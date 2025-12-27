import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ChangeDetectorRef, NgZone } from '@angular/core';

import { withTimeout } from '../../../services/promise-timeout.util';
// import { SentimentService } from '../../../services/sentiment.service';
import { SentimentRealService } from '../../../services/posicionamento-real.service';

// Reuso dos seus componentes
import { AnalysisStatCardComponent } from '../../../components/opinion-analysis/analysis-stat-card/analysis-stat-card';
import { PositioningDistributionComponent } from '../../../components/opinion-analysis/positioning-distribution/positioning-distribution';
import { TopicsCardComponent } from '../../../components/opinion-analysis/topics-card/topics-card';
import { TemporalEvolutionChartComponent } from '../../../components/opinion-analysis/temporal-evolution-chart/temporal-evolution-chart';
import { PositioningDoughnutChartComponent } from '../../../components/opinion-analysis/positioning-doughnut-chart/positioning-doughnut-chart';
import { MetricsBarChartComponent } from '../../../components/opinion-analysis/metrics-bar-chart/metrics-bar-chart';
import { BootstrapResultsCardComponent } from '../../../components/opinion-analysis/bootstrap-results-card/bootstrap-results-card';
import { DetailedMetricsCardComponent } from '../../../components/opinion-analysis/detailed-metrics-card/detailed-metrics-card';
import { CommentsSampleCardComponent } from '../../../components/opinion-analysis/comments-sample-card/comments-sample-card';
import { ModelAccuracyCardComponent } from '../../../components/opinion-analysis/model-accuracy-card/model-accuracy-card';
import { WeeklyStackedChartComponent } from '../../../components/opinion-analysis/weekly-stacked-chart/weekly-stacked-chart';

