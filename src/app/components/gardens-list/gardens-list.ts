import { Component, OnInit, Input, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Garden as GardenModel } from '../../services/api.service';

@Component({
  selector: 'app-gardens-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gardens-list.html',
  styleUrls: ['./gardens-list.scss']
})
export class GardensList implements OnInit {
  gardens: GardenModel[] = [];
  loading = signal(true);
  error?: string;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getGardens().subscribe({
      next: (g) => { 
        this.gardens = g || []; 
        this.loading.set(false);
      },
      error: (e) => { 
        this.error = e?.message || 'Failed to load gardens'; 
        this.loading.set(false); 
      }
    });
  }
}
