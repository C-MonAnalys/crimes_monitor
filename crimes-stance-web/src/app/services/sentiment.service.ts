import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { assetUrl } from './asset-url.util';
import { DATA_CONFIG } from '../data-config';

@Injectable({ providedIn: 'root' })
export class SentimentService {
  private base: string;

  constructor(private http: HttpClient) {
    if (DATA_CONFIG.BASE_DATA_URL) {
      this.base = `${DATA_CONFIG.BASE_DATA_URL}/sentiment`;
    } else {
      const baseTag = document.getElementsByTagName('base')[0];
      const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
      const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
      this.base = `${root}assets/data/sentiment`;
    }
  }

  private async fetchJson(fileName: string): Promise<any> {
    try {
      const url = fileName.startsWith('http') ? fileName : `${this.base}/${fileName}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return resp.json();
    } catch (e) {
      console.error('SentimentService.fetchJson error', fileName, e);
      return null;
    }
  }

  /** Lista os datasets (id -> { title, commentsFile, bootstrapFile }) */
  async getDatasets(): Promise<Record<string, { title: string; commentsFile: string; bootstrapFile: string }>> {
    // Busca base local para fallback
    const baseTag = document.getElementsByTagName('base')[0];
    const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
    const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
    const localUrl = `${root}assets/data/sentiment/datasets.json`;

    const remoteUrl = DATA_CONFIG.BASE_DATA_URL ? `${this.base}/datasets.json` : null;

    try {
      const [localData, remoteData] = await Promise.all([
        this.fetchJson(localUrl).catch(() => ({})),
        remoteUrl ? this.fetchJson(remoteUrl).catch(() => ({})) : Promise.resolve({})
      ]);

      return { ...localData, ...remoteData };
    } catch (e) {
      console.error('[SentimentService] Error merging datasets:', e);
      return {};
    }
  }

  async loadDataset(datasetId: string): Promise<{ bootstrap: any[]; comments: any[] }> {
    // 1. Primeiro, carrega a lista de todos os datasets
    const datasets = await this.getDatasets();
    if (!datasets || !datasets[datasetId]) {
      throw new Error(`Dataset com o ID '${datasetId}' não foi encontrado.`);
    }

    // 2. Obtém os nomes dos ficheiros para o dataset específico
    const config = datasets[datasetId];
    const bootstrapFilePath = config.bootstrapFile;
  const commentsFilePath = config.commentsFile;

  if (!bootstrapFilePath || !commentsFilePath) {
    throw new Error(`Configuração de ficheiros incompleta para o dataset '${datasetId}'.`);
  }

  // 2. Remove o prefixo "data/" dos caminhos, pois o serviço já o adiciona
  const bootstrapFile = bootstrapFilePath.replace('data/', '');
  const commentsFile = commentsFilePath.replace('data/', '');

    // 3. Carrega os ficheiros de dados corretos em paralelo
    const [bootstrap, comments] = await Promise.all([
      this.fetchJson(bootstrapFile),
      this.fetchJson(commentsFile)
    ]);

    // 4. Retorna os dados carregados
    return {
      bootstrap: Array.isArray(bootstrap) ? bootstrap : [],
      comments: Array.isArray(comments) ? comments : []
    };
  }

  async listAll(): Promise<{ datasets: any; bootstrap: any[]; comments: any[] }> {
    const [datasets, bootstrap, comments] = await Promise.all([
      this.fetchJson('datasets.json'),
      this.fetchJson('bootstrap_results_211124.json'),
      this.fetchJson('comentarios_2021_nordeste_newBERT.json')
    ]);

    return {
      datasets: datasets ?? {},
      bootstrap: Array.isArray(bootstrap) ? bootstrap : [],
      comments: Array.isArray(comments) ? comments : []
    };
  }

  async getTrainingStats() {
    // 1) Tenta ler o arquivo único de treino
    const train = await this.fetchJson('treinamento_model_211124.json');

    // 2) Se não houver, cai no fallback antigo (opcional)
    if (!Array.isArray(train) || !train.length) {
      try {
        const [labels, bootstrap] = await Promise.all([
          this.fetchJson('train_labels.json'),
          this.fetchJson('bootstrap_results_211124.json')
        ]);
        const total = Object.values(labels || {}).reduce((s: any, n: any) => s + (n as number), 0);
        return {
          total: total || 0,
          period: '—',
          labels: labels || { '-1': 0, '0': 0, '1': 0 },
          bootstrap: bootstrap || [],
          quality: { avgLen: 0, medianLen: 0, pShort: 0 }
        };
      } catch (e) {
        console.warn('[SentimentService.getTrainingStats] Fallback antigo indisponível:', e);
        return { total: 0, period: '—', labels: { '-1': 0, '0': 0, '1': 0 }, bootstrap: [], quality: { avgLen: 0, medianLen: 0, pShort: 0 } };
      }
    }

    // 3) Calcula contagens de rótulos e qualidade dos textos
    const labels: Record<string, number> = { '-1': 0, '0': 0, '1': 0 };
    const lengths: number[] = [];
    let shortCount = 0;

    for (const r of train) {
      const y = String(r?.rotulo ?? '0');
      if (labels[y] === undefined) labels[y] = 0;
      labels[y]++;

      const len = (r?.comentario ?? '').trim().length;
      lengths.push(len);
      if (len < 30) shortCount++;
    }

    const total = train.length;
    const avgLen = total ? Math.round(lengths.reduce((s, n) => s + n, 0) / total) : 0;
    const medianLen = (() => {
      const arr = lengths.slice().sort((a, b) => a - b);
      if (!arr.length) return 0;
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
    })();
    const pShort = total ? Math.round((shortCount / total) * 100) : 0;

    // 4) Bootstrap (médricas do modelo)
    const bootstrap = await this.fetchJson('bootstrap_results_211124.json');

    return {
      total,
      period: '—',                       // sem período no arquivo de treino -> mantém "—"
      labels,
      bootstrap: Array.isArray(bootstrap) ? bootstrap : [],
      quality: { avgLen, medianLen, pShort }
    };
  }



  // convenience: counts of new_BERT values (-1,0,1)
  getSentimentCounts(comments: any[]): Record<string, number> {
    const counts: Record<string, number> = { '-1': 0, '0': 0, '1': 0 };
    for (const c of comments) {
      const val = String(c.new_BERT ?? '0');
      if (counts[val] === undefined) counts[val] = 0;
      counts[val]++;
    }
    return counts;
  }

  // === Helpers (coloque dentro da classe SentimentService, se ainda não estiverem) ===
  private toNum(x: any): number {
    if (x == null) return 0;
    if (typeof x === 'number') return x > 1.0001 ? x / 100 : x; // 94.3 -> 0.943
    const s = String(x).trim().replace(',', '.');
    if (s.endsWith('%')) {
      const v = parseFloat(s.slice(0, -1));
      return isNaN(v) ? 0 : v / 100;
    }
    const v = parseFloat(s);
    return isNaN(v) ? 0 : (v > 1.0001 ? v / 100 : v);
  }

  private parseCsv(text: string): Array<Record<string, string>> {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];
    const header = lines[0].split(',').map(h => h.trim());
    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length !== header.length) continue;
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => obj[h] = (cols[idx] ?? '').trim());
      rows.push(obj);
    }
    return rows;
  }

  private normalizeModelRows(rows: Array<Record<string, any>>) {
    // helpers seguros
    const getStr = (o: Record<string, any>, keys: string[]): string => {
      for (const k of keys) {
        const v = o[k];
        if (v !== undefined && v !== null) return String(v).trim();
      }
      return '';
    };
    const getNum = (o: Record<string, any>, keys: string[]): number => {
      for (const k of keys) {
        const v = o[k];
        if (v !== undefined && v !== null) return this.toNum(v);
      }
      return 0;
    };

    return rows
      .map((r) => {
        // 1) tenta chave já “pronta”
        let key = getStr(r, ['', 'Metric', 'metric', 'Unnamed: 0']);

        // 2) fallback: arquivos com campos separados (metric + class)
        if (!key) {
          const metric = getStr(r, ['metric', 'Metric']).toLowerCase();
          const cls    = getStr(r, ['class', 'Class', 'classe', 'Classe']);
          if (metric && cls !== '') key = `${metric}_class_${cls}`;
        }

        const mean  = getNum(r, ['mean']);
        const lower = getNum(r, ['lower_95_ci', 'lower_ci', 'lower']);
        const upper = getNum(r, ['upper_95_ci', 'upper_ci', 'upper']);

        return { key, mean, lower, upper };
      })
      .filter((x) => x.key);
  }

  private extractByMetricKey(
    rows: { key: string; mean: number; lower: number; upper: number }[]
  ) {
    // aceita: precision_class_0, precision class 0, precision-class-0
    const RX = /^(precision|recall|f1)[\s_-]class[\s_-](\d+)/i;

    const out: Record<'precision'|'recall'|'f1',
      { class: 0|1|2; mean: number; lower: number; upper: number }[]> = {
      precision: [], recall: [], f1: []
    } as any;

    for (const r of rows) {
      const m = r.key.match(RX);
      if (!m) continue;
      const metric = m[1].toLowerCase() as 'precision'|'recall'|'f1';
      const cls = Number(m[2]) as 0|1|2;
      out[metric].push({ class: cls, mean: r.mean, lower: r.lower, upper: r.upper });
    }

    // garantir as 3 classes
    (['precision','recall','f1'] as const).forEach(metric => {
      const byClass: Record<number, any> = {};
      out[metric].forEach(x => byClass[x.class] = x);
      out[metric] = [0,1,2].map(c => byClass[c] ?? { class: c, mean: 0, lower: 0, upper: 0 }) as any;
    });

    return out;
  }

  private async fetchText(fileName: string): Promise<string | null> {
    try {
      const url = fileName.startsWith('http') ? fileName : `${this.base}/${fileName}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return resp.text();
    } catch (e) {
      console.error('SentimentService.fetchText error', fileName, e);
      return null;
    }
  }

