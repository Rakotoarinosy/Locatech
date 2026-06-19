import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalPayementComponent } from './modal-payement.component';

describe('ModalPayementComponent', () => {
  let component: ModalPayementComponent;
  let fixture: ComponentFixture<ModalPayementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalPayementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ModalPayementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
