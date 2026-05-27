import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { SentimentRealService } from '../../services/posicionamento-real.service';
import { OrquestratorService } from '../../services/orquestrator.service';
import { EventsRealService } from '../../services/events-real.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
export class PosicionamentoRealComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private sentiments = inject(SentimentRealService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);
  private orquestrator = inject(OrquestratorService);
  private eventsService = inject(EventsRealService);
  private destroy$ = new Subject<void>();

  // estado base
  isLoading = true;
  isRefreshing = false;
  error = '';
  regionId = '';
  regionPath = '.';
  regionName = '';
  datasetId = '';
  
  // UX de Carregamento
  loadingMessage = 'Iniciando conexão segura com a base de dados...';
  loadingProgress = 10;
  private loadingTimer: any;

  // dados
  comments: any[] = [];
  videos: any[] = [];
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

  // Modal de Vídeos Relacionados
  isVideosModalVisible = false;
  selectedEventForVideos: any = null;

  async ngOnInit() {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(async params => {
      this.regionId = params.get('id') || 'geral';
      this.datasetId = this.regionId;

      // Reseta estados para evitar que dados da região anterior fiquem visíveis durante o loading
      this.isLoading = true;
      this.isRefreshing = false;
      this.error = '';
      this.comments = [];
      this.bootstrapStats = [];
      this.eventAnalyses = [];
      this.paginatedEvents = [];
      this.isVideosModalVisible = false;
      this.selectedEventForVideos = null;
      this.cdr.markForCheck();
      
      // Obter o caminho correto da região a partir do orquestrador
      const regiao = await this.orquestrator.getRegiao('sentiment', this.regionId);
      if (regiao) {
        this.regionPath = regiao.caminho;
        this.regionName = regiao.nome;
      } else {
        this.regionPath = this.regionId === 'geral' ? '.' : this.regionId;
        this.regionName = this.regionId === 'geral' ? 'Geral' : this.regionId.charAt(0).toUpperCase() + this.regionId.slice(1);
      }

      await this.loadData();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopLoadingSequence(); // garante que o setInterval seja limpo na destruição do componente
  }

  async loadData() {
    this.isLoading = true;
    this.error = '';
    this.startLoadingSequence();
    this.cdr.markForCheck();

    // Carregamos comentários e vídeos da região em paralelo
    const loadSentimentPromise = this.sentiments.loadConsolidated(this.regionPath);
    const loadEventsPromise = this.eventsService.loadDataset('__ALL__', this.regionPath).catch((e: any) => {
      console.warn('Erro ao carregar dados de vídeos/eventos no painel de posicionamento:', e);
      return { videos: [] };
    });

    try {
      const [sentimentData, eventsData] = await Promise.all([loadSentimentPromise, loadEventsPromise]);
      this.stopLoadingSequence();
      this.zone.run(() => this.applyAll(sentimentData, eventsData));
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
      // Limpa especificamente o cache consolidado baseado na região
      const regionPrefix = (this.regionPath && this.regionPath !== '.') ? `sentiment_${this.regionPath}_` : 'sentiment_geral_';
      const cacheKey = `${regionPrefix}consolidado`;
      await this.sentiments.clearCache(cacheKey);
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

  private applyAll(payload: { meta: any; bootstrap: any[]; comments: any[] }, eventsPayload?: any) {
    this.meta = payload.meta;
    this.comments = Array.isArray(payload?.comments) ? payload.comments : [];
    this.videos = eventsPayload && Array.isArray(eventsPayload.videos) ? eventsPayload.videos : [];
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

      // Amostragem Inteligente: Filtro de qualidade limitado aos primeiros 2000 comentários para evitar travamentos
      const samplePool = this.comments.length > 2000 
        ? this.comments.slice(0, 2000) 
        : this.comments;

      const qualityComments = samplePool.filter((c: any) => {
        const text = (c.comentario || '').trim();
        return text.length > 40 && text.includes(' ');
      });

      // Se não houver comentários longos o suficiente, fallback para a amostragem geral simplificada
      const sourcePool = qualityComments.length >= 6 ? qualityComments : samplePool;

      // Sorteia elementos aleatórios de forma altamente eficiente sem ordenar
      const getSample = (pool: any[], sentiment: number, count: number) => {
        const matching = pool.filter(c => c.new_BERT === sentiment);
        if (matching.length <= count) return matching;
        
        const selected = [];
        const indices = new Set<number>();
        while (indices.size < count) {
          const rand = Math.floor(Math.random() * matching.length);
          indices.add(rand);
        }
        for (const idx of indices) {
          selected.push(matching[idx]);
        }
        return selected;
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
    this.processEvents(this.comments, this.videos);

    this.isLoading = false;
    this.error = '';
    this.cdr.markForCheck();
  }

  normalizeOperationName(name: string): string {
    if (!name) return 'Operação Não Identificada';
    // Normalização conservadora: mantemos tags NER (:loc, :per, etc.) e hifens/sufixos
    const clean = name.toString().trim();
    return clean || 'Operação Não Identificada';
  }

  private processEvents(comments: any[], videos: any[]) {
    const groups: Record<string, any> = {};

    // 1. Agrupar vídeos oficiais da região por operação normalizada
    for (const v of videos || []) {
      const opRaw = v.operation_id ?? v.operation ?? v.operation_ner ?? 'Operação Não Identificada';
      const opName = this.normalizeOperationName(opRaw.toString());
      
      if (!groups[opName]) {
        groups[opName] = {
          id: opName,
          commentCount: 0,
          videos: new Map<string, any>(), // id_video -> metadados do vídeo
          sentiment: { '-1': 0, '0': 0, '1': 0 },
          minDate: '',
          maxDate: ''
        };
      }
      
      const g = groups[opName];
      const vidId = v.id_video || v.video_id || v.id;
      if (vidId && vidId !== 'unknown') {
        g.videos.set(vidId.toString(), v);
      }
    }

    // 2. Mapeamento auxiliar de id_video -> nome de operação (para cruzar comentários via id_video)
    const videoToOperationMap = new Map<string, string>();
    Object.values(groups).forEach((g: any) => {
      g.videos.forEach((v: any, vidId: string) => {
        videoToOperationMap.set(vidId, g.id);
      });
    });

    // 3. Associar comentários às operações
    for (const c of comments) {
      let matchedOpName = '';

      // Regra A: Tentar associar pelo id_video do comentário (mapeado nos vídeos oficiais)
      const cVid = (c.id_video || c.video_id || '').toString();
      if (cVid && videoToOperationMap.has(cVid)) {
        matchedOpName = videoToOperationMap.get(cVid) || '';
      }

      // Regra B: Tentar associar pelo campo de operação direta do comentário
      if (!matchedOpName && c.operation_ner) {
        matchedOpName = this.normalizeOperationName(c.operation_ner.toString());
      }

      // Regra C: Se ainda não associou, cai em "Operação Não Identificada"
      if (!matchedOpName) {
        matchedOpName = 'Operação Não Identificada';
      }

      // Cria o grupo dinamicamente se ainda não existir
      if (!groups[matchedOpName]) {
        groups[matchedOpName] = {
          id: matchedOpName,
          commentCount: 0,
          videos: new Map<string, any>(),
          sentiment: { '-1': 0, '0': 0, '1': 0 },
          minDate: '',
          maxDate: ''
        };
      }

      const g = groups[matchedOpName];
      g.commentCount++;

      // Contagem de sentimento
      const s = String(c.new_BERT ?? '0');
      if (s in g.sentiment) g.sentiment[s]++;

      // Datas do comentário
      const dt = c.data_postagem;
      if (dt) {
        if (!g.minDate || dt < g.minDate) g.minDate = dt;
        if (!g.maxDate || dt > g.maxDate) g.maxDate = dt;
      }

      // Se o comentário tem um id_video novo (que não estava nos vídeos oficiais dessa operação)
      if (cVid && cVid !== 'unknown') {
        if (!g.videos.has(cVid)) {
          g.videos.set(cVid, {
            id_video: cVid,
            titulo: `Vídeo da Operação (ID: ${cVid})`,
            canal: c.canal || 'YouTube'
          });
        }
      }
    }

    // Calcular a contagem de comentários por vídeo globalmente uma única vez (O(C)) para evitar loops aninhados
    const globalVideoCommentCounts: Record<string, number> = {};
    for (const c of comments) {
      const cVid = (c.id_video || c.video_id || '').toString();
      if (cVid) {
        globalVideoCommentCounts[cVid] = (globalVideoCommentCounts[cVid] || 0) + 1;
      }
    }

    // 4. Mapear e preparar os grupos para a tela
    this.eventAnalyses = Object.values(groups).map((g: any) => {
      // Converte o Map de vídeos para uma lista
      const allVideos: any[] = Array.from(g.videos.values());

      let topVideo = '';
      let maxOccur = -1;
      allVideos.forEach((v: any) => {
        const count = globalVideoCommentCounts[v.id_video] || 0;
        // Se for o oficial (vindo do dataset de eventos), damos preferência a ele
        const weight = v.titulo && !v.titulo.startsWith('Vídeo da Operação') ? 1000 : 0;
        if (count + weight > maxOccur) {
          maxOccur = count + weight;
          topVideo = v.id_video;
        }
      });

      // Se não encontrou por comentários, pega o primeiro da lista
      if (!topVideo && allVideos.length > 0) {
        topVideo = allVideos[0].id_video;
      }

      const total = g.commentCount || 1; // evita divisão por zero
      return {
        id: g.id,
        commentCount: g.commentCount,
        allVideos,
        topVideo,
        videoCount: allVideos.length,
        minDate: g.minDate,
        maxDate: g.maxDate,
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

  openVideosModal(event: any) {
    this.selectedEventForVideos = event;
    this.isVideosModalVisible = true;
    this.cdr.markForCheck();
  }

  closeVideosModal() {
    this.isVideosModalVisible = false;
    this.selectedEventForVideos = null;
    this.cdr.markForCheck();
  }

  selectVideoForEvent(event: any, videoId: string) {
    event.topVideo = videoId;
    this.cdr.markForCheck();
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
