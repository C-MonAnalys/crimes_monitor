import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { ActiveElement, ChartEvent } from 'chart.js';

type ClassName = 'Aprovação' | 'Desaprovação' | 'Neutro';

@Component({
  selector: 'app-weekly-stacked-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartModule],
  templateUrl: './weekly-stacked-chart.html',
  styleUrls: ['./weekly-stacked-chart.css'],
  host: {
    'class': 'block'
  }
})
export class WeeklyStackedChartComponent implements OnChanges {
  // Inputs: Recebe os comentários e os dados do bootstrap
  @Input() comments: any[] = [];
  @Input() bootstrapData: any[] = [];

  // Propriedades para o gráfico principal
  startDate: string = '';
  endDate: string = '';
  chartData: any;
  chartOptions: any;
  hasData: boolean = true;

  // Propriedades para o modal de drill-down
  isModalVisible: boolean = false;
  selectedWeek: { iso: string; range: string; counts?: any } | null = null;
  selectedMetric: 'precision' | 'recall' | 'f1' = 'precision';
  drillDownChartData: any;
  drillDownChartOptions: any;

  errorBarPlugin: any = {
    id: 'errorBarPlugin',
    afterDatasetsDraw: (chart: any) => {
      const opts = chart?.options?.plugins?.errorBarPlugin || {};
      const errorData: Array<{ low: number; high: number; mean?: number }> = opts.data || [];
      const counts: number[] = opts.counts || [];          // <<< CONTAGENS
      const barValues: number[] = opts.barValues || [];    // valores das barras (proporções) p/ posicionar o rótulo
      if (!errorData.length) return;

      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);  // dataset das barras de proporção
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

        // barra vertical de erro
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // whiskers
        ctx.beginPath();
        ctx.moveTo(x - capSize, highY); ctx.lineTo(x + capSize, highY);
        ctx.moveTo(x - capSize, lowY);  ctx.lineTo(x + capSize, lowY);
        ctx.stroke();

        // (opcional) traço na média
        if (typeof ci.mean === 'number') {
          const meanY = yScale.getPixelForValue(ci.mean);
          ctx.beginPath();
          ctx.moveTo(x - capSize * 0.6, meanY);
          ctx.lineTo(x + capSize * 0.6, meanY);
          ctx.stroke();
        }
      });

      // ---------- CONTAGENS (n=XX) acima da barra ----------
      if (counts.length) {
        ctx.fillStyle = opts.countColor ?? '#334155'; // slate-600
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = opts.countFont ?? '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial';

        errorData.forEach((ci, i) => {
          const elem = meta.data[i];
          if (!elem) return;
          const x = elem.x;

          // posicionar o texto um pouco acima do topo (considera quem é mais alto: whisker ou a própria barra)
          const topValue = Math.max(ci.high ?? 0, barValues[i] ?? 0);
          let y = yScale.getPixelForValue(topValue) - 8;
          y = Math.max(8, y); // evita “sumir” no topo

          const n = counts[i] ?? 0;
          ctx.fillText(`n=${n}`, x, y);
        });
      }
      // -----------------------------------------------------

      ctx.restore();
    }
  };



  // Destaque suave da coluna (toda a semana) quando o mouse estiver sobre ela
  hoverBandPlugin: any = {
    id: 'hoverBandPlugin',
    afterDatasetsDraw: (chart: any, _args: any, pluginOpts: any) => {
      // Pega índice “ativo” a partir do tooltip (modo 'index')
      const active = chart?.tooltip?.getActiveElements?.() ?? [];
      if (!active.length) return;

      const i = active[0].index;
      const xScale = chart.scales.x;
      const { top, bottom } = chart.chartArea;

      // Largura da categoria (usa meio índice para pegar as bordas)
      const left  = xScale.getPixelForValue(i - 0.5);
      const right = xScale.getPixelForValue(i + 0.5);

      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = (pluginOpts?.color) ?? 'rgba(59,130,246,0.07)'; // azul 500 @ 7%
      ctx.fillRect(left, top, right - left, bottom - top);
      ctx.restore();
    }
  };

  constructor() {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['comments'] && this.comments.length > 0) {
      this.updateChart();
    }
    // ADICIONE ESTE CONSOLE.LOG
    if (changes['bootstrapData']) {
      console.log('[FILHO] bootstrapData recebido:', this.bootstrapData);
    }
  }

  updateChart(range: { start?: Date; end?: Date } = {}): void {
    const { weeks, yA, yD, yN } = this.groupCommentsByWeek(this.comments, range);
    if (weeks.length === 0) { this.hasData = false; return; }
    this.hasData = true;

    // 1) Calcula semanas com “diferença significativa” (A vs D) usando Precisão
    const sig = this.computeSignificanceFlags(yA, yD);

    // 2) Paleta: viva para significativas, acinzentada para sobrepostas
    const vividGreen = '#10b981';
    const vividRed   = '#ef4444';
    const neutralGray = '#6b7280';

    const mutedGreen = 'rgba(16,185,129,0.35)'; // verde “acinzentado”
    const mutedRed   = 'rgba(239,68,68,0.35)';  // vermelho “acinzentado”
    const mutedGray  = '#cbd5e1';

    const bgA = weeks.map((_, i) => sig[i] ? vividGreen : mutedGreen);
    const bgD = weeks.map((_, i) => sig[i] ? vividRed   : mutedRed);
    const bgN = weeks.map((_, i) => sig[i] ? neutralGray : mutedGray); // Neutro segue cinza normal

    // 3) Mantemos labels em ISO para o onClick; bordas quadradas (Opção B)
    this.chartData = {
      labels: weeks,
      datasets: [
        { label: 'Aprovação',    data: yA, backgroundColor: bgA, borderRadius: 0, borderSkipped: false },
        { label: 'Desaprovação', data: yD, backgroundColor: bgD, borderRadius: 0, borderSkipped: false },
        { label: 'Neutro',       data: yN, backgroundColor: bgN, borderRadius: 0, borderSkipped: false },
      ],
    };

    const fmtTick = (iso: string) => {
      const d = new Date(`${iso}T00:00:00Z`);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '');
    };
    const fmtRange = (iso: string) => this.formatWeekRange(iso);

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },

      onHover: (evt: any, _els: any, chart: any) => {
        const e = evt?.native ?? evt;
        const pts = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, false);
        chart.canvas.style.cursor = pts.length ? 'pointer' : 'default';
      },

      onClick: (evt: any, _els: any, chart: any) => {
        const e = evt?.native ?? evt;
        const pts = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, false);
        if (!pts?.length) return;
        const weekIndex = pts[0].index;
        const weekIso = this.chartData.labels[weekIndex];
        this.handleBarClick(weekIso);
      },

      plugins: {
        legend: { position: 'top' },
        tooltip: {
          displayColors: true,
          titleFont: { weight: '700' },
          callbacks: {
            title: (items: any[]) => {
              const idx = items?.[0]?.dataIndex ?? 0;
              const iso = this.chartData.labels[idx];
              return fmtRange(iso);
            },
            afterBody: (items: any[]) => {
              const idx = items?.[0]?.dataIndex ?? 0;
              return sig[idx]
                ? 'Destaque: diferença significativa (Precisão)'
                : 'Sem destaque: sobreposição A × D';
            },
            footer: () => 'Clique para detalhar →',
          }
        },
        hoverBandPlugin: { color: 'rgba(59,130,246,0.07)' }
      },

      scales: {
        x: {
          stacked: true,
          title: { display: true, text: 'Início da Semana' },
          ticks: {
            autoSkip: true, maxRotation: 0, minRotation: 0,
            callback: (_: any, idx: number) => fmtTick(this.chartData.labels[idx]),
          },
          grid: { display: false }
        },
        y: {
          stacked: true,
          title: { display: true, text: 'Nº de Comentários' },
          ticks: { precision: 0 },
          grid: { color: 'rgba(148,163,184,0.2)' }
        },
      },

      elements: { bar: { borderWidth: 0, borderSkipped: false } },
      animation: { duration: 250 }
    };
  }

  handleBarClick(weekIso: string): void {
    const weekCounts = this.computeWeekCounts(this.comments, weekIso);
    this.selectedWeek = {
      iso: weekIso,
      range: this.formatWeekRange(weekIso),
      counts: weekCounts
    };
    this.updateDrillDownChart();
    this.isModalVisible = true;
  }

  updateDrillDownChart(): void {
    if (!this.selectedWeek || !this.selectedWeek.counts) return;

    const labels: ClassName[] = ['Aprovação', 'Desaprovação', 'Neutro'];
    const { Aprova, Desaprova, Neutro, total } = this.selectedWeek.counts as any;
    const denom = Math.max(1, total);

    // proporções (barras)
    const proportions = [Aprova / denom, Desaprova / denom, Neutro / denom];

    // >>> contagens absolutas (NOVO)
    const counts = [Aprova, Desaprova, Neutro];

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    // IC aplicado SOBRE a proporção observada
    const errorBars = labels.map((label, idx) => {
      const prop = proportions[idx];
      const ci = this.getBootstrapCI(this.selectedMetric, label);
      const minus = Math.max(0, ci.minus);
      const plus  = Math.max(0, ci.plus);
      const low  = clamp01(prop - minus);
      const high = clamp01(prop + plus);
      return { low, high, mean: prop }; // linha central na própria proporção
    });

    this.drillDownChartData = {
      labels,
      datasets: [
        {
          label: 'Proporção na Semana',
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
              const n  = counts[ctx.dataIndex]; // <<< mostra a quantidade
              return [
                `Proporção: ${(p * 100).toFixed(1)}%`,
                `IC 95% (modelo): [${(ci.low * 100).toFixed(1)}% – ${(ci.high * 100).toFixed(1)}%]`,
                `Quantidade: ${n}`
              ];
            }
          }
        },
        // passa dados pro plugin: IC + valores das barras + contagens
        errorBarPlugin: {
          data: errorBars,
          barValues: proportions,  // para posicionar os rótulos acima do topo
          counts,                  // <<< NOVO
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



  // marcar semanas significativas
  private computeSignificanceFlags(yA: number[], yD: number[]): boolean[] {
  // Erro do modelo (Precisão) por classe
  const ciA = this.getBootstrapCI('precision', 'Aprovação');
  const ciD = this.getBootstrapCI('precision', 'Desaprovação');

  const minusA = Math.max(0, ciA.minus);
  const plusA  = Math.max(0, ciA.plus);
  const minusD = Math.max(0, ciD.minus);
  const plusD  = Math.max(0, ciD.plus);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const flags: boolean[] = [];
  for (let i = 0; i < yA.length; i++) {
    const denom = (yA[i] ?? 0) + (yD[i] ?? 0);
    if (denom === 0) { flags.push(false); continue; }

    const pA = (yA[i] ?? 0) / denom;
    const pD = (yD[i] ?? 0) / denom;

    const lowA  = clamp(pA - minusA);
    const highA = clamp(pA + plusA);
    const lowD  = clamp(pD - minusD);
    const highD = clamp(pD + plusD);

    const overlap = !(highA < lowD || highD < lowA);
    flags.push(!overlap); // true = destaque (sem sobreposição)
  }
  return flags;
}



  // Função de ajuda corrigida, baseada no seu JS original
  private getBootstrapCI(metricType: 'precision'|'recall'|'f1', className: ClassName) {
    // 1) Descobre automaticamente quais IDs existem nas chaves do bootstrap
    //    e tenta mapear por convenção de nomes.
    const keys = (this.bootstrapData || []).map((d: any) => d['']).filter(Boolean) as string[];

    // helpers para tentar identificar cada classe:
    const detectId = (preferredLabels: string[]): string | null => {
      // procura qualquer chave do tipo "<metric>_class_<id>"
      const ids = new Set(
        keys
          .filter(k => k.startsWith(metricType + '_class_'))
          .map(k => k.split('_class_')[1])
      );
      if (ids.size === 0) return null;

      // heurística: tenta achar por label conhecida nas chaves completas (opcional),
      // se não der, cai para o padrão 0/1/2.
      // Aqui deixo simples: retorna por “convenção” 0,1,2.
      // Se quiser ser mais inteligente, inspecione outras estruturas do seu dataset.
      if (preferredLabels.includes('Neutro') && ids.has('0')) return '0';
      if (preferredLabels.includes('Aprovação') && ids.has('1')) return '1';
      if (preferredLabels.includes('Desaprovação') && ids.has('2')) return '2';

      // fallback: pega o menor id disponível (garante não quebrar)
      return Array.from(ids).sort()[0] || null;
    };

    // mapeia cada classe para um id disponível
    const idFor = (label: ClassName): string | null => {
      if (label === 'Neutro') return detectId(['Neutro']);
      if (label === 'Aprovação') return detectId(['Aprovação']);
      return detectId(['Desaprovação']); // 'Desaprovação'
    };

    const classId = idFor(className);
    if (!classId) return { mean: 0, plus: 0, minus: 0 };

    const key = `${metricType}_class_${classId}`;
    const metricData = this.bootstrapData.find((d: any) => d[''] === key);

    if (!metricData) return { mean: 0, plus: 0, minus: 0 };

    return {
      mean: metricData.mean,
      plus: Math.max(0, metricData.upper_95_ci - metricData.mean),
      minus: Math.max(0, metricData.mean - metricData.lower_95_ci),
    };
  }

  private computeWeekCounts(data: any[], weekStartISO: string) {
    const start = new Date(`${weekStartISO}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const counts = { Aprova: 0, Desaprova: 0, Neutro: 0 };
    for (const item of data) {
      const ts = item.data_postagem;
      if (!ts) continue;
      const d = new Date(ts);
      if (isNaN(d.getTime()) || d < start || d >= end) continue;

      const label = (item.new_BERT ?? 0).toString();
      if (label === '1') counts.Aprova++;
      else if (label === '-1') counts.Desaprova++;
      else counts.Neutro++;
    }
    const total = counts.Aprova + counts.Desaprova + counts.Neutro;
    return { ...counts, total };
  }

  private formatWeekRange(weekStartISO: string): string {
    const start = new Date(`${weekStartISO}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' };
    return `${start.toLocaleDateString('pt-BR', options)} – ${end.toLocaleDateString('pt-BR', options)}`;
  }

  applyFilter(): void {
    const start = this.startDate ? new Date(this.startDate + 'T00:00:00Z') : undefined;
    const end = this.endDate ? new Date(this.endDate + 'T23:59:59Z') : undefined;
    this.updateChart({ start, end });
  }

  clearFilter(): void {
    this.startDate = '';
    this.endDate = '';
    this.updateChart();
  }

  private groupCommentsByWeek(data: any[], range: { start?: Date; end?: Date } = {}) {
    const buckets: Record<string, { Aprova: number; Desaprova: number; Neutro: number }> = {};
    for (const item of data) {
      const ts = item.data_postagem;
      if (!ts) continue;
      const d = new Date(ts);
      if (isNaN(d.getTime())) continue;

      if (range.start && d < range.start) continue;
      if (range.end && d > range.end) continue;

      const weekStart = this.getISOWeekStart(d);
      const key = this.toISODate(weekStart);
      const label = (item.new_BERT ?? 0).toString();

      if (!buckets[key]) buckets[key] = { Aprova: 0, Desaprova: 0, Neutro: 0 };
      if (label === '1') buckets[key].Aprova++;
      else if (label === '-1') buckets[key].Desaprova++;
      else buckets[key].Neutro++;
    }

    const weeks = Object.keys(buckets).sort();
    const yA = weeks.map(w => buckets[w].Aprova);
    const yD = weeks.map(w => buckets[w].Desaprova);
    const yN = weeks.map(w => buckets[w].Neutro);
    return { weeks, yA, yD, yN };
  }

  private getISOWeekStart(date: Date): Date {
    const day = date.getUTCDay();
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
  }

  private toISODate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
