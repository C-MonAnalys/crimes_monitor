import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
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
    <div class="space-y-6">
      <!-- CABEÇALHO -->
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-6">
        <div>
          <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Visualização de Dados</h3>
          <h2 class="text-2xl font-black text-slate-900 leading-tight">Timeline de Eventos</h2>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- Agrupamento -->
          <div class="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              *ngFor="let g of [{id:'day', l:'Dia'}, {id:'week', l:'Semana'}, {id:'month', l:'Mês'}]"
              type="button"
              class="px-4 py-2 text-xs font-bold rounded-lg transition-all"
              [ngClass]="selectedGrouping === g.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'"
              (click)="setGrouping($any(g.id))"
            >
              {{ g.l }}
            </button>
          </div>

          <div class="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>

          <!-- Ações de Exportação -->
          <div class="flex items-center gap-2">
            <button (click)="downloadPng()" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-blue-200 transition-all flex items-center gap-2 text-xs font-bold" title="Baixar PNG">
              <i class="bi bi-download"></i>
              <span>PNG</span>
            </button>
            <button (click)="downloadPdf()" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-blue-200 transition-all flex items-center gap-2 text-xs font-bold" title="Baixar PDF">
              <i class="bi bi-file-earmark-pdf"></i>
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        <div class="flex items-center gap-3">
          <div class="relative group">
            <input
              #startInput
              type="date"
              [(ngModel)]="startDate"
              class="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full"
              placeholder="Início"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none z-10">
              <i class="bi bi-calendar3"></i>
            </span>
          </div>

          <div class="text-slate-300 font-light text-sm">até</div>

          <div class="relative group">
            <input
              #endInput
              type="date"
              [(ngModel)]="endDate"
              class="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full"
              placeholder="Fim"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none z-10">
              <i class="bi bi-calendar3"></i>
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button (click)="applyRange()" class="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10">
            Aplicar Filtro
          </button>
          <button (click)="clearRange()" class="px-4 py-2 text-slate-500 text-sm font-bold hover:text-red-500 transition-all">
            Limpar
          </button>
        </div>
      </div>

      <!-- ÁREA DO GRÁFICO -->
      <div class="h-96 w-full relative">
        <ng-container *ngIf="chartData?.labels?.length; else noData">
          <p-chart
            #chartRef
            type="line"
            [data]="chartData"
            [options]="chartOpts"
            height="100%"
          ></p-chart>
        </ng-container>
        <ng-template #noData>
          <div class="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/30 rounded-3xl border-2 border-dashed border-slate-100">
            <i class="bi bi-bar-chart text-4xl mb-2 opacity-20"></i>
            <p class="font-medium">Sem dados para este período</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    
    button, input[type="date"] {
      cursor: pointer !important;
    }

    input[type="date"] {
      min-width: 150px;
      position: relative;
    }

    input[type="date"]::-webkit-calendar-picker-indicator {
      position: absolute;
      right: 0;
      top: 0;
      width: 40px;
      height: 100%;
      margin: 0;
      padding: 0;
      cursor: pointer;
      opacity: 0;
      z-index: 20;
    }
    
    input[type="date"]:hover::-webkit-calendar-picker-indicator {
      opacity: 1;
    }
  `]
})
export class EventosTimelineChartComponent implements OnChanges {
  @Input() videos: any[] = [];
  @Input() datasetId = '';           // <<< para montar o nome do arquivo
  @Input() initialStartDate = '';
  @Input() initialEndDate = '';
  @Output() rangeChanged = new EventEmitter<{start: string, end: string}>();

  @ViewChild('chartRef') chartComp?: UIChart;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['videos']) {
      this.buildBaseSeries();
      this.buildChartOptions();
      this.applyRange();
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
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 12 },
          padding: 8,
          cornerRadius: 6,
          callbacks: {
            title: (items: any[]) => {
              if (!items?.length) return '';
              const lbl = items[0].label as string;
              return this.formatTooltipTitle(lbl);
            },
            label: (ctx: any) => `Eventos distintos: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: baseXAxisTitle,
            color: '#64748b',
            font: { size: 12 }
          },
          ticks: {
            color: '#64748b',
            callback: (_val: any, idx: number) => {
              const lbl = this.chartData?.labels?.[idx] as string;
              return this.formatTickLabel(lbl);
            },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Nº de eventos distintos',
            color: '#64748b',
            font: { size: 12 }
          },
          ticks: {
            color: '#64748b',
            precision: 0
          },
          grid: {
            color: 'rgba(148,163,184,0.3)',
            drawBorder: false
          }
        }
      },
      elements: {
        line: {
          tension: 0.35,
          borderWidth: 2,
          borderCapStyle: 'round'
        },
        point: {
          radius: 2,
          hoverRadius: 5,
          hitRadius: 6
        }
      },
      onClick: (event: any, elements: any[]) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const label = this.chartData.labels[index];
          this.setPeriodFromLabel(label);
        }
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
  applyRange() {
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

    this.chartData = {
      labels,
      datasets: [{
        label: datasetLabel,
        data: values,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.12)',
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
  setPeriodFromLabel(label: string) {
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
    this.applyRange();
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

    const axisTitleSize = 30;
    const axisTickSize  = 25;
    const legendSize    = 30;

    const baseXTicks = baseOpts.scales?.x?.ticks || {};
    const baseYTicks = baseOpts.scales?.y?.ticks || {};

    const exportOpts: any = {
      ...baseOpts,
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        ...(baseOpts.plugins || {}),
        legend: {
          ...(baseOpts.plugins?.legend || {}),
          labels: {
            ...(baseOpts.plugins?.legend?.labels || {}),
            font: {
              ...(baseOpts.plugins?.legend?.labels?.font || {}),
              size: legendSize
            }
          }
        },
        tooltip: {
          ...(baseOpts.plugins?.tooltip || {}),
          titleFont: {
            ...(baseOpts.plugins?.tooltip?.titleFont || {}),
            size: 16,
            weight: '600'
          },
          bodyFont: {
            ...(baseOpts.plugins?.tooltip?.bodyFont || {}),
            size: 16
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
              size: axisTitleSize
            }
          },
          ticks: {
            ...baseXTicks,
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
              size: axisTitleSize
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
}
