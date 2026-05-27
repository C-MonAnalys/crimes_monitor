import { Component } from '@angular/core';
import { RegionSelectorComponent } from '../../components/shared/region-selector/region-selector.component';

@Component({
  selector: 'app-eventos-region',
  standalone: true,
  imports: [RegionSelectorComponent],
  template: `
    <app-region-selector
      modulo="events"
      routeBase="/eventos"
      titulo="Eventos"
      descricao="Selecione a região para explorar as operações policiais detectadas automaticamente pela heurística temporal."
      heroTag="Cenário Real"
      heroBreadcrumb="Heurística Temporal"
      heroGradient="from-blue-400 to-blue-200">
    </app-region-selector>
  `
})
export class EventosRegionComponent {}
