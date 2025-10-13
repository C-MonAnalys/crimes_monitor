import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SentimentRealService } from '../../../services/posicionamento-real.service';
import { withTimeout } from '../../../services/promise-timeout.util';

@Component({
  selector: 'app-posicionamento-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './posicionamento-list.component.html'
})
export class PosicionamentoListComponent implements OnInit {
  private real = inject(SentimentRealService);

  isLoading = true;
  timedOut = false;
  error = '';

  datasets: Array<{ id: string; title: string }> = [];

  async ngOnInit() {
    const load = this.real.getDatasets();
    try {
      const map = await withTimeout(load, 5000);
      this.apply(map);
    } catch (e: any) {
      if (e?.message === 'TIMEOUT') {
        this.timedOut = true; this.isLoading = false;
        load.then(map => this.apply(map))
            .catch(() => { this.error = 'Não foi possível carregar os datasets de posicionamento.'; });
      } else {
        this.error = 'Não foi possível carregar os datasets de posicionamento.'; this.isLoading = false;
      }
    }
  }

  private apply(map: Record<string, any>) {
    this.datasets = Object.entries(map || {}).map(([id, cfg]: any) => ({ id, title: cfg.title || id }));
    this.isLoading = false; this.timedOut = false; this.error = '';
  }
}
