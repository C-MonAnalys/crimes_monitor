import { Injectable } from '@angular/core';
import { DATA_CONFIG } from '../data-config';

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
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 1 dia em milissegundos

  constructor() {
    if (DATA_CONFIG.BASE_DATA_URL) {
      this.base = `${DATA_CONFIG.BASE_DATA_URL}/events/cenario-real`;
    } else {
      // monta base respeitando <base href> (GitHub Pages)
      const baseTag = document.getElementsByTagName('base')[0];
      const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
      const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
      this.base = `${root}assets/data/events/cenario-real`;
    }
  }

  private async fetchJson<T=any>(path: string): Promise<T> {
    try {
      const t = Date.now();
      const separator = path.includes('?') ? '&' : '?';
      const finalUrl = `${path}${separator}t=${t}`;
      const resp = await fetch(finalUrl);
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
    try {
      const data = await this.fetchJson(url);
      return data || {};
    } catch (e) {
      console.error('[EventsRealService] Error fetching datasets from Cloudflare:', e);
      return {};
    }
  }

  /**
   * Carrega um dataset de eventos (vídeos + estatísticas agregadas).
   * - Normaliza datas
   * - Usa operation_ner como id de operação (fallback: operation)
   * - Gera séries por ano e por dia
   */
  async loadDataset(datasetId: string): Promise<any> {
    const all = await this.getDatasets();
    const fingerprint = JSON.stringify(all);

    // Tenta carregar do cache primeiro (IndexedDB)
    const cacheKey = datasetId || 'consolidado';
    const cached = await this.getFromCache(cacheKey);

    if (cached && cached.fingerprint === fingerprint) {
      const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
      if (!isExpired) {
        console.log(`[EventsRealService] Carregado do cache (IndexedDB) - ${cacheKey}`);
        return cached.data;
      }
      console.log(`[EventsRealService] Cache expirou para ${cacheKey}. Recarregando...`);
    }

    let config = all[datasetId];
    const isAll = !datasetId || !config || (config && config.file === '__ALL__');
    if (isAll && !config) {
      config = { label: 'Eventos (Consolidado)', description: 'Todos os datasets unificados', file: '__ALL__' };
    }

    let raw: any[] = [];

    if (isAll) {
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
      const fileUrl = this.resolveAssetUrl(config.file);
      raw = await this.fetchJson(fileUrl);
    }

    const videos = this.normalizeVideos(raw);
    const { byYear, byDay, period, opCount } = this.aggregate(videos);

    const result = {
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

    // Salva no cache
    this.saveToCache(cacheKey, result, fingerprint).catch(e => console.warn('Falha ao salvar cache de eventos:', e));

    return result;
  }

  /** Limpa o cache para forçar recarregamento */
  async clearCache(key: string = 'consolidado'): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('CrimesMonitorDB', 2);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('eventsCache')) db.createObjectStore('eventsCache');
          if (!db.objectStoreNames.contains('sentimentCache')) db.createObjectStore('sentimentCache');
        };
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('eventsCache')) { resolve(); return; }
          const tx = db.transaction('eventsCache', 'readwrite');
          const store = tx.objectStore('eventsCache');
          if (key === '__ALL__') store.clear();
          else store.delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        request.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  private async getFromCache(key: string): Promise<any> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('CrimesMonitorDB', 2);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('eventsCache')) db.createObjectStore('eventsCache');
          if (!db.objectStoreNames.contains('sentimentCache')) db.createObjectStore('sentimentCache');
        };
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('eventsCache')) { resolve(null); return; }
          const tx = db.transaction('eventsCache', 'readonly');
          const store = tx.objectStore('eventsCache');
          const getReq = store.get(key);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  private async saveToCache(key: string, data: any, fingerprint: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('CrimesMonitorDB', 2);
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          const tx = db.transaction('eventsCache', 'readwrite');
          const store = tx.objectStore('eventsCache');
          store.put({ data, fingerprint, timestamp: Date.now() }, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        request.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  private resolveAssetUrl(fileField: string): string {
    if (DATA_CONFIG.BASE_DATA_URL) {
      // No R2, mantemos a estrutura /events/...
      if (fileField.startsWith('events/')) {
        return `${DATA_CONFIG.BASE_DATA_URL}/${fileField}`;
      }
      return `${this.base}/${fileField}`;
    }

    // Comportamento original para local assets
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
          // Tentar diferentes formatos de data
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            parsedDate = d;
          } else {
            // Tentar formato YYYY-MM-DD
            const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
              const year = parseInt(match[1]);
              const month = parseInt(match[2]) - 1; // mês é 0-indexed
              const day = parseInt(match[3]);
              const testDate = new Date(year, month, day);
              if (!isNaN(testDate.getTime())) {
                parsedDate = testDate;
              }
            }
          }
        }
        // Se não conseguiu parsear a data, define uma data padrão antiga para manter no final da lista
        if (!parsedDate) {
          parsedDate = new Date('1900-01-01T00:00:00');
        }
        // operation id pela heurística
        const opId = (v.operation_ner ?? v.operation ?? v.op ?? '').toString().trim();
        // gerar URL do YouTube se houver id_video
        const url = v.id_video ? `https://www.youtube.com/watch?v=${v.id_video}` : null;
        return {
          ...v,
          parsedDate,
          operation_id: opId,
          url,
        };
      })
      .filter(v => true); // aceitar todos os vídeos, mesmo sem data válida
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
