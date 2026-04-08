import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-hero.component.html'
})
export class PageHeroComponent {
  @Input() tagText = '';
  @Input() breadcrumbPath = '';
  @Input() titleNormal = '';
  @Input() titleHighlight = '';
  @Input() description = '';
  
  // Customização de Cores (Tailwind Classes)
  @Input() gradientClass = 'from-blue-400 to-indigo-400';
  @Input() tagColorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  @Input() bgCircle1Class = 'bg-blue-600/20';
  @Input() bgCircle2Class = 'bg-indigo-600/10';
  @Input() borderClass = 'border-slate-800';
}
