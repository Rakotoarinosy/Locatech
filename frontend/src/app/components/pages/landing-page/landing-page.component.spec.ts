import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { LandingPageComponent } from './landing-page.component';
import { LandingPageService } from '../../../services/landing-page.service';

describe('LandingPageComponent', () => {
  let component: LandingPageComponent;
  let fixture: ComponentFixture<LandingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [{
        provide: LandingPageService,
        useValue: {
          getCatalogue: () => of([]),
          submitContact: () => of(undefined)
        }
      }]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LandingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
