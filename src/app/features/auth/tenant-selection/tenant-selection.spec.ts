import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantSelection } from './tenant-selection';

describe('TenantSelection', () => {
  let component: TenantSelection;
  let fixture: ComponentFixture<TenantSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantSelection],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantSelection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
