import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityName, ApiService, Location, Month, Plant, PreferredActivity, Seed } from '../../services/api.service';
import { Soil } from '../soil/soil';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { SeedModal } from '../seed-modal/seed-modal';

@Component({
  selector: 'app-plants-list',
  standalone: true,
  imports: [CommonModule, FormsModule, Soil, NgbModalModule],
  templateUrl: './plants-list.html',
  styleUrls: ['./plants-list.scss']
})

export class PlantsList implements OnInit {
  plants = signal<Plant[]>([]);
  seeds = signal<Seed[]>([]);
  searchQuery = signal('');
  loading = signal(true);
  error = signal<string | undefined>(undefined);
  readonly months: Month[] = ['jan', 'feb', 'maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  readonly locations: Location[] = ['binnen', 'kas', 'buiten'];
  webshopOptions = signal<Array<Seed['webshop_name']>>([]);
  readonly filteredPlants = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const allPlants = this.plants();

    if (!query) {
      return allPlants;
    }

    return allPlants.filter((plant) => {
      const commonName = (plant.common_name || '').toLowerCase();
      const scientificName = (plant.scientific_name || '').toLowerCase();
      return commonName.includes(query) || scientificName.includes(query);
    });
  });

  private readonly activityAbbr: Record<ActivityName, string> = {
    Seeding: 'Z',
    Planting: 'P',
    Reaping: 'O',
    Pruning: 'S'
  };

  private readonly activityTooltipDutch: Record<ActivityName, string> = {
    Seeding: 'Zaaien',
    Planting: 'Planten',
    Reaping: 'Oogsten',
    Pruning: 'Snoeien'
  };

  constructor(private api: ApiService, private modalService: NgbModal) {
    console.log('PlantsList component initialized');
  }

  ngOnInit(): void {
    this.api.getPlants().subscribe({
      next: (p) => {
        this.plants.set(p);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.message || 'Failed to load plants');
        this.loading.set(false);
      }
    });

    this.api.getSeeds().subscribe({
      next: (items) => {
        this.seeds.set(Array.isArray(items) ? items : []);
      }
    });

    this.api.getWebshops().subscribe({
      next: (shops) => {
        const names = (Array.isArray(shops) ? shops : [])
          .map((shop) => shop?.name)
          .filter((name): name is NonNullable<Seed['webshop_name']> => !!name);
        this.webshopOptions.set(names);
      }
    });
  }

  seedsForPlant(plant: Plant): Seed[] {
    return this.seedEntriesForPlant(plant).map((entry) => entry.seed);
  }

  seedEntriesForPlant(plant: Plant): Array<{ seed: Seed; seedIndex: number }> {
    const plantId = (plant.common_name ?? '').trim().toLowerCase();
    if (!plantId) {
      return [];
    }

    const entries: Array<{ seed: Seed; seedIndex: number }> = [];
    this.seeds().forEach((seed, seedIndex) => {
      if ((seed.plant_id ?? '').trim().toLowerCase() === plantId) {
        entries.push({ seed, seedIndex });
      }
    });
    return entries;
  }

  seedDisplayName(seed: Seed): string {
    return seed.variant_name || seed.webshop_name || seed.plant_id || 'Onbekend';
  }

  openCreateSeedModal(plant: Plant) {
    const modalRef = this.modalService.open(SeedModal, { centered: true, size: 'md' });
    modalRef.componentInstance.plant = plant;
    modalRef.componentInstance.webshopOptions = this.webshopOptions().filter((shop): shop is string => !!shop);

    modalRef.closed.subscribe((created: Seed) => {
      if (!created) {
        return;
      }

      this.seeds.update((items) => [...items, created]);
    });
  }

  removeSeed(seedIndex: number) {
    const confirmed = window.confirm('Weet je zeker dat je dit zaad wilt verwijderen?');
    if (!confirmed) {
      return;
    }

    this.api.deleteSeed(seedIndex).subscribe({
      next: () => {
        this.seeds.update((items) => items.filter((_, idx) => idx !== seedIndex));
      },
      error: (e) => {
        const backendMessage = e?.error?.error;
        this.error.set(typeof backendMessage === 'string' ? backendMessage : 'Seed verwijderen mislukt');
      }
    });
  }

  preferredActivitiesForCell(plant: Plant, location: Location, month: Month): PreferredActivity[] {
    if (!Array.isArray(plant.preferred_activities)) {
      return [];
    }

    return plant.preferred_activities.filter((activity) => {
      return activity.location === location && Array.isArray(activity.months) && activity.months.includes(month);
    });
  }

  activityLabel(activity?: ActivityName): string {
    if (!activity) {
      return '';
    }

    return this.activityAbbr[activity] ?? activity;
  }

  activityTooltip(activity?: ActivityName): string {
    if (!activity) {
      return '';
    }

    return this.activityTooltipDutch[activity] ?? activity;
  }

  activityClass(activity?: ActivityName): string {
    switch (activity) {
      case 'Seeding':
        return 'activity-chip activity-chip--seeding';
      case 'Planting':
        return 'activity-chip activity-chip--planting';
      case 'Reaping':
        return 'activity-chip activity-chip--reaping';
      case 'Pruning':
        return 'activity-chip activity-chip--pruning';
      default:
        return 'activity-chip';
    }
  }
}
