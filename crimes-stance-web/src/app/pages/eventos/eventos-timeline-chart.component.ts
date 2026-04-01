import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild, ElementRef, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule, UIChart } from 'primeng/chart';
import { jsPDF } from 'jspdf';
import Chart from 'chart.js/auto';

type Grouping = 'day' | 'week' | 'month';

@Component({
  selector: 'app-eventos-timeline-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartModule],
  template: `
    <div class="bg-white !mx-[-1.5rem] md:!mx-0 !rounded-none md:!rounded-[2.5rem] shadow-none md:shadow-xl border-y border-x-0 md:border border-slate-100 overflow-hidden transition-all hover:shadow-2xl flex flex-col h-full">
      <!-- CABEÇALHO COM TÍTULO E FILTROS -->
      <div class="p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Visualização de Dados</h3>
            <h2 class="text-3xl font-black text-slate-900 tracking-tighter">Timeline de Eventos</h2>
          </div>

          <div class="flex items-center gap-2">
            <!-- Controles de Zoom Premium -->
            <div class="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
              <button (click)="zoomOut()" 
                      class="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm border border-slate-100 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-90"
                      title="Diminuir Zoom">
                <i class="bi bi-dash-lg"></i>
              </button>
              <div class="px-3 flex flex-col items-center">
                <span class="text-[10px] font-black text-slate-400 uppercase leading-none">Zoom</span>
                <span class="text-xs font-black text-blue-600 mt-0.5">{{ barWidth }}px</span>
              </div>
              <button (click)="zoomIn()" 
                      class="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm border border-slate-100 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-90"
                      title="Aumentar Zoom">
                <i class="bi bi-plus-lg"></i>
              </button>
            </div>

            <div class="h-8 w-px bg-slate-100 mx-2 hidden sm:block"></div>

            <div class="flex items-center gap-2">
              <button (click)="downloadPng()" class="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm border border-slate-100" title="Baixar PNG">
                <i class="bi bi-image"></i>
              </button>
              <button (click)="downloadPdf()" class="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm border border-slate-100" title="Baixar PDF">
                <i class="bi bi-file-earmark-pdf"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <!-- Agrupamento -->
          <div class="flex items-center bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50 flex-1 sm:flex-none">
            <button
              *ngFor="let g of [{id:'day', l:'Dia'}, {id:'week', l:'Semana'}, {id:'month', l:'Mês'}]"
              type="button"
              class="flex-1 sm:px-6 py-2.5 text-[11px] font-black rounded-xl transition-all uppercase tracking-wider"
              [ngClass]="selectedGrouping === g.id
                ? 'bg-white text-blue-600 shadow-md'
                : 'text-slate-400 hover:text-slate-600'"
              (click)="setGrouping($any(g.id))"
            >
              {{ g.l }}
            </button>
          </div>

          <!-- Range de Datas -->
          <div class="flex sm:flex-none items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50 sm:max-w-[320px]">
            <div class="flex-1 relative flex items-center">
              <i class="bi bi-calendar-event absolute left-3 text-slate-400 text-xs"></i>
              <input type="date" [(ngModel)]="startDate" (change)="applyRange()"
                     class="w-full pl-9 pr-2 py-2 bg-transparent text-xs font-black text-slate-700 focus:outline-none uppercase tracking-tighter">
            </div>
            <span class="text-slate-300 font-black text-sm">/</span>
            <div class="flex-1 relative flex items-center">
              <i class="bi bi-calendar-check absolute left-3 text-slate-400 text-xs"></i>
              <input type="date" [(ngModel)]="endDate" (change)="applyRange()"
                     class="w-full pl-9 pr-2 py-2 bg-transparent text-xs font-black text-slate-700 focus:outline-none uppercase tracking-tighter">
            </div>
          </div>

          <button (click)="clearRange()" class="px-5 py-3 text-[11px] font-black text-slate-400 hover:text-red-500 transition-all uppercase tracking-widest">
            Limpar
          </button>
        </div>
      </div>

      <!-- ÁREA DO GRÁFICO COM SCROLL E ZOOM 2D -->
      <div class="relative flex-1 bg-slate-50/30 border-t border-slate-100">
        <div #scrollContainer class="overflow-x-auto overflow-y-auto premium-scrollbar scroll-smooth" 
             [style.height.px]="450">
          <div [style.width.px]="getChartWidth()" 
               [style.height.px]="chartHeight" 
               class="min-w-full transition-all duration-300 ease-out">
            <ng-container *ngIf="chartData?.labels?.length; else noData">
              <p-chart
                #chartRef
                type="line"
                [data]="chartData"
                [options]="chartOpts"
                width="100%"
                height="100%"
              ></p-chart>
            </ng-container>
          </div>
        </div>

        <ng-template #noData>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <i class="bi bi-bar-chart text-2xl opacity-20"></i>
            </div>
            <p class="font-black text-[10px] uppercase tracking-[0.2em]">Sem dados para este período</p>
          </div>
        </ng-template>
        
        <!-- Gradiente de Scroll Indicador -->
        <div class="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    
    .premium-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .premium-scrollbar::-webkit-scrollbar-track {
      background: rgba(241, 245, 249, 0.5);
      border-radius: 10px;
    }
    .premium-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 10px;
      transition: all 0.2s;
    }
    .premium-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    
    button, input[type="date"] {
      cursor: pointer !important;
    }

    input[type="date"]::-webkit-calendar-picker-indicator {
      position: absolute;
      left: 0; top: 0; width: 100%; height: 100%;
      margin: 0; padding: 0; cursor: pointer; opacity: 0;
    }

    ::ng-deep .p-chart canvas {
      /* Estilo removido para permitir o cursor pointer dinâmico */
    }
  `]
})
export class EventosTimelineChartComponent implements OnChanges {
  private ngZone = inject(NgZone);
  @Input() videos: any[] = [];
  @Input() datasetId = '';
  @Input() initialStartDate = '';
  @Input() initialEndDate = '';
  @Output() rangeChanged = new EventEmitter<{start: string, end: string}>();
  selectedLabel: string | null = null;

