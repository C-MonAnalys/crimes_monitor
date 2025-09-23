import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { EventsCollectionComponent } from './pages/collections/events-collection.component';
import { OpinionCollectionComponent } from './pages/collections/positioning-collection.component';
import { EventsAnalysisComponent } from './pages/analysis/events-analysis.component';
import { OpinionAnalysisComponent } from './pages/analysis/positioning-analysis.component';
import { OperationDetailsComponent } from './pages/details/operation-details.component';
import { DatasetSelectionComponent } from './pages/analysis/dataset-selection/dataset-selection';

export const routes: Routes = [
	{ path: '', redirectTo: 'dashboard', pathMatch: 'full' },
	{ path: 'dashboard', component: DashboardComponent },
	{ path: 'coletas/eventos', component: EventsCollectionComponent },
	{ path: 'coletas/posicionamento', component: OpinionCollectionComponent },
	{
    path: 'analises',
    children: [
      // 2. A rota 'posicionamento' agora aponta para a página de SELEÇÃO
      { path: 'posicionamento', component: DatasetSelectionComponent },
      // 3. A página de ANÁLISE agora espera um parâmetro 'datasetId' na URL
      { path: 'posicionamento/:datasetId', component: OpinionAnalysisComponent },
      { path: 'eventos', component: EventsAnalysisComponent },
    ]
  },
	{ path: 'operacao/:id', component: OperationDetailsComponent }
];
