import { Injectable } from '@angular/core';
import { DATA_CONFIG } from '../data-config';

/**
 * Lê datasets de POSICIONAMENTO em “cenário real” a partir de:
 * - assets/data/sentiment/cenario-real/datasets.json
 * - cada dataset aponta para commentsFile e bootstrapFile
 *
 * Não altera o SentimentService antigo.
 */
@Injectable({ providedIn: 'root' })
export class SentimentRealService {
  private base: string;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 1 dia em milissegundos

  constructor() {
    if (DATA_CONFIG.BASE_DATA_URL) {
      this.base = `${DATA_CONFIG.BASE_DATA_URL}/sentiment/cenario-real`;
    } else {
      // respeita <base href> (GitHub Pages)
      const baseTag = document.getElementsByTagName('base')[0];
      const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
      const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
      this.base = `${root}assets/data/sentiment/cenario-real`;
    }
  }

  private async fetchJson<T = any>(url: string): Promise<T> {
    const t = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${separator}t=${t}`;
    const resp = await fetch(finalUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} @ ${url}`);
    return resp.json();
  }

  /** Lista os datasets (id -> { title, commentsFile, bootstrapFile }) */
  async getDatasets(): Promise<Record<string, { title: string; commentsFile: string; bootstrapFile: string }>> {
    const url = `${this.base}/datasets.json`;
    try {
      const data = await this.fetchJson(url);
      return data || {};
    } catch (e) {
      console.error('[SentimentRealService] Error fetching datasets from Cloudflare:', e);
      return {};
    }
  }

  /**
   * Carrega um dataset: comentários + bootstrap.
   * Observação: os caminhos do datasets.json usam "data/..." – removemos esse prefixo,
   * pois a base já aponta para ".../sentiment/cenario-real".
   */
  async loadDataset(datasetId: string): Promise<{ meta: { id: string; title: string; total: number; period: string }, comments: any[], bootstrap: any[] }> {
    const all = await this.getDatasets();
    const cfg = all[datasetId];
    if (!cfg) throw new Error(`Dataset "${datasetId}" não encontrado.`);

    // normaliza caminhos removendo "data/"
    const commentsFile = this.resolve(`${cfg.commentsFile}`);
    const bootstrapFile = this.resolve(`${cfg.bootstrapFile}`);

    console.log("commentsFile:", commentsFile)

    const [comments, bootstrap] = await Promise.all([
      this.fetchJson<any[]>(commentsFile).catch(() => []),
      this.fetchJson<any[]>(bootstrapFile).catch(() => [])
    ]);

    return {
      meta: {
        id: datasetId,
        title: cfg.title,
        total: Array.isArray(comments) ? comments.length : 0,
        period: (cfg as any).period || '—'
      },
      comments: Array.isArray(comments) ? comments : [],
      bootstrap: Array.isArray(bootstrap) ? bootstrap : []
    };
  }

  /**
   * Consolidado: Busca todos os datasets em sentiment/cenario-real/datasets.json
   * e retorna a união de todos os comentários + bootstrap médio? 
   * (Para bootstrap o ideal é pegar o do modelo mais recente ou o primeiro)
   */
  /**
   * Consolidado: Busca todos os datasets em sentiment/cenario-real/datasets.json
   * e retorna a união de todos os comentários + bootstrap médio.
   */
  async loadConsolidated(): Promise<{ meta: { id: string; title: string; total: number; period: string }, comments: any[], bootstrap: any[] }> {
    const all = await this.getDatasets();
    const fingerprint = JSON.stringify(all); // Fingerprint baseado no conteúdo do datasets.json

    // Tenta carregar do cache primeiro (IndexedDB)
    const cached = await this.getFromCache('consolidado');
    
    // Se temos cache, o fingerprint bate e ainda está no prazo (TTL), retornamos
    if (cached && cached.fingerprint === fingerprint) {
      const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
      
      if (!isExpired) {
        console.log('[SentimentRealService] Carregado de cache (IndexedDB) - Versão atualizada e válida');
        return cached.data;
      }
      console.log('[SentimentRealService] Cache expirou (TTL > 24h). Recarregando...');
    }

    if (cached) {
      console.log('[SentimentRealService] Cache detectado como desatualizado. Recarregando...');
    }

    const ids = Object.keys(all);
    
    // Carrega todos os datasets em paralelo
    const results = await Promise.all(ids.map(id => this.loadDataset(id).catch(() => null)));
    const valid = results.filter(r => r !== null) as any[];

    const allComments = valid.reduce((acc, r) => acc.concat(r.comments), []);
    
    // Calcula período dinamicamente
    let minDate = '';
    let maxDate = '';
    
    for (const c of allComments) {
      const dt = c.data_postagem;
      if (!dt) continue;
      if (!minDate || dt < minDate) minDate = dt;
      if (!maxDate || dt > maxDate) maxDate = dt;
    }

    const firstBootstrap = valid.length > 0 ? valid[0].bootstrap : [];

    const result = {
      meta: {
        id: 'consolidado',
        title: 'Posicionamento (Consolidado)',
        total: allComments.length,
        period: minDate && maxDate ? `${minDate} a ${maxDate}` : '—'
      },
      comments: allComments,
      bootstrap: firstBootstrap
    };

    // Salva no cache com o novo fingerprint
    this.saveToCache('consolidado', result, fingerprint).catch(e => console.warn('Falha ao salvar cache:', e));

    return result;
  }

  /**
   * Limpa o cache para forçar recarregamento
   */
  async clearCache(key: string = 'consolidado'): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('CrimesMonitorDB', 2);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('sentimentCache')) db.createObjectStore('sentimentCache');
          if (!db.objectStoreNames.contains('eventsCache')) db.createObjectStore('eventsCache');
        };
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('sentimentCache')) { resolve(); return; }
          const tx = db.transaction('sentimentCache', 'readwrite');
          const store = tx.objectStore('sentimentCache');
          store.delete(key);
          tx.oncomplete = () => {
            console.log(`[SentimentRealService] Cache "${key}" limpo com sucesso.`);
            resolve();
          };
          tx.onerror = () => resolve();
        };
        request.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  private async getFromCache(key: string): Promise<{ data: any, fingerprint: string, timestamp: number } | null> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('CrimesMonitorDB', 2);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('sentimentCache')) db.createObjectStore('sentimentCache');
          if (!db.objectStoreNames.contains('eventsCache')) db.createObjectStore('eventsCache');
        };
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('sentimentCache')) {
            resolve(null);
            return;
          }
          const tx = db.transaction('sentimentCache', 'readonly');
          const store = tx.objectStore('sentimentCache');
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
          const tx = db.transaction('sentimentCache', 'readwrite');
          const store = tx.objectStore('sentimentCache');
          store.put({ data, fingerprint, timestamp: Date.now() }, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        request.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  private resolve(input: string): string {
    // 1) URL absoluta
    if (/^https?:\/\//i.test(input)) return input;

    if (DATA_CONFIG.BASE_DATA_URL) {
      // No R2, as pastas estão na raiz
      if (input.startsWith('data/')) {
        return `${DATA_CONFIG.BASE_DATA_URL}/sentiment/cenario-real/${input.replace(/^data\//, '')}`;
      }
      if (input.startsWith('sentiment/')) {
        return `${DATA_CONFIG.BASE_DATA_URL}/${input}`;
      }
      if (input.startsWith('assets/')) {
        return `${DATA_CONFIG.BASE_DATA_URL}/${input.replace('assets/data/', '')}`;
      }
      return `${this.base}/${input}`;
    }

    // Comportamento original
    const baseTag = document.getElementsByTagName('base')[0];
    const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
    const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';

    if (input.startsWith('assets/')) return `${root}${input}`;
    if (input.startsWith('data/')) return `${root}assets/data/sentiment/cenario-real/${input.replace(/^data\//, '')}`;
    if (input.startsWith('sentiment/')) return `${root}assets/data/${input}`;

    return `${this.base}/${input}`;
  }
}
