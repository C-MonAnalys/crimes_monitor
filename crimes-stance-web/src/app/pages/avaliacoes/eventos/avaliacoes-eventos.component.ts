import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';

import { EventsService } from '../../../services/events.service';
import { withTimeout } from '../../../services/promise-timeout.util';

@Component({
  selector: 'app-avaliacoes-eventos',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartModule],
  templateUrl: './avaliacoes-eventos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvaliacoesEventosComponent implements OnInit {

  private events = inject(EventsService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  // busca / filtros (wire pronto p/ fase 3 se quiser conectar)
  search = signal('');
  opFilter = signal<string | null>(null);

  isLoading = true;
  error = '';
  timedOut = false;

  hasPerfData = false;
  hasSeriesData = false;
  hasCompareData = false;

  // cards topo
  stats = signal({ totalVideos: 0, uniqOps: 0, period: '—', avgPerOp: 0 });

  // gráficos
  perfChartData: any; perfChartOpts: any;
  videosSeriesData: any; videosSeriesOpts: any;
  metricsCompareData: any; metricsCompareOpts: any;

  async ngOnInit() {
    const loadPromise = this.events.getEvaluationsOverview();

    try {
      // tenta carregar com limite (ex.: 5s)
      const data: any = await withTimeout(loadPromise, 5000);

      // <<< GARANTE CD com OnPush
      this.zone.run(() => {
        this.applyData(data);
        this.isLoading = false;
        this.timedOut = false;
        this.error = '';
        this.cdr.markForCheck();
      });

    } catch (err: any) {
      if (err?.message === 'TIMEOUT') {
        // timeout: mostra parcial (spinner off) e segue ouvindo a promise original
        this.zone.run(() => {
          this.timedOut = true;
          this.isLoading = false;
          this.error = '';
          this.cdr.markForCheck();
        });

        // quando a promise original terminar, aplicamos os dados e forçamos CD
        loadPromise.then(full => {
          this.zone.run(() => {
            this.applyData(full);
            this.timedOut = false;
            this.cdr.markForCheck();
          });
        }).catch(e => {
          this.zone.run(() => {
            this.error = 'Não foi possível carregar os dados de avaliações.';
            this.cdr.markForCheck();
          });
        });

      } else {
        // erro real
        this.zone.run(() => {
          this.error = 'Não foi possível carregar os dados de avaliações.';
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      }
    }
  }

  private applyData(evalData: any) {
    if (!evalData) return;

    this.stats.set({
      totalVideos: evalData.datasets.totalVideos,
      uniqOps: evalData.datasets.uniqueOperations,
      period: evalData.datasets.periodLabel,
      avgPerOp: evalData.datasets.avgVideosPerOperation,
    });

    const labels = (evalData.performance ?? []).map((x: any) => x.label);
    const acc = (evalData.performance ?? []).map((x: any) => x.metrics.accuracy);
    const prec = (evalData.performance ?? []).map((x: any) => x.metrics.precision);
    const rec  = (evalData.performance ?? []).map((x: any) => x.metrics.recall);
    const f1   = (evalData.performance ?? []).map((x: any) => x.metrics.f1);

    this.hasPerfData = labels.length > 0;
    this.hasCompareData = this.hasPerfData;

    this.perfChartData = {
      labels,
      datasets: [
        { label: 'Acurácia',  data: acc,  backgroundColor: '#3b82f6' },
        { label: 'Precisão',  data: prec, backgroundColor: '#10b981' },
        { label: 'Revocação', data: rec,  backgroundColor: '#f59e0b' },
        { label: 'F1-Score',  data: f1,   backgroundColor: '#8b5cf6' },
      ]
    };
    this.perfChartOpts = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true, max: 1, ticks: { callback: (v:any)=>(v*100)+'%' } } }
    };

    const vp = evalData.videosByPeriod ?? { labels: [], values: [] };
    this.hasSeriesData = Array.isArray(vp.labels) && vp.labels.length > 0;

    this.videosSeriesData = {
      labels: vp.labels,
      datasets: [{
        label: 'Vídeos coletados',
        data: vp.values,
        tension: .3,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,.12)',
        fill: true
      }]
    };
    this.videosSeriesOpts = { responsive: true, maintainAspectRatio: false };

    this.metricsCompareData = {
      labels,
      datasets: [
        { label: 'Acurácia', data: acc,  borderColor: '#3b82f6' },
        { label: 'Precisão', data: prec, borderColor: '#10b981' },
        { label: 'Revocação', data: rec,  borderColor: '#f59e0b' },
        { label: 'F1-Score', data: f1,   borderColor: '#8b5cf6' },
      ]
    };
    this.metricsCompareOpts = { responsive: true, maintainAspectRatio: false };
  }
}
