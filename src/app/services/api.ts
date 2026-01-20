import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Bed {
  id: string;
  name?: string;
  size_m2?: number;
  soil_type?: string;
}

export interface Plant {
  common_name?: string;
  scientific_name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private base = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getBeds(): Observable<Bed[]> {
    return this.http.get<Bed[]>(`${this.base}/beds`);
  }

  getBed(bedId: string): Observable<Bed> {
    return this.http.get<Bed>(`${this.base}/beds/${bedId}`);
  }

  getPlants(): Observable<Record<string, Plant>> {
    return this.http.get<Record<string, Plant>>(`${this.base}/plants`);
  }

  getPlant(plantId: string): Observable<Plant> {
    return this.http.get<Plant>(`${this.base}/plants/${plantId}`);
  }
}
