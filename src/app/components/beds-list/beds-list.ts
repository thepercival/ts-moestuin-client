import { Component, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ApiService, Bed, Garden } from '../../services/api.service';
import { GardenService } from '../../services/garden.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-beds-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './beds-list.html',
  styleUrls: ['./beds-list.scss']
})
export class BedsList implements OnInit {
  gardens: Garden[] = [];
  selectedGardenName = signal<string | null>(null);
  beds: Bed[] = [];
  loading = signal(true);
  error?: string;

  constructor(
    private api: ApiService,
    private gardenService: GardenService
  ) {
    // React to garden selection changes
    effect(() => {
      const selected = this.gardenService.selectedGarden();
      this.selectedGardenName.set(selected);
      if (selected) {
        this.loadBeds(selected);
      }
    });
  }

  ngOnInit(): void {
    this.api.getGardens().subscribe({
      next: (g) => {
        this.gardens = g || [];
      },
      error: (e) => {
        this.error = e?.message || 'Failed to load gardens';
      }
    });
  }

  loadBeds(gardenName: string): void {
    this.loading.set(true);
    this.api.getBeds(gardenName).subscribe({
      next: (b) => {
        this.beds = b || [];
        this.loading.set(false);
      },
      error: (e) => {
        this.error = e?.message || 'Failed to load beds';
        this.loading.set(false);
      }
    });
  }

  trackByName(_index: number, item: Bed | Garden) {
    return item.name;
  }
}
