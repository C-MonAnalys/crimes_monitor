import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { SentimentService } from '../../services/sentiment.service';
import { ActivatedRoute } from '@angular/router';

import { AnalysisStatCardComponent } from '../../components/opinion-analysis/analysis-stat-card/analysis-stat-card';
import { PositioningDistributionComponent } from '../../components/opinion-analysis/positioning-distribution/positioning-distribution';
import { TopicsCardComponent } from '../../components/opinion-analysis/topics-card/topics-card';
import { TemporalEvolutionChartComponent } from '../../components/opinion-analysis/temporal-evolution-chart/temporal-evolution-chart';
import { PositioningDoughnutChartComponent } from '../../components/opinion-analysis/positioning-doughnut-chart/positioning-doughnut-chart';
import { MetricsBarChartComponent } from '../../components/opinion-analysis/metrics-bar-chart/metrics-bar-chart';
import { BootstrapResultsCardComponent } from '../../components/opinion-analysis/bootstrap-results-card/bootstrap-results-card';
import { DetailedMetricsCardComponent } from '../../components/opinion-analysis/detailed-metrics-card/detailed-metrics-card';
import { CommentsSampleCardComponent } from '../../components/opinion-analysis/comments-sample-card/comments-sample-card';
import { ModelAccuracyCardComponent } from '../../components/opinion-analysis/model-accuracy-card/model-accuracy-card';
import { WeeklyStackedChartComponent } from '../../components/opinion-analysis/weekly-stacked-chart/weekly-stacked-chart';

