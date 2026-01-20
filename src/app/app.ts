import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Garden } from './services/api.service';
import { GardenService } from './services/garden.service';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, NgbNavModule, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('moestuinapp');
  protected active = 1;
  gardens = signal<Garden[]>([]);
  selectedGardenName = signal<string | null>(null);

  constructor(
    private router: Router,
    private api: ApiService,
    private gardenService: GardenService
  ) {}

  ngOnInit() {
    this.api.getGardens().subscribe({
      next: (gardens) => {
        this.gardens.set(gardens);
        // Set default to erica2c if it exists
        const hasErica = gardens.find(g => g.name === 'erica2c');
        const defaultGarden = hasErica ? 'erica2c' : (gardens.length > 0 ? gardens[0].name : null);
        if (defaultGarden) {
          this.selectGarden(defaultGarden);
        }
      }
    });
  }

  selectGarden(name: string) {
    this.selectedGardenName.set(name);
    this.gardenService.setSelectedGarden(name);
  }

  go(path: string, id: number) {
    this.active = id;
    this.router.navigate([path]);
  }
}
