import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { EventsRealService } from '../../../services/events-real.service';
import { withTimeout } from '../../../services/promise-timeout.util';

@Component({
  selector: 'app-eventos-real',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartModule],
  templateUrl: './eventos-real.component.html'
})
export class EventosRealComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private real = inject(EventsRealService);

  isLoading = true;
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

  // filtros e busca
  searchTerm = '';
  selectedOperation = '';
  startDate: string = '';
  endDate: string = '';
  filteredVideos: any[] = [];
  topOperations: Array<{ operation: string; count: number }> = [];

  async ngOnInit() {
    this.datasetId = this.route.snapshot.paramMap.get('id') || '';

    const load = this.real.loadDataset(this.datasetId);
    try {
      const data = await withTimeout(load, 5000);
      this.apply(data);
    } catch (e:any) {
      if (e?.message === 'TIMEOUT') {
        this.timedOut = true; this.isLoading = false;
        load.then(full => this.apply(full))
            .catch(() => { this.error = 'Não foi possível carregar o dataset.'; });
      } else {
        this.error = 'Não foi possível carregar o dataset.'; this.isLoading = false;
      }
    }
  }

  private apply(payload: any) {
    this.meta = payload.meta;
    this.videos = payload.videos;
    this.filteredVideos = this.videos;

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

    // Define período padrão do gráfico diário: fim = última data; início = fim - 5 dias
    if (this.baseDayLabels && this.baseDayLabels.length > 0) {
      const lastLabel = this.baseDayLabels[this.baseDayLabels.length - 1]; // yyyy-mm-dd
      const endDateObj = new Date(lastLabel + 'T12:00:00');
      if (!isNaN(endDateObj.getTime())) {
        const startDateObj = new Date(endDateObj);
        startDateObj.setDate(startDateObj.getDate() - 40);
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        this.chartEndDate = fmt(endDateObj);
        this.chartStartDate = fmt(startDateObj);
        this.updateDayChartForRange(startDateObj, endDateObj);
      }
    }
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
}