@Component({
  selector: 'app-opinion-analysis',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ChartModule,
    AnalysisStatCardComponent,
    PositioningDistributionComponent,
    TopicsCardComponent,
    TemporalEvolutionChartComponent,
    PositioningDoughnutChartComponent,
    MetricsBarChartComponent,
    BootstrapResultsCardComponent,
    DetailedMetricsCardComponent,
    CommentsSampleCardComponent,
    ModelAccuracyCardComponent,
    WeeklyStackedChartComponent,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-slate-900">Análise de Posicionamento</h1>
          <p class="text-slate-600 mt-2">Análise de opiniões e posicionamentos da população sobre diversos assuntos</p>
        </div>
      </div>

      <!-- Métricas principais -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <app-analysis-stat-card
          [label]="'Opiniões Analisadas'"
          [value]="formatNumber(totalComments)"
          [icon]="'bi-chat-text'"
          [color]="'blue'"
          [isLoading]="isLoading">
        </app-analysis-stat-card>

        <app-analysis-stat-card
          [label]="'Aprovação'"
          [value]="sentimentPercentages.positive + '%'"
          [icon]="'bi-emoji-smile'"
          [color]="'green'"
          [isLoading]="isLoading">
        </app-analysis-stat-card>

        <app-analysis-stat-card
          [label]="'Desaprovação'"
          [value]="sentimentPercentages.negative + '%'"
          [icon]="'bi-emoji-frown'"
          [color]="'red'"
          [isLoading]="isLoading">
        </app-analysis-stat-card>

        <app-analysis-stat-card
          [label]="'Neutro'"
          [value]="sentimentPercentages.neutral + '%'"
          [icon]="'bi-emoji-neutral'"
          [color]="'yellow'"
          [isLoading]="isLoading">
        </app-analysis-stat-card>
      </div>

      <!-- Distribuição de posicinamento e tópicos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Distribuição de posicinamento -->
        <app-positioning-distribution
          [counts]="sentimentCounts"
          [percentages]="sentimentPercentages">
        </app-positioning-distribution>

        <!-- Tópicos mais discutidos -->
        <app-topics-card [topicCounts]="topicCounts"></app-topics-card>
      </div>

      <app-weekly-stacked-chart
        *ngIf="comments.length > 0"
        [comments]="comments"
        [bootstrapData]="bootstrapStats">
      </app-weekly-stacked-chart>


      <!-- Evolução temporal dos posicinamento -->
      <app-temporal-evolution-chart></app-temporal-evolution-chart>

      <!-- Gráficos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Distribuição de Posicionamentos (Gráfico) -->
        <app-positioning-doughnut-chart
          [data]="sentimentChartData"
          [options]="sentimentChartOptions">
        </app-positioning-doughnut-chart>

        <!-- Métricas por Técnica -->
        <app-metrics-bar-chart
          [data]="metricsChartData"
          [options]="metricsChartOptions">
        </app-metrics-bar-chart>
      </div>

      <!-- Bootstrap Results -->
      <app-bootstrap-results-card
        *ngIf="bootstrapGroups.length > 0"
        [groups]="bootstrapGroups">
      </app-bootstrap-results-card>

      <!-- Métricas Detalhadas por Técnica -->
      <app-detailed-metrics-card
        *ngIf="metrics.length > 0"
        [allMetrics]="metrics">
      </app-detailed-metrics-card>

      <!-- Amostra de Comentários -->
      <app-comments-sample-card
        *ngIf="sampleComments.length > 0"
        [comments]="sampleComments">
      </app-comments-sample-card>

      <!-- Precisão do modelo -->
      <app-model-accuracy-card
        [precision]="modelAccuracy.precision"
        [recall]="modelAccuracy.recall"
        [f1Score]="modelAccuracy.f1Score">
      </app-model-accuracy-card>
    </div>
  `,
  styles: []
})
export class OpinionAnalysisComponent implements OnInit {

  modelAccuracy = { precision: 0, recall: 0, f1Score: 0 };

  // Dados do serviço
  totalComments = 0;
  sentimentCounts: Record<string, number> = { '-1': 0, '0': 0, '1': 0 };
  sentimentPercentages = { negative: 0, neutral: 0, positive: 0 };
  topicCounts = { security: 0, violence: 0, police: 0, management: 0 };
  isLoading = true;

  // Dados para gráficos e análises avançadas
  metrics: any[] = [];

  sentimentChartData: any = {};
  sentimentChartOptions: any = {};
  metricsChartData: any = {};
  metricsChartOptions: any = {};

  bootstrapStats: any[] = [];
  bootstrapGroups: any[] = [];
  sampleComments: any[] = [];
  datasetInfo: any = {};

  comments: any[] = [];

  weeklyChartInputData: { comments: any[], bootstrapData: any[] } | null = null;

  constructor(
    private sentimentService: SentimentService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const datasetId = params.get('datasetId');

      if (datasetId) {
        this.loadAllData(datasetId);
      } else {
        console.error('Nenhum ID de dataset foi fornecido na URL.');
        this.isLoading = false;
      }
    });
  }

  async loadAllData(datasetId: string) {
    try {
      const data = await this.sentimentService.loadDataset(datasetId);

      this.comments = data.comments;

      // Dados dos comentários
      this.totalComments = data.comments.length;
      this.sentimentCounts = this.sentimentService.getSentimentCounts(data.comments);

      // Calcular percentuais
      if (this.totalComments > 0) {
        this.sentimentPercentages = {
          negative: Math.round((this.sentimentCounts['-1'] / this.totalComments) * 100),
          neutral: Math.round((this.sentimentCounts['0'] / this.totalComments) * 100),
          positive: Math.round((this.sentimentCounts['1'] / this.totalComments) * 100)
        };

        // Calcular contagens aproximadas de tópicos baseadas no total
        this.topicCounts = {
          security: Math.floor(this.totalComments * 0.65),
          violence: Math.floor(this.totalComments * 0.45),
          police: Math.floor(this.totalComments * 0.38),
          management: Math.floor(this.totalComments * 0.22)
        };

        // Selecionar comentários de amostra
        // 1. Filtra todos os comentários que têm texto e são longos o suficiente
        const allValidComments = data.comments.filter(
          (comment: any) => comment.comentario && comment.comentario.length > 50
        );

        // 2. Pega os 2 primeiros comentários de cada classe
        const positiveSamples = allValidComments.filter((c: any) => c.new_BERT === 1).slice(0, 2);
        const neutralSamples = allValidComments.filter((c: any) => c.new_BERT === 0).slice(0, 2);
        const negativeSamples = allValidComments.filter((c: any) => c.new_BERT === -1).slice(0, 2);

        // 3. Junta tudo em um único array para a amostra
        this.sampleComments = [...positiveSamples, ...neutralSamples, ...negativeSamples];
      }

      // Dados de bootstrap
      this.bootstrapStats = data.bootstrap;
      console.log('[PAI] Dados de bootstrap carregados do serviço:', this.bootstrapStats);
      this.bootstrapGroups = this.groupBootstrapResults(this.bootstrapStats);

      // Dados de métricas
      if (data.bootstrap) {
        // As métricas estão na propriedade 'bootstrap', não em 'datasets'
        const metricsData = Array.isArray(data.bootstrap) ? data.bootstrap : Object.values(data.bootstrap);

        // Verificamos se os dados são válidos antes de atribuir
        if (metricsData && metricsData.length > 0) {
          this.metrics = metricsData;

          this.calculateModelAccuracy(metricsData);
        }
      }

      this.prepareSentimentChart();
      this.prepareMetricsChart();

      this.weeklyChartInputData = { comments: data.comments, bootstrapData: this.bootstrapStats };

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      this.isLoading = false;
    }
  }

  prepareSentimentChart() {
    this.sentimentChartData = {
      labels: ['Desaprovação', 'Neutro', 'Aprovação'],
      datasets: [{
        data: [
          this.sentimentPercentages.negative,
          this.sentimentPercentages.neutral,
          this.sentimentPercentages.positive
        ],
        backgroundColor: [
          '#ef4444', // red-500
          '#6b7280', // gray-500
          '#10b981'  // emerald-500
        ],
        borderWidth: 0
      }]
    };

    this.sentimentChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              return `${context.label}: ${context.parsed.toFixed(1)}%`;
            }
          }
        }
      }
    };
  }

  prepareMetricsChart() {
    // Verifica se há métricas para processar
    if (this.metrics.length === 0) return;

    // Extrai os rótulos e os dados da média da estrutura de dados correta
    const labels = this.metrics.map((m: any) => m[''] || 'Métrica'); // Ex: 'precision_class_0'
    const meanData = this.metrics.map((m: any) => m.mean || 0);

    // Monta a estrutura de dados para o gráfico de barras
    this.metricsChartData = {
      labels: labels,
      datasets: [
        {
          label: 'Média (Mean)',
          data: meanData,
          backgroundColor: 'rgba(59, 130, 246, 0.7)', // Azul padrão do site
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1
        }
      ]
    };

    // Define as opções do gráfico
    this.metricsChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          // Formata o eixo Y para exibir como porcentagem
          ticks: {
            callback: function(value: any) {
              if (typeof value === 'number' && value >= 0 && value <= 1) {
                return (value * 100).toFixed(0) + '%';
              }
              return value;
            }
          }
        },
        x: {
          // Rotaciona os rótulos do eixo X para evitar sobreposição
          ticks: {
            autoSkip: false,
            maxRotation: 90,
            minRotation: 45
          }
        }
      }
    };
  }


  groupBootstrapResults(results: any[]): any[] {
    if (!results || results.length === 0) {
      return [];
    }

    // 1. Agrupa os resultados por métrica (precision, recall, f1)
    const groupedByMetric = results.reduce((acc, item) => {
      // Extrai o nome da métrica e a classe (ex: 'precision_class_0')
      const key = item[''];
      if (!key) return acc;

      const parts = key.split('_class_');
      const metricName = parts[0]; // 'precision', 'recall', ou 'f1'
      const classId = parts[1]; // '0', '1', ou '2'

      // Cria o grupo de métrica se ele não existir
      if (!acc[metricName]) {
        acc[metricName] = {
          metric: metricName,
          items: []
        };
      }

      // Adiciona o item ao grupo correto
      acc[metricName].items.push({
        class: classId,
        mean: item.mean,
        lower_ci: item.lower_95_ci,
        upper_ci: item.upper_95_ci
      });

      return acc;
    }, {} as any);

    // 2. Converte o objeto de grupos em um array, que é o que o *ngFor espera
    return Object.values(groupedByMetric);
  }

  createBootstrapSummary(data: any): any {
    if (Array.isArray(data)) {
      return {
        count: data.length,
        avgScore: data.reduce((sum: number, item: any) => sum + (item.score || 0), 0) / data.length || 0
      };
    } else if (typeof data === 'object' && data !== null) {
      const values = Object.values(data).filter(v => typeof v === 'number');
      return {
        count: values.length,
        avgScore: values.reduce((sum: number, val: any) => sum + val, 0) / values.length || 0
      };
    }
    return { count: 0, avgScore: 0 };
  }

  formatNumber(num: number): string {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  calculateModelAccuracy(bootstrapData: any[]): void {
    // Função auxiliar para calcular a média de uma métrica específica
    const calculateAverage = (metricName: string): number => {
      const items = bootstrapData.filter(item => item[''] && item[''].startsWith(metricName));
      if (items.length === 0) return 0;

      const sum = items.reduce((acc, item) => acc + item.mean, 0);
      const average = (sum / items.length) * 100;
      return Math.round(average); // Arredonda para o inteiro mais próximo
    };

    // Calcula e armazena a média para cada métrica
    this.modelAccuracy = {
      precision: calculateAverage('precision_class_'),
      recall: calculateAverage('recall_class_'),
      f1Score: calculateAverage('f1_class_')
    };
  }

}
