import { Component, ElementRef, HostListener, OnInit, ViewChild, signal, computed, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { ApiService, Garden, Bed, GardenPart, Growing, Plant, Location, Month, PartType, PlanFootprint, ActivityName, SourceGrowing, Seed, GrowingActivity } from '../../services/api.service';
import { Observable } from 'rxjs';
import { SeedModal } from '../seed-modal/seed-modal';

const PART_TYPE_META: Readonly<
  Record<PartType, { displayName: string; color: string; icon: string }>
> = {
  bed: { displayName: 'Bed', color: '#8b4513', icon: 'fa-solid fa-seedling' },
  path: { displayName: 'Pad', color: '#374151', icon: 'fa-solid fa-road' },
  embankment: { displayName: 'Talud', color: '#1f2937', icon: 'fa-solid fa-mountain' },
  water_tank: { displayName: 'Tank', color: '#0284c7', icon: 'fa-solid fa-droplet' },
  shed: { displayName: 'Schuur', color: '#166534', icon: 'fa-solid fa-warehouse' },
  greenhouse: { displayName: 'Kas', color: '#15803d', icon: 'fa-solid fa-house-chimney-window' }
} as const;

interface FootprintRect {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'bed' | 'growing' | 'path' | 'embankment' | 'water_tank' | 'shed' | 'greenhouse';
  partName?: string;
  partType?: PartType;
  pathMatter?: string;
  warningLevel?: 'none' | 'warning' | 'danger';
  warningText?: string;
  warningSourceGardenName?: string;
  bedName?: string;
  growingIndex?: number;
  bedX?: number;
  bedY?: number;
  bedWidth?: number;
  bedHeight?: number;
}

interface PartPaletteItem {
  type: PartType;
  label: string;
  icon: string;
}

interface ToolbarButtonStyle {
  [key: string]: string;
}

interface BasePartForm {
  name: string;
  x_cm: number;
  y_cm: number;
  width_cm: number;
  height_cm: number;
}

interface PreferredWindow {
  start: Date;
  midpoint: Date;
  end: Date;
}

interface GrowingWarningResult {
  level: 'none' | 'warning' | 'danger';
  text?: string;
  sourceGardenName?: string;
}

interface SourceGrowingContext {
  growing: Growing;
  location?: string;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface DragResizeState {
  mode: 'drag' | 'resize';
  resizeHandle?: ResizeHandle;
  targetType: 'part' | 'growing';
  partType?: PartType;
  partName?: string;
  bedName?: string;
  growingIndex?: number;
  initialMouse: { x: number; y: number };
  initialFootprint: {
    position: { x_cm: number; y_cm: number };
    width_cm: number;
    height_cm: number;
  };
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  snapshotParts: GardenPart[];
  hasChanges: boolean;
}

interface EditingPartState {
  partType: PartType;
  partName: string;
}

interface EmptyBedCell {
  id: string;
  bedName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  localX: number;
  localY: number;
}

interface GrowingTargetState {
  mode: 'add' | 'edit';
  bedName: string;
  localX: number;
  localY: number;
  width: number;
  height: number;
  growingIndex?: number;
  warningText?: string;
  warningSourceGardenName?: string;
}

interface GrowingActivityFormItem {
  date: string;
  name: ActivityName;
}

type GrowingSourceType = 'none' | 'source_growing' | 'seed';

interface GrowingFormState {
  plant_id: string;
  year: number;
  source_type: GrowingSourceType;
  source_garden_name: string;
  source_bed_name: string;
  seed_selection_key: string;
  activities: GrowingActivityFormItem[];
}

@Component({
  selector: 'app-garden-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgbModalModule],
  templateUrl: './garden-detail.html',
  styleUrls: ['./garden-detail.scss']
})
export class GardenDetail implements OnInit {
  @ViewChild('mapSvg') mapSvg?: ElementRef<SVGSVGElement>;
  @ViewChild('bedModal') bedModalRef!: TemplateRef<unknown>;
  @ViewChild('activityModal') activityModalRef!: TemplateRef<unknown>;

  activityForm: GrowingActivityFormItem = { date: '', name: 'Seeding' };

  garden = signal<Garden | null>(null);
  allGardens = signal<Garden[]>([]);
  localParts = signal<GardenPart[]>([]);
  seeds = signal<Seed[]>([]);
  plantsByCommonName = signal<Record<string, Plant>>({});
  webshopOptions = signal<string[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  growingModalError = signal<string | null>(null);
  isDetailsCollapsed = signal(true);
  growingTarget = signal<GrowingTargetState | null>(null);
  dragResizeState = signal<DragResizeState | null>(null);
  editingPart = signal<EditingPartState | null>(null);
  suppressNextPartClick = signal(false);
  readonly growingLabelFontSize = 13;
  readonly growingLabelLineHeight = 15;
  readonly partTypeMeta = PART_TYPE_META;
  readonly partPalette: PartPaletteItem[] = [
    { type: 'bed', label: PART_TYPE_META.bed.displayName, icon: PART_TYPE_META.bed.icon },
    { type: 'path', label: PART_TYPE_META.path.displayName, icon: PART_TYPE_META.path.icon },
    { type: 'embankment', label: PART_TYPE_META.embankment.displayName, icon: PART_TYPE_META.embankment.icon },
    { type: 'water_tank', label: PART_TYPE_META.water_tank.displayName, icon: PART_TYPE_META.water_tank.icon },
    { type: 'shed', label: PART_TYPE_META.shed.displayName, icon: PART_TYPE_META.shed.icon },
    { type: 'greenhouse', label: PART_TYPE_META.greenhouse.displayName, icon: PART_TYPE_META.greenhouse.icon }
  ];

  readonly resizeHandleSize = 8;
  readonly footprintGridSizeCm = 50;
  readonly locations: Location[] = ['binnen', 'kas', 'buiten'];
  readonly activityNames: ActivityName[] = ['Seeding', 'Planting', 'Reaping', 'Pruning'];

  bedForm = { ...this.defaultBaseForm(), mulched: false, texture: 'compost', drainage: 'goed drainerend', richness: 'rijk', ph: 'neutraal', notes: '' };
  pathForm = { ...this.defaultBaseForm(), path_matter: 'houtsnippers' };
  embankmentForm = { ...this.defaultBaseForm(), mulched: false, texture: 'compost', drainage: 'goed drainerend', richness: 'rijk', ph: 'neutraal', notes: '', pitch_degrees: 30 };
  waterTankForm = { ...this.defaultBaseForm(), capacity_liters: 200 };
  shedForm = { ...this.defaultBaseForm(), has_workbench: false };
  greenhouseForm = { ...this.defaultBaseForm(), wall_type: 'glas' };
  growingForm: GrowingFormState = this.createDefaultGrowingForm();

  readonly months: Month[] = ['jan', 'feb', 'maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  private readonly monthOrder: Month[] = this.months;
  private readonly monthToIndex: Record<Month, number> = {
    jan: 0,
    feb: 1,
    maa: 2,
    apr: 3,
    mei: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    okt: 9,
    nov: 10,
    dec: 11
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private modalService: NgbModal
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const gardenName = params.get('gardenName');
      if (!gardenName) {
        this.error.set('Garden not found');
        return;
      }

      this.loadGarden(gardenName);
    });

    this.api.getPlants().subscribe({
      next: (plants) => {
        const mapped: Record<string, Plant> = {};
        plants.forEach((plant) => {
          if (plant.common_name) {
            mapped[plant.common_name] = plant;
          }
        });
        this.plantsByCommonName.set(mapped);
      }
    });

    this.api.getGardens().subscribe({
      next: (gardens) => {
        this.allGardens.set(Array.isArray(gardens) ? gardens : []);
      }
    });

    this.api.getSeeds().subscribe({
      next: (seeds) => {
        this.seeds.set(Array.isArray(seeds) ? seeds : []);
      }
    });

    this.api.getWebshops().subscribe({
      next: (shops) => {
        const names = (Array.isArray(shops) ? shops : [])
          .map((shop) => shop?.name)
          .filter((name): name is string => !!name);
        this.webshopOptions.set(names);
      }
    });
  }

  private loadGarden(gardenName: string) {
    this.loading.set(true);
    this.error.set(null);

    this.api.getGarden(gardenName).subscribe({
      next: (garden) => {
        this.localParts.set([...(garden.parts ?? [])]);
        this.garden.set(garden);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load garden');
        this.loading.set(false);
      }
    });
  }

  viewBox = computed(() => {
    const garden = this.garden();
    const width = garden?.width_cm ?? 0;
    const height = garden?.height_cm ?? 0;
    return `0 0 ${width} ${height}`;
  });

  footprints = computed<FootprintRect[]>(() => {
    const garden = this.garden();
    const parts = this.localParts();
    if (!garden || !parts.length) return [];

    const rects: FootprintRect[] = [];

    const collectPartRectangles = (part: GardenPart) => {
      const partRect = this.buildPartRect(part);
      if (partRect) {
        rects.push(partRect);
      }

      if (this.isBed(part)) {
        part.growings?.forEach((growing, index) => {
          const growingRect = this.buildGrowingRect(part, growing, index, garden.location);
          if (growingRect) {
            rects.push(growingRect);
          }
        });
      }

      if (this.isPath(part) && Array.isArray(part.branches)) {
        part.branches.forEach((branch) => collectPartRectangles(branch));
      }
    };

    parts.forEach((part) => collectPartRectangles(part));

    return rects;
  });

  emptyBedCells = computed<EmptyBedCell[]>(() => {
    const parts = this.localParts();
    if (!parts.length) {
      return [];
    }

    const cells: EmptyBedCell[] = [];

    const collectBedCells = (part: GardenPart) => {
      if (part?.part_type === 'bed') {
        cells.push(...this.buildEmptyBedCells(part));
      }

      if (Array.isArray(part?.branches)) {
        part.branches.forEach((branch) => collectBedCells(branch));
      }
    };

    parts.forEach((part) => collectBedCells(part));

    return cells;
  });

  plantIds = computed<string[]>(() => {
    return Object.keys(this.plantsByCommonName()).sort((a, b) => a.localeCompare(b));
  });

  onDragPartType(event: DragEvent, partType: PartType) {
    if (!event.dataTransfer) {
      return;
    }

    event.dataTransfer.setData('text/part_type', partType);
    event.dataTransfer.effectAllowed = 'copy';
  }

  onCanvasDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onCanvasDrop(
    event: DragEvent,
    bedModal: TemplateRef<unknown>,
    pathModal: TemplateRef<unknown>,
    embankmentModal: TemplateRef<unknown>,
    waterTankModal: TemplateRef<unknown>,
    shedModal: TemplateRef<unknown>,
    greenhouseModal: TemplateRef<unknown>
  ) {
    event.preventDefault();

    const garden = this.garden();
    const target = event.currentTarget as HTMLElement | null;
    const partType = event.dataTransfer?.getData('text/part_type') as PartType | undefined;

    if (!garden || !target || !partType) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(bounds.width, (event.clientX - bounds.left)));
    const relativeY = Math.max(0, Math.min(bounds.height, (event.clientY - bounds.top)));

    const gardenWidthCm = garden.width_cm ?? 0;
    const gardenHeightCm = garden.height_cm ?? 0;
    const rawTopLeftX = Math.round((relativeX / bounds.width) * gardenWidthCm);
    const rawTopLeftY = Math.round((relativeY / bounds.height) * gardenHeightCm);

    const snappedTopLeftX = this.snapToGrid(rawTopLeftX, this.footprintGridSizeCm);
    const snappedTopLeftY = this.snapToGrid(rawTopLeftY, this.footprintGridSizeCm);

    const defaultPartSize = this.footprintGridSizeCm;
    const maxGridX = Math.max(0, Math.floor((gardenWidthCm - defaultPartSize) / this.footprintGridSizeCm) * this.footprintGridSizeCm);
    const maxGridY = Math.max(0, Math.floor((gardenHeightCm - defaultPartSize) / this.footprintGridSizeCm) * this.footprintGridSizeCm);

    const xCm = Math.max(0, Math.min(maxGridX, snappedTopLeftX));
    const yCm = Math.max(0, Math.min(maxGridY, snappedTopLeftY));

    this.openPartTypeModal(partType, { bedModal, pathModal, embankmentModal, waterTankModal, shedModal, greenhouseModal }, xCm, yCm);
  }

  onMapRectClick(
    rect: FootprintRect,
    templates: {
      bedModal: TemplateRef<unknown>;
      pathModal: TemplateRef<unknown>;
      embankmentModal: TemplateRef<unknown>;
      waterTankModal: TemplateRef<unknown>;
      shedModal: TemplateRef<unknown>;
      greenhouseModal: TemplateRef<unknown>;
    },
    growingModal: TemplateRef<unknown>
  ) {
    if (this.suppressNextPartClick()) {
      this.suppressNextPartClick.set(false);
      return;
    }

    if (rect.type === 'growing') {
      this.openEditGrowingModal(rect, growingModal);
      return;
    }

    if (this.isEditablePartRect(rect)) {
      this.openPartEditModal(rect, templates);
    }
  }

  onPartDragStart(event: MouseEvent, rect: FootprintRect) {
    if (!this.isDraggableRect(rect)) {
      return;
    }

    const mouse = this.getMapMousePosition(event);
    if (!mouse) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const bounds = this.getRectInteractionBounds(rect);
    if (!bounds) {
      return;
    }

    const identity = this.getRectInteractionIdentity(rect);
    if (!identity) {
      return;
    }

    this.dragResizeState.set({
      mode: 'drag',
      ...identity,
      initialMouse: mouse,
      initialFootprint: {
        position: { x_cm: rect.x, y_cm: rect.y },
        width_cm: rect.width,
        height_cm: rect.height
      },
      bounds,
      snapshotParts: this.localParts(),
      hasChanges: false
    });
  }

  onPartResizeStart(event: MouseEvent, rect: FootprintRect, handle: ResizeHandle = 'se') {
    if (!this.isDraggableRect(rect)) {
      return;
    }

    const mouse = this.getMapMousePosition(event);
    if (!mouse) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const bounds = this.getRectInteractionBounds(rect);
    if (!bounds) {
      return;
    }

    const identity = this.getRectInteractionIdentity(rect);
    if (!identity) {
      return;
    }

    this.dragResizeState.set({
      mode: 'resize',
      resizeHandle: handle,
      ...identity,
      initialMouse: mouse,
      initialFootprint: {
        position: { x_cm: rect.x, y_cm: rect.y },
        width_cm: rect.width,
        height_cm: rect.height
      },
      bounds,
      snapshotParts: this.localParts(),
      hasChanges: false
    });
  }

  onMapPointerMove(event: MouseEvent) {
    const interaction = this.dragResizeState();
    const garden = this.garden();

    if (!interaction || !garden) {
      return;
    }

    const mouse = this.getMapMousePosition(event);
    if (!mouse) {
      return;
    }

    const deltaX = mouse.x - interaction.initialMouse.x;
    const deltaY = mouse.y - interaction.initialMouse.y;

    const baseX = interaction.initialFootprint.position.x_cm;
    const baseY = interaction.initialFootprint.position.y_cm;
    const baseWidth = interaction.initialFootprint.width_cm;
    const baseHeight = interaction.initialFootprint.height_cm;
    const bounds = interaction.bounds;

    const gridSize = this.footprintGridSizeCm;
    const minSize = gridSize;
    let nextX = baseX;
    let nextY = baseY;
    let nextWidth = baseWidth;
    let nextHeight = baseHeight;

    if (interaction.mode === 'drag') {
      const snappedX = this.snapToGrid(baseX + deltaX, gridSize);
      const snappedY = this.snapToGrid(baseY + deltaY, gridSize);

      nextX = Math.max(bounds.minX, Math.min(bounds.maxX - baseWidth, snappedX));
      nextY = Math.max(bounds.minY, Math.min(bounds.maxY - baseHeight, snappedY));
    } else {
      const initialLeft = baseX;
      const initialTop = baseY;
      const initialRight = baseX + baseWidth;
      const initialBottom = baseY + baseHeight;

      let nextLeft = initialLeft;
      let nextTop = initialTop;
      let nextRight = initialRight;
      let nextBottom = initialBottom;

      const handle = interaction.resizeHandle ?? 'se';

      if (handle.includes('w')) {
        const snappedLeft = this.snapToGrid(initialLeft + deltaX, gridSize);
        nextLeft = Math.max(bounds.minX, Math.min(initialRight - minSize, snappedLeft));
      }

      if (handle.includes('e')) {
        const snappedRight = this.snapToGrid(initialRight + deltaX, gridSize);
        nextRight = Math.max(initialLeft + minSize, Math.min(bounds.maxX, snappedRight));
      }

      if (handle.includes('n')) {
        const snappedTop = this.snapToGrid(initialTop + deltaY, gridSize);
        nextTop = Math.max(bounds.minY, Math.min(initialBottom - minSize, snappedTop));
      }

      if (handle.includes('s')) {
        const snappedBottom = this.snapToGrid(initialBottom + deltaY, gridSize);
        nextBottom = Math.max(initialTop + minSize, Math.min(bounds.maxY, snappedBottom));
      }

      nextX = nextLeft;
      nextY = nextTop;
      nextWidth = nextRight - nextLeft;
      nextHeight = nextBottom - nextTop;

      if (nextWidth < minSize || nextHeight < minSize) {
        return;
      }
    }

    const nextFootprint: PlanFootprint = {
      position: { x_cm: Math.round(nextX), y_cm: Math.round(nextY) },
      width_cm: Math.round(nextWidth),
      height_cm: Math.round(nextHeight)
    };

    const currentParts = this.localParts();
    let nextParts: GardenPart[] | null = null;

    if (interaction.targetType === 'part') {
      if (!interaction.partType || !interaction.partName) {
        return;
      }

      nextParts = this.withUpdatedPartFootprint(
        currentParts,
        interaction.partType,
        interaction.partName,
        nextFootprint
      );

      if (!nextParts || !this.isPartLayoutValid(nextParts, interaction.partType, interaction.partName)) {
        return;
      }
    } else {
      if (!interaction.bedName || interaction.growingIndex === undefined) {
        return;
      }

      nextParts = this.withUpdatedGrowingFootprint(
        currentParts,
        interaction.bedName,
        interaction.growingIndex,
        nextFootprint
      );

      if (!nextParts || !this.isGrowingLayoutValid(nextParts, interaction.bedName)) {
        return;
      }
    }

    this.localParts.set(nextParts);
    this.garden.update((current) => current ? ({ ...current, parts: nextParts }) : current);

    this.dragResizeState.set({
      ...interaction,
      hasChanges: true
    });
  }

  onMapPointerUp() {
    const interaction = this.dragResizeState();
    const garden = this.garden();

    if (!interaction || !garden?.name) {
      this.dragResizeState.set(null);
      return;
    }

    this.dragResizeState.set(null);

    if (!interaction.hasChanges) {
      return;
    }

    this.suppressNextPartClick.set(true);

    if (interaction.targetType === 'part') {
      if (!interaction.partType || !interaction.partName) {
        return;
      }

      const updatedPart = this.findPartByIdentity(this.localParts(), interaction.partType, interaction.partName);
      if (!updatedPart?.position || updatedPart.width_cm === undefined || updatedPart.height_cm === undefined) {
        this.localParts.set(interaction.snapshotParts);
        this.garden.update((current) => current ? ({ ...current, parts: interaction.snapshotParts }) : current);
        return;
      }

      const footprint: PlanFootprint = {
        position: {
          x_cm: updatedPart.position.x_cm,
          y_cm: updatedPart.position.y_cm
        },
        width_cm: updatedPart.width_cm,
        height_cm: updatedPart.height_cm,
        rotation_deg: updatedPart.rotation_deg
      };

      this.api.updateGardenPartFootprint(garden.name, interaction.partName, interaction.partType, footprint).subscribe({
        next: (updatedGarden) => {
          if (Array.isArray(updatedGarden?.parts)) {
            this.localParts.set(updatedGarden.parts);
            this.garden.set(updatedGarden);
          }
        },
        error: (err) => {
          this.localParts.set(interaction.snapshotParts);
          this.garden.update((current) => current ? ({ ...current, parts: interaction.snapshotParts }) : current);
          const backendMessage = err?.error?.error;
          this.error.set(
            typeof backendMessage === 'string'
              ? `Failed to persist part footprint update: ${backendMessage}`
              : 'Failed to persist part footprint update'
          );
        }
      });

      return;
    }

    if (!interaction.bedName) {
      return;
    }

    const updatedBed = this.findBedByName(this.localParts(), interaction.bedName);
    if (!updatedBed || !Array.isArray(updatedBed.growings)) {
      this.localParts.set(interaction.snapshotParts);
      this.garden.update((current) => current ? ({ ...current, parts: interaction.snapshotParts }) : current);
      return;
    }

    this.api.patchBed(garden.name, interaction.bedName, { growings: updatedBed.growings }).subscribe({
      next: (updatedGarden) => {
        if (Array.isArray(updatedGarden?.parts)) {
          this.localParts.set(updatedGarden.parts);
          this.garden.set(updatedGarden);
        }
      },
      error: (err) => {
        this.localParts.set(interaction.snapshotParts);
        this.garden.update((current) => current ? ({ ...current, parts: interaction.snapshotParts }) : current);
        const backendMessage = err?.error?.error;
        this.error.set(
          typeof backendMessage === 'string'
            ? `Failed to persist growing footprint update: ${backendMessage}`
            : 'Failed to persist growing footprint update'
        );
      }
    });
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowPointerMove(event: MouseEvent) {
    this.onMapPointerMove(event);
  }

  @HostListener('window:mouseup')
  onWindowPointerUp() {
    this.onMapPointerUp();
  }

  openPartTypeModal(
    partType: PartType,
    templates: {
      bedModal: TemplateRef<unknown>;
      pathModal: TemplateRef<unknown>;
      embankmentModal: TemplateRef<unknown>;
      waterTankModal: TemplateRef<unknown>;
      shedModal: TemplateRef<unknown>;
      greenhouseModal: TemplateRef<unknown>;
    },
    xCm = 0,
    yCm = 0
  ) {
    this.editingPart.set(null);
    this.initializePartForm(partType, xCm, yCm);

    const templateByType: Record<PartType, TemplateRef<unknown>> = {
      bed: templates.bedModal,
      path: templates.pathModal,
      embankment: templates.embankmentModal,
      water_tank: templates.waterTankModal,
      shed: templates.shedModal,
      greenhouse: templates.greenhouseModal
    };

    this.modalService.open(templateByType[partType], {
      centered: true,
      size: 'lg',
      windowClass: `part-modal part-modal-${partType}`
    });
  }

  isEditingPartType(partType: PartType): boolean {
    return this.editingPart()?.partType === partType;
  }

  getPartModalTitle(partType: PartType): string {
    const action = this.isEditingPartType(partType) ? 'Bewerk' : 'Nieuw';
    return `${action} ${this.partTypeMeta[partType].displayName}`;
  }

  getPartSubmitLabel(partType: PartType): string {
    return this.isEditingPartType(partType) ? 'Opslaan' : `${this.partTypeMeta[partType].displayName} toevoegen`;
  }

  createBed(modal: { close: () => void }) {
    const editing = this.editingPart();

    if (editing?.partType === 'bed') {
      const request = this.api.patchBed(this.garden()!.name, editing.partName, {
        mulched: this.bedForm.mulched,
        soil: {
          texture: this.bedForm.texture as GardenPart['soil'] extends infer S ? any : never,
          drainage: this.bedForm.drainage as GardenPart['soil'] extends infer S ? any : never,
          richness: this.bedForm.richness as GardenPart['soil'] extends infer S ? any : never,
          ph: this.bedForm.ph as GardenPart['soil'] extends infer S ? any : never,
          notes: this.bedForm.notes
        }
      });

      this.persistUniquePatch(request, 'Failed to patch bed');
      this.editingPart.set(null);
      modal.close();
      return;
    }

    const part: GardenPart = {
      part_type: 'bed',
      name: this.bedForm.name,
      position: { x_cm: this.bedForm.x_cm, y_cm: this.bedForm.y_cm },
      width_cm: this.bedForm.width_cm,
      height_cm: this.bedForm.height_cm,
      mulched: this.bedForm.mulched,
      soil: {
        texture: this.bedForm.texture as GardenPart['soil'] extends infer S ? any : never,
        drainage: this.bedForm.drainage as GardenPart['soil'] extends infer S ? any : never,
        richness: this.bedForm.richness as GardenPart['soil'] extends infer S ? any : never,
        ph: this.bedForm.ph as GardenPart['soil'] extends infer S ? any : never,
        notes: this.bedForm.notes
      },
      growings: []
    };
    this.addPart(part);
    modal.close();
  }

  createPath(modal: { close: () => void }) {
    const editing = this.editingPart();

    if (editing?.partType === 'path') {
      const request = this.api.patchPath(this.garden()!.name, editing.partName, {
        path_matter: this.pathForm.path_matter as 'beton' | 'houtsnippers'
      });

      this.persistUniquePatch(request, 'Failed to patch path');
      this.editingPart.set(null);
      modal.close();
      return;
    }

    const part: GardenPart = {
      part_type: 'path',
      name: this.pathForm.name,
      position: { x_cm: this.pathForm.x_cm, y_cm: this.pathForm.y_cm },
      width_cm: this.pathForm.width_cm,
      height_cm: this.pathForm.height_cm,
      path_matter: this.pathForm.path_matter as GardenPart['path_matter'],
      branches: []
    };
    this.addPart(part);
    modal.close();
  }

  createEmbankment(modal: { close: () => void }) {
    const editing = this.editingPart();

    if (editing?.partType === 'embankment') {
      const request = this.api.patchEmbankment(this.garden()!.name, editing.partName, {
        pitch_degrees: this.embankmentForm.pitch_degrees
      });

      this.persistUniquePatch(request, 'Failed to patch embankment');
      this.editingPart.set(null);
      modal.close();
      return;
    }

    const part: GardenPart = {
      part_type: 'embankment',
      name: this.embankmentForm.name,
      position: { x_cm: this.embankmentForm.x_cm, y_cm: this.embankmentForm.y_cm },
      width_cm: this.embankmentForm.width_cm,
      height_cm: this.embankmentForm.height_cm,
      mulched: this.embankmentForm.mulched,
      pitch_degrees: this.embankmentForm.pitch_degrees,
      soil: {
        texture: this.embankmentForm.texture as GardenPart['soil'] extends infer S ? any : never,
        drainage: this.embankmentForm.drainage as GardenPart['soil'] extends infer S ? any : never,
        richness: this.embankmentForm.richness as GardenPart['soil'] extends infer S ? any : never,
        ph: this.embankmentForm.ph as GardenPart['soil'] extends infer S ? any : never,
        notes: this.embankmentForm.notes
      },
      growings: []
    };
    this.addPart(part);
    modal.close();
  }

  createWaterTank(modal: { close: () => void }) {
    const editing = this.editingPart();
    const capacityLiters = Number(this.waterTankForm.capacity_liters);

    if (!Number.isFinite(capacityLiters)) {
      this.error.set('capacity_liters must be a valid number');
      return;
    }

    if (editing?.partType === 'water_tank') {
      const request = this.api.patchWaterTank(this.garden()!.name, editing.partName, {
        capacity_liters: capacityLiters
      });

      this.persistUniquePatch(request, 'Failed to patch water tank');
      this.editingPart.set(null);
      modal.close();
      return;
    }

    const part: GardenPart = {
      part_type: 'water_tank',
      name: this.waterTankForm.name,
      position: { x_cm: this.waterTankForm.x_cm, y_cm: this.waterTankForm.y_cm },
      width_cm: this.waterTankForm.width_cm,
      height_cm: this.waterTankForm.height_cm,
      capacity_liters: capacityLiters
    };
    this.addPart(part);
    modal.close();
  }

  createShed(modal: { close: () => void }) {
    const editing = this.editingPart();

    if (editing?.partType === 'shed') {
      const request = this.api.patchShed(this.garden()!.name, editing.partName, {
        has_workbench: this.shedForm.has_workbench
      });

      this.persistUniquePatch(request, 'Failed to patch shed');
      this.editingPart.set(null);
      modal.close();
      return;
    }

    const part: GardenPart = {
      part_type: 'shed',
      name: this.shedForm.name,
      position: { x_cm: this.shedForm.x_cm, y_cm: this.shedForm.y_cm },
      width_cm: this.shedForm.width_cm,
      height_cm: this.shedForm.height_cm,
      has_workbench: this.shedForm.has_workbench
    };
    this.addPart(part);
    modal.close();
  }

  createGreenhouse(modal: { close: () => void }) {
    const editing = this.editingPart();
    const wallType = this.greenhouseForm.wall_type?.trim() || 'glas';

    if (editing?.partType === 'greenhouse') {
      const request = this.api.patchGreenhouse(this.garden()!.name, editing.partName, {
        wall_type: wallType
      });

      this.persistUniquePatch(request, 'Failed to patch greenhouse');
      this.editingPart.set(null);
      modal.close();
      return;
    }

    const part: GardenPart = {
      part_type: 'greenhouse',
      name: this.greenhouseForm.name,
      position: { x_cm: this.greenhouseForm.x_cm, y_cm: this.greenhouseForm.y_cm },
      width_cm: this.greenhouseForm.width_cm,
      height_cm: this.greenhouseForm.height_cm,
      wall_type: wallType
    };
    this.addPart(part);
    modal.close();
  }

  deleteEditingPart(modal: { close: () => void }, expectedType: PartType) {
    const garden = this.garden();
    const editing = this.editingPart();

    if (!garden?.name || !editing || editing.partType !== expectedType) {
      return;
    }

    this.api.deleteGardenPart(garden.name, editing.partName, editing.partType).subscribe({
      next: (updatedGarden) => {
        if (Array.isArray(updatedGarden?.parts)) {
          this.localParts.set(updatedGarden.parts);
          this.garden.set(updatedGarden);
        }
        this.editingPart.set(null);
        modal.close();
      },
      error: () => {
        this.error.set('Verwijderen van object mislukt');
      }
    });
  }

  getGrowingLabelLines(rect: FootprintRect): string[] {
    if (rect.type !== 'growing' || !rect.label) {
      return [];
    }

    const cleaned = rect.label.replace(/[-_]+/g, ' ').trim();
    if (!cleaned) {
      return [];
    }

    const maxCharsPerLine = Math.max(1, Math.floor(rect.width / (this.growingLabelFontSize * 0.58)));
    const maxLines = Math.max(1, Math.floor((rect.height - 8) / this.growingLabelLineHeight));
    const variantName = this.getGrowingVariantName(rect);

    if (variantName) {
      const mainLine = this.fitTextToLine(cleaned, maxCharsPerLine);
      if (maxLines >= 2) {
        return [mainLine, this.fitTextToLine(variantName, maxCharsPerLine)];
      }
      return [mainLine];
    }

    const words = cleaned.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
      if (word.length > maxCharsPerLine) {
        if (current) {
          lines.push(current);
          current = '';
        }

        for (let index = 0; index < word.length; index += maxCharsPerLine) {
          lines.push(word.slice(index, index + maxCharsPerLine));
        }
        return;
      }

      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    });

    if (current) {
      lines.push(current);
    }

    if (lines.length <= maxLines) {
      return lines;
    }

    return lines.slice(0, maxLines);
  }

  private fitTextToLine(text: string, maxChars: number): string {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length <= maxChars) {
      return trimmed;
    }

    if (maxChars <= 3) {
      return trimmed.slice(0, maxChars);
    }

    return `${trimmed.slice(0, maxChars - 3)}...`;
  }

  private getGrowingVariantName(rect: FootprintRect): string | undefined {
    if (rect.type !== 'growing' || !rect.bedName || rect.growingIndex === undefined) {
      return undefined;
    }

    const bed = this.findPartByIdentity(this.localParts(), 'bed', rect.bedName);
    if (!bed || bed.part_type !== 'bed' || !Array.isArray(bed.growings)) {
      return undefined;
    }

    const growing = bed.growings[rect.growingIndex];
    if (!growing) {
      return undefined;
    }

    return this.resolveGrowingVariantName(growing, new Set<string>());
  }

  private resolveGrowingVariantName(growing: Growing, visited: Set<string>): string | undefined {
    const source = growing.source;
    if (!source) {
      return undefined;
    }

    if (this.isSeed(source)) {
      const variantName = source.variant_name?.trim();
      if (variantName) {
        return variantName;
      }

      return this.findVariantNameForSeedSource(source);
    }

    if (!this.isSourceGrowing(source)) {
      return undefined;
    }

    const sourceKey = `${source.garden_name ?? ''}|${source.bed_name ?? ''}|${growing.plant_id ?? ''}`;
    if (visited.has(sourceKey)) {
      return undefined;
    }
    visited.add(sourceKey);

    const sourceContext = this.findSourceGrowingContext(source, growing.plant_id);
    if (!sourceContext) {
      return undefined;
    }

    return this.resolveGrowingVariantName(sourceContext.growing, visited);
  }

  private findSourceGrowingRecord(source: SourceGrowing, plantId?: string): Growing | null {
    return this.findSourceGrowingContext(source, plantId)?.growing ?? null;
  }

  private findSourceGrowingContext(source: SourceGrowing, plantId?: string): SourceGrowingContext | null {
    const gardenName = source.garden_name?.trim();
    const bedName = source.bed_name?.trim();
    if (!gardenName || !bedName) {
      return null;
    }

    const currentGarden = this.garden();
    const sourceGarden = currentGarden?.name === gardenName
      ? currentGarden
      : this.allGardens().find((garden) => garden.name === gardenName);
    const parts = sourceGarden?.name === currentGarden?.name
      ? this.localParts()
      : (sourceGarden?.parts ?? []);

    const bed = this.findBedByName(parts, bedName);
    if (!bed || !Array.isArray(bed.growings)) {
      return null;
    }

    const byPlant = plantId
      ? bed.growings.filter((item) => item?.plant_id === plantId)
      : bed.growings;
    const candidates = byPlant.filter((item): item is Growing => !!item);

    if (!candidates.length) {
      return null;
    }

    const withVariantSeed = candidates.find((item) => {
      const seedSource = item.source;
      return !!seedSource && this.isSeed(seedSource) && !!seedSource.variant_name?.trim();
    });
    if (withVariantSeed) {
      return {
        growing: withVariantSeed,
        location: sourceGarden?.location
      };
    }

    const withSourceGrowing = candidates.find((item) => {
      const src = item.source;
      return !!src && this.isSourceGrowing(src);
    });
    if (withSourceGrowing) {
      return {
        growing: withSourceGrowing,
        location: sourceGarden?.location
      };
    }

    const selectedGrowing = [...candidates].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0] ?? null;
    if (!selectedGrowing) {
      return null;
    }

    return {
      growing: selectedGrowing,
      location: sourceGarden?.location
    };
  }

  private findVariantNameForSeedSource(sourceSeed: Seed): string | undefined {
    const allSeeds = this.seeds();
    if (!allSeeds.length) {
      return undefined;
    }

    const exact = allSeeds.find((seed) =>
      seed.plant_id === sourceSeed.plant_id &&
      seed.valid_until_year === sourceSeed.valid_until_year &&
      (seed.bought_on ?? '') === (sourceSeed.bought_on ?? '') &&
      (seed.webshop_name ?? '') === (sourceSeed.webshop_name ?? '') &&
      (seed.product_url ?? '') === (sourceSeed.product_url ?? '') &&
      !!seed.variant_name?.trim()
    );

    if (exact?.variant_name?.trim()) {
      return exact.variant_name.trim();
    }

    const byProduct = allSeeds.find((seed) =>
      !!seed.product_url &&
      seed.product_url === sourceSeed.product_url &&
      seed.plant_id === sourceSeed.plant_id &&
      !!seed.variant_name?.trim()
    );

    if (byProduct?.variant_name?.trim()) {
      return byProduct.variant_name.trim();
    }

    const byPlantAndYear = allSeeds.find((seed) =>
      seed.plant_id === sourceSeed.plant_id &&
      seed.valid_until_year === sourceSeed.valid_until_year &&
      !!seed.variant_name?.trim()
    );

    return byPlantAndYear?.variant_name?.trim() || undefined;
  }

  getGrowingLabelStartY(rect: FootprintRect, lineCount: number): number {
    if (lineCount <= 0) {
      return rect.y + (rect.height / 2);
    }

    const totalHeight = (lineCount - 1) * this.growingLabelLineHeight;
    return rect.y + (rect.height / 2) - (totalHeight / 2);
  }

  getGrowingRectClass(rect: FootprintRect): string {
    if (rect.type !== 'growing') {
      return 'map-rect-pointer';
    }

    return rect.warningText ? 'growing-rect map-rect-pointer growing-rect-clickable' : 'growing-rect map-rect-pointer';
  }

  getGrowingWarningIconClass(rect: FootprintRect): string {
    if (rect.type !== 'growing' || !rect.warningText) {
      return 'growing-warning-icon';
    }

    if (rect.warningLevel === 'danger') {
      return 'growing-warning-icon growing-warning-icon--danger';
    }

    return 'growing-warning-icon growing-warning-icon--warning';
  }

  getPartRectStyle(rect: FootprintRect): ToolbarButtonStyle | null {
    if (rect.type === 'growing') {
      return null;
    }

    const pathColor = rect.pathMatter === 'houtsnippers'
      ? '#8b4513'
      : this.partTypeMeta.path.color;
    const color = rect.type === 'path' ? pathColor : this.partTypeMeta[rect.type].color;
    const strokeWidth = rect.type === 'path' ? '1.2' : rect.type === 'bed' ? '1.5' : '1.4';

    return {
      fill: this.hexToRgba(color, 0.2),
      stroke: color,
      strokeWidth
    };
  }

  getResizeHandleColor(rect: FootprintRect, handle: 'nw' | 'ne' | 'sw' | 'se' = 'se'): string {
    if (rect.type === 'growing') {
      const bedColor = this.partTypeMeta.bed.color; // bruin
      const growingColor = '#4ade80'; // groen
      const touchesLeft = rect.bedX !== undefined && rect.x <= rect.bedX;
      const touchesRight = rect.bedX !== undefined && rect.bedWidth !== undefined && (rect.x + rect.width) >= (rect.bedX + rect.bedWidth);
      const touchesTop = rect.bedY !== undefined && rect.y <= rect.bedY;
      const touchesBottom = rect.bedY !== undefined && rect.bedHeight !== undefined && (rect.y + rect.height) >= (rect.bedY + rect.bedHeight);
      const onLeft = handle === 'nw' || handle === 'sw';
      const onTop = handle === 'nw' || handle === 'ne';
      const touchesBed = (onLeft ? touchesLeft : touchesRight) && (onTop ? touchesTop : touchesBottom);
      return touchesBed ? bedColor : growingColor;
    }
    const pathColor = rect.pathMatter === 'houtsnippers' ? '#8b4513' : this.partTypeMeta.path.color;
    return rect.type === 'path' ? pathColor : this.partTypeMeta[rect.type as PartType]?.color ?? '#6b7280';
  }

  getResizeTarget(rect: FootprintRect, handle: 'nw' | 'ne' | 'sw' | 'se'): FootprintRect {
    if (rect.type !== 'growing' || rect.bedName === undefined) {
      return rect;
    }
    const touchesLeft = rect.bedX !== undefined && rect.x <= rect.bedX;
    const touchesRight = rect.bedX !== undefined && rect.bedWidth !== undefined && (rect.x + rect.width) >= (rect.bedX + rect.bedWidth);
    const touchesTop = rect.bedY !== undefined && rect.y <= rect.bedY;
    const touchesBottom = rect.bedY !== undefined && rect.bedHeight !== undefined && (rect.y + rect.height) >= (rect.bedY + rect.bedHeight);
    const onLeft = handle === 'nw' || handle === 'sw';
    const onTop = handle === 'nw' || handle === 'ne';
    const touchesBed = (onLeft ? touchesLeft : touchesRight) && (onTop ? touchesTop : touchesBottom);
    if (touchesBed) {
      const bedRect = this.footprints().find((r) => r.type === 'bed' && r.partName === rect.bedName);
      if (bedRect) return bedRect;
    }
    return rect;
  }

  isEditablePartRect(rect: FootprintRect): boolean {
    return rect.type !== 'growing' && !!rect.partType && !!rect.partName;
  }

  getPartTypeButtonStyle(partType: PartType): ToolbarButtonStyle {
    const color = this.partTypeMeta[partType].color;

    return {
      color,
      borderColor: color,
      backgroundColor: this.hexToRgba(color, 0.2)
    };
  }

  toggleDetailsCollapse() {
    this.isDetailsCollapsed.update((value) => !value);
  }

  onEmptyCellMouseDown(event: MouseEvent, cell: EmptyBedCell) {
    const bedRect = this.footprints().find((r) => r.type === 'bed' && r.partName === cell.bedName);
    if (!bedRect) {
      return;
    }

    const mouse = this.getMapMousePosition(event);
    const hs = this.resizeHandleSize;

    if (mouse) {
      const inLeft = mouse.x <= bedRect.x + hs;
      const inRight = mouse.x >= bedRect.x + bedRect.width - hs;
      const inTop = mouse.y <= bedRect.y + hs;
      const inBottom = mouse.y >= bedRect.y + bedRect.height - hs;

      if (inTop && inLeft) { this.onPartResizeStart(event, bedRect, 'nw'); return; }
      if (inTop && inRight) { this.onPartResizeStart(event, bedRect, 'ne'); return; }
      if (inBottom && inLeft) { this.onPartResizeStart(event, bedRect, 'sw'); return; }
      if (inBottom && inRight) { this.onPartResizeStart(event, bedRect, 'se'); return; }
    }

    this.onPartDragStart(event, bedRect);
  }

  getEmptyCellCursor(cell: EmptyBedCell): string {
    const bed = this.findPartByIdentity(this.localParts(), 'bed', cell.bedName);
    if (!bed || bed.width_cm === undefined || bed.height_cm === undefined) {
      return 'pointer';
    }

    const atLeft = cell.localX === 0;
    const atRight = (cell.localX + cell.width) === bed.width_cm;
    const atTop = cell.localY === 0;
    const atBottom = (cell.localY + cell.height) === bed.height_cm;

    if ((atLeft && atTop) || (atRight && atBottom)) {
      return 'nwse-resize';
    }

    if ((atRight && atTop) || (atLeft && atBottom)) {
      return 'nesw-resize';
    }

    return 'pointer';
  }

  openCreateGrowingModal(cell: EmptyBedCell, content: TemplateRef<unknown>) {
    if (this.suppressNextPartClick()) {
      this.suppressNextPartClick.set(false);
      return;
    }
    this.growingModalError.set(null);
    this.growingTarget.set({
      mode: 'add',
      bedName: cell.bedName,
      localX: cell.localX,
      localY: cell.localY,
      width: cell.width,
      height: cell.height
    });

    this.growingForm = this.createDefaultGrowingForm();

    this.modalService.open(content, {
      centered: true,
      size: 'md',
      windowClass: 'growing-modal'
    });
  }

  openEditGrowingModal(rect: FootprintRect, content: TemplateRef<unknown>) {
    if (rect.type !== 'growing' || !rect.bedName || rect.growingIndex === undefined) {
      return;
    }

    const bed = this.findPartByIdentity(this.localParts(), 'bed', rect.bedName);
    if (!bed || bed.part_type !== 'bed') {
      this.error.set('Bed niet gevonden');
      return;
    }

    const growings = Array.isArray(bed.growings) ? bed.growings : [];
    const growing = growings[rect.growingIndex];
    if (!growing) {
      this.error.set('Teelt niet gevonden');
      return;
    }

    this.growingTarget.set({
      mode: 'edit',
      bedName: rect.bedName,
      localX: growing.position?.x_cm ?? 0,
      localY: growing.position?.y_cm ?? 0,
      width: growing.width_cm ?? this.footprintGridSizeCm,
      height: growing.height_cm ?? this.footprintGridSizeCm,
      growingIndex: rect.growingIndex,
      warningText: rect.warningText,
      warningSourceGardenName: rect.warningSourceGardenName
    });

    this.growingForm = this.createGrowingFormFromGrowing(growing);
    this.growingModalError.set(null);

    this.modalService.open(content, {
      centered: true,
      size: 'md',
      windowClass: 'growing-modal'
    });
  }

  getGrowingModalTitle(): string {
    return this.growingTarget()?.mode === 'edit' ? 'Teelt bewerken' : 'Nieuwe teelt';
  }

  getGrowingSubmitLabel(): string {
    return this.growingTarget()?.mode === 'edit' ? 'Teelt opslaan' : 'Teelt toevoegen';
  }

  isEditingGrowing(): boolean {
    return this.growingTarget()?.mode === 'edit';
  }

  navigateToBed(modal: { dismiss: () => void }) {
    const bedName = this.growingTarget()?.bedName;
    if (!bedName) return;
    const bed = this.findPartByIdentity(this.localParts(), 'bed', bedName);
    if (!bed) return;
    modal.dismiss();
    this.editingPart.set({ partType: 'bed', partName: bedName });
    this.initializePartFormFromPart(bed);
    this.modalService.open(this.bedModalRef, {
      centered: true,
      size: 'lg',
      windowClass: 'part-modal part-modal-bed'
    });
  }

  addGrowingActivity() {
    this.activityForm = { date: new Date().toISOString().slice(0, 10), name: 'Seeding' };
    this.modalService.open(this.activityModalRef, {
      centered: true,
      size: 'sm',
      windowClass: 'activity-modal'
    });
  }

  confirmAddActivity(modal: { close: () => void }) {
    const newActivity: GrowingActivityFormItem = {
      date: this.activityForm.date,
      name: this.activityForm.name
    };

    const target = this.growingTarget();
    const garden = this.garden();

    if (target?.mode === 'edit' && target.growingIndex !== undefined && garden?.name) {
      this.api.addGrowingActivity(garden.name, target.bedName, target.growingIndex, newActivity).subscribe({
        next: (updatedGarden) => {
          if (Array.isArray(updatedGarden?.parts)) {
            this.localParts.set(updatedGarden.parts);
            this.garden.set(updatedGarden);
          }
          this.growingForm.activities = [...this.growingForm.activities, newActivity];
          this.growingModalError.set(null);
          modal.close();
        },
        error: (err) => {
          const backendMessage = err?.error?.error;
          this.growingModalError.set(typeof backendMessage === 'string' ? `Failed to add growing activity: ${backendMessage}` : 'Failed to add growing activity');
        }
      });
      return;
    }

    this.growingForm.activities = [...this.growingForm.activities, newActivity];
    modal.close();
  }

  removeGrowingActivity(index: number) {
    this.growingForm.activities = this.growingForm.activities.filter((_, currentIndex) => currentIndex !== index);
  }

  openSourceGardenFromWarning(modal: { close?: () => void; dismiss?: () => void }, event?: MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();

    const sourceGardenName = this.growingTarget()?.warningSourceGardenName?.trim();
    if (!sourceGardenName) {
      return;
    }

    modal.dismiss?.();
    modal.close?.();

    if (this.garden()?.name === sourceGardenName) {
      return;
    }

    this.router.navigate(['/gardens', sourceGardenName]).then((navigated) => {
      if (!navigated) {
        window.location.assign(`/gardens/${encodeURIComponent(sourceGardenName)}`);
      }
    });
  }

  openNewSeedModal() {
    const plantId = this.growingForm.plant_id.trim();
    if (!plantId) {
      this.growingModalError.set('Selecteer eerst een plant voordat je een nieuw zaad toevoegt');
      return;
    }

    const plant = this.plantsByCommonName()[plantId];
    const modalRef = this.modalService.open(SeedModal, {
      centered: true,
      size: 'md',
      windowClass: 'seed-modal'
    });

    modalRef.componentInstance.plant = plant ?? null;
    modalRef.componentInstance.webshopOptions = this.webshopOptions();
    modalRef.closed.subscribe((createdSeed: Seed) => {
      if (!createdSeed) {
        return;
      }

      this.seeds.update((items) => [...items, createdSeed]);
      this.growingForm.seed_selection_key = this.seedKey(createdSeed);
      this.growingModalError.set(null);
    });
  }

  seedOptionsForSelectedPlant(): Seed[] {
    const plantId = this.growingForm.plant_id.trim();
    if (!plantId) {
      return [];
    }

    return this.seeds().filter((seed) => seed.plant_id === plantId);
  }

  getSeedOptionLabel(seed: Seed): string {
    return `${seed.plant_id}, ${seed.variant_name}, houdbaar tot ${seed.valid_until_year}`;
  }

  getSeedOptionKey(seed: Seed): string {
    return this.seedKey(seed);
  }

  sourceGrowingOptionsForSelectedPlant(): Array<{ gardenName: string; bedName: string }> {
    const plantId = this.growingForm.plant_id.trim();
    if (!plantId) {
      return [];
    }

    const options = new Map<string, { gardenName: string; bedName: string }>();

    this.allGardens().forEach((garden) => {
      const gardenName = garden.name;
      if (!gardenName) {
        return;
      }

      (garden.parts ?? []).forEach((part) => {
        if (part?.part_type !== 'bed' || !part.name) {
          return;
        }

        const hasPlantInBed = (part.growings ?? []).some((growing) => growing?.plant_id === plantId);
        if (!hasPlantInBed) {
          return;
        }

        const key = `${gardenName}|${part.name}`;
        options.set(key, { gardenName, bedName: part.name });
      });
    });

    return Array.from(options.values());
  }

  sourceGrowingGardenOptions(): string[] {
    const gardens = new Set<string>();
    this.sourceGrowingOptionsForSelectedPlant().forEach((option) => gardens.add(option.gardenName));
    return Array.from(gardens).sort((a, b) => a.localeCompare(b));
  }

  sourceGrowingBedOptions(): string[] {
    const selectedGarden = this.growingForm.source_garden_name;
    if (!selectedGarden) {
      return [];
    }

    return this.sourceGrowingOptionsForSelectedPlant()
      .filter((option) => option.gardenName === selectedGarden)
      .map((option) => option.bedName)
      .sort((a, b) => a.localeCompare(b));
  }

  onSourceGrowingGardenChange() {
    const bedOptions = this.sourceGrowingBedOptions();
    if (!bedOptions.includes(this.growingForm.source_bed_name)) {
      this.growingForm.source_bed_name = '';
    }
  }

  onGrowingPlantChange() {
    const seedOptions = this.seedOptionsForSelectedPlant();
    if (!seedOptions.some((seed) => this.seedKey(seed) === this.growingForm.seed_selection_key)) {
      this.growingForm.seed_selection_key = '';
    }

    const beginTeeltOptions = this.sourceGrowingOptionsForSelectedPlant();
    if (!beginTeeltOptions.some((option) => option.gardenName === this.growingForm.source_garden_name)) {
      this.growingForm.source_garden_name = '';
      this.growingForm.source_bed_name = '';
      return;
    }

    if (!beginTeeltOptions.some(
      (option) => option.gardenName === this.growingForm.source_garden_name && option.bedName === this.growingForm.source_bed_name
    )) {
      this.growingForm.source_bed_name = '';
    }
  }

  growingStartPreferredActivitiesForCell(location: Location, month: Month): ActivityName[] {
    const plantId = this.growingForm.plant_id.trim();
    if (!plantId) {
      return [];
    }

    const plant = this.plantsByCommonName()[plantId];
    if (!plant?.preferred_activities?.length) {
      return [];
    }

    return plant.preferred_activities
      .filter((item) => {
        return item.location === location
          && Array.isArray(item.months)
          && item.months.includes(month);
      })
      .map((item) => item.activity_name)
      .filter((activity): activity is ActivityName => !!activity);
  }

  growingStartActivityLabel(activity: ActivityName): string {
    switch (activity) {
      case 'Seeding': return 'Z';
      case 'Planting': return 'P';
      case 'Reaping': return 'O';
      case 'Pruning': return 'S';
      default: return activity;
    }
  }

  growingStartActivityTooltip(activity: ActivityName): string {
    switch (activity) {
      case 'Seeding': return 'Zaaien';
      case 'Planting': return 'Planten';
      case 'Reaping': return 'Oogsten';
      case 'Pruning': return 'Snoeien';
      default: return activity;
    }
  }

  growingStartActivityClass(activity: ActivityName): string {
    switch (activity) {
      case 'Seeding': return 'growing-activity-chip growing-activity-chip--seeding';
      case 'Planting': return 'growing-activity-chip growing-activity-chip--planting';
      case 'Reaping': return 'growing-activity-chip growing-activity-chip--reaping';
      case 'Pruning': return 'growing-activity-chip growing-activity-chip--pruning';
      default: return 'growing-activity-chip';
    }
  }

  saveGrowing(modal: { close: () => void }) {
    this.growingModalError.set(null);
    const garden = this.garden();
    const target = this.growingTarget();
    const plantId = this.growingForm.plant_id.trim();

    if (!garden?.name || !target || !plantId) {
      this.growingModalError.set('Selecteer een plant om te plaatsen');
      return;
    }

    const bed = this.findPartByIdentity(this.localParts(), 'bed', target.bedName);
    if (!bed || bed.part_type !== 'bed') {
      this.growingModalError.set('Bed niet gevonden');
      return;
    }

    const source = this.buildGrowingSourceFromForm(plantId);
    if (source === undefined) {
      return;
    }

    const activities = this.buildGrowingActivitiesFromForm();
    if (activities === undefined) {
      return;
    }

    const currentGrowings = Array.isArray(bed.growings) ? bed.growings : [];
    const newGrowing: Growing = {
      plant_id: plantId,
      year: this.growingForm.year,
      source,
      position: {
        x_cm: target.localX,
        y_cm: target.localY
      },
      width_cm: target.width,
      height_cm: target.height,
      activities
    };

    const nextGrowings = [...currentGrowings];

    if (target.mode === 'edit') {
      if (target.growingIndex === undefined || !nextGrowings[target.growingIndex]) {
        this.growingModalError.set('Teelt niet gevonden om te bewerken');
        return;
      }

      const existing = nextGrowings[target.growingIndex];
      nextGrowings[target.growingIndex] = {
        ...existing,
        plant_id: plantId,
        year: this.growingForm.year,
        source,
        activities
      };
    } else {
      nextGrowings.push(newGrowing);
    }

    this.api.patchBed(garden.name, target.bedName, { growings: nextGrowings }).subscribe({
      next: (updatedGarden) => {
        if (Array.isArray(updatedGarden?.parts)) {
          this.localParts.set(updatedGarden.parts);
          this.garden.set(updatedGarden);
        }
        this.growingModalError.set(null);
        this.growingTarget.set(null);
        this.growingForm = this.createDefaultGrowingForm();
        modal.close();
      },
      error: (err) => {
        const backendMessage = err?.error?.error;
        this.growingModalError.set(typeof backendMessage === 'string' ? `Failed to save growing: ${backendMessage}` : 'Failed to save growing');
      }
    });
  }

  deleteGrowing(modal: { close: () => void }) {
    const garden = this.garden();
    const target = this.growingTarget();

    if (!garden?.name || !target || target.mode !== 'edit' || target.growingIndex === undefined) {
      return;
    }

    const bed = this.findPartByIdentity(this.localParts(), 'bed', target.bedName);
    if (!bed || bed.part_type !== 'bed') {
      this.error.set('Bed niet gevonden');
      return;
    }

    const currentGrowings = Array.isArray(bed.growings) ? bed.growings : [];
    if (!currentGrowings[target.growingIndex]) {
      this.error.set('Teelt niet gevonden om te verwijderen');
      return;
    }

    const nextGrowings = currentGrowings.filter((_, index) => index !== target.growingIndex);

    this.api.patchBed(garden.name, target.bedName, { growings: nextGrowings }).subscribe({
      next: (updatedGarden) => {
        if (Array.isArray(updatedGarden?.parts)) {
          this.localParts.set(updatedGarden.parts);
          this.garden.set(updatedGarden);
        }
        this.growingTarget.set(null);
        this.growingForm = this.createDefaultGrowingForm();
        modal.close();
      },
      error: (err) => {
        const backendMessage = err?.error?.error;
        this.error.set(typeof backendMessage === 'string' ? `Failed to delete growing: ${backendMessage}` : 'Failed to delete growing');
      }
    });
  }

  private createDefaultGrowingForm(): GrowingFormState {
    return {
      plant_id: '',
      year: new Date().getFullYear(),
      source_type: 'none',
      source_garden_name: '',
      source_bed_name: '',
      seed_selection_key: '',
      activities: []
    };
  }

  private createGrowingFormFromGrowing(growing: Growing): GrowingFormState {
    const form = this.createDefaultGrowingForm();
    form.plant_id = growing.plant_id ?? '';
    form.year = typeof growing.year === 'number' ? growing.year : form.year;

    const source = growing.source;
    if (source && this.isSourceGrowing(source)) {
      form.source_type = 'source_growing';
      form.source_garden_name = source.garden_name ?? '';
      form.source_bed_name = source.bed_name ?? '';
    } else if (source && this.isSeed(source)) {
      form.source_type = 'seed';
      form.seed_selection_key = this.seedKey(source);
    }

    if (Array.isArray(growing.activities)) {
      form.activities = growing.activities
        .filter((activity): activity is GrowingActivity => !!activity?.name && !!activity?.date)
        .map((activity) => ({ date: activity.date!, name: activity.name! }));
    }

    return form;
  }

  private isSourceGrowing(value: SourceGrowing | Seed): value is SourceGrowing {
    return 'garden_name' in value || 'bed_name' in value;
  }

  private isSeed(value: SourceGrowing | Seed): value is Seed {
    return 'valid_until_year' in value || 'webshop_name' in value || 'product_url' in value;
  }

  private buildGrowingSourceFromForm(plantId: string): SourceGrowing | Seed | null | undefined {
    if (this.growingForm.source_type === 'none') {
      return null;
    }

    if (this.growingForm.source_type === 'source_growing') {
      const gardenName = this.growingForm.source_garden_name.trim();
      const bedName = this.growingForm.source_bed_name.trim();

      const isValidSource = this.sourceGrowingOptionsForSelectedPlant().some(
        (option) => option.gardenName === gardenName && option.bedName === bedName
      );

      if (!gardenName || !bedName || !isValidSource) {
        this.growingModalError.set('Kies bij binnenteelt een geldige tuin en bed combinatie');
        return undefined;
      }

      return {
        garden_name: gardenName,
        bed_name: bedName
      };
    }

    const selectedSeed = this.seedOptionsForSelectedPlant()
      .find((seed) => this.seedKey(seed) === this.growingForm.seed_selection_key);

    if (!selectedSeed) {
      this.growingModalError.set('Kies een geldig zaad uit de lijst');
      return undefined;
    }

    return {
      ...selectedSeed,
      plant_id: plantId
    };
  }

  private seedKey(seed: Seed): string {
    return [
      seed.plant_id,
      seed.valid_until_year,
      seed.variant_name ?? '',
      seed.bought_on ?? '',
      seed.webshop_name ?? '',
      seed.product_url ?? ''
    ].join('|');
  }

  private buildGrowingActivitiesFromForm(): GrowingActivity[] | undefined {
    const activities: GrowingActivity[] = [];

    for (const activity of this.growingForm.activities) {
      const date = activity.date.trim();
      const name = activity.name;

      if (!date || !name) {
        this.growingModalError.set('Vul voor elke activiteit zowel datum als type in');
        return undefined;
      }

      activities.push({ date, name });
    }

    return activities;
  }

  private buildPartRect(part: GardenPart): FootprintRect | null {
    if (
      part.position?.x_cm === undefined ||
      part.position?.y_cm === undefined ||
      part.height_cm === undefined ||
      part.width_cm === undefined
    ) {
      return null;
    }

    const partType = part.part_type ?? (this.isPath(part) ? 'path' : (this.isBed(part) ? 'bed' : 'bed'));

    const isPathPart = partType === 'path';
    const pathMatterValue = part.path_matter ?? part.matter;

    return {
      id: `part-${partType}-${part.name ?? 'item'}`,
      label: part.name ?? 'part',
      x: part.position.x_cm,
      y: part.position.y_cm,
      width: part.width_cm,
      height: part.height_cm,
      type: partType,
      partName: part.name,
      partType,
      pathMatter: isPathPart ? pathMatterValue : undefined
    };
  }

  private buildEmptyBedCells(bed: GardenPart): EmptyBedCell[] {
    if (
      bed.part_type !== 'bed' ||
      !bed.name ||
      bed.position?.x_cm === undefined ||
      bed.position?.y_cm === undefined ||
      bed.width_cm === undefined ||
      bed.height_cm === undefined
    ) {
      return [];
    }

    const cells: EmptyBedCell[] = [];
    const growings = Array.isArray(bed.growings) ? bed.growings : [];
    const bedX = bed.position.x_cm;
    const bedY = bed.position.y_cm;
    const gridSize = this.footprintGridSizeCm;

    for (let localY = 0; localY <= bed.height_cm - gridSize; localY += gridSize) {
      for (let localX = 0; localX <= bed.width_cm - gridSize; localX += gridSize) {
        const isOccupied = growings.some((growing) => {
          if (
            growing.position?.x_cm === undefined ||
            growing.position?.y_cm === undefined ||
            growing.width_cm === undefined ||
            growing.height_cm === undefined
          ) {
            return false;
          }

          return this.rectanglesOverlap(
            { x: localX, y: localY, width: gridSize, height: gridSize },
            {
              x: growing.position.x_cm,
              y: growing.position.y_cm,
              width: growing.width_cm,
              height: growing.height_cm
            }
          );
        });

        if (!isOccupied) {
          cells.push({
            id: `empty-cell-${bed.name}-${localX}-${localY}`,
            bedName: bed.name,
            x: bedX + localX,
            y: bedY + localY,
            width: gridSize,
            height: gridSize,
            localX,
            localY
          });
        }
      }
    }

    return cells;
  }

  private buildGrowingRect(bed: Bed, growing: Growing, index: number, gardenLocation?: string): FootprintRect | null {
    if (
      growing.position?.x_cm === undefined ||
      growing.position?.y_cm === undefined ||
      growing.height_cm === undefined ||
      growing.width_cm === undefined
    ) {
      return null;
    }

    const offsetX = bed.position?.x_cm ?? 0;
    const offsetY = bed.position?.y_cm ?? 0;
    const warning = this.getGrowingWarning(growing, gardenLocation);

    return {
      id: `growing-${bed.name}-${index}`,
      label: growing.plant_id ?? 'growing',
      x: offsetX + growing.position.x_cm,
      y: offsetY + growing.position.y_cm,
      width: growing.width_cm,
      height: growing.height_cm,
      type: 'growing',
      warningLevel: warning.level,
      warningText: warning.text,
      warningSourceGardenName: warning.sourceGardenName,
      bedName: bed.name,
      growingIndex: index,
      bedX: offsetX,
      bedY: offsetY,
      bedWidth: bed.width_cm,
      bedHeight: bed.height_cm
    };
  }

  private getGrowingWarning(growing: Growing, gardenLocation?: string): GrowingWarningResult {
    return this.resolveGrowingWarning(growing, gardenLocation, new Set<string>());
  }

  private resolveGrowingWarning(growing: Growing, gardenLocation: string | undefined, visited: Set<string>): GrowingWarningResult {
    const visitedKey = this.getGrowingWarningVisitKey(growing, gardenLocation);
    if (visited.has(visitedKey)) {
      return { level: 'none' };
    }
    visited.add(visitedKey);

    const ownWarning = this.getDirectGrowingWarning(growing, gardenLocation);
    const sourceWarning = this.getSourceGrowingWarning(growing, visited);

    return this.mergeGrowingWarnings(ownWarning, sourceWarning);
  }

  private getDirectGrowingWarning(growing: Growing, gardenLocation?: string): GrowingWarningResult {
    if (!growing.plant_id || !this.isLocation(gardenLocation)) {
      return { level: 'none' };
    }

    const plant = this.plantsByCommonName()[growing.plant_id];
    if (!plant?.preferred_activities?.length) {
      return { level: 'none' };
    }

    const relevantActivities = plant.preferred_activities.filter(
      (item) => item.location === gardenLocation && (item.months?.length ?? 0) > 0
    );

    if (relevantActivities.length === 0) {
      return { level: 'none' };
    }

    const year = typeof growing.year === 'number' ? growing.year : new Date().getFullYear();
    const now = new Date();
    const millisPerDay = 1000 * 60 * 60 * 24;

    const warningActivities: string[] = [];
    const dangerActivities: string[] = [];

    const growingActivityNames = (growing.activities || [])
      .map((a) => a.name)
      .filter((name): name is ActivityName => !!name);

    relevantActivities.forEach((preferredActivity) => {
      if (!preferredActivity.months?.length || !preferredActivity.activity_name) {
        return;
      }

      const preferredWindow = this.buildPreferredWindow(preferredActivity.months, year);
      if (!preferredWindow) {
        return;
      }

      const hasMatchingActivity = growingActivityNames.includes(preferredActivity.activity_name);
      if (now < preferredWindow.start || hasMatchingActivity) {
        return;
      }

      const activityLabel = this.translateActivityName(preferredActivity.activity_name);
      const daysUntilEnd = (preferredWindow.end.getTime() - now.getTime()) / millisPerDay;

      if (daysUntilEnd <= 7) {
        const detail = `${activityLabel} (${this.formatDaysStatus(daysUntilEnd)})`;
        dangerActivities.push(detail);
        return;
      }

      warningActivities.push(activityLabel);
    });

    if (dangerActivities.length > 0) {
      const dangerText = dangerActivities.join(', ');
      const warningText = warningActivities.length > 0 ? ` | ${warningActivities.join(', ')}` : '';
      return {
        level: 'danger',
        text: `${growing.plant_id}: ${dangerText}${warningText}`
      };
    }

    if (warningActivities.length > 0) {
      return {
        level: 'warning',
        text: `${growing.plant_id}: ${warningActivities.join(', ')}`
      };
    }

    return { level: 'none' };
  }

  private getSourceGrowingWarning(growing: Growing, visited: Set<string>): GrowingWarningResult {
    const source = growing.source;
    if (!source || !this.isSourceGrowing(source)) {
      return { level: 'none' };
    }

    const sourceContext = this.findSourceGrowingContext(source, growing.plant_id);
    if (!sourceContext) {
      return { level: 'none' };
    }

    const sourceWarning = this.resolveGrowingWarning(sourceContext.growing, sourceContext.location, visited);
    if (sourceWarning.level === 'none') {
      return sourceWarning;
    }

    return {
      level: sourceWarning.level,
      text: sourceWarning.text ? `bron-teelt: ${sourceWarning.text}` : 'bron-teelt: teelt heeft waarschuwing',
      sourceGardenName: source.garden_name?.trim() || undefined
    };
  }

  private mergeGrowingWarnings(primary: GrowingWarningResult, secondary: GrowingWarningResult): GrowingWarningResult {
    const severity = { none: 0, warning: 1, danger: 2 } as const;

    if (severity[secondary.level] > severity[primary.level]) {
      return {
        ...secondary,
        sourceGardenName: secondary.sourceGardenName ?? primary.sourceGardenName
      };
    }

    if (severity[secondary.level] === severity[primary.level] && secondary.level !== 'none' && secondary.text) {
      return {
        level: primary.level,
        text: primary.text ? `${primary.text} | ${secondary.text}` : secondary.text,
        sourceGardenName: primary.sourceGardenName ?? secondary.sourceGardenName
      };
    }

    return primary;
  }

  private getGrowingWarningVisitKey(growing: Growing, gardenLocation?: string): string {
    const plantId = growing.plant_id ?? '';
    const year = typeof growing.year === 'number' ? growing.year : '';

    if (growing.source && this.isSourceGrowing(growing.source)) {
      const sourceGarden = growing.source.garden_name ?? '';
      const sourceBed = growing.source.bed_name ?? '';
      return `${sourceGarden}|${sourceBed}|${plantId}|${year}`;
    }

    const sourceType = growing.source ? (this.isSeed(growing.source) ? 'seed' : 'none') : 'none';
    return `${gardenLocation ?? ''}|${sourceType}|${plantId}|${year}`;
  }

  private buildPreferredWindow(months: Month[], year: number): PreferredWindow | null {
    const validMonths = months.filter((month): month is Month => this.monthOrder.includes(month));
    if (validMonths.length === 0) {
      return null;
    }

    const uniqueIndices = Array.from(new Set(validMonths.map((month) => this.monthToIndex[month]))).sort((a, b) => a - b);
    if (uniqueIndices.length === 0) {
      return null;
    }

    // Treat all listed months as one continuous period by selecting the shortest arc on the month circle.
    let largestGap = -1;
    let largestGapStartIndex = 0;

    uniqueIndices.forEach((current, idx) => {
      const next = idx === uniqueIndices.length - 1 ? uniqueIndices[0] + 12 : uniqueIndices[idx + 1];
      const gap = next - current;
      if (gap > largestGap) {
        largestGap = gap;
        largestGapStartIndex = idx;
      }
    });

    const startIndex = uniqueIndices[(largestGapStartIndex + 1) % uniqueIndices.length];
    const endIndex = uniqueIndices[largestGapStartIndex];
    const endYear = endIndex < startIndex ? year + 1 : year;

    const start = new Date(year, startIndex, 1, 0, 0, 0, 0);
    const end = new Date(endYear, endIndex + 1, 0, 23, 59, 59, 999);
    const midpoint = new Date(start.getTime() + Math.floor((end.getTime() - start.getTime()) / 2));

    return { start, midpoint, end };
  }

  protected translateActivityName(activityName: ActivityName): string {
    switch (activityName) {
      case 'Seeding':
        return 'Zaaien';
      case 'Planting':
        return 'Planten';
      case 'Reaping':
        return 'Oogsten';
      case 'Pruning':
        return 'Snoeien';
      default:
        return activityName;
    }
  }

  private formatDaysStatus(daysUntilEnd: number): string {
    if (daysUntilEnd >= 0) {
      const daysLeft = Math.ceil(daysUntilEnd);
      return `nog ${daysLeft} dagen`;
    }

    const daysOverdue = Math.ceil(Math.abs(daysUntilEnd));
    return `${daysOverdue} dagen voorbij`;
  }

  getPathLabelTransform(rect: FootprintRect): string | null {
    if (rect.type !== 'path') {
      return null;
    }

    if (rect.height > rect.width) {
      const centerX = rect.x + (rect.width / 2);
      const centerY = rect.y + (rect.height / 2);
      return `rotate(-90 ${centerX} ${centerY})`;
    }

    return null;
  }

  private isLocation(value?: string): value is Location {
    return value === 'binnen' || value === 'buiten' || value === 'kas';
  }

  private isBed(part: GardenPart): part is Bed {
    if (part.part_type === 'bed' || part.part_type === 'embankment') {
      return true;
    }

    return !!part.name && (Array.isArray(part.growings) || !!part.soil || part.mulched !== undefined);
  }

  private isPath(part: GardenPart): boolean {
    if (part.part_type === 'path') {
      return true;
    }

    return (
      (typeof part.path_matter === 'string' && part.path_matter.length > 0) ||
      (typeof part.matter === 'string' && part.matter.length > 0)
    );
  }

  private initializePartForm(partType: PartType, xCm: number, yCm: number) {
    if (partType === 'bed') {
      this.bedForm = {
        ...this.defaultBaseForm(xCm, yCm),
        name: `new-bed-${this.localParts().length + 1}`,
        mulched: false,
        texture: 'compost',
        drainage: 'goed drainerend',
        richness: 'rijk',
        ph: 'neutraal',
        notes: ''
      };
      return;
    }

    if (partType === 'path') {
      this.pathForm = {
        ...this.defaultBaseForm(xCm, yCm),
        name: `new-path-${this.localParts().length + 1}`,
        path_matter: 'houtsnippers'
      };
      return;
    }

    if (partType === 'embankment') {
      this.embankmentForm = {
        ...this.defaultBaseForm(xCm, yCm),
        name: `new-embankment-${this.localParts().length + 1}`,
        mulched: false,
        texture: 'compost',
        drainage: 'goed drainerend',
        richness: 'rijk',
        ph: 'neutraal',
        notes: '',
        pitch_degrees: 30
      };
      return;
    }

    if (partType === 'water_tank') {
      this.waterTankForm = {
        ...this.defaultBaseForm(xCm, yCm),
        name: `new-water-tank-${this.localParts().length + 1}`,
        capacity_liters: 200
      };
      return;
    }

    if (partType === 'shed') {
      this.shedForm = {
        ...this.defaultBaseForm(xCm, yCm),
        name: `new-shed-${this.localParts().length + 1}`,
        has_workbench: false
      };
      return;
    }

    this.greenhouseForm = {
      ...this.defaultBaseForm(xCm, yCm),
      name: `new-greenhouse-${this.localParts().length + 1}`,
      wall_type: 'glas'
    };
  }

  private openPartEditModal(
    rect: FootprintRect,
    templates: {
      bedModal: TemplateRef<unknown>;
      pathModal: TemplateRef<unknown>;
      embankmentModal: TemplateRef<unknown>;
      waterTankModal: TemplateRef<unknown>;
      shedModal: TemplateRef<unknown>;
      greenhouseModal: TemplateRef<unknown>;
    }
  ) {
    if (!rect.partType || !rect.partName) {
      return;
    }

    const part = this.findPartByIdentity(this.localParts(), rect.partType, rect.partName);
    if (!part) {
      return;
    }

    this.editingPart.set({ partType: rect.partType, partName: rect.partName });
    this.initializePartFormFromPart(part);

    const templateByType: Record<PartType, TemplateRef<unknown>> = {
      bed: templates.bedModal,
      path: templates.pathModal,
      embankment: templates.embankmentModal,
      water_tank: templates.waterTankModal,
      shed: templates.shedModal,
      greenhouse: templates.greenhouseModal
    };

    this.modalService.open(templateByType[rect.partType], {
      centered: true,
      size: 'lg',
      windowClass: `part-modal part-modal-${rect.partType}`
    });
  }

  private initializePartFormFromPart(part: GardenPart) {
    const positionX = part.position?.x_cm ?? 0;
    const positionY = part.position?.y_cm ?? 0;
    const base = this.defaultBaseForm(positionX, positionY);
    base.width_cm = part.width_cm ?? this.footprintGridSizeCm;
    base.height_cm = part.height_cm ?? this.footprintGridSizeCm;

    if (part.part_type === 'bed') {
      this.bedForm = {
        ...base,
        name: part.name ?? '',
        mulched: !!part.mulched,
        texture: part.soil?.texture ?? 'compost',
        drainage: part.soil?.drainage ?? 'goed drainerend',
        richness: part.soil?.richness ?? 'rijk',
        ph: part.soil?.ph ?? 'neutraal',
        notes: part.soil?.notes ?? ''
      };
      return;
    }

    if (part.part_type === 'path') {
      this.pathForm = {
        ...base,
        name: part.name ?? '',
        path_matter: (part.path_matter ?? 'houtsnippers') as 'beton' | 'houtsnippers'
      };
      return;
    }

    if (part.part_type === 'embankment') {
      this.embankmentForm = {
        ...base,
        name: part.name ?? '',
        mulched: !!part.mulched,
        texture: part.soil?.texture ?? 'compost',
        drainage: part.soil?.drainage ?? 'goed drainerend',
        richness: part.soil?.richness ?? 'rijk',
        ph: part.soil?.ph ?? 'neutraal',
        notes: part.soil?.notes ?? '',
        pitch_degrees: part.pitch_degrees ?? 30
      };
      return;
    }

    if (part.part_type === 'water_tank') {
      this.waterTankForm = {
        ...base,
        name: part.name ?? '',
        capacity_liters: part.capacity_liters ?? 200
      };
      return;
    }

    if (part.part_type === 'shed') {
      this.shedForm = {
        ...base,
        name: part.name ?? '',
        has_workbench: !!part.has_workbench
      };
      return;
    }

    this.greenhouseForm = {
      ...base,
      name: part.name ?? '',
      wall_type: part.wall_type ?? 'glas'
    };
  }

  private persistUniquePatch(request: Observable<Garden>, errorMessage: string) {
    request.subscribe({
      next: (updatedGarden) => {
        if (Array.isArray(updatedGarden?.parts)) {
          this.localParts.set(updatedGarden.parts);
          this.garden.set(updatedGarden);
        }
      },
      error: (err) => {
        const backendMessage = err?.error?.error;
        this.error.set(typeof backendMessage === 'string' ? `${errorMessage}: ${backendMessage}` : errorMessage);
      }
    });
  }

  private addPart(part: GardenPart) {
    const garden = this.garden();
    if (!garden?.name) {
      return;
    }

    const normalizedPart = this.normalizePartToGrid(part);

    const previousParts = this.localParts();
    const nextParts = [...previousParts, normalizedPart];

    this.localParts.set(nextParts);
    this.garden.set({ ...garden, parts: nextParts });

    const request = this.createPartRequest(garden.name, normalizedPart);
    if (!request) {
      this.localParts.set(previousParts);
      this.garden.set({ ...garden, parts: previousParts });
      this.error.set('Unsupported part_type for persistence');
      return;
    }

    request.subscribe({
      next: (updatedGarden) => {
        if (updatedGarden?.parts) {
          this.localParts.set(updatedGarden.parts);
          this.garden.set(updatedGarden);
        }
      },
      error: () => {
        this.localParts.set(previousParts);
        this.garden.set({ ...garden, parts: previousParts });
        this.error.set('Failed to persist part to definition.json');
      }
    });
  }

  private createPartRequest(gardenName: string, part: GardenPart) {
    switch (part.part_type) {
      case 'bed':
        return this.api.createBed(gardenName, part);
      case 'path':
        return this.api.createPath(gardenName, part);
      case 'embankment':
        return this.api.createEmbankment(gardenName, part);
      case 'water_tank':
        return this.api.createWaterTank(gardenName, part);
      case 'shed':
        return this.api.createShed(gardenName, part);
      case 'greenhouse':
        return this.api.createGreenhouse(gardenName, part);
      default:
        return null;
    }
  }

  private getMapMousePosition(event: MouseEvent): { x: number; y: number } | null {
    const eventTarget = event.target as Element | null;
    const svgFromTarget = eventTarget?.closest('svg');
    const svg = (svgFromTarget as SVGSVGElement | null)
      ?? (event.currentTarget as SVGSVGElement | null)
      ?? this.mapSvg?.nativeElement
      ?? null;
    const garden = this.garden();

    if (!svg || !garden?.width_cm || !garden?.height_cm) {
      return null;
    }

    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      return null;
    }

    const x = ((event.clientX - bounds.left) / bounds.width) * garden.width_cm;
    const y = ((event.clientY - bounds.top) / bounds.height) * garden.height_cm;

    return {
      x: Math.max(0, Math.min(garden.width_cm, x)),
      y: Math.max(0, Math.min(garden.height_cm, y))
    };
  }

  private withUpdatedPartFootprint(
    parts: GardenPart[],
    partType: PartType,
    partName: string,
    footprint: PlanFootprint
  ): GardenPart[] | null {
    let found = false;

    const updateRecursively = (items: GardenPart[]): GardenPart[] => {
      return items.map((part) => {
        let nextPart = part;

        if (part?.part_type === partType && part?.name === partName) {
          found = true;
          nextPart = {
            ...part,
            position: {
              x_cm: footprint.position?.x_cm,
              y_cm: footprint.position?.y_cm
            },
            width_cm: footprint.width_cm,
            height_cm: footprint.height_cm,
            rotation_deg: footprint.rotation_deg ?? part.rotation_deg
          };
        }

        if (Array.isArray(nextPart?.branches)) {
          nextPart = {
            ...nextPart,
            branches: updateRecursively(nextPart.branches)
          };
        }

        return nextPart;
      });
    };

    const next = updateRecursively(parts);
    return found ? next : null;
  }

  private withUpdatedGrowingFootprint(
    parts: GardenPart[],
    bedName: string,
    growingIndex: number,
    footprint: PlanFootprint
  ): GardenPart[] | null {
    let found = false;

    const updateRecursively = (items: GardenPart[]): GardenPart[] => {
      return items.map((part) => {
        let nextPart = part;

        if (this.isBed(part) && part.name === bedName && Array.isArray(part.growings)) {
          const bedX = part.position?.x_cm;
          const bedY = part.position?.y_cm;
          const hasGrowing = part.growings[growingIndex] !== undefined;

          if (bedX !== undefined && bedY !== undefined && hasGrowing) {
            found = true;
            const nextGrowings = [...part.growings];
            const existingGrowing = nextGrowings[growingIndex];

            nextGrowings[growingIndex] = {
              ...existingGrowing,
              position: {
                x_cm: (footprint.position?.x_cm ?? bedX) - bedX,
                y_cm: (footprint.position?.y_cm ?? bedY) - bedY
              },
              width_cm: footprint.width_cm,
              height_cm: footprint.height_cm,
              rotation_deg: footprint.rotation_deg ?? existingGrowing.rotation_deg
            };

            nextPart = {
              ...part,
              growings: nextGrowings
            };
          }
        }

        if (Array.isArray(nextPart?.branches)) {
          nextPart = {
            ...nextPart,
            branches: updateRecursively(nextPart.branches)
          };
        }

        return nextPart;
      });
    };

    const next = updateRecursively(parts);
    return found ? next : null;
  }

  private findPartByIdentity(parts: GardenPart[], partType: PartType, partName: string): GardenPart | null {
    for (const part of parts) {
      if (part?.part_type === partType && part?.name === partName) {
        return part;
      }

      if (Array.isArray(part?.branches)) {
        const nested = this.findPartByIdentity(part.branches, partType, partName);
        if (nested) {
          return nested;
        }
      }
    }

    return null;
  }

  private findBedByName(parts: GardenPart[], bedName: string): GardenPart | null {
    for (const part of parts) {
      if (part?.part_type === 'bed' && part.name === bedName) {
        return part;
      }

      if (Array.isArray(part?.branches)) {
        const nested = this.findBedByName(part.branches, bedName);
        if (nested) {
          return nested;
        }
      }
    }

    return null;
  }

  private isGrowingLayoutValid(parts: GardenPart[], bedName: string): boolean {
    const bed = this.findBedByName(parts, bedName);
    if (!bed || !this.isBed(bed)) {
      return false;
    }

    return this.areGrowingsValidInsideBed(bed);
  }

  private isEditableGrowingRect(rect: FootprintRect): boolean {
    if (rect.type !== 'growing' || !rect.bedName || rect.growingIndex === undefined) {
      return false;
    }

    return !!this.findBedByName(this.localParts(), rect.bedName);
  }

  isDraggableRect(rect: FootprintRect): boolean {
    return this.isEditablePartRect(rect) || this.isEditableGrowingRect(rect);
  }

  private getRectInteractionIdentity(rect: FootprintRect): {
    targetType: 'part' | 'growing';
    partType?: PartType;
    partName?: string;
    bedName?: string;
    growingIndex?: number;
  } | null {
    if (this.isEditablePartRect(rect)) {
      return {
        targetType: 'part',
        partType: rect.partType,
        partName: rect.partName
      };
    }

    if (this.isEditableGrowingRect(rect)) {
      return {
        targetType: 'growing',
        bedName: rect.bedName,
        growingIndex: rect.growingIndex
      };
    }

    return null;
  }

  private getRectInteractionBounds(rect: FootprintRect): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (this.isEditablePartRect(rect)) {
      const garden = this.garden();
      if (!garden?.width_cm || !garden?.height_cm) {
        return null;
      }

      return {
        minX: 0,
        minY: 0,
        maxX: garden.width_cm,
        maxY: garden.height_cm
      };
    }

    if (this.isEditableGrowingRect(rect)) {
      const bed = this.findBedByName(this.localParts(), rect.bedName!);
      if (
        !bed ||
        bed.position?.x_cm === undefined ||
        bed.position?.y_cm === undefined ||
        bed.width_cm === undefined ||
        bed.height_cm === undefined
      ) {
        return null;
      }

      return {
        minX: bed.position.x_cm,
        minY: bed.position.y_cm,
        maxX: bed.position.x_cm + bed.width_cm,
        maxY: bed.position.y_cm + bed.height_cm
      };
    }

    return null;
  }

  private isPartLayoutValid(parts: GardenPart[], partType: PartType, partName: string): boolean {
    const updated = this.findPartByIdentity(parts, partType, partName);
    if (!updated?.position || updated.width_cm === undefined || updated.height_cm === undefined) {
      return false;
    }

    if ((updated.part_type === 'bed' || updated.part_type === 'embankment') && Array.isArray(updated.growings)) {
      if (!this.areGrowingsValidInsideBed(updated)) {
        return false;
      }
    }

    // Existing definition data can contain overlapping path branches.
    // Blocking all edits on global overlap makes drag/resize unusable.
    return true;
  }

  private areGrowingsValidInsideBed(bed: GardenPart): boolean {
    const growings = Array.isArray(bed.growings) ? bed.growings : [];
    if (!growings.length) {
      return true;
    }

    if (bed.width_cm === undefined || bed.height_cm === undefined) {
      return false;
    }

    for (const growing of growings) {
      if (
        growing.position?.x_cm === undefined ||
        growing.position?.y_cm === undefined ||
        growing.width_cm === undefined ||
        growing.height_cm === undefined
      ) {
        return false;
      }

      if (
        growing.position.x_cm < 0 ||
        growing.position.y_cm < 0 ||
        (growing.position.x_cm + growing.width_cm) > bed.width_cm ||
        (growing.position.y_cm + growing.height_cm) > bed.height_cm
      ) {
        return false;
      }
    }

    for (let first = 0; first < growings.length; first += 1) {
      for (let second = first + 1; second < growings.length; second += 1) {
        const a = growings[first];
        const b = growings[second];
        if (
          a.position && b.position &&
          a.width_cm !== undefined && a.height_cm !== undefined &&
          b.width_cm !== undefined && b.height_cm !== undefined &&
          this.rectanglesOverlap(
            { x: a.position.x_cm!, y: a.position.y_cm!, width: a.width_cm, height: a.height_cm },
            { x: b.position.x_cm!, y: b.position.y_cm!, width: b.width_cm, height: b.height_cm }
          )
        ) {
          return false;
        }
      }
    }

    return true;
  }

  private doPartsOverlap(parts: GardenPart[]): boolean {
    const flatParts: Array<{ x: number; y: number; width: number; height: number }> = [];

    const walk = (items: GardenPart[]) => {
      items.forEach((part) => {
        if (
          part?.position?.x_cm !== undefined &&
          part?.position?.y_cm !== undefined &&
          part?.width_cm !== undefined &&
          part?.height_cm !== undefined
        ) {
          flatParts.push({
            x: part.position.x_cm,
            y: part.position.y_cm,
            width: part.width_cm,
            height: part.height_cm
          });
        }

        if (Array.isArray(part?.branches)) {
          walk(part.branches);
        }
      });
    };

    walk(parts);

    for (let first = 0; first < flatParts.length; first += 1) {
      for (let second = first + 1; second < flatParts.length; second += 1) {
        if (this.rectanglesOverlap(flatParts[first], flatParts[second])) {
          return true;
        }
      }
    }

    return false;
  }

  private rectanglesOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean {
    return a.x < (b.x + b.width)
      && (a.x + a.width) > b.x
      && a.y < (b.y + b.height)
      && (a.y + a.height) > b.y;
  }

  private defaultBaseForm(xCm = 0, yCm = 0): BasePartForm {
    return {
      name: '',
      x_cm: this.snapToGrid(xCm, this.footprintGridSizeCm),
      y_cm: this.snapToGrid(yCm, this.footprintGridSizeCm),
      width_cm: this.footprintGridSizeCm,
      height_cm: this.footprintGridSizeCm
    };
  }

  private normalizePartToGrid(part: GardenPart): GardenPart {
    return {
      ...part,
      position: {
        x_cm: this.snapToGrid(part.position?.x_cm ?? 0, this.footprintGridSizeCm),
        y_cm: this.snapToGrid(part.position?.y_cm ?? 0, this.footprintGridSizeCm)
      },
      width_cm: this.snapToGrid(Math.max(this.footprintGridSizeCm, part.width_cm ?? this.footprintGridSizeCm), this.footprintGridSizeCm),
      height_cm: this.snapToGrid(Math.max(this.footprintGridSizeCm, part.height_cm ?? this.footprintGridSizeCm), this.footprintGridSizeCm)
    };
  }

  private snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
  }

  private hexToRgba(hexColor: string, alpha: number): string {
    const normalized = hexColor.replace('#', '');
    const value = normalized.length === 3
      ? normalized.split('').map((char) => `${char}${char}`).join('')
      : normalized;

    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
