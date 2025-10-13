import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { EventsRealService } from '../../../services/events-real.service';
import { withTimeout } from '../../../services/promise-timeout.util';

@Component({
  selector: 'app-eventos-real',
  standalone: true,
  imports: [CommonModule, ChartModule],
  templateUrl: './eventos-real.component.html'
})
export class EventosRealComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private real = inject(EventsRealService);

  isLoading = true;
  timedOut = false;
  error = '';

  datasetId = '';
  meta: any = null;
  videos: any[] = [];
  yearChart: any; yearOpts: any;
  dayChart: any; dayOpts: any;

  async ngOnInit() {
    this.datasetId = this.route.snapshot.paramMap.get('id') || '';

    const load = this.real.loadDataset(this.datasetId);
    try {
      const data = await withTimeout(load, 5000);
      this.apply(data);
    } catch (e:any) {
      if (e?.message === 'TIMEOUT') {
        this.timedOut = true; this.isLoading = false;
        load.then(full => this.apply(full))
            .catch(() => { this.error = 'Não foi possível carregar o dataset.'; });
      } else {
        this.error = 'Não foi possível carregar o dataset.'; this.isLoading = false;
      }
    }
  }

  private apply(payload: any) {
    this.meta = payload.meta;
    this.videos = payload.videos;

    this.yearChart = {
      labels: payload.series.byYear.labels,
      datasets: [{ label: 'Vídeos por ano', data: payload.series.byYear.values, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.12)', tension: .25, fill: true }]
    };
    this.yearOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } };

    this.dayChart = {
      labels: payload.series.byDay.labels,
      datasets: [{ label: 'Vídeos por dia', data: payload.series.byDay.values, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.12)', tension: .25, fill: true }]
    };
    this.dayOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } };

    this.isLoading = false;
    this.timedOut = false;
    this.error = '';
  }
}
