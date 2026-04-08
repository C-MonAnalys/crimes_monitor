import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { lastValueFrom } from 'rxjs';

import { EventsService } from '../../services/events.service';
import { EventsRealService } from '../../services/events-real.service';
import { SentimentService } from '../../services/sentiment.service';
import { DATA_CONFIG } from '../../data-config';

// Componentes Compartilhados
import { PageHeroComponent } from '../../components/shared/page-hero/page-hero.component';

// ----- Tipos mínimos usados aqui -----
interface EventsOverview {
  datasets?: {
    totalVideos?: number;
    uniqueOperations?: number;
    periodLabel?: string;
    avgVideosPerOperation?: number;
  };
}

interface TrainingStats {
  total: number;
  period: string;
  labels: Record<string, number>; // {'-1': n, '0': n, '1': n}
  bootstrap: any[];
  quality: { avgLen: number; medianLen: number; pShort: number };
}

interface VideosByMonth {
  period: string; // ex: "2024-01"
  count: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ChartModule,
    PageHeroComponent
  ],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  private eventsSvc = inject(EventsService);
  private eventsRealSvc = inject(EventsRealService);
  private sentiSvc  = inject(SentimentService);

  isLoading = signal(true);
  timedOut  = signal(false);
  error     = signal<string>('');

  // Status Rápido
  totalVideos       = signal<number>(0);
  uniqOperations    = signal<number>(0);
  videosPeriodLabel = signal<string>('—');
  avgPerOp          = signal<number>(0);

  // Status Treino (Spoiler para Avaliações de Posicionamento)
  trainTotal = signal<number>(0);
  trainNeg   = signal<number>(0);
  trainNeu   = signal<number>(0);
  trainPos   = signal<number>(0);
  evalTotal  = signal<number>(0);

  // Porcentagens calculadas para a barra (Garantem soma 100%)
  wPos = signal<number>(0);
  wNeu = signal<number>(0);
  wNeg = signal<number>(0);

  // Cobertura de Datasets (Spoiler para Cenário Real)
  availableDatasets = signal<{id: string, label: string}[]>([]);

  // Spoiler de Performance (Heurísticas - Ranking Top 3)
  topHeuristics = signal<any[]>([]);

  // Sparkline (Tendência)
  videosSparkData: any;
  videosSparkOpts: any;

  private timeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('TIMEOUT')), ms);
      p.then(v => { clearTimeout(id); resolve(v); })
       .catch(e => { clearTimeout(id); reject(e); });
    });
  }

  pct(n: number): number {
    const total = this.trainTotal();
    if (!total) return 0;
    return Math.round((n / total) * 100);
  }

  private buildSparklines(videosByMonth: VideosByMonth[]) {
    const labels = videosByMonth.map(v => v.period);
    const values = videosByMonth.map(v => v.count);

    this.videosSparkData = {
      labels,
      datasets: [{
        data: values,
        tension: 0.4,
        fill: true,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    };

    this.videosSparkOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#0f172a',
          padding: 8,
          cornerRadius: 8
        }
      },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true }
      }
    };
  }

  private buildSparklinesFromChartData(chartData: any) {
    if (!chartData || !chartData.labels) return;

    this.videosSparkData = {
      labels: chartData.labels,
      datasets: [{
        data: chartData.datasets[0].data,
        tension: 0.4,
        fill: true,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    };

    this.videosSparkOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#0f172a',
          padding: 8,
          cornerRadius: 8
        }
      },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true }
      }
    };
  }

  async ngOnInit() {
    try {
      const load: Promise<[EventsOverview, TrainingStats, any, any, any]> = Promise.all([
        this.eventsSvc.getEvaluationsOverview() as any,
        this.sentiSvc.getTrainingStats()        as any,
        this.eventsRealSvc.loadDataset('').catch(() => null),
        this.eventsSvc.getMetrics().catch(() => []),
        this.eventsSvc.listAll().catch(() => ({ videos: [] }))
      ]);

      const [eventsOverview, train, realConsolidated, rawMetrics, allEvents] = await this.timeout(load, 15000);

      // 1. Destaques de Eventos (AGORA DO CENÁRIO REAL CONSOLIDADO)
      if (realConsolidated?.meta) {
        this.totalVideos.set(realConsolidated.meta.totalVideos ?? 0);
        this.uniqOperations.set(realConsolidated.meta.totalOperations ?? 0);
        this.videosPeriodLabel.set(realConsolidated.meta.period ?? '—');
        
        const total = realConsolidated.meta.totalVideos || 0;
        const ops = realConsolidated.meta.totalOperations || 1;
        this.avgPerOp.set(+(total / ops).toFixed(1));
      }

      // 1.1 Volume de Avaliação (Ground Truth)
      if (allEvents?.videos) {
        this.evalTotal.set(allEvents.videos.length);
      }

      // 2. Spoiler Performance Heurísticas (Ranking específico: todos_sem)
      if (Array.isArray(rawMetrics) && rawMetrics.length) {
        const names: Record<string, string> = { 
          HS: 'Heurística Semântica', 
          HT: 'Heurística Temporal', 
          GPT: 'GPT-4' 
        };
        const colors: Record<string, string> = {
          HS: '#3b82f6', // Blue
          HT: '#10b981', // Emerald
          GPT: '#f59e0b' // Amber
        };

        const filtered = rawMetrics
          .filter((m: any) => m.dataset === 'todos_sem')
          .map((m: any) => ({
            label: names[m.tecnica] || m.tecnica,
            accuracy: m.acu ?? 0,
            color: colors[m.tecnica] || '#64748b'
          }))
          .sort((a, b) => b.accuracy - a.accuracy);

        this.topHeuristics.set(filtered);
      }

      // 3. Status de Treino (Agora usado no Módulo 04)
      if (train) {
        this.trainTotal.set(train.total ?? 0);
        this.trainNeg.set(train.labels?.['-1'] ?? 0);
        this.trainNeu.set(train.labels?.['0'] ?? 0);
        this.trainPos.set(train.labels?.['1'] ?? 0);

        // Calcula larguras garantindo 100% total
        const p1 = this.pct(this.trainPos());
        const p2 = this.pct(this.trainNeu());
        this.wPos.set(p1);
        this.wNeu.set(p2);
        this.wNeg.set(Math.max(0, 100 - (p1 + p2)));
      }

      // 4. Sparkline de Tendência (AGORA DO CENÁRIO REAL)
      if (realConsolidated?.series?.byDay) {
        this.buildSparklinesFromRealSeries(realConsolidated.series.byDay);
      }

      // 5. Carregar Datasets para o Spoiler do Módulo 02 (Caminho Correcto via Service)
      this.sentiSvc.getRealScenarioDatasets().then(ds => {
        if (ds) {
          const entries = Object.entries(ds);
          const years: number[] = [];
          
          entries.forEach(([_, cfg]) => {
            const label = (cfg as any).title ?? (cfg as any).label ?? '';
            const match = label.match(/\((\d{4})\)/);
            if (match) years.push(parseInt(match[1]));
          });

          if (years.length > 0) {
            const min = Math.min(...years);
            const max = Math.max(...years);
            const label = min === max ? `Brasil (${min})` : `Brasil (${min} — ${max})`;
            this.availableDatasets.set([{ id: 'real_all', label }]);
          } else {
            const list = entries.map(([id, cfg]) => ({ 
              id, 
              label: (cfg as any).title ?? (cfg as any).label ?? id 
            }));
            this.availableDatasets.set(list);
          }
        }
      });

      this.isLoading.set(false);
    } catch (e: any) {
      this.isLoading.set(false);
      if (e?.message === 'TIMEOUT') {
        this.timedOut.set(true);
      } else {
        this.error.set('Houve um problema ao carregar as métricas consolidadas.');
      }
    }
  }

  private buildSparklinesFromRealSeries(series: { labels: string[], values: number[] }) {
    if (!series || !series.labels) return;

    // Agrupar por mês para não poluir o gráfico da home
    const monthly: Record<string, number> = {};
    series.labels.forEach((label, i) => {
      const monthKey = label.substring(0, 7); // Pega "YYYY-MM" de "YYYY-MM-DD"
      monthly[monthKey] = (monthly[monthKey] || 0) + series.values[i];
    });

    const sortedMonths = Object.keys(monthly).sort();
    const monthlyValues = sortedMonths.map(m => monthly[m]);

    this.videosSparkData = {
      labels: sortedMonths,
      datasets: [{
        data: monthlyValues,
        tension: 0.4,
        fill: true,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    };

    this.videosSparkOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#0f172a',
          padding: 8,
          cornerRadius: 8,
          callbacks: {
            title: (items: any[]) => {
              const [year, month] = items[0].label.split('-');
              const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
              return `${months[parseInt(month)-1]} de ${year}`;
            }
          }
        }
      },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true }
      }
    };
  }
}
