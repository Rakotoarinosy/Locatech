import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Error502Component } from './error-502.component';

describe('Error502Component', () => {
  let component: Error502Component;
  let fixture: ComponentFixture<Error502Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Error502Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Error502Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
