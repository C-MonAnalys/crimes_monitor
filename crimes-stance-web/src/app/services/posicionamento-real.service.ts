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
  private dbPromise?: Promise<IDBDatabase>;

  constructor() {
    this.base = this.getBase();
  }

  /**
   * Retorna a conexão aberta do IndexedDB (Singleton).
   */
  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open('CrimesMonitorDB', 2);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('sentimentCache')) db.createObjectStore('sentimentCache');
          if (!db.objectStoreNames.contains('eventsCache')) db.createObjectStore('eventsCache');
        };
        request.onsuccess = (e: any) => {
          resolve(e.target.result);
        };
        request.onerror = (e: any) => {
          this.dbPromise = undefined; // Reseta para tentar de novo na próxima chamada
          reject(e.target.error);
        };
      } catch (err) {
        this.dbPromise = undefined;
        reject(err);
      }
    });

    return this.dbPromise;
  }

  /**
   * Retorna a URL base para o módulo de sentimentos em cenário real.
   * @param regionPath - Caminho da região (ex: "piaui", "." para geral).
   */
  private getBase(regionPath?: string): string {
    let base: string;
    if (DATA_CONFIG.BASE_DATA_URL) {
      base = `${DATA_CONFIG.BASE_DATA_URL}/sentiment/cenario-real`;
    } else {
      // respeita <base href> (GitHub Pages)
      const baseTag = document.getElementsByTagName('base')[0];
      const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
      const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
      base = `${root}assets/data/sentiment/cenario-real`;
    }
    if (regionPath && regionPath !== '.') {
      base = `${base}/${regionPath}`;
    }
    return base;
  }

  /**
   * Realiza requisição HTTP de dados.
   * @param url - URL do arquivo
   * @param bypassCache - Se true, aplica query-string de cache-busting para evitar cache HTTP
   */
  private async fetchJson<T = any>(url: string, bypassCache = false): Promise<T> {
    const finalUrl = bypassCache 
      ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
      : url;
    const resp = await fetch(finalUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} @ ${url}`);
    return resp.json();
  }

  /** Lista os datasets (id -> { title, commentsFile, bootstrapFile }) */
  async getDatasets(regionPath?: string): Promise<Record<string, { title: string; commentsFile: string; bootstrapFile: string }>> {
    const base = this.getBase(regionPath);
    const url = `${base}/datasets.json`;
    try {
      // datasets.json muda frequentemente, usamos bypassCache = true
      const data = await this.fetchJson(url, true);
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
  async loadDataset(datasetId: string, regionPath?: string, allConfig?: Record<string, any>): Promise<{ meta: { id: string; title: string; total: number; period: string }, comments: any[], bootstrap: any[] }> {
    const base = this.getBase(regionPath);
    const all = allConfig || await this.getDatasets(regionPath);
    const cfg = all[datasetId];
    if (!cfg) throw new Error(`Dataset "${datasetId}" não encontrado.`);

    // Prefixo de cache com a região para evitar colisões
    const regionPrefix = (regionPath && regionPath !== '.') ? `sentiment_${regionPath}_` : 'sentiment_geral_';
    const cacheKey = `${regionPrefix}${datasetId}`;
    const fingerprint = JSON.stringify(cfg);

    const cached = await this.getFromCache(cacheKey);
    if (cached && cached.fingerprint === fingerprint) {
      const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
      if (!isExpired) {
        console.log(`[SentimentRealService] Carregado do cache individual (IndexedDB) - ${cacheKey}`);
        return cached.data;
      }
    }

    // normaliza caminhos removendo "data/"
    const commentsFile = this.resolve(`${cfg.commentsFile}`, base);
    const bootstrapFile = this.resolve(`${cfg.bootstrapFile}`, base);

    console.log("commentsFile:", commentsFile)

    // Arquivos grandes de dados usam cache HTTP (bypassCache = false)
    const [comments, bootstrap] = await Promise.all([
      this.fetchJson<any[]>(commentsFile, false).catch(() => []),
      this.fetchJson<any[]>(bootstrapFile, false).catch(() => [])
    ]);

    const result = {
      meta: {
        id: datasetId,
        title: cfg.title,
        total: Array.isArray(comments) ? comments.length : 0,
        period: (cfg as any).period || '—'
      },
      comments: Array.isArray(comments) ? comments : [],
      bootstrap: Array.isArray(bootstrap) ? bootstrap : []
    };

    // Salva no cache individual
    this.saveToCache(cacheKey, result, fingerprint).catch(e => console.warn('[SentimentRealService] erro ao salvar cache individual:', e));

    return result;
  }

  /**
   * Consolidado: Busca todos os datasets em sentiment/cenario-real/datasets.json
   * e retorna a união de todos os comentários + bootstrap médio.
   */
  async loadConsolidated(regionPath?: string): Promise<{ meta: { id: string; title: string; total: number; period: string }, comments: any[], bootstrap: any[] }> {
    const all = await this.getDatasets(regionPath);
    const fingerprint = JSON.stringify(all); // Fingerprint baseado no conteúdo do datasets.json

    // Prefixo de cache com a região para evitar colisões
    const regionPrefix = (regionPath && regionPath !== '.') ? `sentiment_${regionPath}_` : 'sentiment_geral_';
    const cacheKey = `${regionPrefix}consolidado`;

    // Tenta carregar do cache primeiro (IndexedDB)
    const cached = await this.getFromCache(cacheKey);
    
    // Se temos cache, o fingerprint bate e ainda está no prazo (TTL), retornamos
    if (cached && cached.fingerprint === fingerprint) {
      const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
      
      if (!isExpired) {
        console.log(`[SentimentRealService] Carregado de cache consolidado (IndexedDB) - Versão atualizada e válida para ${cacheKey}`);
        return cached.data;
      }
      console.log(`[SentimentRealService] Cache expirou (TTL > 24h) para ${cacheKey}. Recarregando...`);
    }

    if (cached) {
      console.log(`[SentimentRealService] Cache detectado como desatualizado para ${cacheKey}. Recarregando...`);
    }

    const ids = Object.keys(all);
    
    // Carrega todos os datasets em paralelo passando 'all' para evitar fetches redundantes do datasets.json
    const results = await Promise.all(ids.map(id => this.loadDataset(id, regionPath, all).catch(() => null)));
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

    // Salva no cache consolidado com o novo fingerprint
    this.saveToCache(cacheKey, result, fingerprint).catch(e => console.warn('Falha ao salvar cache:', e));

    return result;
  }

  /**
   * Limpa o cache para forçar recarregamento
   */
  async clearCache(key: string = 'consolidado'): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sentimentCache', 'readwrite');
        const store = tx.objectStore('sentimentCache');
        let request;
        if (key === '__ALL__') {
          request = store.clear();
        } else {
          request = store.delete(key);
        }
        request.onsuccess = () => {
          console.log(`[SentimentRealService] Cache "${key}" limpo com sucesso.`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[SentimentRealService] Falha ao limpar cache:', e);
    }
  }

  private async getFromCache(key: string): Promise<any> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('sentimentCache', 'readonly');
        const store = tx.objectStore('sentimentCache');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('[SentimentRealService] Falha ao ler cache:', e);
      return null;
    }
  }

  private async saveToCache(key: string, data: any, fingerprint: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sentimentCache', 'readwrite');
        const store = tx.objectStore('sentimentCache');
        const request = store.put({ data, fingerprint, timestamp: Date.now() }, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[SentimentRealService] Falha ao salvar no cache:', e);
    }
  }

  private resolve(input: string, base?: string): string {
    const effectiveBase = base || this.getBase();
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
      return `${effectiveBase}/${input}`;
    }

    // Comportamento original
    const baseTag = document.getElementsByTagName('base')[0];
    const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
    const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';

    if (input.startsWith('assets/')) return `${root}${input}`;
    if (input.startsWith('data/')) {
      if (effectiveBase && effectiveBase.includes('cenario-real/') && !effectiveBase.endsWith('cenario-real')) {
        return `${effectiveBase}/${input.replace(/^data\//, '')}`;
      }
      return `${root}assets/data/sentiment/cenario-real/${input.replace(/^data\//, '')}`;
    }
    if (input.startsWith('sentiment/')) return `${root}assets/data/${input}`;

    return `${effectiveBase}/${input}`;
  }
}