  @ViewChild('chartRef') chartComp?: UIChart;
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  private readonly MAX_TOTAL_WIDTH = 30000;

  // séries base por agrupamento
  private baseSeries: Record<Grouping, { labels: string[]; values: number[] }> = {
    day:   { labels: [], values: [] },
    week:  { labels: [], values: [] },
    month: { labels: [], values: [] }
  };

  selectedGrouping: Grouping = 'week';

  chartData: any;
  chartOpts: any;

  startDate = '';
  endDate = '';

  barWidth: number = 30; // Diferente do semanal, começamos com 30px pois é linha
  chartHeight: number = 400;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['videos']) {
      this.buildBaseSeries();
      this.buildChartOptions();
      this.applyRange();
      setTimeout(() => this.scrollToEnd(), 50);
    }
    if (changes['initialStartDate'] || changes['initialEndDate']) {
      this.startDate = this.initialStartDate;
      this.endDate = this.initialEndDate;
      this.applyRange();
    }
  }

  // ========= 1 evento = primeira data de vídeo daquela operação =========
  private buildBaseSeries() {
    const earliestByOp = new Map<string, Date>();

    for (const v of this.videos || []) {
      const rawDate = v.data_postagem || v.date || v.day;
      if (!rawDate) continue;

      const d = new Date(String(rawDate).replace(' ', 'T'));
      if (isNaN(d.getTime())) continue;

      const op = (v.operation_ner || v.operation || 'unknown').toString().trim();
      if (!op) continue;

      const current = earliestByOp.get(op);
      if (!current || d < current) {
        earliestByOp.set(op, d);
      }
    }

    const dayBuckets   = new Map<string, number>();
    const weekBuckets  = new Map<string, number>();
    const monthBuckets = new Map<string, number>();

    for (const [, eventDate] of earliestByOp.entries()) {
      const dayKey   = this.formatDateISO(eventDate);
      const weekKey  = this.formatDateISO(this.getWeekStart(eventDate));
      const monthKey = this.formatMonthKey(eventDate);

      dayBuckets.set(dayKey,   (dayBuckets.get(dayKey)   || 0) + 1);
      weekBuckets.set(weekKey, (weekBuckets.get(weekKey) || 0) + 1);
      monthBuckets.set(monthKey, (monthBuckets.get(monthKey) || 0) + 1);
    }

    this.baseSeries.day   = this.mapToSeries(dayBuckets);
    this.baseSeries.week  = this.mapToSeries(weekBuckets);
    this.baseSeries.month = this.mapToSeries(monthBuckets);
  }

  private mapToSeries(buckets: Map<string, number>): { labels: string[]; values: number[] } {
    const keys = Array.from(buckets.keys()).sort();
    return {
      labels: keys,
      values: keys.map(k => buckets.get(k) || 0)
    };
  }

  // ======== opções do gráfico (dependem do agrupamento) ========
  private buildChartOptions() {
    const baseXAxisTitle =
      this.selectedGrouping === 'day'
        ? 'Dia'
        : this.selectedGrouping === 'week'
          ? 'Início da semana'
          : 'Início do mês';

    this.chartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event: any, elements: any[]) => {
        const target = event.native ? event.native.target : (event.target || (event.chart && event.chart.canvas));
        if (target) {
          target.style.cursor = (elements && elements.length > 0) ? 'pointer' : 'default';
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12, weight: '500' },
          padding: 12,
          cornerRadius: 12,
          displayColors: false,
          callbacks: {
            title: (items: any[]) => {
              if (!items?.length) return '';
              const lbl = items[0].label as string;
              return this.formatTooltipTitle(lbl);
            },
            label: (ctx: any) => `Eventos distintos: ${ctx.parsed.y}`,
            footer: () => '\nClique para filtrar este período →'
          }
        }
      },
      scales: {
        x: {
          title: {
            display: false
          },
          ticks: {
            color: '#94a3b8',
            font: { size: 10, weight: '600' },
            callback: (_val: any, idx: number) => {
              const lbl = this.chartData?.labels?.[idx] as string;
              return this.formatTickLabel(lbl);
            },
            maxRotation: 45,
            minRotation: 45,
            autoSkip: false
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          position: 'right',
          title: {
            display: false
          },
          ticks: {
            color: '#94a3b8',
            font: { size: 10, weight: '700' },
            precision: 0,
            padding: 10
          },
          grid: {
            color: 'rgba(226,232,240,0.4)',
            drawTicks: false
          },
          border: { display: false }
        }
      },
      elements: {
        line: {
          tension: 0.4,
          borderWidth: 3,
          borderColor: '#3b82f6',
          fill: true,
          backgroundColor: (ctx: any) => {
            const canvas = ctx.chart.ctx;
            const gradient = canvas.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
            return gradient;
          }
        },
        point: {
          radius: (ctx: any) => {
            const lbl = this.chartData?.labels?.[ctx.dataIndex];
            return lbl === this.selectedLabel ? 8 : 4;
          },
          hoverRadius: (ctx: any) => {
            const lbl = this.chartData?.labels?.[ctx.dataIndex];
            return lbl === this.selectedLabel ? 10 : 8;
          },
          hitRadius: 10,
          backgroundColor: (ctx: any) => {
            const lbl = this.chartData?.labels?.[ctx.dataIndex];
            return lbl === this.selectedLabel ? '#3b82f6' : '#ffffff';
          },
          borderColor: (ctx: any) => {
            const lbl = this.chartData?.labels?.[ctx.dataIndex];
            return lbl === this.selectedLabel ? '#2563eb' : '#3b82f6';
          },
          borderWidth: (ctx: any) => {
            const lbl = this.chartData?.labels?.[ctx.dataIndex];
            return lbl === this.selectedLabel ? 4 : 2;
          },
          hoverBorderWidth: 4
        }
      },
      onClick: (event: any, elements: any[]) => {
        this.ngZone.run(() => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const label = this.chartData.labels[index];
            this.selectedLabel = label;
            this.setPeriodFromLabel(label, true); // true indica que veio de um clique
          }
        });
      }
    };
  }

  // === mudança de agrupamento via botões ===
  setGrouping(group: Grouping) {
    if (this.selectedGrouping === group) return;
    this.selectedGrouping = group;
    this.buildChartOptions();
    this.applyRange();
  }

  // ========= aplicação do range, considerando o agrupamento =========
  applyRange(skipChartFilter: boolean = false) {
    if (!skipChartFilter) {
      this.selectedLabel = null; // Limpa destaque se for filtro manual
    }
    const series = this.baseSeries[this.selectedGrouping];
    const baseLabels = series.labels;
    const baseValues = series.values;

    if (!baseLabels.length) {
      this.chartData = { labels: [], datasets: [] };
      return;
    }

    let start: Date | null = null;
    let end: Date | null = null;

    if (this.startDate) start = new Date(this.startDate + 'T00:00:00');
    if (this.endDate)   end   = new Date(this.endDate + 'T23:59:59');

    const labels: string[] = [];
    const values: number[] = [];

    for (let i = 0; i < baseLabels.length; i++) {
      const lbl = baseLabels[i];
      const d = new Date(lbl + 'T12:00:00');
      if (isNaN(d.getTime())) continue;

      if (start && d < start) continue;
      if (end && d > end) continue;

      labels.push(lbl);
      values.push(baseValues[i]);
    }

    const datasetLabel =
      this.selectedGrouping === 'day'
        ? 'Eventos por dia'
        : this.selectedGrouping === 'week'
          ? 'Eventos por semana'
          : 'Eventos por mês';

    if (skipChartFilter) {
      // Se for apenas clique/seleção, emitimos o evento mas não alteramos os dados do gráfico
      this.rangeChanged.emit({ start: this.startDate, end: this.endDate });
      if (this.chartComp) this.chartComp.reinit(); // Força atualização dos pontos para mostrar o destaque
      return;
    }

    this.chartData = {
      labels,
      datasets: [{
        label: datasetLabel,
        data: values,
        borderColor: '#3b82f6',
        // backgroundColor: 'rgba(59,130,246,0.12)', // Deixamos o gradiente do elements.line agir
        fill: true
      }]
    };

    // Emitir evento para sincronizar com a lista de vídeos
    this.rangeChanged.emit({ start: this.startDate, end: this.endDate });
  }

  clearRange() {
    this.startDate = '';
    this.endDate = '';
    this.applyRange();
  }

  // ===== definir período ao clicar no gráfico =====
  setPeriodFromLabel(label: string, isClick: boolean = false) {
    let start: string;
    let end: string;

    if (this.selectedGrouping === 'day') {
      start = end = label;
    } else if (this.selectedGrouping === 'week') {
      const d = new Date(label + 'T00:00:00');
      const endD = new Date(d);
      endD.setDate(d.getDate() + 6);
      start = this.formatDateISO(d);
      end = this.formatDateISO(endD);
    } else { // month
      const [year, month] = label.split('-').map(Number);
      const startD = new Date(year, month - 1, 1);
      const endD = new Date(year, month, 0);
      start = this.formatDateISO(startD);
      end = this.formatDateISO(endD);
    }

    this.startDate = start;
    this.endDate = end;
    this.applyRange(isClick);
  }

  // ===== botão do calendário =====
  openDatePicker(input: HTMLInputElement | null) {
    if (!input) return;
    input.focus();
    const anyInput = input as any;
    if (typeof anyInput.showPicker === 'function') {
      anyInput.showPicker();
    }
  }

  // ===== export em alta qualidade =====
  private buildExportImage(width = 1600, height = 960): string | null {
    if (!this.chartData || !this.chartData.labels?.length) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const bgPlugin = {
      id: 'bgColor',
      beforeDraw: (chart: any) => {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    };

    const baseOpts: any = this.chartOpts || {};

    const axisTitleSize = 18;
    const axisTickSize = 14;
    const legendSize = 16;

    const baseXTicks = baseOpts.scales?.x?.ticks || {};
    const baseYTicks = baseOpts.scales?.y?.ticks || {};

    const exportOpts: any = {
      ...baseOpts,
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {
          top: 40,
          bottom: 40,
          left: 40,
          right: 40
        }
      },
      plugins: {
        ...(baseOpts.plugins || {}),
        legend: {
          ...(baseOpts.plugins?.legend || {}),
          labels: {
            ...(baseOpts.plugins?.legend?.labels || {}),
            font: {
              ...(baseOpts.plugins?.legend?.labels?.font || {}),
              size: legendSize,
              weight: 'bold'
            }
          }
        }
      },
      scales: {
        x: {
          ...(baseOpts.scales?.x || {}),
          title: {
            ...(baseOpts.scales?.x?.title || {}),
            font: {
              ...(baseOpts.scales?.x?.title?.font || {}),
              size: axisTitleSize,
              weight: 'bold'
            }
          },
          ticks: {
            ...baseXTicks,
            autoSkip: true,
            maxTicksLimit: 15,
            padding: 10,
            font: {
              ...(baseXTicks.font || {}),
              size: axisTickSize
            },
            minRotation: 45,
            maxRotation: 45
          }
        },
        y: {
          ...(baseOpts.scales?.y || {}),
          title: {
            ...(baseOpts.scales?.y?.title || {}),
            font: {
              ...(baseOpts.scales?.y?.title?.font || {}),
              size: axisTitleSize,
              weight: 'bold'
            }
          },
          ticks: {
            ...baseYTicks,
            font: {
              ...(baseYTicks.font || {}),
              size: axisTickSize
            }
          }
        }
      }
    };

    const exportChart = new Chart(ctx, {
      type: 'line',
      data: this.chartData,
      options: exportOpts,
      plugins: [bgPlugin]
    });

    exportChart.update();

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    exportChart.destroy();

    return dataUrl;
  }

  private buildFilename(extension: 'png' | 'pdf'): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;

    const agrup =
      this.selectedGrouping === 'day'   ? 'dia' :
      this.selectedGrouping === 'week'  ? 'semana' :
                                          'mes';

    const dataset = this.datasetId || 'dataset';

    return `eventos_por_periodo_${dataset}_${agrup}.${extension}`;
  }

  downloadPng() {
    const url = this.buildExportImage();
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = this.buildFilename('png');
    a.click();
  }

  downloadPdf() {
    const url = this.buildExportImage();
    if (!url) return;

    const pdf = new jsPDF('landscape', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(
        (pageWidth * 0.9) / img.width,
        (pageHeight * 0.8) / img.height
      );

      const imgWidth = img.width * ratio;
      const imgHeight = img.height * ratio;

      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      pdf.addImage(img, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(this.buildFilename('pdf'));
    };
    img.src = url;
  }

  // ===== utilitários de data =====
  private getWeekStart(d: Date): Date {
    const tmp = new Date(d);
    const day = tmp.getDay(); // 0=dom, 1=seg, ...
    const diff = (day + 6) % 7;
    tmp.setDate(tmp.getDate() - diff);
    tmp.setHours(0, 0, 0, 0);
    return tmp;
  }

  private formatMonthKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  private formatDateISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatTickLabel(label: string): string {
    const d = new Date(label + 'T12:00:00');
    if (isNaN(d.getTime())) return label;

    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                   'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    const dia = String(d.getDate()).padStart(2, '0');
    const mes = meses[d.getMonth()];
    const ano = d.getFullYear();

    if (this.selectedGrouping === 'month') {
      return `${mes} ${ano}`;
    }
    return `${dia} ${mes} ${ano}`;
  }

  private formatTooltipTitle(label: string): string {
    const formatted = this.formatTickLabel(label);

    if (this.selectedGrouping === 'day') {
      return `Data: ${formatted}`;
    }
    if (this.selectedGrouping === 'week') {
      return `Início da semana: ${formatted}`;
    }
    return `Mês: ${formatted}`;
  }

  // ===== ZOOM LOGIC (NEW) =====
  getChartWidth(): number {
    if (!this.chartData || !this.chartData.labels) return 0;
    const numLabels = this.chartData.labels.length;
    let width = numLabels * this.barWidth;
    if (width > this.MAX_TOTAL_WIDTH) width = this.MAX_TOTAL_WIDTH;
    return Math.max(0, width);
  }

  scrollToEnd() {
    if (this.scrollContainer?.nativeElement) {
      const el = this.scrollContainer.nativeElement;
      el.scrollLeft = el.scrollWidth;
    }
  }

  zoomIn() {
    this.updateZoom(this.barWidth + 10);
  }

  zoomOut() {
    this.updateZoom(Math.max(20, this.barWidth - 10));
  }

  private updateZoom(newBarWidth: number) {
    if (!this.scrollContainer?.nativeElement || !this.chartData?.labels?.length) {
      this.barWidth = newBarWidth;
      return;
    }

    const numLabels = this.chartData.labels.length;
    const maxAllowedBarWidth = Math.floor(this.MAX_TOTAL_WIDTH / numLabels);
    const finalBarWidth = Math.min(newBarWidth, maxAllowedBarWidth);

    const container = this.scrollContainer.nativeElement;
    
    // Maintain center ratio
    const centerPixelX = container.scrollLeft + container.clientWidth / 2;
    const centerRatio = centerPixelX / this.getChartWidth();

    const zoomSteps = (finalBarWidth - 30) / 10;
    this.barWidth = finalBarWidth;
    this.chartHeight = 400 + (zoomSteps * 50);
    
    setTimeout(() => {
      const newTotalWidth = this.getChartWidth();
      container.scrollLeft = Math.max(0, (centerRatio * newTotalWidth) - (container.clientWidth / 2));
    }, 0);
  }
}
