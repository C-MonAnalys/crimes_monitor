import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeeklyStackedChart } from './weekly-stacked-chart';

describe('WeeklyStackedChart', () => {
  let component: WeeklyStackedChart;
  let fixture: ComponentFixture<WeeklyStackedChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyStackedChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeeklyStackedChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
