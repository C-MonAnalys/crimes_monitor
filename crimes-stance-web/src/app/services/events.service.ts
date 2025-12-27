import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { assetUrl } from './asset-url.util';

@Injectable({ providedIn: 'root' })
export class EventsService {
    private base: string;

    constructor(private http: HttpClient) {
        // Construir base usando o <base href> presente no index.html para suportar GitHub Pages
        const baseTag = document.getElementsByTagName('base')[0];
        const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
        this.base = baseHref.endsWith('/') ? `${baseHref}assets/data/events` : `${baseHref}/assets/data/events`;
    }

    private async fetchJson(fileName: string): Promise<any> {
        try {
            const resp = await fetch(`${this.base}/${fileName}`);
            if (!resp.ok) return null;
            return resp.json();
        } catch (e) {
            console.error('fetchJson error', fileName, e);
            return null;
        }
    }

    async listAll(): Promise<{ videos: any[]; metrics: any[]; videosByMonth: any[]; videosByYear: any[] }> {
        const [metrics, videos2024, videosPre] = await Promise.all([
            this.fetchJson('metrics_comparison.json'),
            this.fetchJson('videos_2024_onwards.json'),
            this.fetchJson('videos_pre_2024.json')
        ]);

        const videos: any[] = [];
        if (Array.isArray(videosPre)) videos.push(...videosPre);
        if (Array.isArray(videos2024)) videos.push(...videos2024);

        // normalize date field and parse dates
        const normalized = videos.map((v) => {
            const dateStr = v.data_postagem ?? v.date ?? v.day ?? null;
            let parsedDate = null;
            if (dateStr) {
                try {
                    parsedDate = new Date(dateStr);
                    if (isNaN(parsedDate.getTime())) parsedDate = null;
                } catch (e) {
                    parsedDate = null;
                }
            }
            return {
                ...v,
                data_postagem: dateStr,
                parsedDate
            };
        }).filter(v => v.parsedDate); // only keep videos with valid dates

        // aggregate by month and year
        const videosByMonth = this.aggregateByPeriod(normalized, 'month');
        const videosByYear = this.aggregateByPeriod(normalized, 'year');

        return {
            videos: normalized,
            metrics: Array.isArray(metrics) ? metrics : [],
            videosByMonth,
            videosByYear
        };
    }

    private aggregateByPeriod(videos: any[], period: 'month' | 'year'): any[] {
        const counts: Record<string, number> = {};

        for (const video of videos) {
            if (!video.parsedDate) continue;

            let key: string;
            if (period === 'month') {
                key = `${video.parsedDate.getFullYear()}-${String(video.parsedDate.getMonth() + 1).padStart(2, '0')}`;
            } else {
                key = String(video.parsedDate.getFullYear());
            }

            counts[key] = (counts[key] || 0) + 1;
        }

        return Object.entries(counts)
            .map(([period, count]) => ({ period, count }))
            .sort((a, b) => a.period.localeCompare(b.period));
    }

    // convenience: load only videos
    async getAllVideos(): Promise<any[]> {
        return (await this.listAll()).videos;
    }

    async getMetrics(): Promise<any[]> {
        return (await this.listAll()).metrics;
    }

    async getVideosByMonth(): Promise<any[]> {
        return (await this.listAll()).videosByMonth;
    }

    async getVideosByYear(): Promise<any[]> {
        return (await this.listAll()).videosByYear;
    }

    // dataset bruto (o que já alimenta /coletas/eventos)
    getEventsRaw() {
      return this.http.get<any>('assets/data/events.json'); // ajuste o caminho
    }

    // série temporal (separado, se tiver)
    getEventsTimeSeries() {
      return this.http.get<any>('assets/data/events_timeseries.json');
    }

    // avaliação consolidada para /avaliacoes/eventos
    async getEvaluationsOverview() {
      const { videos, metrics, videosByYear } = await this.listAll();

      const totalVideos = videos?.length ?? 0;
      const uniqueOperations = videos ? new Set(
        videos.map((v: any) => v.operation_id || v.operation || v.op)
      ).size : 0;

      const years = (videos ?? [])
        .map((v: any) => v.parsedDate?.getFullYear?.())
        .filter((y: any) => typeof y === 'number' && !isNaN(y));
      const periodLabel = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—';
      const avgVideosPerOperation = uniqueOperations ? +(totalVideos / uniqueOperations).toFixed(1) : 0;

      // Mapeia corretamente campos do arquivo metrics_comparison.json (acu/pre/rev/f1/tecnica)
      const performance = Array.isArray(metrics) && metrics.length
        ? metrics.map((m: any) => ({
            label: m.tecnica ?? m.label ?? m.nome ?? m.tech ?? 'Técnica',
            metrics: {
              accuracy:  (m.accuracy ?? m.acuracia ?? m.acu ?? 0),
              precision: (m.precision ?? m.pre ?? 0),
              recall:    (m.recall ?? m.rev ?? m.revocacao ?? 0),
              f1:        (m.f1 ?? 0),
            }
          }))
        : [];

      const videosByPeriod = {
        labels: (videosByYear ?? []).map(x => x.period),
        values: (videosByYear ?? []).map(x => x.count),
      };

      return {
        datasets: { totalVideos, uniqueOperations, periodLabel, avgVideosPerOperation },
        performance,
        videosByPeriod
      };
    }

    private buildSeriesFromRaw(raw: any) {
      const byYear: Record<number, number> = {};
      (raw.videos ?? raw).forEach((v: any) => {
        const y = new Date(v.date || v.created_at || v.timestamp).getFullYear();
        if (!isNaN(y)) byYear[y] = (byYear[y] || 0) + 1;
      });
      const labels = Object.keys(byYear).sort();
      const values = labels.map(y => byYear[+y]);
      return { labels, values };
    }

    // Retorna todos os vídeos de uma operação específica (operation_id/operation/op)
    async getOperationVideos(operationId: string): Promise<any[]> {
      const { videos } = await this.listAll();
      const idNorm = String(operationId).trim().toLowerCase();
      return videos.filter(v => {
        const op = (v.operation_id ?? v.operation ?? v.op ?? '').toString().trim().toLowerCase();
        return op && op === idNorm;
      });
    }

    // Estatísticas e série temporal (por dia) para a operação
    async getOperationOverview(operationId: string): Promise<{
      opId: string;
      totalVideos: number;
      periodLabel: string;
      videosByDay: { labels: string[]; values: number[] };
    }> {
      const items = await this.getOperationVideos(operationId);
      const totalVideos = items.length;

      const daysCount: Record<string, number> = {};
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      for (const v of items) {
        const d: Date | null = v.parsedDate ?? (v.data_postagem ? new Date(v.data_postagem) : null);
        if (!d || isNaN(d.getTime())) continue;
        const key = d.toISOString().slice(0, 10);
        daysCount[key] = (daysCount[key] || 0) + 1;
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      }

      const labels = Object.keys(daysCount).sort();
      const values = labels.map(k => daysCount[k]);

      const periodLabel = (minDate && maxDate)
        ? `${minDate.toISOString().slice(0,10)} – ${maxDate.toISOString().slice(0,10)}`
        : '—';

      return { opId: String(operationId), totalVideos, periodLabel, videosByDay: { labels, values } };
    }

}
