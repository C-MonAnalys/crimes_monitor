import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrquestratorService, Regiao } from '../../../services/orquestrator.service';
import { PageHeroComponent } from '../page-hero/page-hero.component';

@Component({
  selector: 'app-region-selector',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeroComponent],
  templateUrl: './region-selector.component.html',
  styles: [`
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeInUp {
      animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
    }
    .delay-1 { animation-delay: 0.1s; }
    .delay-2 { animation-delay: 0.2s; }
    .delay-3 { animation-delay: 0.3s; }
    .delay-4 { animation-delay: 0.4s; }
  `]
})
export class RegionSelectorComponent implements OnInit {
  @Input() modulo!: 'events' | 'sentiment';
  @Input() routeBase!: string;         // '/eventos' ou '/posicionamento'
  @Input() titulo = 'Selecionar Região';
  @Input() descricao = 'Escolha a região para explorar os dados.';
  @Input() heroTag = 'Cenário Real';
  @Input() heroBreadcrumb = '';
  @Input() heroGradient = 'from-blue-400 to-indigo-400';

  private orquestrator = inject(OrquestratorService);

  isLoading = true;
  error = '';
  regioes: Regiao[] = [];

  async ngOnInit() {
    try {
      this.regioes = await this.orquestrator.getRegioes(this.modulo);
      if (this.regioes.length === 0) {
        this.error = 'Nenhuma região encontrada no orquestrator.json.';
      }
    } catch (e) {
      this.error = 'Erro ao carregar as regiões disponíveis.';
      console.error(e);
    } finally {
      this.isLoading = false;
    }
  }

  getAnimationDelay(index: number): string {
    return `delay-${Math.min(index + 1, 4)}`;
  }

  getRouterLink(regiao: Regiao): string[] {
    return [this.routeBase, regiao.id];
  }

  getIconClass(regiao: Regiao): string {
    return regiao.icone || (regiao.caminho === '.' ? 'bi-globe-americas' : 'bi-geo-alt-fill');
  }

  getAccentColor(index: number): { bg: string; text: string; border: string; shadow: string } {
    const palettes = [
      { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100',   shadow: 'shadow-blue-500/10' },
      { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-100',  shadow: 'shadow-indigo-500/10' },
      { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', shadow: 'shadow-emerald-500/10' },
      { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100',   shadow: 'shadow-amber-500/10' },
      { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-100',     shadow: 'shadow-rose-500/10' },
    ];
    return palettes[index % palettes.length];
  }
}
