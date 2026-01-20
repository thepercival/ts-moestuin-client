import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TemperatureRange {
  min?: number;
  max?: number;
}

export interface Growing {
  plant_id?: string;
  planted_on?: string;
}

export interface Bed {
  name: string;
  size_m2?: number;
  soil_type?: string;
  location?: string;
  humidity?: string;
  temperature_range_c?: TemperatureRange;
  mulched?: boolean;
  growings?: Growing[];
}

export interface Garden {
  name: string;
  beds?: Bed[];
}

export interface PlantTemperature {
  minimum_c?: number;
  optimal_minimum_c?: number;
  optimal_max_c?: number;
}

export interface Sowing {
  location?: string;
  description?: string;
  depth_cm?: number;
  distance_cm?: number;
  months?: string[];
}

export interface Planting {
  location?: string;
  description?: string;
  months?: string[];
}

export interface Flowering {
  location?: string;
  description?: string;
  months?: string[];
}

export interface Reaping {
  description?: string;
  months?: string[];
}

export interface Pruning {
  description?: string;
  months?: string[];
}

export interface Diseases {
  common?: string[];
  prevention?: string[];
}

export interface Repot {
  recommended?: boolean;
  notes?: string;
}

export interface Plant {
  common_name?: string;
  scientific_name?: string;
  purpose?: string;
  category?: string;
  url?: string;
  height_cm?: number;
  width_cm?: number;
  perennial?: string;
  pitch?: string;
  soil?: string;
  water?: string;
  temperature?: PlantTemperature;
  humidity?: string;
  sowing?: Sowing[];
  planting?: Planting[];
  flowering?: Flowering;
  reaping?: Reaping;
  pruning?: Pruning;
  winter_prep?: string;
  diseases?: Diseases;
  fertilization?: string;
  toxic?: string;
  repot?: Repot;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getGardens(): Observable<Garden[]> {
    return this.http.get<Garden[]>(`${this.base}/gardens`);
  }

  getGarden(gardenName: string): Observable<Garden> {
    return this.http.get<Garden>(`${this.base}/garden/${gardenName}`);
  }

  createGarden(garden: Garden): Observable<Garden> {
    return this.http.post<Garden>(`${this.base}/gardens`, garden);
  }

  updateGarden(gardenName: string, garden: Garden): Observable<Garden> {
    return this.http.put<Garden>(`${this.base}/garden/${gardenName}`, garden);
  }

  getBeds(gardenName: string): Observable<Bed[]> {
    return this.http.get<Bed[]>(`${this.base}/gardens/${gardenName}/beds`);
  }

  getBed(gardenName: string, bedName: string): Observable<Bed> {
    return this.http.get<Bed>(`${this.base}/gardens/${gardenName}/beds/${bedName}`);
  }

  getPlants(): Observable<Plant[]> {
    return this.http.get<Plant[]>(`${this.base}/plants`);
  }

  getPlant(plantName: string): Observable<Plant> {
    return this.http.get<Plant>(`${this.base}/plants/${plantName}`);
  }
}
