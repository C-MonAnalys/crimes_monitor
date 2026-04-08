import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

// import { SentimentService } from '../../services/sentiment.service';
import { SentimentRealService } from '../../services/posicionamento-real.service';

// Reuso dos seus componentes
import { AnalysisStatCardComponent } from '../../components/opinion-analysis/analysis-stat-card/analysis-stat-card';
import { PositioningDistributionComponent } from '../../components/opinion-analysis/positioning-distribution/positioning-distribution';
import { CommentsSampleCardComponent } from '../../components/opinion-analysis/comments-sample-card/comments-sample-card';
import { WeeklyStackedChartComponent } from '../../components/opinion-analysis/weekly-stacked-chart/weekly-stacked-chart';
import { PageHeroComponent } from '../../components/shared/page-hero/page-hero.component';

@Component({
  selector: 'app-posicionamento-real',
  standalone: true,
  imports: [
    CommonModule, ChartModule,
    AnalysisStatCardComponent, PositioningDistributionComponent,
    CommentsSampleCardComponent, WeeklyStackedChartComponent,
    FormsModule,
    PageHeroComponent
  ],
  templateUrl: './posicionamento-real.component.html'
})
export class PosicionamentoRealComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private sentiments = inject(SentimentRealService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);

  // estado base
  isLoading = true;
  isRefreshing = false;
  error = '';
  datasetId = '';
  
  // UX de Carregamento
  loadingMessage = 'Iniciando conexão segura com a base de dados...';
  loadingProgress = 10;
  private loadingTimer: any;

  // dados
  comments: any[] = [];
  bootstrapStats: any[] = [];
  bootstrapGroups: any[] = [];

  totalComments = 0;
  sentimentCounts: Record<string, number> = { '-1': 0, '0': 0, '1': 0 };
  sentimentPercentages = { negative: 0, neutral: 0, positive: 0 };
  meta: any = null;

  sampleComments: any[] = [];
  sentimentChartOptions: any = {};

  // Análise por Evento
  eventAnalyses: any[] = [];
  paginatedEvents: any[] = [];
  currentPage = 1;
  pageSize = 6;
  totalPages = 0;
  currentSort: 'comments' | 'videos' | 'approval' | 'disapproval' = 'comments';

  async ngOnInit() {
    this.datasetId = this.route.snapshot.paramMap.get('id') || '';
    await this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    this.error = '';
    this.startLoadingSequence();
    this.cdr.markForCheck();

    let loadPromise: Promise<{ meta: any; comments: any[]; bootstrap: any[] }>;
    
    if (this.datasetId) {
      loadPromise = this.sentiments.loadDataset(this.datasetId);
    } else {
      loadPromise = this.sentiments.loadConsolidated();
    }

    try {
      const data = await loadPromise;
      this.stopLoadingSequence();
      this.zone.run(() => this.applyAll(data));
    } catch (e: any) {
      this.stopLoadingSequence();
      this.zone.run(() => {
        this.error = 'Não foi possível carregar o dataset.';
        this.isLoading = false;
        this.cdr.markForCheck();
      });
    }
  }

  private startLoadingSequence() {
    this.loadingProgress = 10;
    this.loadingMessage = 'Iniciando conexão segura com a base de dados...';
    
    const sequence = [
      { p: 25, m: 'Solicitando transferência de grandes volumes de dados...' },
      { p: 45, m: 'O download do dataset está sendo feito (isso pode levar alguns segundos)...' },
      { p: 65, m: 'Download concluído. Iniciando processamento de inteligência artificial...' },
      { p: 85, m: 'Organizando as métricas de posicionamento e sentimentos da audiência...' },
      { p: 95, m: 'Finalizando renderização do painel técnico...' }
    ];

    let step = 0;
    this.loadingTimer = setInterval(() => {
      if (step < sequence.length) {
        this.loadingProgress = sequence[step].p;
        this.loadingMessage = sequence[step].m;
        step++;
        this.cdr.markForCheck();
      } else {
        clearInterval(this.loadingTimer);
      }
    }, 2500); // Muda a cada 2.5s para dar tempo de leitura
  }

  private stopLoadingSequence() {
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
    }
    this.loadingProgress = 100;
    this.cdr.markForCheck();
  }

  async refreshData() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    this.cdr.markForCheck();

    try {
      // Limpa especificamente o cache consolidado ou do dataset atual
      await this.sentiments.clearCache(this.datasetId || 'consolidado');
      await this.loadData();
    } catch (e) {
      console.error('Erro ao atualizar dados:', e);
    } finally {
      this.isRefreshing = false;
      this.cdr.markForCheck();
    }
  }

  get currentPeriod(): string {
    if (!this.meta?.period || this.meta.period === '—') return '—';
    const parts = this.meta.period.split(/\s+(?:a|-|–)\s+/);
    if (parts.length === 2) {
      return `${this.formatDate(parts[0])} — ${this.formatDate(parts[1])}`;
    }
    return this.meta.period;
  }

  formatDate(dateStr: string): string {
    if (!dateStr || dateStr === '—') return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  private applyAll(payload: { meta: any; bootstrap: any[]; comments: any[] }) {
    this.meta = payload.meta;
    this.comments = Array.isArray(payload?.comments) ? payload.comments : [];
    this.totalComments = this.comments.length;
    this.sentimentCounts = this.computeSentimentCounts(this.comments);

    if (this.totalComments > 0) {
      // Cálculo dinâmico do período caso falte ou seja padrão
      if (!this.meta.period || this.meta.period === '—') {
        let min = '';
        let max = '';
        for (const c of this.comments) {
          const dt = c.data_postagem;
          if (!dt) continue;
          if (!min || dt < min) min = dt;
          if (!max || dt > max) max = dt;
        }
        if (min && max) {
          this.meta.period = `${min} a ${max}`;
        }
      }

      this.sentimentPercentages = {
        negative: Math.round((this.sentimentCounts['-1'] / this.totalComments) * 100),
        neutral: Math.round((this.sentimentCounts['0'] / this.totalComments) * 100),
        positive: Math.round((this.sentimentCounts['1'] / this.totalComments) * 100),
      };

      // Amostragem Inteligente: Filtro de qualidade + Aleatoriedade
      const qualityComments = this.comments.filter((c: any) => {
        const text = (c.comentario || '').trim();
        const words = text.split(/\s+/).length;
        return words >= 8 && text.length > 40; // Mínimo de 8 palavras e 40 caracteres
      });

      // Se não houver comentários longos o suficiente, fallback para os normais
      const sourcePool = qualityComments.length >= 6 ? qualityComments : this.comments;

      // Embaralha e pega 2 de cada classe
      const getSample = (pool: any[], sentiment: number, count: number) => {
        return pool
          .filter(c => c.new_BERT === sentiment)
          .sort(() => Math.random() - 0.5)
          .slice(0, count);
      };

      this.sampleComments = [
        ...getSample(sourcePool, 1, 2),
        ...getSample(sourcePool, 0, 2),
        ...getSample(sourcePool, -1, 2)
      ];
    }

    // bootstrap (necessário para a lógica interna do gráfico semanal)
    this.bootstrapStats = Array.isArray(payload?.bootstrap) ? payload.bootstrap : [];

    // Agrupamento por Evento
    this.processEvents(this.comments);

    this.isLoading = false;
    this.error = '';
    this.cdr.markForCheck();
  }

  private processEvents(comments: any[]) {
    const groups: Record<string, any> = {};

    for (const c of comments) {
      const eventId = c.operation_ner || 'Operação Não Identificada';
      if (!groups[eventId]) {
        groups[eventId] = {
          id: eventId,
          commentCount: 0,
          videos: new Map<string, number>(),
          sentiment: { '-1': 0, '0': 0, '1': 0 },
          minDate: '',
          maxDate: ''
        };
      }

      const g = groups[eventId];
      g.commentCount++;
      
      // Contagem de vídeos e recorrência
      const vid = c.id_video || 'unknown';
      g.videos.set(vid, (g.videos.get(vid) || 0) + 1);

      // Sentimento
      const s = String(c.new_BERT ?? '0');
      if (s in g.sentiment) g.sentiment[s]++;

      // Datas
      const dt = c.data_postagem;
      if (dt) {
        if (!g.minDate || dt < g.minDate) g.minDate = dt;
        if (!g.maxDate || dt > g.maxDate) g.maxDate = dt;
      }
    }

    this.eventAnalyses = Object.values(groups).map(g => {
      // Encontrar o vídeo mais frequente
      let topVideo = '';
      let maxOccur = -1;
      g.videos.forEach((count: number, id: string) => {
        if (id !== 'unknown' && count > maxOccur) {
          maxOccur = count;
          topVideo = id;
        }
      });

      const total = g.commentCount;
      return {
        ...g,
        topVideo,
        videoCount: g.videos.has('unknown') ? g.videos.size - 1 : g.videos.size,
        percentages: {
          negative: Math.round((g.sentiment['-1'] / total) * 100),
          neutral: Math.round((g.sentiment['0'] / total) * 100),
          positive: Math.round((g.sentiment['1'] / total) * 100)
        }
      };
    });

    // Ordenar inicialmente por relevância (mais comentários)
    this.sortEvents('comments');

    this.totalPages = Math.ceil(this.eventAnalyses.length / this.pageSize);
    this.updatePagination();
  }

  sortEvents(type: 'comments' | 'videos' | 'approval' | 'disapproval') {
    this.currentSort = type;
    this.eventAnalyses.sort((a, b) => {
      switch (type) {
        case 'comments': return b.commentCount - a.commentCount;
        case 'videos': return b.videoCount - a.videoCount;
        case 'approval': return b.percentages.positive - a.percentages.positive;
        case 'disapproval': return b.percentages.negative - a.percentages.negative;
        default: return 0;
      }
    });
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedEvents = this.eventAnalyses.slice(start, start + this.pageSize);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  getSafeUrl(videoId: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
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
