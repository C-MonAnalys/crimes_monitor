import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { EventsRealService } from '../../services/events-real.service';
import { DATA_CONFIG } from '../../data-config';
import { withTimeout } from '../../services/promise-timeout.util';
import { EventosTimelineChartComponent } from './eventos-timeline-chart.component';
import { PageHeroComponent } from '../../components/shared/page-hero/page-hero.component';

type ClassName = 'Aprovação' | 'Desaprovação' | 'Neutro';

@Component({
  selector: 'app-eventos-real',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ChartModule, 
    EventosTimelineChartComponent,
    PageHeroComponent
  ],
  templateUrl: './eventos-real.component.html',
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
    .animate-slideUp { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

    :host {
      display: block;
      color: #334155;
    }

    .dashboard-container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 2.5rem 2rem;
      border-radius: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      color: white;
      margin-bottom: 2rem;
      position: relative;
      overflow: hidden;
    }

    .pagination-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.2s ease;
      border: 1px solid #e2e8f0;
      background: white;
      color: #64748b;
    }

    .pagination-btn:hover:not(:disabled) {
      background: #f1f5f9;
      color: #1e293b;
      border-color: #cbd5e1;
    }

    .pagination-btn.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
      box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
    }

    .pagination-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .video-item {
      padding: 1rem;
      border-radius: 1rem;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      transition: all 0.2s;
    }

    .video-item:hover {
      background: #f1f5f9;
      border-color: #e2e8f0;
    }

    /* Feedback global de ponteiro */
    button, 
    select, 
    input[type="date"], 
    .pagination-btn, 
    .btn-show-videos,
    a {
      cursor: pointer !important;
    }

    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
  `]
})
export class EventosRealComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private real = inject(EventsRealService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  isLoading = true;
  isRefreshing = false;
  timedOut = false;
  error = '';

  datasetId = '';
  meta: any = null;
  videos: any[] = [];
  yearChart: any; yearOpts: any;
  dayChart: any; dayOpts: any;
  private baseDayLabels: string[] = [];
  private baseDayValues: number[] = [];
  chartStartDate: string = '';
  chartEndDate: string = '';

  // paginação
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;

  // filtros e busca
  searchTerm = '';
  selectedOperation = '';
  startDate: string = '';
  endDate: string = '';
  sortBy: 'relevance' | 'newest' | 'date' = 'relevance';
  filteredVideos: any[] = [];
  totalVideosGlobal = 0;
  totalEventsGlobal = 0;
  // dados de sentiment (comentários)
  comments: any[] = [];
  bootstrapStats: any[] = [];
  groupedEvents: Array<{ 
    operation_id: string; 
    videos: any[]; 
    firstDate: Date | null; 
    firstDateStr: string; 
    minDateStr: string; 
    maxDateStr: string;
    totalComments: number;
    approvalCount: number;
    disapprovalCount: number;
    neutralityCount: number;
    isSignificant: boolean;

  }> = [];
  topOperations: Array<{ operation: string; count: number }> = [];
  filteredTotalOperations = 0;
  expandedEvents: Set<string> = new Set();
  videoPages: Record<string, number> = {};
  videoPageSize = 10;

  // Modal de detalhes
  isModalVisible: boolean = false;
  selectedEvent: any = null;
  selectedMetric: 'precision' | 'recall' | 'f1' = 'precision';
  drillDownChartData: any;
  drillDownChartOptions: any;

  errorBarPlugin: any = {
    id: 'errorBarPlugin',
    afterDatasetsDraw: (chart: any) => {
      const opts = chart?.options?.plugins?.errorBarPlugin || {};
      const errorData: Array<{ low: number; high: number; mean?: number }> = opts.data || [];
      const counts: number[] = opts.counts || [];
      const barValues: number[] = opts.barValues || [];
      if (!errorData.length) return;

      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      const yScale = chart.scales.y;

      const capSize   = opts.capSize ?? 8;
      const lineWidth = opts.lineWidth ?? 2;
      const color     = opts.color ?? '#111827';

      ctx.save();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;

      errorData.forEach((ci, i) => {
        const elem = meta.data[i];
        if (!elem) return;

        const x = elem.x;
        const lowY  = yScale.getPixelForValue(ci.low);
        const highY = yScale.getPixelForValue(ci.high);

        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x - capSize, highY); ctx.lineTo(x + capSize, highY);
        ctx.moveTo(x - capSize, lowY);  ctx.lineTo(x + capSize, lowY);
        ctx.stroke();

        if (typeof ci.mean === 'number') {
          const meanY = yScale.getPixelForValue(ci.mean);
          ctx.beginPath();
          ctx.moveTo(x - capSize * 0.6, meanY);
          ctx.lineTo(x + capSize * 0.6, meanY);
          ctx.stroke();
        }
      });

      if (counts.length) {
        ctx.fillStyle = opts.countColor ?? '#334155';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = opts.countFont ?? '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial';

        errorData.forEach((ci, i) => {
          const elem = meta.data[i];
          if (!elem) return;
          const x = elem.x;

          const topValue = Math.max(ci.high ?? 0, barValues[i] ?? 0);
          let y = yScale.getPixelForValue(topValue) - 8;
          y = Math.max(8, y);

          const n = counts[i] ?? 0;
          ctx.fillText(`n=${n}`, x, y);
        });
      }

      ctx.restore();
    }
  };

  async ngOnInit() {
    this.datasetId = this.route.snapshot.paramMap.get('id') || '';
    await this.loadInitialData();
  }

  async loadInitialData() {
    this.isLoading = true;
    const load = this.real.loadDataset(this.datasetId);
    try {
      const data = await withTimeout(load, 5000);
      this.zone.run(() => this.apply(data));
      this.loadComments().catch(() => {});
    } catch (e: any) {
      if (e?.message === 'TIMEOUT') {
        this.timedOut = true;
        this.isLoading = false;
        load.then(full => {
          this.zone.run(() => {
            this.apply(full);
            this.loadComments().catch(() => {});
          });
        }).catch(() => { this.error = 'Erro ao carregar dataset.'; });
      } else {
        this.error = 'Não foi possível carregar o dataset.';
        this.isLoading = false;
      }
    }
  }

  async refreshData() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    try {
      // Limpa cache no IndexedDB
      await this.real.clearCache(this.datasetId || 'consolidado');
      // Recarrega
      await this.loadInitialData();
    } catch (e) {
      console.error('Erro ao sincronizar:', e);
    } finally {
      this.isRefreshing = false;
      this.cdr.detectChanges();
    }
  }

  private apply(payload: any) {
    this.meta = payload.meta;
    this.videos = payload.videos;
    this.totalVideosGlobal = this.videos.length;
    this.totalEventsGlobal = new Set(this.videos.map(v => (v.operation_ner || v.operation || 'unknown').toString().trim()).filter(Boolean)).size;
    
    this.filteredVideos = this.videos;
    this.filteredVideos.sort((a, b) => {
      const da = a.data_postagem || a.date || a.day || '';
      const db = b.data_postagem || b.date || b.day || '';
      return da.localeCompare(db);
    });

    this.calculateFilteredTotals();

    // agrupar vídeos por operation_id
    this.groupVideosByOperation();

    // calcular totalPages após definir groupedEvents
    this.totalPages = Math.ceil(this.groupedEvents.length / this.pageSize);
    this.currentPage = 1; // reset para primeira página

    // calcular operações mais comuns (para filtro)
    const opCounts: Record<string, number> = {};
    for (const v of this.videos) {
      const op = (v.operation_id ?? v.operation ?? 'unknown').toString();
      opCounts[op] = (opCounts[op] || 0) + 1;
    }
    this.topOperations = Object.entries(opCounts)
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    this.yearChart = {
      labels: payload.series.byYear.labels,
      datasets: [{
        label: 'Vídeos por ano',
        data: payload.series.byYear.values,
        borderColor: '#0ea5e9',
        backgroundColor: '#0ea5e933',
        pointBackgroundColor: '#0ea5e9',
        pointBorderColor: '#ffffff',
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: .35,
        fill: true
      }]
    };
    this.yearOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, elements: { point: { radius: 3, hoverRadius: 6 } }, scales: { y: { beginAtZero: true } } };

    this.baseDayLabels = payload.series.byDay.labels || [];
    this.baseDayValues = payload.series.byDay.values || [];

    this.dayChart = {
      labels: this.baseDayLabels,
      datasets: [{
        label: 'Vídeos por dia',
        data: this.baseDayValues,
        borderColor: '#0ea5e9',
        backgroundColor: '#0ea5e933',
        pointBackgroundColor: '#0ea5e9',
        pointBorderColor: '#ffffff',
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: .35,
        fill: true
      }]
    };
    this.dayOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, elements: { point: { radius: 3, hoverRadius: 6 } }, scales: { y: { beginAtZero: true } } };

    this.isLoading = false;
    this.timedOut = false;
    this.error = '';

    // Não definir período padrão inicial para manter filtros limpos
    // O gráfico será mostrado com o período completo inicialmente
  }

  applyFilters() {
    const term = (this.searchTerm || '').toLowerCase();
    const selected = this.selectedOperation || '';
    const hasStart = !!this.startDate;
    const hasEnd = !!this.endDate;
    const start = hasStart ? new Date(this.startDate + 'T00:00:00') : null;
    const end = hasEnd ? new Date(this.endDate + 'T23:59:59') : null;

    this.filteredVideos = this.videos.filter(item => {
      const matchesSearch = !term ||
        item.titulo?.toLowerCase().includes(term) ||
        item.descricao?.toLowerCase().includes(term);
      const matchesOperation = !selected ||
        item.operation_id?.toString() === selected ||
        item.operation?.toString() === selected;
      let matchesDate = true;
      if (hasStart || hasEnd) {
        const ds = item.data_postagem || item.date || item.day;
        const d = ds ? new Date(ds) : null;
        if (d && !isNaN(d.getTime())) {
          if (start && d < start) matchesDate = false;
          if (end && d > end) matchesDate = false;
        } else {
          matchesDate = false;
        }
      }
      return matchesSearch && matchesOperation && matchesDate;
    });

    this.calculateFilteredTotals();

    // agrupar vídeos por operation_id
    this.groupVideosByOperation();

    // atualizar paginação
    this.totalPages = Math.ceil(this.groupedEvents.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }

    // filtros da amostra não alteram mais o gráfico: controle separado
  }

  applyChartRange() {
    const hasStart = !!this.chartStartDate;
    const hasEnd = !!this.chartEndDate;
    const start = hasStart ? new Date(this.chartStartDate + 'T00:00:00') : null;
    const end = hasEnd ? new Date(this.chartEndDate + 'T23:59:59') : null;
    this.updateDayChartForRange(start, end);
  }

  private updateDayChartForRange(start: Date | null, end: Date | null) {
    if (!this.baseDayLabels || !this.baseDayLabels.length) return;
    const hasStart = !!start;
    const hasEnd = !!end;
    if (!hasStart && !hasEnd) {
      this.dayChart = {
        labels: this.baseDayLabels,
        datasets: [{
          ...this.dayChart.datasets[0],
          data: this.baseDayValues
        }]
      };
      return;
    }
    const filtLabels: string[] = [];
    const filtValues: number[] = [];
    for (let i = 0; i < this.baseDayLabels.length; i++) {
      const lbl = this.baseDayLabels[i]; // yyyy-mm-dd
      const d = new Date(lbl + 'T12:00:00');
      if (isNaN(d.getTime())) continue;
      if (hasStart && d < start!) continue;
      if (hasEnd && d > end!) continue;
      filtLabels.push(lbl);
      filtValues.push(this.baseDayValues[i]);
    }
    this.dayChart = {
      labels: filtLabels,
      datasets: [{
        ...this.dayChart.datasets[0],
        data: filtValues
      }]
    };
  }

  // métodos de paginação
  get paginatedEvents() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.groupedEvents.slice(start, end);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  firstPage() {
    this.currentPage = 1;
  }

  lastPage() {
    this.currentPage = this.totalPages;
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // função auxiliar para template
  getMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr || dateStr === '—') return '—';
    try {
      const clean = dateStr.replace(' ', 'T').split('+')[0]; // Remove offset se existir
      const d = new Date(clean);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  changeSort(mode: 'relevance' | 'newest' | 'date') {
    this.sortBy = mode;
    this.sortEvents();
    this.currentPage = 1;
  }

  private sortEvents() {
    if (this.sortBy === 'relevance') {
      this.groupedEvents.sort((a, b) => b.videos.length - a.videos.length || (b.minDateStr || '').localeCompare(a.minDateStr || ''));
    } else if (this.sortBy === 'newest') {
      this.groupedEvents.sort((a, b) => (b.minDateStr || '').localeCompare(a.minDateStr || ''));
    } else if (this.sortBy === 'date') {
      this.groupedEvents.sort((a, b) => (a.minDateStr || '').localeCompare(b.minDateStr || ''));
    }
  }

  private calculateFilteredTotals() {
    this.filteredTotalOperations = new Set(this.filteredVideos.map(v => (v.operation_id ?? v.operation ?? '').toString())).size;
  }

  get currentPeriod(): string {
    if (this.startDate && this.endDate) {
      return `${this.formatDate(this.startDate)} a ${this.formatDate(this.endDate)}`;
    }
    if (this.meta?.period) {
      // Tenta split por ' a ' ou ' - ' ou ' – '
      const parts = this.meta.period.split(/\s+(?:a|-|–)\s+/);
      if (parts.length === 2) {
        return `${this.formatDate(parts[0])} — ${this.formatDate(parts[1])}`;
      }
      return this.meta.period;
    }
    return '—';
  }

  onRangeChanged(event: {start: string, end: string}) {
    this.startDate = event.start;
    this.endDate = event.end;
    this.applyFilters();
  }

  private groupVideosByOperation() {
    const groups: Record<string, any[]> = {};
    for (const video of this.filteredVideos) {
      const opId = (video.operation_id ?? video.operation ?? 'unknown').toString();
      if (!groups[opId]) {
        groups[opId] = [];
      }
      groups[opId].push(video);
    }

    this.groupedEvents = Object.entries(groups).map(([operation_id, videos]) => {
      // ordenar vídeos por data
      videos.sort((a, b) => {
        const da = a.data_postagem || a.date || a.day || '';
        const db = b.data_postagem || b.date || b.day || '';
        return da.localeCompare(db);
      });
      // data do primeiro vídeo
      const firstVideo = videos[0];
      const firstDateStr = firstVideo.data_postagem || firstVideo.date || firstVideo.day || '';
      const firstDate = firstDateStr ? new Date(firstDateStr) : null;

      // calcular min e max date
      let minDateStr: string = '';
      let maxDateStr: string = '';
      let minDate: Date | null = null;
      let maxDate: Date | null = null;
      for (const video of videos) {
        const dateStr = video.data_postagem || video.date || video.day;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            if (!minDate || d < minDate) {
              minDate = d;
              minDateStr = dateStr;
            }
            if (!maxDate || d > maxDate) {
              maxDate = d;
              maxDateStr = dateStr;
            }
          }
        }
      }

      return { 
        operation_id, 
        videos, 
        firstDate, 
        firstDateStr, 
        minDateStr: minDateStr || '—', 
        maxDateStr: maxDateStr || '—',
        totalComments: 0,
        approvalCount: 0,
        disapprovalCount: 0,
        neutralityCount: 0,
        isSignificant: false
      };
    });

    this.sortEvents();
    // Agregar dados de sentiment se comentários estiverem disponíveis
    if (this.comments && this.comments.length > 0) {
      this.aggregateSentimentToEvents();
    }
  }

  private aggregateSentimentToEvents(): void {
    if (!this.comments || this.comments.length === 0) return;

    for (const event of this.groupedEvents) {
      // ids de vídeo do evento (vários formatos possíveis)
      const vidIds = new Set<string>(event.videos
        .map((v: any) => (v.id_video || v.video_id || v.id || '').toString())
        .filter((x: string) => !!x));

      // Procura comentários associados a este evento por operação OU por id de vídeo
      const eventComments = this.comments.filter((c: any) => {
        const commentOp = (c.operation_id || c.operation || c.operation_ner || '').toString();
        if (commentOp && commentOp === event.operation_id) return true;
        const commentVid = (c.id_video || c.video_id || c.id || '').toString();
        if (commentVid && vidIds.has(commentVid)) return true;
        return false;
      });

      if (eventComments.length === 0) continue;

      // Contadores por sentimento (campo: new_BERT -> 1,0,-1)
      const approval = eventComments.filter((c: any) => c.new_BERT === 1).length;
      const disapproval = eventComments.filter((c: any) => c.new_BERT === -1).length;
      const neutrality = eventComments.filter((c: any) => c.new_BERT === 0).length;
      const total = eventComments.length;

      event.totalComments = total;
      event.approvalCount = approval;
      event.disapprovalCount = disapproval;
      event.neutralityCount = neutrality;

      // Calcula significância para cada evento
      if (this.bootstrapStats && this.bootstrapStats.length > 0) {
        event.isSignificant = this.computeEventSignificance(event);
      }
    }
  }

  // Abre o modal com as métricas detalhadas de um evento
  openEventMetrics(event: any) {
    this.selectedEvent = event;
    this.updateEventDrillDownChart();
    this.isModalVisible = true;
  }

  // Atualiza o gráfico de detalhes com a métrica selecionada
  updateEventDrillDownChart(): void {
    if (!this.selectedEvent) return;

    const labels: ClassName[] = ['Aprovação', 'Desaprovação', 'Neutro'];
    const { approvalCount: Aprova, disapprovalCount: Desaprova, neutralityCount: Neutro, totalComments: total } = this.selectedEvent;
    const denom = Math.max(1, total);

    const proportions = [Aprova / denom, Desaprova / denom, Neutro / denom];
    const counts = [Aprova, Desaprova, Neutro];

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    const errorBars = labels.map((label, idx) => {
      const prop = proportions[idx];
      const ci = this.getBootstrapCI(this.selectedMetric, label);
      const minus = Math.max(0, ci.minus);
      const plus  = Math.max(0, ci.plus);
      const low  = clamp01(prop - minus);
      const high = clamp01(prop + plus);
      return { low, high, mean: prop };
    });

    this.drillDownChartData = {
      labels,
      datasets: [
        {
          label: 'Proporção no Evento',
          data: proportions,
          backgroundColor: ['#10b981', '#ef4444', '#6b7280'],
          barPercentage: 0.6,
          categoryPercentage: 0.8
        }
      ]
    };

    this.drillDownChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const p = ctx.parsed.y;
              const ci = errorBars[ctx.dataIndex];
              const n  = counts[ctx.dataIndex];
              return [
                `Proporção: ${(p * 100).toFixed(1)}%`,
                `IC 95% (modelo): [${(ci.low * 100).toFixed(1)}% – ${(ci.high * 100).toFixed(1)}%]`,
                `Quantidade: ${n}`
              ];
            }
          }
        },
        errorBarPlugin: {
          data: errorBars,
          barValues: proportions,
          counts,
          capSize: 8,
          lineWidth: 2,
          color: '#111827',
          countColor: '#334155',
          countFont: '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: 1,
          ticks: { callback: (v: any) => (v * 100) + '%' },
          title: { display: true, text: `Proporção (${this.selectedMetric})` }
        },
        x: { title: { display: true, text: 'Classe' } }
      }
    };
  }

  // Calcula significância (sobreposição de IC entre Aprovação e Desaprovação)
  private computeEventSignificance(event: any): boolean {
    if (event.totalComments === 0) return false;

    const ciA = this.getBootstrapCI('precision', 'Aprovação');
    const ciD = this.getBootstrapCI('precision', 'Desaprovação');

    const minusA = Math.max(0, ciA.minus);
    const plusA  = Math.max(0, ciA.plus);
    const minusD = Math.max(0, ciD.minus);
    const plusD  = Math.max(0, ciD.plus);

    const clamp = (v: number) => Math.max(0, Math.min(1, v));

    const denom = Math.max(1, event.approvalCount + event.disapprovalCount);
    const pA = event.approvalCount / denom;
    const pD = event.disapprovalCount / denom;

    const lowA  = clamp(pA - minusA);
    const highA = clamp(pA + plusA);
    const lowD  = clamp(pD - minusD);
    const highD = clamp(pD + plusD);

    const overlap = !(highA < lowD || highD < lowA);
    return !overlap; // true = significante (sem sobreposição)
  }

  // Obtém o intervalo de confiança do bootstrap para uma métrica e classe
  private getBootstrapCI(metricType: 'precision'|'recall'|'f1', className: ClassName) {
    const keys = (this.bootstrapStats || []).map((d: any) => d['']).filter(Boolean) as string[];

    const detectId = (preferredLabels: string[]): string | null => {
      const ids = new Set(
        keys
          .filter(k => k.startsWith(metricType + '_class_'))
          .map(k => k.split('_class_')[1])
      );
      if (ids.size === 0) return null;

      if (preferredLabels.includes('Neutro') && ids.has('0')) return '0';
      if (preferredLabels.includes('Aprovação') && ids.has('1')) return '1';
      if (preferredLabels.includes('Desaprovação') && ids.has('2')) return '2';

      return Array.from(ids).sort()[0] || null;
    };

    const idFor = (label: ClassName): string | null => {
      if (label === 'Neutro') return detectId(['Neutro']);
      if (label === 'Aprovação') return detectId(['Aprovação']);
      return detectId(['Desaprovação']);
    };

    const classId = idFor(className);
    if (!classId) return { mean: 0, plus: 0, minus: 0 };

    const key = `${metricType}_class_${classId}`;
    const metricData = this.bootstrapStats.find((d: any) => d[''] === key);

    if (!metricData) return { mean: 0, plus: 0, minus: 0 };

    return {
      mean: metricData.mean,
      plus: Math.max(0, metricData.upper_95_ci - metricData.mean),
      minus: Math.max(0, metricData.mean - metricData.lower_95_ci),
    };
  }

  private async loadComments(): Promise<void> {
    const baseTag = document.getElementsByTagName('base')[0];
    const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
    const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
    
    // Mapeia dataset IDs para possíveis arquivos de comentários
    const commentFilesMap: Record<string, string> = {
      'brasil_all': 'sentiment/cenario-real/comentarios_2021_inferido_events.json',
      'brasil_19': 'sentiment/cenario-real/comentarios_2021_inferido_events.json',
      'brasil_20': 'sentiment/cenario-real/comentarios_2021_inferido_events.json',
      'brasil_21': 'sentiment/cenario-real/comentarios_2021_inferido_events.json',
      'brasil_22': 'sentiment/cenario-real/comentarios_2021_inferido_events.json',
      'brasil_23': 'sentiment/cenario-real/comentarios_2021_inferido_events.json',
      'brasil_24': 'sentiment/cenario-real/comentarios_2021_inferido_events.json',
      'brasil_25': 'sentiment/cenario-real/comentarios_2021_inferido_events.json',
    };

    const bootstrapFilesMap: Record<string, string> = {
      'brasil_all': 'sentiment/cenario-real/bootstrap_results_211124.json',
      'brasil_19': 'sentiment/cenario-real/bootstrap_results_211124.json',
      'brasil_20': 'sentiment/cenario-real/bootstrap_results_211124.json',
      'brasil_21': 'sentiment/cenario-real/bootstrap_results_211124.json',
      'brasil_22': 'sentiment/cenario-real/bootstrap_results_211124.json',
      'brasil_23': 'sentiment/cenario-real/bootstrap_results_211124.json',
      'brasil_24': 'sentiment/cenario-real/bootstrap_results_211124.json',
      'brasil_25': 'sentiment/cenario-real/bootstrap_results_211124.json',
    };

    // Na visão consolidada (/eventos), não carregamos sentimentos/comentários 
    // pois não há um arquivo unificado e os arquivos individuais são pesados.
    if (!this.datasetId) {
      return;
    }

    const commentsFile = commentFilesMap[this.datasetId];
    const bootstrapFile = bootstrapFilesMap[this.datasetId];

    if (!commentsFile && !bootstrapFile) {
      return; // Sem arquivos para este dataset
    }

    // Função auxiliar para resolver a URL final (Cloudflare vs Local)
    const resolve = (path: string) => {
      if (DATA_CONFIG.BASE_DATA_URL) {
        return `${DATA_CONFIG.BASE_DATA_URL}/${path}`;
      }
      return `${root}assets/data/${path}`;
    };

    try {
      const promises = [];
      
      if (commentsFile) {
        promises.push(
          fetch(resolve(commentsFile)).then(r => r.ok ? r.json() : []).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      if (bootstrapFile) {
        promises.push(
          fetch(resolve(bootstrapFile)).then(r => r.ok ? r.json() : []).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      const [comments, bootstrap] = await Promise.all(promises);
      
      this.comments = Array.isArray(comments) ? comments : [];
      this.bootstrapStats = Array.isArray(bootstrap) ? bootstrap : [];

      if (this.comments && this.comments.length > 0) {
        this.aggregateSentimentToEvents();
      }
    } catch (error) {
      console.log(`Dados não disponíveis para dataset ${this.datasetId}`);
    }
  }

  toggleEventExpansion(operation_id: string) {
    if (this.expandedEvents.has(operation_id)) {
      this.expandedEvents.delete(operation_id);
    } else {
      this.expandedEvents.add(operation_id);
      // Inicia na página 1 ao abrir
      this.videoPages[operation_id] = 1;
    }
  }

  getVideoPage(opId: string): number {
    return this.videoPages[opId] || 1;
  }

  getTotalVideoPages(event: any): number {
    if (!event?.videos?.length) return 0;
    return Math.ceil(event.videos.length / this.videoPageSize);
  }

  getPaginatedVideos(event: any): any[] {
    if (!event?.videos?.length) return [];
    const page = this.getVideoPage(event.operation_id);
    const start = (page - 1) * this.videoPageSize;
    return event.videos.slice(start, start + this.videoPageSize);
  }

  nextVideoPage(event: any) {
    const total = this.getTotalVideoPages(event);
    const current = this.getVideoPage(event.operation_id);
    if (current < total) {
      this.videoPages[event.operation_id] = current + 1;
    }
  }

  prevVideoPage(event: any) {
    const current = this.getVideoPage(event.operation_id);
    if (current > 1) {
      this.videoPages[event.operation_id] = current - 1;
    }
  }

}
