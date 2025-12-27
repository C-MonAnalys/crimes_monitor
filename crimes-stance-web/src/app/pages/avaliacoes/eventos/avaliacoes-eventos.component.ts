import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { Router } from '@angular/router';

import { EventsService } from '../../../services/events.service';
import { EventsRealService } from '../../../services/events-real.service';
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
  private eventsReal = inject(EventsRealService);
  private router = inject(Router);
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
  temporalChartData: any; temporalChartOptions: any;
  radarChartData: any; radarChartOptions: any;

  // seletores do gráfico de desempenho (por cenário e métrica)
  scenarios: string[] = [];
  selectedScenario: string = '';
  metricType: 'acu' | 'pre' | 'rev' | 'f1' = 'acu';

  // dados detalhados p/ gráficos adicionais e coleção
  metrics: any[] = [];
  videos: any[] = [];
  videosByMonth: any[] = [];

  // coleção (migrado de /coletas/eventos)
  items: any[] = [];
  filteredItems: any[] = [];
  page = 1;
  per = 9;
  searchTerm = '';
  selectedOperation = '';
  topOperations: Array<{ operation: string; count: number }> = [];
  // filtros por período
  startDate: string = '';
  endDate: string = '';

  // gráfico Top Operações (click para detalhes)
  topOpsChartData: any; topOpsChartOpts: any;

  // suporte (removido seletor de dataset real, mas propriedades ficaram referenciadas)
  realDatasets: Record<string, { label: string; description?: string; file: string }> = {};
  selectedRealDatasetId: string = '';

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

    // carrega dados extras (grid de coleção) e datasets reais
    this.loadExtraData();
    this.loadRealDatasets();
  }

  private applyData(evalData: any) {
    if (!evalData) return;

    this.stats.set({
      totalVideos: evalData.datasets.totalVideos,
      uniqOps: evalData.datasets.uniqueOperations,
      period: evalData.datasets.periodLabel,
      avgPerOp: evalData.datasets.avgVideosPerOperation,
    });

    // o gráfico de desempenho será montado a partir de metrics (carregado em loadExtraData)

    // A série temporal usará dados reais via loadRealSeries(datasetId)

    // Mantemos dados de comparação apenas se necessário futuramente (não exibido por padrão)
  }

  private async loadExtraData() {
    try {
      const { videos, metrics, videosByMonth } = await this.events.listAll();
      this.zone.run(() => {
        this.videos = videos ?? [];
        this.metrics = metrics ?? [];
        this.videosByMonth = videosByMonth ?? [];

        // inicializa coleção
        this.items = this.videos;
        this.calculateTopOperations();
        this.applyFilters();

        // inicializa cenários p/ gráfico de desempenho
        this.scenarios = Array.from(new Set((this.metrics || []).map((m: any) => m.cenario).filter(Boolean)));
        this.selectedScenario = this.scenarios[0] || '';
        this.hasPerfData = this.scenarios.length > 0;
        this.updatePerfChartFromMetrics();

        // série temporal mensal (mesmo formato da análise)
        const monthlyData = (this.videosByMonth || []).map(item => ({ month: item.period, count: item.count }));
        this.videosSeriesData = {
          labels: monthlyData.map(d => {
            const [year, month] = d.month.split('-');
            return `${month}/${year}`;
          }),
          datasets: [{
            label: 'Vídeos Coletados',
            data: monthlyData.map(d => d.count),
            borderColor: '#0ea5e9',
            backgroundColor: '#0ea5e933',
            pointBackgroundColor: '#8B5CF6',
            pointBorderColor: '#ffffff',
            pointRadius: 3,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: true
          }]
        };
        this.videosSeriesOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, elements: { point: { radius: 3, hoverRadius: 6 } } };
        this.hasSeriesData = (monthlyData.length > 0);

        // dados do gráfico temporal (interface igual ao events-analysis)
        this.temporalChartData = this.videosSeriesData;
        this.temporalChartOptions = this.videosSeriesOpts;

        // Top operações com estilo do dashboard
        const topOps = this.topOperations.slice(0, 10);
        this.topOpsChartData = {
          labels: topOps.map((_, idx) => `#${idx + 1}`),
          datasets: [{
            label: 'Top 10 Operações',
            data: topOps.map(x => x.count),
            backgroundColor: '#22c55e',
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.7,
            categoryPercentage: 0.6
          }]
        };
        this.topOpsChartOpts = {
          responsive: true,
          indexAxis: 'x',
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const idx = ctx.dataIndex;
                  const count = ctx.parsed.y;
                  const percent = ((count / Math.max(1, this.total)) * 100).toFixed(1);
                  const op = topOps[idx]?.operation;
                  return [`Rank: #${idx + 1}`, `Operação: ${op}`, `Vídeos: ${count} (${percent}%)`];
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#64748b' } },
            y: { beginAtZero: true, grid: { color: 'rgba(148, 163, 184, 0.2)' }, ticks: { color: '#475569' } }
          },
          onHover: (event: any, elements: any[]) => {
            if (event?.native?.target) {
              event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
            }
          },
          onClick: (_evt: any, elements: any[]) => {
            if (elements && elements.length > 0) {
              const idx = elements[0].index;
              const op = topOps[idx]?.operation;
              if (op) this.router.navigate(['/operacao', encodeURIComponent(op)]);
            }
          }
        };

        // Radar de métricas (média por técnica)
        this.updateRadarChartFromMetrics();

        this.cdr.markForCheck();
      });
    } catch (e) {
      // mantém a página utilizável mesmo se gráficos extras falharem
      console.warn('[AvaliacoesEventos] loadExtraData failed', e);
    }
  }
  private getTechniqueName(technique: string): string {
    const names: Record<string, string> = { HS: 'Heurística Semântica', HT: 'Heurística Temporal', GPT: 'GPT-4' };
    return names[technique] || technique;
  }

  private getTechniqueColor(technique: string): string {
    const colors: Record<string, string> = { HS: '#3B82F6', HT: '#10B981', GPT: '#F59E0B' };
    return colors[technique] || '#6B7280';
  }

  updatePerfChartFromMetrics() {
    const scenario = this.selectedScenario;
    const metricKey = this.metricType; // 'acu' | 'pre' | 'rev' | 'f1'
    const dataForScenario = (this.metrics || []).filter((m: any) => m.cenario === scenario);
    const techniques = Array.from(new Set(dataForScenario.map((m: any) => m.tecnica)));
    const values = techniques.map(t => {
      const m = dataForScenario.find((x: any) => x.tecnica === t);
      const v = m ? (m[metricKey] ?? 0) : 0;
      return typeof v === 'number' ? v : 0;
    });
    const labelMap: Record<string, string> = { acu: 'Acurácia', pre: 'Precisão', rev: 'Revocação', f1: 'F1-Score' } as any;
    const colorMap: Record<string, string> = { acu: '#3b82f6', pre: '#10b981', rev: '#f59e0b', f1: '#8b5cf6' } as any;
    this.perfChartData = {
      labels: techniques.map(t => this.getTechniqueName(t)),
      datasets: [{
        label: labelMap[metricKey],
        data: values,
        borderColor: colorMap[metricKey],
        backgroundColor: colorMap[metricKey] + '33',
        pointBackgroundColor: colorMap[metricKey],
        pointBorderColor: '#ffffff',
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true
      }]
    };
    this.perfChartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true, max: 1, ticks: { callback: (v: any) => (v * 100) + '%' } } },
      elements: { point: { radius: 3, hoverRadius: 6 } }
    };
    this.hasPerfData = techniques.length > 0;
  }

  private updateRadarChartFromMetrics() {
    const metricsToShow = ['acu', 'pre', 'rev', 'f1', 'nmi', 'ami'];
    const metricLabels = ['Acurácia', 'Precisão', 'Revocação', 'F1-Score', 'NMI', 'AMI'];

    if (!this.metrics || this.metrics.length === 0) {
      this.radarChartData = { labels: metricLabels, datasets: [] };
      this.radarChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
      return;
    }

    const techniques = Array.from(new Set(this.metrics.map((m: any) => m.tecnica)));
    const datasets = techniques.map(technique => {
      const techniqueData = this.metrics.filter((m: any) => m.tecnica === technique);
      const avgMetrics = metricsToShow.map(key => {
        if (techniqueData.length === 0) return 0;
        const sum = techniqueData.reduce((acc: number, m: any) => acc + (typeof m[key] === 'number' ? m[key] : 0), 0);
        return +(sum / techniqueData.length).toFixed(2);
      });
      const color = this.getTechniqueColor(technique);
      return {
        label: this.getTechniqueName(technique),
        data: avgMetrics,
        borderColor: color,
        backgroundColor: color + '20',
        pointBackgroundColor: color,
        pointBorderColor: color
      };
    });

    this.radarChartData = { labels: metricLabels, datasets };
    this.radarChartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  }

  private async loadRealDatasets() {
    try {
      const ds = await this.eventsReal.getDatasets();
      const keys = Object.keys(ds || {});
      this.zone.run(() => {
        this.realDatasets = ds || {};
        this.selectedRealDatasetId = keys[0] || '';
        this.cdr.markForCheck();
      });
      if (this.selectedRealDatasetId) {
        await this.loadRealSeries(this.selectedRealDatasetId);
      }
    } catch (e) {
      console.warn('[AvaliacoesEventos] loadRealDatasets failed', e);
    }
  }

  async loadRealSeries(datasetId: string) {
    try {
      const data = await this.eventsReal.loadDataset(datasetId);
      const byYear = data.series.byYear;
      this.zone.run(() => {
        this.hasSeriesData = Array.isArray(byYear.labels) && byYear.labels.length > 0;
        this.videosSeriesData = {
          labels: byYear.labels,
      datasets: [{
            label: 'Vídeos coletados (dados reais)',
            data: byYear.values,
        tension: .3,
            borderColor: '#0ea5e9',
            backgroundColor: '#0ea5e933',
            pointBackgroundColor: '#8B5CF6',
            pointBorderColor: '#ffffff',
            pointRadius: 3,
            pointHoverRadius: 6,
        fill: true
      }]
    };
        this.videosSeriesOpts = { responsive: true, maintainAspectRatio: false, elements: { point: { radius: 3, hoverRadius: 6 } } };
        this.cdr.markForCheck();
      });
    } catch (e) {
      console.warn('[AvaliacoesEventos] loadRealSeries failed', e);
    }
  }

  onMetricOrScenarioChange() {
    this.updatePerfChartFromMetrics();
  }

  onRealDatasetChange() {
    if (this.selectedRealDatasetId) {
      this.loadRealSeries(this.selectedRealDatasetId);
    }
  }

  // ====== Parte de coleção (lista/paginação/filtros) ======
  private calculateTopOperations(): void {
    const opCounts: Record<string, number> = {};
    for (const v of this.items) {
      const op = (v.operation ?? v.operation_id ?? 'unknown').toString();
      opCounts[op] = (opCounts[op] || 0) + 1;
    }
    this.topOperations = Object.entries(opCounts)
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  applyFilters(): void {
    const term = (this.searchTerm || '').toLowerCase();
    const selected = this.selectedOperation || '';
    const hasStart = !!this.startDate;
    const hasEnd = !!this.endDate;
    const start = hasStart ? new Date(this.startDate + 'T00:00:00') : null;
    const end = hasEnd ? new Date(this.endDate + 'T23:59:59') : null;
    this.filteredItems = this.items.filter(item => {
      const matchesSearch = !term ||
        item.titulo?.toLowerCase().includes(term) ||
        item.descricao?.toLowerCase().includes(term);
      const matchesOperation = !selected || (item.operation?.toString() === selected || item.operation_id?.toString() === selected);
      let matchesDate = true;
      if (hasStart || hasEnd) {
        const ds = item.data_postagem || item.date || item.day;
        const d = ds ? new Date(ds) : null;
        if (d && !isNaN(d.getTime())) {
          if (start && d < start) matchesDate = false;
          if (end && d > end) matchesDate = false;
        } else {
          // se não houver data válida e o usuário filtrou por período, exclui
          matchesDate = false;
        }
      }
      return matchesSearch && matchesOperation && matchesDate;
    });
    this.page = 1;
  }

  updatePagination(): void {
    this.page = 1;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Data não disponível';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  truncateText(text: string, maxLength: number): string {
    if (!text) return 'Descrição não disponível';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  goToPage(pageNum: number): void { if (pageNum >= 1 && pageNum <= this.totalPages) this.page = pageNum; }
  prev() { if (this.page > 1) this.page--; }
  next() { if (this.page < this.totalPages) this.page++; }

  // getters
  get total() { return this.items.length; }
  get filteredTotal() { return this.filteredItems.length; }
  get totalPages() { return Math.max(1, Math.ceil(this.filteredTotal / this.per)); }
  get pageItems() { return this.filteredItems.slice((this.page - 1) * this.per, this.page * this.per); }
  get uniqueOperations(): number { return new Set(this.items.map(v => v.operation ?? v.operation_id)).size; }
  get dateRange(): string {
    if (this.items.length === 0) return 'N/A';
    const dates = this.items.map(v => v.data_postagem).filter(Boolean).sort();
    if (dates.length === 0) return 'N/A';
    const first = new Date(dates[0]).getFullYear();
    const last = new Date(dates[dates.length - 1]).getFullYear();
    return first === last ? first.toString() : `${first}-${last}`;
  }
  get avgVideosPerOp(): string {
    const avg = this.uniqueOperations > 0 ? this.total / this.uniqueOperations : 0;
    return avg.toFixed(1);
  }
  get visiblePages(): number[] {
    const current = this.page;
    const total = this.totalPages;
    const delta = 2;
    let start = Math.max(1, current - delta);
    let end = Math.min(total, current + delta);
    if (end - start < 2 * delta) {
      if (start === 1) {
        end = Math.min(total, start + 2 * delta);
      } else if (end === total) {
        start = Math.max(1, end - 2 * delta);
      }
    }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }
}
