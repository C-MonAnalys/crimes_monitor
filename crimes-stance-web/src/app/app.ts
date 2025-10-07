import { Component, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterModule, SidebarComponent, HeaderComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('crimes-stance-web');
  sidebarOpen = false;
  sidebarCollapsed = false;
  private routerSubscription?: Subscription;
  @ViewChild('mainScroll') mainScroll?: ElementRef<HTMLElement>;

  constructor(private router: Router) {}

  ngOnInit() {
    // Scroll para o topo quando a rota mudar
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // Rola o container principal para o topo
        const el = this.mainScroll?.nativeElement;
        if (el) {
          el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } else {
          // Fallback
          window.scrollTo(0, 0);
        }
      });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  onSidebarToggle() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    try {
      localStorage.setItem('sidebar-collapsed', String(this.sidebarCollapsed));
    } catch (e) {}
  }
}
