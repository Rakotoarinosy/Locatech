import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FacturesComponent } from './factures.component';

describe('FacturesComponent', () => {
  let component: FacturesComponent;
  let fixture: ComponentFixture<FacturesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacturesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FacturesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
