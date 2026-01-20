import { Routes } from '@angular/router';

export const routes: Routes = [
	{ path: '', redirectTo: 'beds', pathMatch: 'full' },
	{ path: 'beds', loadComponent: () => import('./components/beds-list/beds-list').then(m => m.BedsList) },
	{ path: 'plants', loadComponent: () => import('./components/plants-list/plants-list').then(m => m.PlantsList) },
	{ path: '**', redirectTo: 'beds' }
];
