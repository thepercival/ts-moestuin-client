import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Garden as GardenModel, Month } from '../../services/api.service';

interface GardenFilter {
  startMonth: Month | '';
  endMonth: Month | '';
}

@Component({
  selector: 'app-gardens-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gardens-list.html',
  styleUrls: ['./gardens-list.scss']
})
export class GardensList implements OnInit {
  private apiService = inject(ApiService);
  
  gardens = signal<GardenModel[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showFilter = signal(false);
  
  filter: GardenFilter = {
    startMonth: '',
    endMonth: ''
  };

  months: Month[] = ['jan', 'feb', 'maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  ngOnInit() {
    this.loadGardens();
  }

  toggleFilter() {
    this.showFilter.update(value => !value);
  }

  applyFilter() {
    console.log('Applying filter:', this.filter);
    // Add your filter logic here
  }

  clearFilter() {
    this.filter = {
      startMonth: '',
      endMonth: ''
    };
    this.loadGardens();
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
}
