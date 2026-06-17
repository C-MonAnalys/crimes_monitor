import { Injectable } from '@angular/core';
import { DATA_CONFIG } from '../data-config';

export interface Regiao {
  id: string;
  nome: string;
  caminho: string;    // "." para geral, "piaui" para regional
  descricao?: string;
  icone?: string;
  ordem?: number;
}

@Injectable({ providedIn: 'root' })
export class OrquestratorService {
  private cache: Record<string, Regiao[]> = {};

  private getBaseUrl(modulo: 'events' | 'sentiment'): string {
    if (DATA_CONFIG.BASE_DATA_URL) {
      return `${DATA_CONFIG.BASE_DATA_URL}/${modulo}/cenario-real`;
    }
    const baseTag = document.getElementsByTagName('base')[0];
    const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
    const root = baseHref.endsWith('/') ? baseHref : baseHref + '/';
    return `${root}assets/data/${modulo}/cenario-real`;
  }

  /**
   * Busca as regiões disponíveis para o módulo (events ou sentiment).
   * Retorna array ordenado pelo campo `ordem`.
   */
  async getRegioes(modulo: 'events' | 'sentiment', includeHidden = false): Promise<Regiao[]> {
    let regioes: Regiao[] = [];

    if (this.cache[modulo]) {
      regioes = this.cache[modulo];
    } else {
      const url = `${this.getBaseUrl(modulo)}/orquestrator.json`;

      try {
        const t = Date.now();
        const resp = await fetch(`${url}?t=${t}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        // Suporta formato array (recomendado) e formato objeto (legado)
        if (Array.isArray(data.regioes)) {
          regioes = data.regioes;
        } else if (typeof data === 'object' && !Array.isArray(data)) {
          // Formato legado: { "piaui": { "caminho": "piaui" }, "geral": { "caminho": "." } }
          regioes = Object.entries(data).map(([id, cfg]: [string, any]) => ({
            id,
            nome: cfg.nome || id.charAt(0).toUpperCase() + id.slice(1),
            caminho: cfg.caminho || id,
            descricao: cfg.descricao || '',
            icone: cfg.icone || 'bi-geo-alt',
            ordem: cfg.ordem ?? 99
          }));
        }

        // Ordena pelo campo `ordem` (menor = primeiro)
        regioes.sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));

        this.cache[modulo] = regioes;
      } catch (e) {
        console.error(`[OrquestratorService] Erro ao buscar orquestrator.json para ${modulo}:`, e);
        return [];
      }
    }

    if (includeHidden) {
      return regioes;
    }

    const hiddenStr = DATA_CONFIG.HIDDEN_REGIONS || '';
    const hiddenIds = hiddenStr
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);

    return regioes.filter(r => !hiddenIds.includes(r.id.toLowerCase()));
  }

  /**
   * Busca uma região específica pelo ID.
   */
  async getRegiao(modulo: 'events' | 'sentiment', regionId: string): Promise<Regiao | null> {
    const regioes = await this.getRegioes(modulo, true);
    return regioes.find(r => r.id === regionId) || null;
  }

  /**
   * Resolve o caminho base de dados para uma região.
   * - caminho "." → retorna a URL base do módulo (dados gerais)
   * - caminho "piaui" → retorna a URL base + /piaui
   */
  resolveBasePath(modulo: 'events' | 'sentiment', caminho: string): string {
    const base = this.getBaseUrl(modulo);
    if (caminho === '.') return base;
    return `${base}/${caminho}`;
  }

  /** Limpa o cache em memória (útil para forçar recarga) */
  clearCache() {
    this.cache = {};
  }
}
