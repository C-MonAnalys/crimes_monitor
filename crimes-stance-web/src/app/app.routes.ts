import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { EventsCollectionComponent } from './pages/collections/events-collection.component';
import { OpinionCollectionComponent } from './pages/collections/positioning-collection.component';
import { EventsAnalysisComponent } from './pages/analysis/events-analysis.component';
import { OpinionAnalysisComponent } from './pages/analysis/positioning-analysis.component';
import { OperationDetailsComponent } from './pages/details/operation-details.component';
import { DatasetSelectionComponent } from './pages/analysis/dataset-selection/dataset-selection';

const AvaliacoesEventos = () =>
  import('./pages/avaliacoes/eventos/avaliacoes-eventos.component')
    .then(m => m.AvaliacoesEventosComponent);

const AvaliacoesPosicionamento = () =>
  import('./pages/avaliacoes/posicionamento/avaliacoes-posicionamento.component')
    .then(m => m.AvaliacoesPosicionamentoComponent);

// Reuso de componentes existentes (analises)
const AnaliseEventos = () =>
  import('./pages/analysis/events-analysis.component') // já existe no seu projeto
    .then(m => m.EventsAnalysisComponent);

const AnalisePosicionamentoExistente = () =>
  import('./pages/analysis/positioning-analysis.component') // seu componente atual
    .then(m => m.OpinionAnalysisComponent);

const EventosList = () =>
  import('./pages/real/eventos/eventos-list.component')
    .then(m => m.EventosListComponent);

const EventosReal = () =>
  import('./pages/real/eventos/eventos-real.component')
    .then(m => m.EventosRealComponent);

const PosicionamentoList = () =>
  import('./pages/real/posicionamento/posicionamento-list.component')
    .then(m => m.PosicionamentoListComponent);

const PosicionamentoReal = () =>
  import('./pages/real/posicionamento/posicionamento-real.component')
    .then(m => m.PosicionamentoRealComponent);

const Home = () =>
  import('./pages/home/home.component').then(m => m.HomeComponent);



export const routes: Routes = [
  { path: 'home', loadComponent: Home },
  {
    path: 'avaliacoes',
    children: [
      { path: 'eventos', loadComponent: AvaliacoesEventos },
      { path: 'posicionamento', loadComponent: AvaliacoesPosicionamento },
      { path: '', redirectTo: 'eventos', pathMatch: 'full' },
    ],
  },
	{ path: '', redirectTo: 'home', pathMatch: 'full' },
	{ path: 'dashboard', component: DashboardComponent },
	{ path: 'coletas/eventos', component: EventsCollectionComponent },
	{ path: 'coletas/posicionamento', component: OpinionCollectionComponent },
	{
    path: 'analises',
    children: [
      { path: 'posicionamento', component: DatasetSelectionComponent },
      { path: 'posicionamento/:datasetId', component: OpinionAnalysisComponent },
      { path: 'eventos', component: EventsAnalysisComponent },
    ]
  },

  // Cenário real — Eventos
  { path: 'eventos', redirectTo: 'eventos/brasil_all', pathMatch: 'full' },
  { path: 'eventos/:id', loadComponent: EventosReal },

  // Cenário real — Posicionamento
  { path: 'posicionamento', loadComponent: PosicionamentoList },
  { path: 'posicionamento/:id', loadComponent: PosicionamentoReal },

	{ path: 'operacao/:id', component: OperationDetailsComponent }
];
