import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChartModule } from 'primeng/chart';

import { EventsService } from '../../services/events.service';
import { SentimentService } from '../../services/sentiment.service';

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
  imports: [CommonModule, RouterModule, ChartModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  private eventsSvc = inject(EventsService);
  private sentiSvc  = inject(SentimentService);

  isLoading = signal(true);
  timedOut  = signal(false);
  error     = signal<string>('');

  // números rápidos
  totalVideos       = signal<number>(0);
  uniqOperations    = signal<number>(0);
  videosPeriodLabel = signal<string>('—');
  avgPerOp          = signal<number>(0);

  trainTotal = signal<number>(0);
  trainNeg   = signal<number>(0);
  trainNeu   = signal<number>(0);
  trainPos   = signal<number>(0);

  // “Últimos adicionados” (cenário real)
  latestEvent = signal<{ id: string; label: string; description?: string } | null>(null);
  latestSent  = signal<{ id: string; label: string; description?: string } | null>(null);

  // sparkline: vídeos por mês
  videosSparkData: any;
  videosSparkOpts: any;

  // helper local de timeout — mantém tipos de tupla
  private timeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('TIMEOUT')), ms);
      p.then(v => { clearTimeout(id); resolve(v); })
       .catch(e => { clearTimeout(id); reject(e); });
    });
  }

  // Helpers para o card de rótulos (percentuais)
  pct(n: number): number {
    const total = this.trainTotal();
    if (!total) return 0;
    return Math.round((n / total) * 100);
  }

  // Aliases para manter o nome que você usou no HTML
  treinoNeg(): number { return this.trainNeg(); }
  treinoNeu(): number { return this.trainNeu(); }
  treinoPos(): number { return this.trainPos(); }

  // -------- helpers de dados locais --------
  private async fetchJson(path: string): Promise<any | null> {
    try {
      const baseTag  = document.getElementsByTagName('base')[0];
      const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
      const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
      const resp = await fetch(root + path);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  private async loadLatestDatasets() {
    // events/cenario-real
    const ev = await this.fetchJson('assets/data/events/cenario-real/datasets.json');
    if (ev && typeof ev === 'object') {
      const entries = Object.entries(ev) as Array<[string, any]>;
      if (entries.length) {
        const [id, cfg] = entries[entries.length - 1]; // “último” no arquivo
        this.latestEvent.set({
          id,
          label: cfg?.label ?? id,
          description: cfg?.description ?? ''
        });
      }
    }

    // sentiment/cenario-real
    const se = await this.fetchJson('assets/data/sentiment/cenario-real/datasets.json');
    if (se && typeof se === 'object') {
      const entries = Object.entries(se) as Array<[string, any]>;
      if (entries.length) {
        const [id, cfg] = entries[entries.length - 1];
        this.latestSent.set({
          id,
          label: cfg?.title ?? id,
          description: ''
        });
      }
    }
  }

  private buildSparklines(videosByMonth: VideosByMonth[]) {
    // 1) Vídeos por mês
    const labels = videosByMonth.map(v => v.period);
    const values = videosByMonth.map(v => v.count);

    this.videosSparkData = {
      labels,
      datasets: [{
        data: values,
        tension: 0.35,
        fill: true,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.12)',
        borderWidth: 1.5,
        pointRadius: 0
      }]
    };

    this.videosSparkOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true }
      },
      elements: { line: { borderJoinStyle: 'round' } }
    };
  }

  // --------------- ciclo de vida ---------------
  async ngOnInit() {
    try {
      // Tipamos explicitamente o Promise.all para preservar a tupla
      const load: Promise<[EventsOverview, TrainingStats, VideosByMonth[]]> = Promise.all([
        this.eventsSvc.getEvaluationsOverview() as Promise<EventsOverview>,
        this.sentiSvc.getTrainingStats()        as Promise<TrainingStats>,
        this.eventsSvc.getVideosByMonth()       as Promise<VideosByMonth[]>
      ]);

      const [eventsOverview, train, videosByMonth] = await this.timeout(load, 5000);

      // eventos
      if (eventsOverview?.datasets) {
        this.totalVideos.set(eventsOverview.datasets.totalVideos ?? 0);
        this.uniqOperations.set(eventsOverview.datasets.uniqueOperations ?? 0);
        this.videosPeriodLabel.set(eventsOverview.datasets.periodLabel ?? '—');
        this.avgPerOp.set(eventsOverview.datasets.avgVideosPerOperation ?? 0);
      }

      // treino (posicionamento)
      if (train) {
        this.trainTotal.set(train.total ?? 0);
        this.trainNeg.set(train.labels?.['-1'] ?? 0);
        this.trainNeu.set(train.labels?.['0'] ?? 0);
        this.trainPos.set(train.labels?.['1'] ?? 0);
      }

      // sparklines
      this.buildSparklines(Array.isArray(videosByMonth) ? videosByMonth : []);

      // “Últimos adicionados” (não bloqueia a tela)
      this.loadLatestDatasets();

      this.isLoading.set(false);
    } catch (e: any) {
      if (e?.message === 'TIMEOUT') {
        this.timedOut.set(true);
        this.isLoading.set(false);
        this.error.set('');
      } else {
        this.error.set('Não foi possível carregar os destaques.');
        this.isLoading.set(false);
      }
    }
  }
}
