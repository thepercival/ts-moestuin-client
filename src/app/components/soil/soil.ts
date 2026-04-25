import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Soil as SoilModel } from '../../services/api.service';

@Component({
  selector: 'app-soil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './soil.html',
  styleUrls: ['./soil.scss']
})
export class Soil {
  @Input({ required: true }) soil!: SoilModel;
  @Input() inline: boolean = false;
}
