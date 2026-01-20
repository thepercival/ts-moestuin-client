import { Injectable } from '@angular/core';
import { signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GardenService {
  selectedGarden: WritableSignal<string | null> = signal(null);

  setSelectedGarden(name: string | null) {
    this.selectedGarden.set(name);
  }

  getSelectedGarden() {
    return this.selectedGarden();
  }
}
