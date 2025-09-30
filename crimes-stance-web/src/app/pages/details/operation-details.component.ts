import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { EventsService } from '../../services/events.service';
import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { FooterComponent } from "../../components/footer/footer.component";

Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-operation-details',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartModule, FooterComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <!-- Header Section -->
      <div class="bg-white shadow-sm border-b border-slate-200">
        <div class="max-w-7xl mx-auto px-4 py-6">
          <div class="flex items-center gap-4">
            <button 
              (click)="goBack()"
              class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              <i class="bi bi-arrow-left"></i>
              Voltar ao Dashboard
            </button>
            <div>
              <h1 class="text-3xl font-bold text-slate-900">
                <i class="bi bi-shield-check text-blue-600 mr-2"></i>
                Operação {{ operationId }}
              </h1>
              <p class="text-slate-600 mt-1">Análise detalhada da operação policial</p>
            </div>
          </div>
        </div>
      </div>

      <div class="mx-auto py-8">
        <!-- Statistics Overview -->
        <div class="mb-8">
          <h2 class="text-2xl font-semibold text-slate-900 mb-6 flex items-center">
            <i class="bi bi-graph-up text-blue-600 mr-2"></i>
            Estatísticas da Operação
          </h2>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div class="p-6">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-3xl font-bold text-blue-600 mb-1">{{ relatedVideos.length }}</div>
                    <div class="text-slate-600 font-medium">Vídeos Relacionados</div>
                  </div>
                  <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i class="bi bi-camera-video text-blue-600 text-xl"></i>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div class="p-6">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-3xl font-bold text-purple-600 mb-1">{{ percentage.toFixed(1) }}%</div>
                    <div class="text-slate-600 font-medium">Do Total de Vídeos</div>
                  </div>
                  <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <i class="bi bi-pie-chart text-purple-600 text-xl"></i>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div class="p-6">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-3xl font-bold text-emerald-600 mb-1">{{ dateRange }}</div>
                    <div class="text-slate-600 font-medium">Período</div>
                  </div>
                  <div class="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <i class="bi bi-calendar-range text-emerald-600 text-xl"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Analysis Section -->
        <div class="mb-8">
          <h2 class="text-2xl font-semibold text-slate-900 mb-6 flex items-center">
            <i class="bi bi-search text-blue-600 mr-2"></i>
            Análise da Operação
          </h2>
          
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div class="p-6 border-b border-slate-100">
                <h3 class="text-lg font-semibold text-slate-900 flex items-center">
                  <i class="bi bi-lightbulb text-orange-600 mr-2"></i>
                  Padrões Identificados
                </h3>
                <p class="text-sm text-slate-600 mt-1">Características detectadas automaticamente</p>
              </div>
              <div class="p-6">
                <div class="space-y-3">
                  <div *ngFor="let pattern of identifiedPatterns" class="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <i class="bi bi-check-circle-fill text-emerald-600 mt-0.5"></i>
                    <span class="text-slate-700">{{ pattern }}</span>
                  </div>
                  <div *ngIf="identifiedPatterns.length === 0" class="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <i class="bi bi-info-circle text-slate-400 mt-0.5"></i>
                    <span class="text-slate-500">Nenhum padrão identificado ainda</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div class="p-6 border-b border-slate-100">
                <h3 class="text-lg font-semibold text-slate-900 flex items-center">
                  <i class="bi bi-tags text-blue-600 mr-2"></i>
                  Palavras-chave Frequentes
                </h3>
                <p class="text-sm text-slate-600 mt-1">Termos mais relevantes encontrados</p>
              </div>
              <div class="p-6">
                <div class="flex flex-wrap gap-2">
                  <span *ngFor="let keyword of topKeywords" 
                        class="inline-flex items-center px-3 py-1.5 rounded-full text-white font-medium transition-transform hover:scale-105"
                        [style.background-color]="getKeywordColor(keyword.weight)"
                        [style.font-size.px]="12 + keyword.weight * 6">
                    {{ keyword.word }}
                  </span>
                  <div *ngIf="topKeywords.length === 0" class="text-slate-500 italic">
                    Nenhuma palavra-chave identificada
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="mb-8">
          <h2 class="text-2xl font-semibold text-slate-900 mb-6 flex items-center">
            <i class="bi bi-bar-chart text-blue-600 mr-2"></i>
            Análise Temporal
          </h2>
          
          <div class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div class="p-6 border-b border-slate-100">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-slate-900 flex items-center">
                    <i class="bi bi-graph-up text-blue-600 mr-2"></i>
                    Distribuição Temporal dos Vídeos
                  </h3>
                  <p class="text-sm text-slate-600 mt-1">
                    Comparação entre vídeos da operação {{ operationId }} e o total de vídeos coletados por período
                  </p>
                </div>
                <button 
                  (click)="resetZoom()"
                  class="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition-colors"
                  title="Resetar zoom"
                >
                  <i class="bi bi-arrow-clockwise"></i>
                  Reset
                </button>
              </div>
            </div>
            <div class="p-6">
              <div class="h-[400px]">
                <p-chart #timelineChart type="line" [data]="timelineChartData" [options]="timelineChartOptions" class="w-full h-full"></p-chart>
              </div>
            </div>
          </div>
        </div>

        <!-- Videos Section -->
        <div class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div class="p-6 border-b border-slate-100">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 class="text-lg font-semibold text-slate-900 flex items-center">
                  <i class="bi bi-collection-play text-blue-600 mr-2"></i>
                  Vídeos Relacionados
                </h3>
                <p class="text-sm text-slate-600 mt-1">
                  {{ filteredVideos.length }} de {{ relatedVideos.length }} vídeos
                </p>
              </div>
              
              <div class="flex gap-3">
                <div class="relative flex-1 sm:w-80">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="bi bi-search text-slate-400"></i>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Buscar por título..." 
                    [(ngModel)]="searchTerm" 
                    (input)="filterVideos()"
                    class="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                </div>
                
                <select 
                  [(ngModel)]="sortBy" 
                  (change)="sortVideos()" 
                  class="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="date">Data de publicação</option>
                  <option value="title">Título</option>
                </select>
              </div>
            </div>
          </div>

          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div *ngFor="let video of filteredVideos" class="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col">
          <div class="relative aspect-video overflow-hidden">
                  <img 
                    [src]="getThumbnail(video)"
                    [alt]="video.titulo || video.title || ''"
                    (error)="onImageError($event)"
                    class="w-full h-full object-cover"
                  >
                  <div *ngIf="video.duration" class="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {{ video.duration }}
                  </div>
                </div>
                
          <div class="p-4 flex flex-col flex-1">
                  <h4 class="font-semibold text-slate-900 mb-2 line-clamp-2">
                    {{ video.titulo || video.title || 'Título não disponível' }}
                  </h4>
                  
                  <div class="flex items-center justify-between text-sm text-slate-600 mb-3">
                    <div class="flex items-center gap-1">
                      <i class="bi bi-person-circle"></i>
                      <span>{{ (video.canal || video.channel || 'Canal não informado') | slice:0:20 }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <i class="bi bi-calendar3"></i>
                      <span>{{ formatDate(video.data_postagem || video.date) }}</span>
                    </div>
                  </div>
                  
                  <div *ngIf="video.visualizacoes || video.views || video.curtidas || video.likes" class="flex items-center gap-4 text-sm text-slate-600 mb-3">
                    <div *ngIf="video.visualizacoes || video.views" class="flex items-center gap-1">
                      <i class="bi bi-eye"></i>
                      <span>{{ formatNumber(video.visualizacoes || video.views) }}</span>
                    </div>
                    <div *ngIf="video.curtidas || video.likes" class="flex items-center gap-1">
                      <i class="bi bi-heart"></i>
                      <span>{{ formatNumber(video.curtidas || video.likes) }}</span>
                    </div>
                  </div>
                  
                  <p *ngIf="video.descricao || video.description" class="text-sm text-slate-600 mb-4 line-clamp-2">
                    {{ truncateText(video.descricao || video.description, 100) }}
                  </p>

                  <a 
                    [href]="getVideoUrl(video)" 
                    target="_blank"
                    class="inline-flex items-center gap-2 w-full justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 mt-auto"
                  >
                    <i class="bi bi-youtube"></i>
                    Assistir no YouTube
                  </a>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div *ngIf="filteredVideos.length === 0" class="text-center py-12">
              <div class="text-slate-400 mb-4">
                <i class="bi bi-search text-6xl"></i>
              </div>
              <h3 class="text-lg font-semibold text-slate-900 mb-2">Nenhum vídeo encontrado</h3>
              <p class="text-slate-600">Tente ajustar os critérios de busca ou filtros</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <app-footer></app-footer>
  `,
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class OperationDetailsComponent implements OnInit {
  @ViewChild('timelineChart') timelineChart: any;

  operationId: string = '';
  relatedVideos: any[] = [];
  filteredVideos: any[] = [];
  allVideos: any[] = [];
  totalVideos = 0;
  percentage = 0;
  dateRange = '';
  uniqueChannels = 0;
  identifiedPatterns: string[] = [];
  topKeywords: { word: string; weight: number }[] = [];
  defaultThumbnail: string = 'assets/default-thumbnail.svg';

  searchTerm = '';
  sortBy = 'date';

  timelineChartData: any = {};
  timelineChartOptions: any = {};
  channelsChartData: any = {};
  channelsChartOptions: any = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventsService: EventsService
  ) {
    // ajustar default thumbnail respeitando o base href (útil para GH Pages)
    const baseTag = document.getElementsByTagName('base')[0];
    const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
    this.defaultThumbnail = baseHref.endsWith('/') ? `${baseHref}assets/default-thumbnail.svg` : `${baseHref}/assets/default-thumbnail.svg`;
  }

  async ngOnInit() {
    console.log('=== OperationDetailsComponent ngOnInit started ===');
    this.operationId = this.route.snapshot.paramMap.get('id') || '';
    console.log('Operation ID from route:', this.operationId, typeof this.operationId);

    try {
      await this.loadOperationData();
      console.log('loadOperationData completed');

      this.analyzeOperation();
      console.log('analyzeOperation completed');

      this.prepareCharts();
      console.log('prepareCharts completed');
    } catch (error) {
      console.error('Error in ngOnInit:', error);
    }

    console.log('=== OperationDetailsComponent ngOnInit finished ===');
  }

  async loadOperationData() {
    try {
      const { videos } = await this.eventsService.listAll();
      this.allVideos = videos;
      this.totalVideos = videos.length;
      console.log('Total videos loaded:', this.totalVideos);
      console.log('Sample video for structure check:', videos[0]);

      // Converter operationId para número se necessário
      const opId = isNaN(Number(this.operationId)) ? this.operationId : Number(this.operationId);
      console.log('Operation ID for filtering:', opId, typeof opId);

      // Filtrar vídeos relacionados a esta operação (busca mais robusta)
      this.relatedVideos = videos.filter((video: any) => {
        // Comparação direta por operation ID
        if (video.operation === opId || video.operacao === opId) {
          console.log('Found video by operation ID:', video.id_video, video.titulo);
          return true;
        }

        // Busca por string no operation field
        if (String(video.operation) === String(this.operationId) ||
          String(video.operacao) === String(this.operationId)) {
          return true;
        }

        // Busca no título (fallback)
        const title = (video.titulo || video.title || '').toLowerCase();
        const searchTerm = String(this.operationId).toLowerCase();

        return title.includes(searchTerm) ||
          title.includes(`operação ${searchTerm}`) ||
          title.includes(`op ${searchTerm}`);
      });

      console.log(`Operação ${this.operationId}: encontrados ${this.relatedVideos.length} vídeos`);
      if (this.relatedVideos.length > 0) {
        console.log('Primeiros vídeos encontrados:', this.relatedVideos.slice(0, 3));
      } else {
        console.log('Nenhum vídeo encontrado. Verificando primeiros 10 vídeos da base:');
        console.log(videos.slice(0, 10).map(v => ({
          operation: v.operation,
          operacao: v.operacao,
          titulo: v.titulo,
          id: v.id_video
        })));
      }

      this.filteredVideos = [...this.relatedVideos];
      this.percentage = this.totalVideos > 0 ? (this.relatedVideos.length / this.totalVideos) * 100 : 0;

      // Calcular período
      const dates = this.relatedVideos
        .map(v => v.data_postagem || v.date)
        .filter(Boolean)
        .sort();

      if (dates.length > 0) {
        const firstDate = new Date(dates[0]).toLocaleDateString('pt-BR');
        const lastDate = new Date(dates[dates.length - 1]).toLocaleDateString('pt-BR');
        this.dateRange = firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;
      } else {
        this.dateRange = 'Período não disponível';
      }

      // Contar canais únicos
      const channels = new Set(this.relatedVideos.map(v => v.canal || v.channel).filter(Boolean));
      this.uniqueChannels = channels.size;

    } catch (error) {
      console.error('Erro ao carregar dados da operação:', error);
    }
  }

  analyzeOperation() {
    // Carregar padrões salvos
    const savedPatterns = this.loadSavedPatterns();

    // Analisar títulos dos vídeos
    const titles = this.relatedVideos.map(v => v.titulo || v.title || '').filter(Boolean);
    console.log(`Analisando operação ${this.operationId}:`);
    console.log(`- Vídeos relacionados: ${this.relatedVideos.length}`);
    console.log(`- Títulos válidos: ${titles.length}`);
    console.log('- Primeiros títulos:', titles.slice(0, 3));

    this.identifiedPatterns = this.extractPatterns(titles);
    this.topKeywords = this.extractKeywords(titles);

    console.log('- Padrões identificados:', this.identifiedPatterns);
    console.log('- Palavras-chave:', this.topKeywords);

    // Salvar análise atualizada
    this.saveAnalysis(savedPatterns);
  }

  async prepareCharts() {
    // Gráfico de timeline com comparação
    const timelineData = await this.groupByMonthWithComparison();

    this.timelineChartData = {
      labels: timelineData.map(d => d.month),
      datasets: [
        {
          label: `Operação ${this.operationId}`,
          data: timelineData.map(d => d.operationCount),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5
        },
        {
          label: 'Todos os Vídeos',
          data: timelineData.map(d => d.totalCount),
          borderColor: '#e5e7eb',
          backgroundColor: 'rgba(229, 231, 235, 0.1)',
          fill: false,
          tension: 0.4,
          pointBackgroundColor: '#9ca3af',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          borderDash: [5, 5]
        }
      ]
    };

    this.timelineChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const datasetLabel = context.dataset.label;
              const value = context.parsed.y;
              const month = context.label;
              const dataIndex = context.dataIndex;

              if (datasetLabel.includes('Operação')) {
                const totalForMonth = timelineData[dataIndex]?.totalCount || 0;
                const percentage = totalForMonth > 0 ? ((value / totalForMonth) * 100).toFixed(1) : '0';
                return [
                  `${datasetLabel}: ${value} vídeos`,
                  `${percentage}% do total em ${month}`,
                  totalForMonth > 0 ? `Total geral: ${totalForMonth} vídeos` : ''
                ].filter(Boolean);
              } else {
                return `${datasetLabel}: ${value} vídeos`;
              }
            },
            title: (context: any) => {
              const month = context[0].label;
              return `Período: ${month}`;
            }
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'shift'
          },
          zoom: {
            wheel: {
              enabled: true
            },
            pinch: {
              enabled: true
            },
            mode: 'x',
            onZoomComplete: (chart: any) => {
              // Callback opcional após zoom
              console.log('Zoom aplicado:', chart.chart.scales.x.min, chart.chart.scales.x.max);
            }
          },
          limits: {
            x: { min: 'original', max: 'original' }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Período (Mês/Ano) - Use scroll para zoom, Shift+drag para pan'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Número de Vídeos'
          },
          ticks: {
            stepSize: 1
          }
        }
      }
    };

    // Gráfico de canais (mantido como estava)
    const channelData = this.groupByChannel();
    this.channelsChartData = {
      labels: channelData.map(d => d.channel),
      datasets: [{
        label: 'Vídeos por Canal',
        data: channelData.map(d => d.count),
        backgroundColor: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c084fc']
      }]
    };

    this.channelsChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false
        }
      }
    };
  }

  async groupByMonthWithComparison(): Promise<{ month: string; operationCount: number; totalCount: number; date: Date }[]> {
    // Usar os vídeos já carregados
    const allVideos = this.allVideos;

    // Agrupar vídeos da operação por mês
    const operationGroups: Record<string, number> = {};
    this.relatedVideos.forEach(video => {
      const dateStr = video.data_postagem || video.date;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          operationGroups[monthKey] = (operationGroups[monthKey] || 0) + 1;
        }
      }
    });

    // Agrupar todos os vídeos por mês
    const totalGroups: Record<string, number> = {};
    allVideos.forEach((video: any) => {
      const dateStr = video.data_postagem || video.date;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          totalGroups[monthKey] = (totalGroups[monthKey] || 0) + 1;
        }
      }
    });

    // Combinar dados e ordenar por data
    const allMonths = new Set([...Object.keys(operationGroups), ...Object.keys(totalGroups)]);

    return Array.from(allMonths)
      .map(monthKey => {
        const [year, month] = monthKey.split('-').map(Number);
        const date = new Date(year, month - 1, 1);

        return {
          month: date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' }),
          operationCount: operationGroups[monthKey] || 0,
          totalCount: totalGroups[monthKey] || 0,
          date: date
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  groupByMonth(): { month: string; count: number }[] {
    const groups: Record<string, number> = {};

    this.relatedVideos.forEach(video => {
      const dateStr = video.data_postagem || video.date;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const month = date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
          groups[month] = (groups[month] || 0) + 1;
        }
      }
    });

    return Object.entries(groups)
      .map(([month, count]) => ({ month, count }))
      .sort();
  }

  groupByChannel(): { channel: string; count: number }[] {
    const groups: Record<string, number> = {};

    this.relatedVideos.forEach(video => {
      const channel = video.canal || video.channel || 'Canal Desconhecido';
      groups[channel] = (groups[channel] || 0) + 1;
    });

    return Object.entries(groups)
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  extractPatterns(titles: string[]): string[] {
    const patterns: string[] = [];

    if (titles.length === 0) {
      return ['Nenhum título disponível para análise'];
    }

    console.log('Analisando títulos:', titles.slice(0, 5)); // Debug

    // Padrões específicos de operações (mais abrangentes)
    const operationPatterns = [
      { pattern: /operação|operacao/gi, label: 'Operação policial' },
      { pattern: /prisão|preso|detido|detida|captura/gi, label: 'Operação de prisão' },
      { pattern: /apreensão|apreensao|droga|drogas|entorpecente/gi, label: 'Apreensão de drogas' },
      { pattern: /homicídio|homicidio|assassinato|morte|morto|morta|óbito/gi, label: 'Crime contra vida' },
      { pattern: /roubo|furto|assalto|latrocínio|latrocinio/gi, label: 'Crime contra patrimônio' },
      { pattern: /chacina|massacre|múltiplas|vítimas/gi, label: 'Crime com múltiplas vítimas' },
      { pattern: /tráfico|trafico|narcotráfico/gi, label: 'Tráfico de drogas' },
      { pattern: /polícia|policial|pm|civil|militar/gi, label: 'Ação policial' },
      { pattern: /investigação|investigacao|inquérito|inquerito/gi, label: 'Investigação criminal' },
      { pattern: /facção|faccao|organizada|criminosa/gi, label: 'Crime organizado' }
    ];

    const foundPatterns = new Set<string>();

    operationPatterns.forEach(({ pattern, label }) => {
      const matches = titles.some(title => pattern.test(title));
      if (matches) {
        foundPatterns.add(label);
      }
    });

    // Adicionar padrões encontrados
    patterns.push(...Array.from(foundPatterns));

    // Análise de palavras-chave (melhorada)
    const keywords: Record<string, number> = {};
    const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem', 'sob', 'sobre', 'após', 'antes', 'durante', 'contra', 'entre', 'até', 'desde', 'após', 'que', 'como', 'quando', 'onde', 'porque', 'porque', 'já', 'ainda', 'mais', 'menos', 'muito', 'pouco', 'todo', 'toda', 'todos', 'todas', 'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'meus', 'minhas', 'nosso', 'nossa', 'nossos', 'nossas']);

    titles.forEach(title => {
      const words = title.toLowerCase()
        .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));

      words.forEach(word => {
        keywords[word] = (keywords[word] || 0) + 1;
      });
    });

    // Identificar palavras-chave mais frequentes
    const topKeywords = Object.entries(keywords)
      .filter(([, count]) => count >= Math.max(2, Math.ceil(titles.length * 0.2)))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word);

    if (topKeywords.length > 0) {
      patterns.push(`Palavras-chave: ${topKeywords.join(', ')}`);
    }

    console.log('Padrões encontrados:', patterns); // Debug

    return patterns.length > 0 ? patterns : ['Padrão não identificado - análise manual necessária'];
  }

  extractKeywords(titles: string[]): { word: string; weight: number }[] {
    const keywords: Record<string, number> = {};
    const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'sem', 'sob', 'sobre', 'após', 'antes', 'durante', 'contra', 'entre', 'até', 'desde', 'que', 'como', 'quando', 'onde', 'porque', 'já', 'ainda', 'mais', 'menos', 'muito', 'pouco', 'todo', 'toda', 'todos', 'todas']);

    titles.forEach(title => {
      const words = title.toLowerCase()
        .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));

      words.forEach(word => {
        keywords[word] = (keywords[word] || 0) + 1;
      });
    });

    return Object.entries(keywords)
      .map(([word, count]) => ({
        word,
        weight: Math.min(count / Math.max(titles.length, 1), 1)
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);
  }

  loadSavedPatterns(): any {
    try {
      return JSON.parse(localStorage.getItem('operationPatterns') || '{}');
    } catch {
      return {};
    }
  }

  saveAnalysis(savedPatterns: any) {
    try {
      savedPatterns[this.operationId] = {
        patterns: this.identifiedPatterns,
        keywords: this.topKeywords,
        lastUpdated: new Date().toISOString(),
        videosCount: this.relatedVideos.length
      };
      localStorage.setItem('operationPatterns', JSON.stringify(savedPatterns));
    } catch (error) {
      console.error('Erro ao salvar análise:', error);
    }
  }

  filterVideos() {
    if (!this.searchTerm.trim()) {
      this.filteredVideos = [...this.relatedVideos];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredVideos = this.relatedVideos.filter(video =>
        (video.titulo || video.title || '').toLowerCase().includes(term) ||
        (video.descricao || video.description || '').toLowerCase().includes(term)
      );
    }
    this.sortVideos();
  }

  sortVideos() {
    this.filteredVideos.sort((a, b) => {
      switch (this.sortBy) {
        case 'title':
          return (a.titulo || a.title || '').localeCompare(b.titulo || b.title || '');
        case 'date':
        default:
          const dateA = new Date(a.data_postagem || a.date || 0);
          const dateB = new Date(b.data_postagem || b.date || 0);
          return dateB.getTime() - dateA.getTime();
      }
    });
  }

  formatDate(date: string): string {
    if (!date) return 'Data não disponível';
    return new Date(date).toLocaleDateString('pt-BR');
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  getVideoUrl(video: any): string {
    // Gerar URL do YouTube baseado no id_video
    if (video.id_video) {
      return `https://www.youtube.com/watch?v=${video.id_video}`;
    }
    // Fallback para URLs diretas
    return video.url || video.link || '#';
  }
  onImageError(event: any) {
    event.target.src = this.defaultThumbnail;
  }

  // Retorna uma URL de thumbnail apropriada para o vídeo
  getThumbnail(video: any): string {
    if (!video) return this.defaultThumbnail;

    // 1) se já tem thumbnail absoluta
    if (video.thumbnail && /^https?:\/\//i.test(video.thumbnail)) {
      return video.thumbnail;
    }

    // 2) se tem id do youtube
    const id = video.id_video || video.id || this.extractYouTubeId(video.url || video.link || '');
    if (id) {
      return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }

    // 3) fallback
    return this.defaultThumbnail;
  }

  // extrai id do YouTube de várias formas
  extractYouTubeId(input: string): string | null {
    if (!input) return null;
    const re = /(?:v=|\/vi\/|\/v\/|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/;
    const m = input.match(re);
    if (m && m[1]) return m[1];

    const maybe = input.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(maybe)) return maybe;
    return null;
  }

  getKeywordColor(weight: number): string {
    // Gerar uma cor baseada no peso da palavra-chave
    if (weight > 0.7) return '#3b82f6'; // azul intenso
    if (weight > 0.5) return '#6366f1'; // índigo
    if (weight > 0.3) return '#8b5cf6'; // violeta
    if (weight > 0.2) return '#a855f7'; // roxo
    return '#c084fc'; // roxo claro
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  resetZoom() {
    if (this.timelineChart && this.timelineChart.chart) {
      this.timelineChart.chart.resetZoom();
    }
  }
}
