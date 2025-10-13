import { Component, OnInit, inject, signal } from '@angular/core';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';

import { SentimentService } from '../../../services/sentiment.service';
import { withTimeout } from '../../../services/promise-timeout.util';

// Reaproveitados na página
import { BootstrapResultsCardComponent } from '../../../components/opinion-analysis/bootstrap-results-card/bootstrap-results-card';
import { DetailedMetricsCardComponent } from '../../../components/opinion-analysis/detailed-metrics-card/detailed-metrics-card';
import { ModelAccuracyCardComponent } from '../../../components/opinion-analysis/model-accuracy-card/model-accuracy-card';

@Component({
  selector: 'app-avaliacoes-posicionamento',
  standalone: true,
  imports: [
    CommonModule,
    ChartModule,
    BootstrapResultsCardComponent,
    DetailedMetricsCardComponent,
    ModelAccuracyCardComponent
  ],
  templateUrl: './avaliacoes-posicionamento.component.html'
})
export class AvaliacoesPosicionamentoComponent implements OnInit {
  private sentiments = inject(SentimentService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  isLoading = true;
  error = '';
  timedOut = false;

  dataset = signal<{ total: number; labels: { neg: number; neu: number; pos: number }; period: string }>({ total: 0, labels: { neg:0, neu:0, pos:0 }, period: '—' });
  bootstrap = signal<any[]>([]);
  modelAccuracy = signal({ precision: 0, recall: 0, f1Score: 0 });

  hasLabelData = false;
  hasBootstrapData = false;

  distData: any; distOpts: any;

  async ngOnInit() {
    const loadPromise = this.sentiments.getTrainingStats();

    try {
      const data: any = await withTimeout(loadPromise, 5000);
      this.applyData(data);
      this.isLoading = false;
    } catch (err: any) {
      if (err?.message === 'TIMEOUT') {
        this.timedOut = true;
        this.isLoading = false;
        this.error = '';
        loadPromise.then(full => {
          this.zone.run(() => {
            this.applyData(full);
            this.timedOut = false;
            this.cdr.markForCheck();
          });
        }).catch(e => {
          this.zone.run(() => {
            this.error = 'Não foi possível carregar estatísticas de treino.';
            this.cdr.markForCheck();
          });
        });
      } else {
        this.error = 'Não foi possível carregar estatísticas de treino.';
        this.isLoading = false;
      }
    }
  }

  private applyData(train: any) {
    if (!train) return;

    this.dataset.set({
      total: train.total ?? 0,
      labels: {
        neg: train.labels?.['-1'] ?? 0,
        neu: train.labels?.['0'] ?? 0,
        pos: train.labels?.['1'] ?? 0
      },
      period: train.period ?? '—'
    });

    this.bootstrap.set(Array.isArray(train.bootstrap) ? train.bootstrap : []);
    this.modelAccuracy.set(this.calcAccuracy(this.bootstrap()));

    const { neg, neu, pos } = this.dataset().labels;
    this.hasLabelData = (neg + neu + pos) > 0;
    this.hasBootstrapData = this.bootstrap().length > 0;

    this.distData = {
      labels: ['Desaprovação', 'Neutro', 'Aprovação'],
      datasets: [{ data: [neg, neu, pos], backgroundColor: ['#ef4444', '#6b7280', '#10b981'], borderWidth: 0 }]
    };
    this.distOpts = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx:any)=> `${ctx.label}: ${ctx.parsed} comentários` } } }
    };
  }

  private calcAccuracy(bootstrapData: any[]) {
    const avg = (prefix: string) => {
      const items = bootstrapData?.filter(i => i['']?.startsWith(prefix)) ?? [];
      if (!items.length) return 0;
      const v = items.reduce((s: number, i: any)=> s + (i.mean || 0), 0) / items.length;
      return Math.round(v * 100);
    };
    return { precision: avg('precision_class_'), recall: avg('recall_class_'), f1Score: avg('f1_class_') };
  }

  private groupBootstrap(results: any[]): any[] {
    if (!Array.isArray(results) || !results.length) return [];
    const grouped: Record<string, { metric: string; items: any[] }> = {};
    for (const item of results) {
      const key = item?.[''];
      if (!key) continue;
      const [metric, cls] = key.split('class'); // precision / recall / f1
      if (!grouped[metric]) grouped[metric] = { metric, items: [] };
      grouped[metric].items.push({
        class: cls,
        mean: item.mean,
        lower_ci: item.lower_95_ci,
        upper_ci: item.upper_95_ci
      });
    }
    return Object.values(grouped);
  }

  // Usado no template: [groups]="groupedBootstrap()"
  groupedBootstrap(): any[] {
    return this.groupBootstrap(this.bootstrap());
  }
}
