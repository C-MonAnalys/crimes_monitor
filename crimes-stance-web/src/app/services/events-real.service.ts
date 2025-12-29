import { Injectable } from '@angular/core';

/**
 * Lê datasets de eventos em “cenário real” a partir de:
 * - assets/data/events/cenario-real/datasets.json
 * - cada dataset aponta para um arquivo com vídeos (formato dado pelo usuário)
 *
 * NÃO altera o EventsService antigo.
 */
@Injectable({ providedIn: 'root' })
export class EventsRealService {
  private base: string;

  constructor() {
    // monta base respeitando <base href> (GitHub Pages)
    const baseTag = document.getElementsByTagName('base')[0];
    const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
    const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
    this.base = `${root}assets/data/events/cenario-real`;
  }

  private async fetchJson<T=any>(path: string): Promise<T> {
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    } catch (e) {
      console.error('[EventsRealService] fetchJson error:', path, e);
      throw e;
    }
  }

  /** Lista datasets disponíveis (id -> {label, description, file}) */
  async getDatasets(): Promise<Record<string, { label: string; description?: string; file: string }>> {
    const url = `${this.base}/datasets.json`;
    const data = await this.fetchJson(url);
    return data ?? {};
  }

  /**
   * Carrega um dataset de eventos (vídeos + estatísticas agregadas).
   * - Normaliza datas
   * - Usa operation_ner como id de operação (fallback: operation)
   * - Gera séries por ano e por dia
   */
  async loadDataset(datasetId: string): Promise<{
    meta: {
      id: string;
      label: string;
      description?: string;
      period: string;
      totalVideos: number;
      totalOperations: number;
    };
    videos: any[];
    series: {
      byYear: { labels: string[]; values: number[] };
      byDay: { labels: string[]; values: number[] };
    };
  }> {
    const all = await this.getDatasets();
    const config = all[datasetId];
    if (!config) throw new Error(`Dataset "${datasetId}" não encontrado em datasets.json`);

    let raw: any[] = [];

    if (config.file === '__ALL__') {
      // compila todos os arquivos listados em datasets.json (exceto entradas __ALL__)
      const files = Object.values(all)
        .map((c: any) => c.file)
        .filter((f: any) => f && f !== '__ALL__');

      const fetches = files.map(f => this.fetchJson(this.resolveAssetUrl(f)).catch(e => {
        console.error('[EventsRealService] erro ao buscar arquivo', f, e);
        return null;
      }));

      const results = await Promise.all(fetches);
      raw = results.filter(r => Array.isArray(r)).flat();
      if (!raw.length) throw new Error('Nenhum arquivo disponível para compilar datasets.');
    } else {
      // o "file" em datasets.json já é relativo à pasta assets/data/events/...
      const fileUrl = this.resolveAssetUrl(config.file);
      raw = await this.fetchJson(fileUrl);
    }

    const videos = this.normalizeVideos(raw);

    // agrega
    const { byYear, byDay, period, opCount } = this.aggregate(videos);

    return {
      meta: {
        id: datasetId,
        label: config.label,
        description: config.description,
        period,
        totalVideos: videos.length,
        totalOperations: opCount,
      },
      videos,
      series: { byYear, byDay }
    };
  }

  private resolveAssetUrl(fileField: string): string {
    // tolera prefixos “events/…”
    if (fileField.startsWith('events/')) {
      // base já é .../events/cenario-real
      // mas o arquivo do exemplo está em "events/cenario-real/…"
      // se vier "events/cenario-real/..." mantemos relativo à raiz assets
      const prefix = this.base.replace('/cenario-real', ''); // .../assets/data/events
      return `${prefix}/${fileField.replace(/^events\//,'')}`;
    }
    // caminho relativo à pasta “cenario-real”
    return `${this.base}/${fileField}`;
  }

  private normalizeVideos(raw: any[]): any[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map(v => {
        const dateStr = v.data_postagem || v.date || v.day || null;
        let parsedDate: Date | null = null;
        if (dateStr) {
          const d = new Date(dateStr);
          parsedDate = isNaN(d.getTime()) ? null : d;
        }
        // operation id pela heurística
        const opId = (v.operation_ner ?? v.operation ?? v.op ?? '').toString().trim();
        return {
          ...v,
          parsedDate,
          operation_id: opId,
        };
      })
      .filter(v => !!v.parsedDate); // só mantém com data válida
  }

  private aggregate(videos: any[]) {
    const byYearCount: Record<string, number> = {};
    const byDayCount: Record<string, number> = {};
    const opSet = new Set<string>();
    let min: Date | null = null;
    let max: Date | null = null;

    for (const v of videos) {
      const d: Date = v.parsedDate;
      const year = String(d.getUTCFullYear());
      const day = d.toISOString().slice(0, 10);

      byYearCount[year] = (byYearCount[year] || 0) + 1;
      byDayCount[day] = (byDayCount[day] || 0) + 1;

      const op = (v.operation_id || '').toString().trim();
      if (op) opSet.add(op);

      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }

    const byYearLabels = Object.keys(byYearCount).sort();
    const byYearValues = byYearLabels.map(k => byYearCount[k]);

    const byDayLabels = Object.keys(byDayCount).sort();
    const byDayValues = byDayLabels.map(k => byDayCount[k]);

    const period = (min && max)
      ? `${min.toISOString().slice(0,10)} – ${max.toISOString().slice(0,10)}`
      : '—';

    return {
      byYear: { labels: byYearLabels, values: byYearValues },
      byDay: { labels: byDayLabels, values: byDayValues },
      period,
      opCount: opSet.size
    };
  }
}
