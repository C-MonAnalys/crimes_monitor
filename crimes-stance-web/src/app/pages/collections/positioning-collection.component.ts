import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FooterComponent } from "../../components/footer/footer.component";

@Component({
  selector: 'app-opinion-collection',
  standalone: true,
  imports: [CommonModule, RouterModule, FooterComponent],
  template: `
    <div class="space-y-6">
      <!-- Header Section -->
      <div class="bg-white shadow-sm border-b border-slate-200">
        <div class="max-w-7xl mx-auto px-4 py-8">
          <div class="text-center">
            <h1 class="text-4xl font-bold text-slate-900 mb-3">
              <i class="bi bi-chat text-blue-600 mr-3"></i>
              Coletas de Posicionamento
            </h1>
            <p class="text-lg text-slate-600 max-w-3xl mx-auto">
              Explore os datasets de opiniões e posicionamentos da população sobre operações policiais
            </p>
          </div>
        </div>
      </div>


      <!-- Cards dos datasets -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i class="bi bi-chat-text text-blue-600"></i>
            </div>
            <div>
              <h3 class="font-semibold text-slate-900">Comentários Nordeste 2021</h3>
              <p class="text-sm text-slate-500">Opinião sobre segurança pública</p>
            </div>
          </div>
          <div class="space-y-2 text-sm text-slate-600">
            <div class="flex justify-between">
              <span>Comentários:</span>
              <span class="font-medium">30.2K</span>
            </div>
            <div class="flex justify-between">
              <span>Período:</span>
              <span class="font-medium">2021</span>
            </div>
            <div class="flex justify-between">
              <span>Modelo:</span>
              <span class="font-medium">BERT</span>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <button class="w-full text-blue-600 hover:text-blue-700 font-medium">
              Ver detalhes <i class="bi bi-arrow-right ml-1"></i>
            </button>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <i class="bi bi-people text-green-600"></i>
            </div>
            <div>
              <h3 class="font-semibold text-slate-900">Posicionamento Político</h3>
              <p class="text-sm text-slate-500">Análise de opiniões políticas</p>
            </div>
          </div>
          <div class="space-y-2 text-sm text-slate-600">
            <div class="flex justify-between">
              <span>Registros:</span>
              <span class="font-medium">15.8K</span>
            </div>
            <div class="flex justify-between">
              <span>Período:</span>
              <span class="font-medium">2020-2024</span>
            </div>
            <div class="flex justify-between">
              <span>Fonte:</span>
              <span class="font-medium">Redes Sociais</span>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <button class="w-full text-blue-600 hover:text-blue-700 font-medium">
              Ver detalhes <i class="bi bi-arrow-right ml-1"></i>
            </button>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <i class="bi bi-megaphone text-purple-600"></i>
            </div>
            <div>
              <h3 class="font-semibold text-slate-900">Opinião Pública</h3>
              <p class="text-sm text-slate-500">Percepção sobre políticas</p>
            </div>
          </div>
          <div class="space-y-2 text-sm text-slate-600">
            <div class="flex justify-between">
              <span>Registros:</span>
              <span class="font-medium">22.1K</span>
            </div>
            <div class="flex justify-between">
              <span>Período:</span>
              <span class="font-medium">2022-2024</span>
            </div>
            <div class="flex justify-between">
              <span>Classificação:</span>
              <span class="font-medium">Automática</span>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <button class="w-full text-blue-600 hover:text-blue-700 font-medium">
              Ver detalhes <i class="bi bi-arrow-right ml-1"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Estatísticas -->
      <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 class="text-xl font-semibold text-slate-900 mb-4">Estatísticas dos Datasets</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">68.1K</div>
            <div class="text-sm text-slate-600">Total de Opiniões</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">3</div>
            <div class="text-sm text-slate-600">Datasets Ativos</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-purple-600">87%</div>
            <div class="text-sm text-slate-600">Precisão do Modelo</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-orange-600">5</div>
            <div class="text-sm text-slate-600">Categorias de Opinião</div>
          </div>
        </div>
      </div>

      <!-- Metodologia -->
      <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 class="text-xl font-semibold text-slate-900 mb-4">Metodologia de Coleta</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="font-medium text-slate-900 mb-2">Fontes de Dados</h3>
            <ul class="space-y-1 text-sm text-slate-600">
              <li>• Comentários de YouTube</li>
              <li>• Posts de redes sociais</li>
              <li>• Fóruns de discussão</li>
              <li>• Pesquisas de opinião</li>
            </ul>
          </div>
          <div>
            <h3 class="font-medium text-slate-900 mb-2">Processamento</h3>
            <ul class="space-y-1 text-sm text-slate-600">
              <li>• Limpeza de dados</li>
              <li>• Análise com modelo BERT</li>
              <li>• Classificação de sentimento</li>
              <li>• Validação manual</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <app-footer></app-footer>
  `,
  styles: []
})
export class OpinionCollectionComponent {
  
}
