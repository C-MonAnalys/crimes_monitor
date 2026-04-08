import { Component, OnInit, inject, signal } from '@angular/core';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';

import { SentimentService } from '../../../services/sentiment.service';
import { withTimeout } from '../../../services/promise-timeout.util';

// Componentes Reutilizáveis
import { BootstrapResultsCardComponent } from '../../../components/opinion-analysis/bootstrap-results-card/bootstrap-results-card';
import { PageHeroComponent } from '../../../components/shared/page-hero/page-hero.component';

// Chart.js + plugin de barras de erro (whiskers)
import Chart from 'chart.js/auto';
import type { Plugin } from 'chart.js';

// --- Plugin leve para desenhar whiskers (IC95%) nos pontos ---
const ErrorWhiskersPlugin: Plugin = {
  id: 'errorWhiskers',
  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart as any;
    const yScale = scales['y'];

    chart.data.datasets.forEach((ds: any, di: number) => {
      if (ds.type !== 'line' || ds.showLine !== false || !Array.isArray(ds.errorBars)) return;

      const meta = chart.getDatasetMeta(di);
      const color = ds.borderColor || '#334155';
      const cap = 4;        // menor para visual refinado
      const lineW = 1.5;    // mais fino

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.globalAlpha = 0.6; // sutil

      meta.data.forEach((elem: any, i: number) => {
        const bar = ds.errorBars[i];
        if (!bar) return;

        const x = elem.x;
        const yLow  = yScale.getPixelForValue(bar.low);
        const yHigh = yScale.getPixelForValue(bar.high);

        ctx.beginPath();
        ctx.moveTo(x, yLow);
        ctx.lineTo(x, yHigh);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - cap, yLow);
        ctx.lineTo(x + cap, yLow);
        ctx.moveTo(x - cap, yHigh);
        ctx.lineTo(x + cap, yHigh);
        ctx.stroke();
      });

      ctx.restore();
    });
  }
};

Chart.register(ErrorWhiskersPlugin);

