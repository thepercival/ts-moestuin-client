import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Bed as BedModel, Garden as GardenModel, GardenPart } from '../../services/api.service';
import { Bed } from '../bed/bed';

@Component({
  selector: 'app-garden',
  standalone: true,
  imports: [CommonModule, Bed],
  templateUrl: './garden.html',
  styleUrls: ['./garden.scss']
})
export class Garden {
  @Input({ required: true }) garden!: GardenModel;
  isCollapsed = signal(true);

  bedParts(parts?: GardenPart[]): BedModel[] {
    if (!parts) {
      return [];
    }

    return parts.filter((part): part is BedModel => {
      return !!part.name && (Array.isArray(part.growings) || !!part.soil || part.mulched !== undefined);
    });
  }

  toggleCollapse() {
    this.isCollapsed.update(value => !value);
  }
}