import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Purpose = 'sier' | 'eten';
export type Perennial = 'eenjarig' | 'tweejarig' | 'meerjarig';
export type Pitch = 'zon' | 'halfschaduw' | 'schaduw';
export type PlantCategory = 'planten' | 'graan' | 'kruiden' | 'bloemen' | 'pootgoed' | 
  'wortelstokken' | 'koolgewassen' | 'bladgewassen' | 'vruchtgewassen' | 
  'wortelgewassen' | 'peulgewassen' | 'knoflook en ui' | 'zonnebloemen' | 'kiemgroenten';
export type Location = 'binnen' | 'kas' | 'buiten' ;
export type Month = 'jan' | 'feb' | 'maa' | 'apr' | 'mei' | 'jun' | 
  'jul' | 'aug' | 'sep' | 'okt' | 'nov' | 'dec';
export type SoilTexture = 'zand' | 'leem' | 'klei' | 'zavel' | 'veen' | 'potgrond' | 'compost' | 'zand, compost en grit';
export type SoilDrainage = 'zeer matig' | 'matig' | 'normaal' | 'zeer goed drainerend' | 'goed drainerend';
export type SoilRichness = 'arm' | 'normaal' | 'rijk';
export type SoilPh = 'zuur' | 'licht zuur' | 'neutraal' | 'alkalisch';
export type PlantHumidity = 'laag' | 'normaal' | 'hoog';
export type ActivityName = 'Seeding' | 'Planting' | 'Reaping' | 'Pruning';
export type WebshopName = string;

export interface TemperatureRange {
  min?: number;
  max?: number;
}

export interface HumidityRange {
  min_pct?: number;
  max_pct?: number;
}

export interface Position {
  x_cm?: number;
  y_cm?: number;
}

export interface PlanFootprint {
  position?: Position;
  height_cm?: number;
  width_cm?: number;
  rotation_deg?: number;
}

export type PartType = 'bed' | 'path' | 'embankment' | 'water_tank' | 'shed' | 'greenhouse';

export interface Soil {
  texture?: SoilTexture;
  drainage?: SoilDrainage;
  richness?: SoilRichness;
  ph?: SoilPh;
  notes?: string;
}

export interface GrowingActivity {
  date?: string; // format: date
  name?: ActivityName;
}

export interface Growing extends PlanFootprint {
  year?: number;
  plant_id?: string;
  startActivityName?: ActivityName;
  source?: SourceGrowing | Seed | null;
  position?: Position;
  planted_on?: string; // format: date
  activities?: GrowingActivity[];
}

export interface SourceGrowing {
  garden_name?: string;
  bed_name?: string;
}

export interface Seed {
  plant_id: string;
  valid_until_year: number;
  variant_name?: string;
  bought_on?: string; // format: date
  webshop_name?: WebshopName;
  product_url?: string;
  sowing_depth_cm?: number;
  sowing_distance_cm?: number;
}

export interface Webshop {
  name: WebshopName;
  url?: string;
  zoek_url_template?: string;
}

export interface Bed extends PlanFootprint {
  name: string;
  soil?: Soil;
  mulched?: boolean;
  growings?: Growing[];
}

export interface Garden extends PlanFootprint {
  name: string;
  location?: string;
  humidity?: HumidityRange;
  temperature_range_c?: TemperatureRange;
  parts?: GardenPart[];
}

export interface GardenPart extends PlanFootprint {
  part_type?: PartType;
  name?: string;
  soil?: Soil;
  mulched?: boolean;
  growings?: Growing[];
  path_matter?: 'beton' | 'houtsnippers';
  matter?: string;
  branches?: GardenPart[];
  pitch_degrees?: number;
  capacity_liters?: number;
  has_workbench?: boolean;
  building_type?: string;
  wall_type?: string;
}

export interface PlantTemperature {
  min_c?: number;
  optimal_c?: number;
  max_c?: number;
}

export interface PreferredActivity {
  activity_name?: ActivityName;
  location?: Location;
  months?: Month[];
}

export interface Diseases {
  common?: string[];
  prevention?: string[];
  notes?: string;
}

export interface Repot {
  recommended?: boolean;
  notes?: string;
}

export interface Plant {
  common_name?: string;
  description?: string;
  scientific_name?: string;
  purpose?: Purpose;
  category?: PlantCategory;
  url?: string;
  height_cm?: number;
  width_cm?: number;
  perennial?: Perennial;
  pitch?: Pitch;
  soil?: Soil;
  water?: string;
  temperature?: PlantTemperature;
  humidity?: PlantHumidity;
  sowing_depth_cm?: number;
  sowing_distance_cm?: number;
  preferred_activities?: PreferredActivity[];
  winter_prep?: string;
  diseases?: Diseases;
  fertilization?: string;
  toxic?: string;
  repot?: Repot;
}

export interface BedUniquePatch {
  soil?: Soil;
  mulched?: boolean;
  growings?: Growing[];
}

export interface PathUniquePatch {
  path_matter?: 'beton' | 'houtsnippers';
  branches?: GardenPart[];
}

export interface EmbankmentUniquePatch {
  pitch_degrees?: number;
}

export interface WaterTankUniquePatch {
  capacity_liters?: number;
}

