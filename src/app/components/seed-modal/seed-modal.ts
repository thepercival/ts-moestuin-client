import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ApiService, Plant, Seed } from '../../services/api.service';

interface SeedFormState {
  valid_until_year: number;
  variant_name: string;
  bought_on: string;
  webshop_name: string;
  product_url: string;
  sowing_depth_cm: number | null;
  sowing_distance_cm: number | null;
}

@Component({
  selector: 'app-seed-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seed-modal.html'
})
export class SeedModal implements OnInit {
  @Input() plant: Plant | null = null;
  @Input() webshopOptions: string[] = [];

  error = signal<string | null>(null);
  seedForm: SeedFormState = this.createDefaultSeedForm();

  constructor(public activeModal: NgbActiveModal, private api: ApiService) {}

  ngOnInit(): void {
    this.seedForm = this.createDefaultSeedForm(this.plant);
  }

  saveSeed() {
    const plantId = (this.plant?.common_name ?? '').trim();
    if (!plantId) {
      this.error.set('Plant niet gevonden');
      return;
    }

    const validUntilYear = Number(this.seedForm.valid_until_year);
    if (!Number.isFinite(validUntilYear)) {
      this.error.set('Geldig tot jaar is verplicht');
      return;
    }

    const variantName = this.seedForm.variant_name.trim();

    const sowingDepth = Number(this.seedForm.sowing_depth_cm);
    const sowingDistance = Number(this.seedForm.sowing_distance_cm);
    if (!Number.isFinite(sowingDepth) || !Number.isFinite(sowingDistance)) {
      this.error.set('Zaaidiepte en plantafstand zijn verplicht');
      return;
    }

    const payload: Seed = {
      plant_id: plantId,
      valid_until_year: Math.trunc(validUntilYear),
      variant_name: variantName,
      bought_on: this.seedForm.bought_on || undefined,
      webshop_name: this.seedForm.webshop_name || undefined,
      product_url: this.seedForm.product_url || undefined,
      sowing_depth_cm: sowingDepth,
      sowing_distance_cm: sowingDistance
    };

    this.api.createSeed(payload).subscribe({
      next: (created) => {
        this.error.set(null);
        this.activeModal.close(created);
      },
      error: (e) => {
        const backendMessage = e?.error?.error;
        this.error.set(typeof backendMessage === 'string' ? backendMessage : 'Seed opslaan mislukt');
      }
    });
  }

  private createDefaultSeedForm(plant?: Plant | null): SeedFormState {
    return {
      valid_until_year: new Date().getFullYear() + 2,
      variant_name: '',
      bought_on: new Date().toISOString().slice(0, 10),
      webshop_name: '',
      product_url: '',
      sowing_depth_cm: plant?.sowing_depth_cm ?? null,
      sowing_distance_cm: plant?.sowing_distance_cm ?? null
    };
  }
}
