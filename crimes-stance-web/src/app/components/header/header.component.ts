import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="flex items-center h-16 bg-white border-b border-blue-300/20 w-full z-30">
      <div class="flex flex-1 items-center justify-between max-w-screen-2xl pl-6 pr-6 md:pr-12">
        <!-- Lado Esquerdo -->
        <div class="flex items-center gap-3 font-bold text-slate-900">
          <!-- Botão menu mobile (abre sidebar) -->
          <button class="md:hidden bg-transparent border-none p-2 rounded-xl cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition" (click)="menuClick.emit()" title="Menu">
            <i class="bi bi-list text-lg"></i>
          </button>

          <!-- Botão de Voltar (Desktop) -->
          <button (click)="goBack()" class="hidden md:inline-flex bg-transparent border-none p-2 rounded-xl cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition" title="Voltar para a página anterior">
            <i class="bi bi-arrow-left text-lg"></i>
          </button>

          <!-- Ícone Dinâmico -->
          <i class="bi text-blue-500 text-xl ml-1" [ngClass]="currentIcon"></i>
          <span class="text-base font-black tracking-tight text-slate-900">{{ currentTitle }}</span>
        </div>

        <!-- Lado Direito (Mobile) -->
        <div class="flex items-center md:hidden">
          <!-- Botão de Voltar (Mobile) -->
          <button (click)="goBack()" class="bg-transparent border-none p-2 rounded-xl cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition" title="Voltar para a página anterior">
            <i class="bi bi-arrow-left text-lg"></i>
          </button>
        </div>
      </div>
    </header>
  `,
  styles: [
    `:host { display: block; width: 100%; }`
  ]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() menuClick = new EventEmitter<void>();

  currentTitle = 'Home';
  currentIcon = 'bi-stars';
  private routerSub?: Subscription;

  constructor(private router: Router, private location: Location) {}

  ngOnInit() {
    this.updateTitle(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateTitle(event.urlAfterRedirects || event.url);
      });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  goBack() {
    this.location.back();
  }

  private updateTitle(url: string) {
    this.currentTitle = this.getTitle(url);
    this.currentIcon = this.getIcon(url);
  }

  private getTitle(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    
    if (path === '/' || path === '/home') {
      return 'Home';
    }
    if (path.startsWith('/eventos')) {
      return 'Eventos';
    }
    if (path.startsWith('/posicionamento')) {
      return 'Posicionamentos';
    }
    if (path.startsWith('/avaliacoes/eventos')) {
      return 'Avaliações de Eventos';
    }
    if (path.startsWith('/avaliacoes/posicionamento')) {
      return 'Avaliações de Posicionamentos';
    }
    if (path.startsWith('/avaliacoes')) {
      return 'Avaliações';
    }
    if (path.startsWith('/dashboard')) {
      return 'Dashboard';
    }
    if (path.startsWith('/coletas/eventos')) {
      return 'Coletas de Eventos';
    }
    if (path.startsWith('/coletas/posicionamento')) {
      return 'Coletas de Posicionamentos';
    }
    if (path.startsWith('/analises/posicionamento')) {
      return 'Análises de Posicionamentos';
    }
    if (path.startsWith('/analises/eventos')) {
      return 'Análises de Eventos';
    }
    if (path.startsWith('/operacao')) {
      return 'Detalhes da Operação';
    }
    return 'Urban Violence Monitor';
  }

  private getIcon(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    
    if (path === '/' || path === '/home') {
      return 'bi-stars';
    }
    if (path.startsWith('/eventos')) {
      return 'bi-collection-play';
    }
    if (path.startsWith('/posicionamento')) {
      return 'bi-chat-square-text';
    }
    if (path.startsWith('/avaliacoes')) {
      return 'bi-clipboard-data';
    }
    if (path.startsWith('/dashboard')) {
      return 'bi-speedometer2';
    }
    if (path.startsWith('/coletas')) {
      return 'bi-cloud-download';
    }
    if (path.startsWith('/analises')) {
      return 'bi-graph-up';
    }
    if (path.startsWith('/operacao')) {
      return 'bi-info-circle';
    }
    return 'bi-bar-chart';
  }
}