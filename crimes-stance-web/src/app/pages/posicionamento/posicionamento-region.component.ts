import { Component } from '@angular/core';
import { RegionSelectorComponent } from '../../components/shared/region-selector/region-selector.component';

@Component({
  selector: 'app-posicionamento-region',
  standalone: true,
  imports: [RegionSelectorComponent],
  template: `
    <app-region-selector
      modulo="sentiment"
      routeBase="/posicionamento"
      titulo="Posicionamento"
      descricao="Selecione a região para analisar a percepção da audiência sobre operações policiais através de modelos de inteligência artificial."
      heroTag="Cenário Real"
      heroBreadcrumb="Sentiment Analysis"
      heroGradient="from-blue-400 to-indigo-400">
    </app-region-selector>
  `
})
export class PosicionamentoRegionComponent {}
