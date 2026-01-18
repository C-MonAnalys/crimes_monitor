import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
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
    <div class="space-y-3">
      <!-- CABEÇALHO -->
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <!-- Título -->
        <div class="flex-shrink-0">
          <h2 class="font-semibold text-slate-900 leading-tight">Eventos por período</h2>
        </div>

        <!-- Controles -->
        <div class="flex flex-col gap-2 w-full lg:w-auto">
          <!-- Linha 1: Agrupamento -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-slate-700">Agrupar por:</span>
            <div class="inline-flex rounded-lg border border-slate-300 bg-white overflow-hidden">
              <button
                type="button"
                class="px-2.5 py-1 text-xs md:text-sm border-r border-slate-200 hover:bg-slate-50"
                [ngClass]="selectedGrouping === 'day'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-slate-700'"
                (click)="setGrouping('day')"
              >
                Dia
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs md:text-sm border-r border-slate-200 hover:bg-slate-50"
                [ngClass]="selectedGrouping === 'week'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-slate-700'"
                (click)="setGrouping('week')"
              >
                Semana
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs md:text-sm hover:bg-slate-50"
                [ngClass]="selectedGrouping === 'month'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-slate-700'"
                (click)="setGrouping('month')"
              >
                Mês
              </button>
            </div>
          </div>

          <!-- Linha 2: Datas + ações -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- INÍCIO -->
            <label class="text-sm text-slate-700 flex items-center gap-1">
              Início:
              <div class="relative">
                <input
                  #startInput
                  type="date"
                  class="pl-2 pr-8 py-1 border border-slate-300 rounded text-sm"
                  [(ngModel)]="startDate"
                />
                <button
                  type="button"
                  class="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0 bg-transparent border-none"
                  (click)="openDatePicker(startInput)"
                  aria-label="Abrir calendário de início"
                >
                  <i class="bi bi-calendar-event text-sm"></i>
                </button>
              </div>
            </label>

            <!-- FIM -->
            <label class="text-sm text-slate-700 flex items-center gap-1">
              Fim:
              <div class="relative">
                <input
                  #endInput
                  type="date"
                  class="pl-2 pr-8 py-1 border border-slate-300 rounded text-sm"
                  [(ngModel)]="endDate"
                />
                <button
                  type="button"
                  class="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0 bg-transparent border-none"
                  (click)="openDatePicker(endInput)"
                  aria-label="Abrir calendário de fim"
                >
                  <i class="bi bi-calendar-event text-sm"></i>
                </button>
              </div>
            </label>

            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              (click)="applyRange()"
            >
              Aplicar
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              (click)="clearRange()"
            >
              Limpar
            </button>

            <span class="hidden md:inline-block w-px h-5 bg-slate-200 mx-1"></span>

            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              (click)="downloadPng()"
            >
              Baixar PNG
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              (click)="downloadPdf()"
            >
              Baixar PDF
            </button>
          </div>
        </div>
      </div>

      <!-- GRÁFICO -->
      <div class="h-80">
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
          <div class="h-full flex items-center justify-center text-slate-500 text-sm">
            Sem dados suficientes para montar a série temporal de eventos.
          </div>
        </ng-template>
      </div>
    </div>
  `
})
export class EventosTimelineChartComponent implements OnChanges {
  @Input() videos: any[] = [];
  @Input() datasetId = '';           // <<< para montar o nome do arquivo

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
  }

  clearRange() {
    this.startDate = '';
    this.endDate = '';
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
