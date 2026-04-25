import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Bed as BedModel } from '../../services/api.service';
import { Soil } from '../soil/soil';

@Component({
  selector: 'app-bed',
  standalone: true,
  imports: [CommonModule, Soil],
  templateUrl: './bed.html',
  styleUrls: ['./bed.scss']
})
export class Bed {
  @Input({ required: true }) bed!: BedModel;
}