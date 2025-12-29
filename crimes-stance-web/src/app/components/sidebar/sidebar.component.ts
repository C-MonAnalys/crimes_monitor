import { Component, Output, EventEmitter, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: `
    <aside
      class="flex flex-col h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-100 transition-all duration-300 flex-shrink-0 shadow-xl"
      [ngClass]="{ 'w-64': !isCollapsed, 'w-16': isCollapsed }"
    >
      <div class="flex items-center justify-between p-4 border-b border-white/10">
        <a [routerLink]="'/home'" (click)="onNavigate()" class="flex items-center gap-2 font-semibold text-lg no-underline text-inherit">
          <img src="assets/img/logo-paad.png" alt="Crimes Stance" [ngClass]="isCollapsed ? 'w-6 h-6' : 'w-8 h-8'" class="bg-white/5 flex-shrink-0 rounded" />
          <span class="ml-1" *ngIf="!isCollapsed">Crimes Stance</span>
        </a>
      </div>

      <nav class="flex-1 py-4 overflow-y-auto overflow-x-hidden custom-scroll">
        <ul class="space-y-1">
          <li class="relative group" *ngFor="let item of navItems">
            <!-- Item simples -->
            <ng-container *ngIf="!item.hasSubmenu">
              <a
                [routerLink]="item.link"
                routerLinkActive="active-link"
                (click)="onNavigate()"
                class="flex items-center gap-3 px-4 py-3 text-slate-100 no-underline transition-all border-l-4 border-transparent hover:bg-white/5 hover:text-slate-200 hover:border-blue-400 rounded-r-full"
              >
                <i class="bi" [ngClass]="item.icon + ' text-blue-400 text-lg'"></i>
                <span *ngIf="!isCollapsed">{{ item.text }}</span>
                <span
                  *ngIf="isCollapsed"
                  class="absolute left-full top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:visible invisible transition-all ml-2 shadow-lg z-50"
                >
                  {{ item.tooltip }}
                </span>
              </a>
            </ng-container>

            <!-- Item com submenu -->
            <ng-container *ngIf="item.hasSubmenu">
              <button
                (click)="toggleSubmenu(item.id)"
                class="w-full flex items-center gap-3 px-4 py-3 text-slate-100 transition-all border-l-4 border-transparent hover:bg-white/5 hover:text-slate-200 hover:border-blue-400 bg-transparent border-none cursor-pointer rounded-r-full"
              >
                <i class="bi" [ngClass]="item.icon + ' text-blue-400 text-lg'" (click)="$event.stopPropagation(); toggleQuickSummary(item.id)"></i>
                <span *ngIf="!isCollapsed" class="flex-1 text-left">{{ item.text }}</span>
                <i *ngIf="!isCollapsed" class="bi transition-transform duration-200" [ngClass]="isSubmenuExpanded(item.id) ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
                <span
                  *ngIf="isCollapsed"
                  class="absolute left-full top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:visible invisible transition-all ml-2 shadow-lg z-50"
                >
                  {{ item.tooltip }}
                </span>
              </button>

              <!-- Submenus -->
              <ul *ngIf="!isCollapsed && isSubmenuExpanded(item.id)" class="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-4">
                <li *ngFor="let subItem of item.subItems">
                  <a
                    [routerLink]="subItem.link"
                    routerLinkActive="active-link"
                    (click)="onNavigate()"
                    class="flex items-center gap-3 px-4 py-2 text-slate-300 no-underline transition-all hover:bg-white/5 hover:text-slate-100 rounded-md"
                  >
                    <i class="bi" [ngClass]="subItem.icon + ' text-blue-300 text-sm'"></i>
                    <span>{{ subItem.text }}</span>
                  </a>
                </li>
              </ul>
            </ng-container>
          </li>
        </ul>
      </nav>

      <div class="p-4 border-t border-white/10 text-center">
        <div *ngIf="!isCollapsed" class="text-slate-400">
          <small>v1.0.0</small>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .active-link {
      background-color: rgb(96 165 250 / 0.15) !important;
      color: #93c5fd !important;
      border-left-color: #60a5fa !important;
    }
    .custom-scroll::-webkit-scrollbar { width: 8px; }
    .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 9999px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  `]
})
export class SidebarComponent {
  @Input() isCollapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() closeSidebar = new EventEmitter<void>();

  expandedMenus: Set<string> = new Set();

  // Navegação principal (destaque)
  navItems: NavItem[] = [
    {
      id: 'home',
      link: '/home',
      icon: 'bi-stars',
      text: 'Home',
      tooltip: 'Página inicial',
    },
    {
      id: 'cenario',
      icon: 'bi-broadcast',
      text: 'Cenário real',
      tooltip: 'Dados em contexto real',
      hasSubmenu: true,
      subItems: [
        { id: 'cenario-eventos',        link: '/eventos/brasil_all',  icon: 'bi-collection-play',  text: 'Eventos',        tooltip: 'Heurística em datasets reais' },
        { id: 'cenario-posicionamento', link: '/posicionamento',   icon: 'bi-chat-square-text', text: 'Posicionamento', tooltip: 'Modelo em datasets reais' }
      ]
    },
    {
      id: 'avaliacoes',
      icon: 'bi-clipboard-data',
      text: 'Avaliações',
      tooltip: 'Desempenho de modelos',
      hasSubmenu: true,
      subItems: [
        { id: 'avaliacoes-eventos',        link: '/avaliacoes/eventos',        icon: 'bi-collection',       text: 'Eventos',         tooltip: 'Avaliação de heurísticas' },
        { id: 'avaliacoes-posicionamento', link: '/avaliacoes/posicionamento', icon: 'bi-chat-left-quote',  text: 'Posicionamento',  tooltip: 'Métricas do modelo' }
      ]
    },
  ];

  constructor() {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      this.isCollapsed = saved === 'true';
      const savedMenus = localStorage.getItem('sidebar-expanded-menus');
      if (savedMenus) this.expandedMenus = new Set(JSON.parse(savedMenus));
    } catch {}
  }

  toggleSubmenu(menuId: string) {
    if (this.expandedMenus.has(menuId)) this.expandedMenus.delete(menuId);
    else this.expandedMenus.add(menuId);
    this.persistMenus();
  }

  isSubmenuExpanded(menuId: string): boolean {
    return this.expandedMenus.has(menuId);
  }

  onToggleCollapse() {
    const next = !this.isCollapsed;
    this.collapsedChange.emit(next);
  }

  onNavigate() {
    this.closeSidebar.emit();
  }

  private persistMenus() {
    try { localStorage.setItem('sidebar-expanded-menus', JSON.stringify(Array.from(this.expandedMenus))); } catch {}
  }

  // Quick summary state (mantido para futura expansão)
  private quickSummaryOpen: Set<string> = new Set();
  toggleQuickSummary(menuId: string) {
    if (this.quickSummaryOpen.has(menuId)) this.quickSummaryOpen.delete(menuId);
    else this.quickSummaryOpen.add(menuId);
  }
  isQuickSummaryOpen(menuId: string) {
    return this.quickSummaryOpen.has(menuId);
  }
}

// Types
interface BaseItem { id: string; icon: string; text: string; tooltip: string; }
interface LinkItem extends BaseItem { link: string; hasSubmenu?: false; }
interface MenuItem extends BaseItem { hasSubmenu: true; subItems: LinkItem[]; }
type NavItem = LinkItem | MenuItem;