export interface ShedUniquePatch {
  has_workbench?: boolean;
}

export interface GreenhouseUniquePatch {
  wall_type?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getGardens(): Observable<Garden[]> {
    return this.http.get<Garden[]>(`${this.base}/gardens`);
  }

  getGarden(gardenName: string): Observable<Garden> {
    return this.http.get<Garden>(`${this.base}/gardens/${encodeURIComponent(gardenName)}`);
  }

  getPlants(): Observable<Plant[]> {
    return this.http.get<Plant[]>(`${this.base}/plants`);
  }

  getPlant(plantName: string): Observable<Plant> {
    return this.http.get<Plant>(`${this.base}/plants/${encodeURIComponent(plantName)}`);
  }

  getSeeds(): Observable<Seed[]> {
    return this.http.get<Seed[]>(`${this.base}/seeds`);
  }

  getWebshops(): Observable<Webshop[]> {
    return this.http.get<Webshop[]>(`${this.base}/webshops`);
  }

  createSeed(seed: Seed): Observable<Seed> {
    return this.http.post<Seed>(`${this.base}/seeds`, seed);
  }

  deleteSeed(seedIndex: number): Observable<Seed> {
    return this.http.delete<Seed>(`${this.base}/seeds/${seedIndex}`);
  }

  getGardenParts(gardenName: string): Observable<GardenPart[]> {
    return this.http.get<GardenPart[]>(`${this.base}/gardens/${encodeURIComponent(gardenName)}/parts`);
  }

  createBed(gardenName: string, part: GardenPart): Observable<Garden> {
    return this.http.post<Garden>(`${this.base}/gardens/${encodeURIComponent(gardenName)}/beds`, { bed: part });
  }

  patchBed(gardenName: string, bedName: string, bed: BedUniquePatch): Observable<Garden> {
    return this.http.patch<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/beds/${encodeURIComponent(bedName)}`,
      { bed }
    );
  }

  addGrowingActivity(gardenName: string, bedName: string, growingIndex: number, growing_activity: GrowingActivity): Observable<Garden> {
    return this.http.post<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/beds/${encodeURIComponent(bedName)}/growings/${growingIndex}/activities`,
      { growing_activity }
    );
  }

  createPath(gardenName: string, part: GardenPart): Observable<Garden> {
    return this.http.post<Garden>(`${this.base}/gardens/${encodeURIComponent(gardenName)}/paths`, { path: part });
  }

  patchPath(gardenName: string, pathName: string, path: PathUniquePatch): Observable<Garden> {
    return this.http.patch<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/paths/${encodeURIComponent(pathName)}`,
      { path }
    );
  }

  createEmbankment(gardenName: string, part: GardenPart): Observable<Garden> {
    return this.http.post<Garden>(`${this.base}/gardens/${encodeURIComponent(gardenName)}/embankments`, { embankment: part });
  }

  patchEmbankment(gardenName: string, embankmentName: string, embankment: EmbankmentUniquePatch): Observable<Garden> {
    return this.http.patch<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/embankments/${encodeURIComponent(embankmentName)}`,
      { embankment }
    );
  }

  createWaterTank(gardenName: string, part: GardenPart): Observable<Garden> {
    return this.http.post<Garden>(`${this.base}/gardens/${encodeURIComponent(gardenName)}/water-tanks`, { water_tank: part });
  }

  patchWaterTank(gardenName: string, waterTankName: string, water_tank: WaterTankUniquePatch): Observable<Garden> {
    return this.http.patch<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/water-tanks/${encodeURIComponent(waterTankName)}`,
      { water_tank }
    );
  }

  createShed(gardenName: string, part: GardenPart): Observable<Garden> {
    return this.http.post<Garden>(`${this.base}/gardens/${encodeURIComponent(gardenName)}/sheds`, { shed: part });
  }

  patchShed(gardenName: string, shedName: string, shed: ShedUniquePatch): Observable<Garden> {
    return this.http.patch<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/sheds/${encodeURIComponent(shedName)}`,
      { shed }
    );
  }

  createGreenhouse(gardenName: string, part: GardenPart): Observable<Garden> {
    return this.http.post<Garden>(`${this.base}/gardens/${encodeURIComponent(gardenName)}/greenhouses`, { greenhouse: part });
  }

  patchGreenhouse(gardenName: string, greenhouseName: string, greenhouse: GreenhouseUniquePatch): Observable<Garden> {
    return this.http.patch<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/greenhouses/${encodeURIComponent(greenhouseName)}`,
      { greenhouse }
    );
  }

  updateGardenPartFootprint(
    gardenName: string,
    partName: string,
    partType: PartType,
    footprint: PlanFootprint
  ): Observable<Garden> {
    return this.http.put<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/parts/${encodeURIComponent(partName)}/footprint`,
      { part_type: partType, footprint }
    );
  }

  deleteGardenPart(gardenName: string, partName: string, partType?: PartType): Observable<Garden> {
    const query = partType ? `?part_type=${encodeURIComponent(partType)}` : '';
    return this.http.delete<Garden>(
      `${this.base}/gardens/${encodeURIComponent(gardenName)}/parts/${encodeURIComponent(partName)}${query}`
    );
  }
}
