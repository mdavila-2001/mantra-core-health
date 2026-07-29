import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesignSystemSample } from './design-system-sample';

describe('DesignSystemSample', () => {
  let component: DesignSystemSample;
  let fixture: ComponentFixture<DesignSystemSample>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesignSystemSample],
    }).compileComponents();

    fixture = TestBed.createComponent(DesignSystemSample);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
