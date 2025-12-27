import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; 
import { SentimentService } from '../../../services/sentiment.service';

@Component({
  selector: 'app-dataset-selection',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dataset-selection.html',
  styleUrls: ['./dataset-selection.css']
})
export class DatasetSelectionComponent implements OnInit {
  // Propriedade para guardar os datasets carregados
  datasets: { key: string, config: any }[] = [];
  isLoading = true;

  constructor(private sentimentService: SentimentService) {}

  ngOnInit(): void {
    this.loadDatasets();
  }

  async loadDatasets(): Promise<void> {
    try {
      // Usamos o serviço para buscar a lista de datasets
      const data = await this.sentimentService.getDatasets();

      // Transformamos o objeto em um array para facilitar o uso no template com *ngFor
      this.datasets = Object.keys(data).map(key => ({
        key: key,
        config: data[key]
      }));
    } catch (error) {
      console.error('Erro ao carregar a lista de datasets:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
