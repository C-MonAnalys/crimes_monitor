import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EventsRealService } from '../../../services/events-real.service';
import { withTimeout } from '../../../services/promise-timeout.util';

@Component({
  selector: 'app-eventos-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './eventos-list.component.html'
})
export class EventosListComponent implements OnInit {
  private real = inject(EventsRealService);

  isLoading = true;
  error = '';
  timedOut = false;

  datasets: Array<{ id: string; label: string; description?: string }> = [];

  async ngOnInit() {
    const load = this.real.getDatasets();
    try {
      const all = await withTimeout(load, 5000);
      this.apply(all);
    } catch (e:any) {
      if (e?.message === 'TIMEOUT') {
        this.timedOut = true; this.isLoading = false;
        load.then(all => this.apply(all))
            .catch(() => this.error = 'Não foi possível carregar os datasets de eventos.');
      } else {
        this.error = 'Não foi possível carregar os datasets de eventos.'; this.isLoading = false;
      }
    }
  }

  private apply(all: Record<string, any>) {
    this.datasets = Object.entries(all || {})
      .filter(([id, cfg]: any) => cfg && (cfg.file === '__ALL__' || id === 'brasil_all'))
      .map(([id, cfg]: any) => ({ id, label: cfg.label, description: cfg.description }));
    this.isLoading = false;
    this.timedOut = false;
    this.error = '';
  }
}
