import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SentimentService {
  private base: string;

  constructor() {
    const baseTag = document.getElementsByTagName('base')[0];
    const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
    this.base = baseHref.endsWith('/') ? `${baseHref}assets/data/sentiment` : `${baseHref}/assets/data/sentiment`;
  }

  private async fetchJson(fileName: string): Promise<any> {
    try {
      const resp = await fetch(`${this.base}/${fileName}`);
      if (!resp.ok) return null;
      return resp.json();
    } catch (e) {
      console.error('SentimentService.fetchJson error', fileName, e);
      return null;
    }
  }

  async getDatasets(): Promise<any> {
    return this.fetchJson('datasets.json');
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
}
