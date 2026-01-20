import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Plant } from '../../services/api.service';

@Component({
  selector: 'app-plants-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plants-list.html',
  styleUrls: ['./plants-list.scss']
})

export class PlantsList implements OnInit {
  plants = signal<Plant[]>([]);
  loading = signal(true);
  error?: string;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getPlants().subscribe({
      next: (p) => {
        this.plants.set(p || []);
        this.loading.set(false);
      },
      error: (e) => {
        this.error = e?.message || 'Failed to load plants';
        this.loading.set(false);
      }
    });
  }
}