@Component({
  selector: 'app-avaliacoes-posicionamento',
  standalone: true,
  imports: [
    CommonModule,
    ChartModule,
    BootstrapResultsCardComponent,
    PageHeroComponent,
    FormsModule
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

  dataset = signal<{ total: number; labels: { neg: number; neu: number; pos: number }; period: string }>(
    { total: 0, labels: { neg: 0, neu: 0, pos: 0 }, period: '—' }
  );
  bootstrap = signal<any[]>([]);
  modelAccuracy = signal({ precision: 0, recall: 0, f1Score: 0 });

  hasLabelData = false;
  hasBootstrapData = false;

  distData: any; distOpts: any;

  quality = signal<{ avgLen: number; medianLen: number; pShort: number }>({ avgLen: 0, medianLen: 0, pShort: 0 });
  imbalanceWarn = signal<string | null>(null);

  // seleção de métrica (padrão: precisão)
  selectedMetric = signal<'precision' | 'recall' | 'f1'>('precision');

  // modelos carregados p/ comparação
  modelsComp = signal<Array<{
    model: string;
    metrics: Record<'precision' | 'recall' | 'f1', { class: 0 | 1 | 2; mean: number; lower: number; upper: number }[]>
  }>>([]);

  // gráfico de comparação
  compChartData: any; compChartOpts: any;

  async ngOnInit() {
    const loadPromise = this.sentiments.getTrainingStats();

    try {
      const data: any = await withTimeout(loadPromise, 5000);
      this.applyData(data);

      // carrega comparações de modelos (baseline + extras, se existirem)
      try {
        const comps = await this.sentiments.getBootstrapComparisons();
        // console.log('[COMP] modelsComp carregados:', comps);
        this.modelsComp.set(comps);
        this.buildComparisonChart(); // métrica padrão
      } catch (e) {
        console.warn('[avaliacoes-posicionamento] comparação de modelos indisponível:', e);
      }

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

    // qualidade do dado
    this.quality.set(train.quality || { avgLen: 0, medianLen: 0, pShort: 0 });

    // desequilíbrio de classes
    const { neg, neu, pos } = this.dataset().labels;
    const total = this.dataset().total || 0;
    const pct = total ? {
      neg: Math.round((neg / total) * 100),
      neu: Math.round((neu / total) * 100),
      pos: Math.round((pos / total) * 100),
    } : { neg: 0, neu: 0, pos: 0 };

    this.imbalanceWarn.set(
      (pct.neg < 10 || pct.neu < 10 || pct.pos < 10)
        ? `Atenção: possível desequilíbrio de classes (Desaprovação: ${pct.neg}%, Neutro: ${pct.neu}%, Aprovação: ${pct.pos}%).`
        : null
    );

    this.bootstrap.set(Array.isArray(train.bootstrap) ? train.bootstrap : []);
    this.modelAccuracy.set(this.calcAccuracy(this.bootstrap()));

    this.hasLabelData = (neg + neu + pos) > 0;
    this.hasBootstrapData = this.bootstrap().length > 0;

    this.distData = {
      labels: ['Desaprovação', 'Neutro', 'Aprovação'],
      datasets: [
        {
          data: [neg, neu, pos],
          backgroundColor: [
            '#f43f5e', // Rose 500
            '#64748b', // Slate 500
            '#10b981'  // Emerald 500
          ],
          hoverBackgroundColor: [
            '#fb7185',
            '#94a3b8',
            '#34d399'
          ],
          borderWidth: 0,
          borderRadius: 8,
          spacing: 4
        }
      ]
    };
    this.distOpts = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%', // Estilo Donut moderno "Ring"
      layout: { padding: 30 },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, weight: '600' },
            padding: 20,
            color: '#64748b'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
          bodyFont: { size: 14, weight: '600' },
          callbacks: {
            label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} amostras`
          }
        }
      }
    };
  }

  private calcAccuracy(bootstrapData: any[]) {
    const avg = (prefix: string) => {
      const items = bootstrapData?.filter(i => i['']?.startsWith(prefix)) ?? [];
      if (!items.length) return 0;
      const v = items.reduce((s: number, i: any) => s + (i.mean || 0), 0) / items.length;
      return Math.round(v * 100);
    };
    return {
      precision: avg('precision_class_'),
      recall: avg('recall_class_'),
      f1Score: avg('f1_class_')
    };
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

  // usado no template
  groupedBootstrap(): any[] {
    return this.groupBootstrap(this.bootstrap());
  }

  // chamado ao trocar o select de métrica no template
  onMetricChange() {
    this.buildComparisonChart();
    this.cdr.markForCheck();
  }

  // --- gráfico de comparação: pontos (médias) + whiskers (IC95%) --- //
  buildComparisonChart() {
    const data = this.modelsComp();
    if (!data || !data.length) {
      this.compChartData = null;
      return;
    }

    const metric = this.selectedMetric(); // 'precision' | 'recall' | 'f1'
    const labels = ['Neutro', 'Aprova', 'Desaprova'];

    const palette = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#ef4444','#14b8a6'];
    const datasets: any[] = [];

    // limites dinâmicos para “dar folga”
    let minLower = 1, maxUpper = 0;

    data.forEach((m, i) => {
      const byMetric = m.metrics[metric] || [];
      const means  = [0,1,2].map(c => byMetric.find(x => x.class === c)?.mean  ?? 0);
      const lowers = [0,1,2].map(c => byMetric.find(x => x.class === c)?.lower ?? 0);
      const uppers = [0,1,2].map(c => byMetric.find(x => x.class === c)?.upper ?? 0);

      lowers.forEach(v => { if (v < minLower) minLower = v; });
      uppers.forEach(v => { if (v > maxUpper) maxUpper = v; });

      // dataset dos pontos de média + whiskers via plugin
      datasets.push({
        type: 'line',
        label: `${m.model}`,
        data: means,
        showLine: false,
        backgroundColor: palette[i % palette.length],
        borderColor: palette[i % palette.length],
        pointBackgroundColor: palette[i % palette.length],
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 8,
        pointHoverRadius: 10,
        pointHoverBorderWidth: 3,
        hitRadius: 15,
        order: 1,
        errorBars: [0,1,2].map(idx => ({ low: lowers[idx], high: uppers[idx] }))
      });
    });

    // “zoom” vertical com folga nas extremidades
    const pad = 0.03;
    const suggestedMin = Math.max(0, minLower - pad);
    const suggestedMax = Math.min(1, maxUpper + pad);

    this.compChartData = { labels, datasets };

    this.compChartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20, bottom: 20, left: 10, right: 10 } },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { 
            usePointStyle: true, 
            boxWidth: 8, 
            boxHeight: 8, 
            font: { size: 12, weight: '600' },
            padding: 20,
            color: '#64748b'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
          bodyFont: { size: 13 },
          callbacks: {
            label: (ctx: any) => {
              const ds = ctx.dataset as any;
              const eb = ds.errorBars?.[ctx.dataIndex];
              const val = (ctx.parsed.y * 100).toFixed(1);
              if (eb) {
                return `${ds.label}: ${val}% (IC95% [${(eb.low*100).toFixed(1)}% - ${(eb.high*100).toFixed(1)}%])`;
              }
              return `${ds.label}: ${val}%`;
            }
          }
        }
      },
      scales: {
        x: {
          offset: true,
          grid: { display: false },
          ticks: { color: '#64748b', font: { weight: 'bold' }, padding: 10 }
        },
        y: {
          suggestedMin,
          suggestedMax,
          grid: { color: 'rgba(148, 163, 184, 0.1)', drawTicks: false },
          border: { display: false },
          ticks: { 
            color: '#64748b',
            callback: (v: any) => (Number(v) * 100) + '%',
            padding: 10
          }
        }
      }
    };

    this.cdr.markForCheck();
  }
}
