import { Routes } from '@angular/router';

export const routes: Routes = [
	{ path: '', redirectTo: 'beds', pathMatch: 'full' },
	{ path: 'gardens/:gardenName', loadComponent: () => import('./components/garden-detail/garden-detail').then(m => m.GardenDetail) },
	{ path: 'gardens', loadComponent: () => import('./components/gardens-list/gardens-list').then(m => m.GardensList) },
	{ path: 'planning', loadComponent: () => import('./components/planning/planning').then(m => m.Planning) },
	{ path: 'plants', loadComponent: () => import('./components/plants-list/plants-list').then(m => m.PlantsList) },	
	{ path: '**', redirectTo: 'gardens' }
];