  // === MÉTODO PRINCIPAL (substitua o antigo por este) ===
  async getBootstrapComparisons(): Promise<Array<{ model: string; metrics: Record<'precision'|'recall'|'f1', { class: 0|1|2; mean:number; lower:number; upper:number }[]> }>> {
    const baselineJsonUrl = 'bootstrap_results_211124.json';
    const indexUrl        = 'bootstrap/index.json';

    const models: Array<{ model: string; metrics: any }> = [];

    // 1) baseline JSON
    try {
      const arr = await this.fetchJson(baselineJsonUrl);
      if (arr) {
        const rows = this.normalizeModelRows(arr);
        const metrics = this.extractByMetricKey(rows);
        models.push({ model: 'BERTimbau', metrics });
      }
    } catch (e) {
      console.warn('[getBootstrapComparisons] baseline JSON indisponível:', e);
    }

    // 2) extras via manifest (JSON ou CSV)
    try {
      const list = await this.fetchJson(indexUrl) as Array<{ label: string; file: string }>;
      if (list && Array.isArray(list)) {
        for (const item of list) {
          try {
            const isJson = item.file.toLowerCase().endsWith('.json');
            let rows: { key: string; mean: number; lower: number; upper: number }[] = [];

            if (isJson) {
              const j = await this.fetchJson(`bootstrap/${item.file}`);
              if (j) rows = this.normalizeModelRows(j);
            } else {
              const text = await this.fetchText(`bootstrap/${item.file}`);
              if (text) {
                const rowsCsv = this.parseCsv(text);
                rows = this.normalizeModelRows(rowsCsv as any);
              }
            }

            if (rows.length) {
              const metrics = this.extractByMetricKey(rows);
              models.push({ model: item.label || item.file, metrics });
            }
          } catch (e) {
            console.warn('[getBootstrapComparisons] falha ao ler', item.file, e);
          }
        }
      }
    } catch {
      // sem manifest: ok
    }

    return models;
  }
}
