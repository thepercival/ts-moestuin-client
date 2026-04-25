import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Garden, Bed, GardenPart, Plant, Month, ActivityName, Location as GardenLocation } from '../../services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface PlantWithActivities {
  plantId: string;
  plant: Plant | null;
  activitiesByMonth: Map<Month, ActivityName[]>;
}

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './planning.html',
  styleUrls: ['./planning.scss']
})
export class Planning implements OnInit {
  gardens = signal<Garden[]>([]);
  selectedGardenName = signal<string>('');
  selectedBedName = signal<string>('');
  loading = signal(false);
  error = signal<string | null>(null);
  plantsWithActivities = signal<PlantWithActivities[]>([]);
  loadingPlants = signal(false);

  months: Month[] = ['jan', 'feb', 'maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

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

  // Computed signal for filtered beds based on selected garden
  beds = computed(() => {
    const gardenName = this.selectedGardenName();
    if (!gardenName) return [];
    const garden = this.gardens().find(g => g.name === gardenName);
    return this.extractBeds(garden?.parts || []);
  });

  // Computed signal for selected bed
  selectedBed = computed(() => {
    const bedName = this.selectedBedName();
    if (!bedName) return null;
    return this.beds().find(b => b.name === bedName) || null;
  });

  selectedGarden = computed(() => {
    const gardenName = this.selectedGardenName();
    if (!gardenName) return null;
    return this.gardens().find(g => g.name === gardenName) || null;
  });

  constructor(private apiService: ApiService) {
    // Load plants when bed selection changes
    effect(() => {
      const bed = this.selectedBed();
      const gardenLocation = this.selectedGardenLocation();
      if (bed) {
        this.loadPlantsForBed(bed, gardenLocation);
      } else {
        this.plantsWithActivities.set([]);
      }
    });
  }

  ngOnInit() {
    this.loadGardens();
  }

  onGardenChange() {
    // Reset bed selection when garden changes
    this.selectedBedName.set('');
  }

  activityLabel(activity: ActivityName): string {
    return this.activityAbbr[activity] ?? activity;
  }

  activityTooltip(activity: ActivityName): string {
    return this.activityTooltipDutch[activity] ?? activity;
  }

  activityClass(activity: ActivityName): string {
    switch (activity) {
      case 'Seeding':
        return 'planning-activity-chip planning-activity-chip--seeding';
      case 'Planting':
        return 'planning-activity-chip planning-activity-chip--planting';
      case 'Reaping':
        return 'planning-activity-chip planning-activity-chip--reaping';
      case 'Pruning':
        return 'planning-activity-chip planning-activity-chip--pruning';
      default:
        return 'planning-activity-chip';
    }
  }

  private loadGardens() {
    this.loading.set(true);
    this.error.set(null);

    this.apiService.getGardens().subscribe({
      next: (data) => {
        this.gardens.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load gardens');
        this.loading.set(false);
        console.error('Error loading gardens:', err);
      }
    });
  }

  private loadPlantsForBed(bed: Bed, gardenLocation: GardenLocation | null) {
    if (!bed.growings || bed.growings.length === 0) {
      this.plantsWithActivities.set([]);
      return;
    }

    this.loadingPlants.set(true);
    const plantRequests = bed.growings
      .filter(g => g.plant_id)
      .map(growing => 
        this.apiService.getPlant(growing.plant_id!).pipe(
          catchError(err => {
            console.error(`Failed to load plant ${growing.plant_id}:`, err);
            return of(null);
          })
        )
      );

    forkJoin(plantRequests).subscribe({
      next: (plants) => {
        const plantsData: PlantWithActivities[] = bed.growings!
          .filter(g => g.plant_id)
          .map((growing, index) => {
            const plant = plants[index];
            const activitiesByMonth = new Map<Month, ActivityName[]>();

            if (plant?.preferred_activities) {
              plant.preferred_activities.forEach(activity => {
                if (
                  activity.months
                  && activity.activity_name
                  && gardenLocation
                  && activity.location === gardenLocation
                ) {
                  activity.months.forEach(month => {
                    if (!activitiesByMonth.has(month)) {
                      activitiesByMonth.set(month, []);
                    }
                    activitiesByMonth.get(month)!.push(activity.activity_name!);
                  });
                }
              });
            }

            return {
              plantId: growing.plant_id!,
              plant,
              activitiesByMonth
            };
          });

        this.plantsWithActivities.set(plantsData);
        this.loadingPlants.set(false);
      },
      error: (err) => {
        console.error('Error loading plants:', err);
        this.loadingPlants.set(false);
      }
    });
  }

  private extractBeds(parts: GardenPart[]): Bed[] {
    return parts.filter((part): part is Bed => !!part.name && Array.isArray(part.growings));
  }

  private selectedGardenLocation(): GardenLocation | null {
    const location = this.selectedGarden()?.location;
    return this.isLocation(location) ? location : null;
  }

  private isLocation(value?: string): value is GardenLocation {
    return value === 'binnen' || value === 'kas' || value === 'buiten';
  }
}