@Component({
  selector: 'app-posicionamento-real',
  standalone: true,
  imports: [
    CommonModule, ChartModule,
    AnalysisStatCardComponent, PositioningDistributionComponent, TopicsCardComponent,
    TemporalEvolutionChartComponent, PositioningDoughnutChartComponent, MetricsBarChartComponent,
    BootstrapResultsCardComponent, DetailedMetricsCardComponent, CommentsSampleCardComponent,
    ModelAccuracyCardComponent, WeeklyStackedChartComponent
  ],
  templateUrl: './posicionamento-real.component.html'
})
export class PosicionamentoRealComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private sentiments = inject(SentimentRealService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  // estado base
  isLoading = true;
  timedOut = false;
  error = '';
  datasetId = '';

  // dados
  comments: any[] = [];
  bootstrapStats: any[] = [];
  bootstrapGroups: any[] = [];

  totalComments = 0;
  sentimentCounts: Record<string, number> = { '-1': 0, '0': 0, '1': 0 };
  sentimentPercentages = { negative: 0, neutral: 0, positive: 0 };
  topicCounts = { security: 0, violence: 0, police: 0, management: 0 };

  sampleComments: any[] = [];
  metrics: any[] = [];
  modelAccuracy = { precision: 0, recall: 0, f1Score: 0 };

  sentimentChartData: any = {};
  sentimentChartOptions: any = {};
  metricsChartData: any = {};
  metricsChartOptions: any = {};

  async ngOnInit() {
    this.datasetId = this.route.snapshot.paramMap.get('id') || '';

    const load = this.sentiments.loadDataset(this.datasetId);

    try {
      const data = await withTimeout(load, 5000);
      this.zone.run(() => this.applyAll(data));
    } catch (e: any) {
      if (e?.message === 'TIMEOUT') {
        this.zone.run(() => {
          this.timedOut = true;
          this.isLoading = false;
          this.error = '';
          this.cdr.markForCheck();
        });
        load.then(full => this.zone.run(() => this.applyAll(full)))
            .catch(() => this.zone.run(() => { this.error = 'Não foi possível carregar o dataset.'; this.cdr.markForCheck(); }));
      } else {
        this.zone.run(() => {
          this.error = 'Não foi possível carregar o dataset.';
          this.isLoading = false;
          this.cdr.markForCheck();
        });
      }
    }
  }

  private applyAll(payload: { bootstrap: any[]; comments: any[] }) {
    this.comments = Array.isArray(payload?.comments) ? payload.comments : [];
    this.totalComments = this.comments.length;
    this.sentimentCounts = this.computeSentimentCounts(this.comments);

    if (this.totalComments > 0) {
      this.sentimentPercentages = {
        negative: Math.round((this.sentimentCounts['-1'] / this.totalComments) * 100),
        neutral: Math.round((this.sentimentCounts['0'] / this.totalComments) * 100),
        positive: Math.round((this.sentimentCounts['1'] / this.totalComments) * 100),
      };

      // tópicos (placeholder igual ao que você usa hoje)
      this.topicCounts = {
        security: Math.floor(this.totalComments * 0.65),
        violence: Math.floor(this.totalComments * 0.45),
        police: Math.floor(this.totalComments * 0.38),
        management: Math.floor(this.totalComments * 0.22),
      };

      // amostra
      const allValid = this.comments.filter((c: any) => c.comentario && c.comentario.length > 50);
      const pos = allValid.filter((c: any) => c.new_BERT === 1).slice(0, 2);
      const neu = allValid.filter((c: any) => c.new_BERT === 0).slice(0, 2);
      const neg = allValid.filter((c: any) => c.new_BERT === -1).slice(0, 2);
      this.sampleComments = [...pos, ...neu, ...neg];
    }

    // bootstrap
    this.bootstrapStats = Array.isArray(payload?.bootstrap) ? payload.bootstrap : [];
    this.bootstrapGroups = this.groupBootstrapResults(this.bootstrapStats);

    if (this.bootstrapStats.length) {
      this.metrics = this.bootstrapStats;
      this.calculateModelAccuracy(this.bootstrapStats);
    }

    // gráficos simples
    this.sentimentChartData = {
      labels: ['Desaprovação', 'Neutro', 'Aprovação'],
      datasets: [{
        data: [
          this.sentimentPercentages.negative,
          this.sentimentPercentages.neutral,
          this.sentimentPercentages.positive
        ],
        backgroundColor: ['#ef4444', '#6b7280', '#10b981'], borderWidth: 0
      }]
    };
    this.sentimentChartOptions = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    };

    const labels = this.metrics.map((m:any) => m[''] || 'Métrica');
    const meanData = this.metrics.map((m:any) => m.mean || 0);
    this.metricsChartData = {
      labels,
      datasets: [{ label: 'Média (Mean)', data: meanData, backgroundColor: 'rgba(59,130,246,0.7)', borderColor: 'rgb(59,130,246)', borderWidth: 1 }]
    };
    this.metricsChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } };

    this.isLoading = false;
    this.timedOut = false;
    this.error = '';
    this.cdr.markForCheck();
  }

  private groupBootstrapResults(results: any[]): any[] {
    if (!results?.length) return [];
    const grouped: Record<string, any> = {};
    for (const item of results) {
      const key = item['']; if (!key) continue;
      const [metric, cls] = key.split('class');
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

  private calculateModelAccuracy(bootstrapData: any[]): void {
    const avg = (prefix: string) => {
      const items = bootstrapData.filter(i => i['']?.startsWith(prefix));
      if (!items.length) return 0;
      return Math.round((items.reduce((s,i)=>s+(i.mean||0),0)/items.length)*100);
    };
    this.modelAccuracy = {
      precision: avg('precision_class_'),
      recall: avg('recall_class_'),
      f1Score: avg('f1_class_')
    };
  }

  private computeSentimentCounts(comments: any[]): Record<string, number> {
    const counts: Record<string, number> = { '-1': 0, '0': 0, '1': 0 };
    for (const c of comments || []) {
      const val = String(c?.new_BERT ?? '0');
      if (!(val in counts)) continue;
      counts[val]++;
    }
    return counts;
  }
}
