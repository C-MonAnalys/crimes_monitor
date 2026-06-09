import { Component, Output, EventEmitter, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: `
    <aside
      class="flex flex-col h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-slate-100 transition-all duration-300 flex-shrink-0 shadow-2xl"
      [ngClass]="{ 'w-64': !isCollapsed, 'w-16': isCollapsed }"
    >
      <!-- Cabeçalho da Sidebar -->
      <div class="flex items-center justify-between p-4 border-b border-white/5" [ngClass]="{ 'flex-row': !isCollapsed, 'flex-col gap-3': isCollapsed }">
        <a [routerLink]="'/home'" (click)="onNavigate()" class="flex items-center gap-2 font-semibold no-underline text-inherit">
          <img src="assets/img/logo-paad.png" alt="Urban Violence Monitor" [ngClass]="isCollapsed ? 'w-6 h-6' : 'w-8 h-8'" class="bg-white/5 flex-shrink-0 rounded-lg shadow-sm" />
          <span class="ml-1 text-sm font-black leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300" *ngIf="!isCollapsed">Urban Violence Monitor</span>
        </a>
        
        <!-- Botão de Toggle (Desktop) -->
        <button (click)="onToggleCollapse()" class="hidden md:flex bg-transparent border-none text-slate-400 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-white/5 transition active:scale-95 items-center justify-center" [title]="isCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'">
          <i class="bi bi-layout-sidebar text-lg"></i>
        </button>

        <!-- Botão Fechar (Mobile) -->
        <button (click)="closeSidebar.emit()" class="md:hidden bg-transparent border-none text-slate-400 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-white/5 transition active:scale-95 flex items-center justify-center" title="Fechar menu">
          <i class="bi bi-x-lg text-lg"></i>
        </button>
      </div>

      <!-- Menu de Navegação -->
      <nav class="flex-1 py-4 overflow-y-auto overflow-x-hidden custom-scroll">
        <ul class="space-y-1.5">
          <li class="relative group" *ngFor="let item of navItems">
            <!-- Item simples -->
            <ng-container *ngIf="!item.hasSubmenu">
              <a
                [routerLink]="item.link"
                routerLinkActive="active-link"
                [routerLinkActiveOptions]="{ exact: item.link === '/home' }"
                (click)="onNavigate()"
                class="flex items-center text-slate-400 hover:text-slate-100 no-underline transition-all group/item"
                [ngClass]="isCollapsed ? 'justify-center w-10 h-10 mx-auto rounded-xl my-0.5 hover:bg-white/5' : 'gap-3 mx-3 px-4 py-2.5 rounded-xl my-0.5 hover:bg-white/5'"
              >
                <i class="bi text-lg transition-transform duration-200 group-hover/item:scale-110" [ngClass]="item.icon"></i>
                <span *ngIf="!isCollapsed" class="font-semibold text-sm tracking-wide">{{ item.text }}</span>
                
                <!-- Tooltip para Sidebar Colapsada -->
                <span
                  *ngIf="isCollapsed"
                  class="absolute left-full top-1/2 -translate-y-1/2 bg-slate-950 text-slate-100 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:visible invisible transition-all duration-200 ml-3 shadow-2xl border border-white/5 z-50"
                >
                  {{ item.tooltip }}
                </span>
              </a>
            </ng-container>

            <!-- Item com submenu -->
            <ng-container *ngIf="item.hasSubmenu">
              <button
                (click)="toggleSubmenu(item.id)"
                class="flex items-center text-slate-400 hover:text-slate-100 transition-all bg-transparent border-none cursor-pointer group/item"
                [ngClass]="isCollapsed ? 'justify-center w-10 h-10 mx-auto rounded-xl my-0.5 hover:bg-white/5' : 'gap-3 mx-3 px-4 py-2.5 rounded-xl my-0.5 hover:bg-white/5 w-[calc(100%-1.5rem)]'"
              >
                <i class="bi text-lg transition-transform duration-200 group-hover/item:scale-110" [ngClass]="[item.icon, isSubmenuExpanded(item.id) && !isCollapsed ? 'text-blue-400' : '']" (click)="$event.stopPropagation(); toggleQuickSummary(item.id)"></i>
                <span *ngIf="!isCollapsed" class="flex-1 text-left font-semibold text-sm tracking-wide">{{ item.text }}</span>
                <i *ngIf="!isCollapsed" class="bi transition-transform duration-200 text-xs text-slate-500" [ngClass]="isSubmenuExpanded(item.id) ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
                
                <!-- Tooltip para Sidebar Colapsada -->
                <span
                  *ngIf="isCollapsed"
                  class="absolute left-full top-1/2 -translate-y-1/2 bg-slate-950 text-slate-100 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:visible invisible transition-all duration-200 ml-3 shadow-2xl border border-white/5 z-50"
                >
                  {{ item.tooltip }}
                </span>
              </button>

              <!-- Submenus -->
              <ul *ngIf="!isCollapsed && isSubmenuExpanded(item.id)" class="mt-0.5 space-y-0.5 animate-in fade-in duration-300">
                <li *ngFor="let subItem of item.subItems">
                  <a
                    [routerLink]="subItem.link"
                    routerLinkActive="active-link"
                    (click)="onNavigate()"
                    class="flex items-center gap-3 mx-3 pl-10 pr-4 py-2 text-slate-400 hover:text-slate-100 no-underline transition-all rounded-xl hover:bg-white/5 text-xs font-semibold tracking-wide"
                  >
                    <i class="bi text-sm" [ngClass]="subItem.icon"></i>
                    <span>{{ subItem.text }}</span>
                  </a>
                </li>
              </ul>
            </ng-container>
          </li>
        </ul>
      </nav>

      <div class="p-4 border-t border-white/5 text-center">
        <div *ngIf="!isCollapsed" class="text-slate-500 font-bold text-[10px] uppercase tracking-widest">
          v1.0.0
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .active-link {
      background-color: rgba(59, 130, 246, 0.12) !important;
      color: #60a5fa !important;
    }
    .active-link i {
      color: #60a5fa !important;
    }
    .custom-scroll::-webkit-scrollbar { width: 6px; }
    .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 9999px; }
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
      id: 'eventos',
      link: '/eventos',
      icon: 'bi-collection-play',
      text: 'Eventos',
      tooltip: 'Heurística em datasets reais',
    },
    {
      id: 'posicionamento',
      link: '/posicionamento',
      icon: 'bi-chat-square-text',
      text: 'Posicionamento',
      tooltip: 'Modelo em datasets reais',
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
