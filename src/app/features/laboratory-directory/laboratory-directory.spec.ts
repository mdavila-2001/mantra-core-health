import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LaboratoryDirectory, type LaboratoryCategoryGroup } from './laboratory-directory';

const LAB_ID = '11111111-1111-4111-8111-111111111111';
const IMAGE_ID = '22222222-2222-4222-8222-222222222222';
const LAB = {
  id: LAB_ID,
  code: 'LAB-CENTRAL',
  name: 'Laboratorio Central',
  type: { code: 'DU_TYPE_LAB', display: 'Clinical laboratory unit' },
  siteCount: 2,
  equipmentCount: 1,
  studyCount: 3,
  acceptsExternalOrders: true,
  walkInAvailable: true,
  homeCollectionAvailable: true,
};
const IMAGING = {
  ...LAB,
  id: IMAGE_ID,
  code: 'IMG-CENTRAL',
  name: 'Imagen Diagnóstica',
  type: { code: 'DU_TYPE_IMAGING', display: 'Diagnostic imaging unit' },
  siteCount: 1,
  equipmentCount: 2,
  studyCount: 2,
  homeCollectionAvailable: false,
};

describe('LaboratoryDirectory', () => {
  let fixture: ComponentFixture<LaboratoryDirectory>;
  let component: LaboratoryDirectory;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function mount(): void {
    fixture = TestBed.createComponent(LaboratoryDirectory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  function status(): string {
    return internal<() => { status: string }>('state')().status;
  }

  function groups(): readonly LaboratoryCategoryGroup[] {
    return internal<() => readonly LaboratoryCategoryGroup[]>('groups')();
  }

  it('starts in loading state while the server is authoritative', () => {
    mount();
    expect(status()).toBe('loading');
    http.expectOne('/diagnostic-units').flush({ items: [], count: 0 });
  });

  it('groups units by the existing category codes', () => {
    mount();
    http.expectOne('/diagnostic-units').flush({ items: [LAB, IMAGING], count: 2 });

    expect(groups().map((group) => group.name)).toEqual([
      'Imagenología diagnóstica',
      'Laboratorio clínico',
    ]);
    expect(groups().flatMap((group) => group.units)).toHaveLength(2);
  });

  it('links each card to the distinct visual detail route', () => {
    mount();
    http.expectOne('/diagnostic-units').flush({ items: [LAB], count: 1 });

    expect(groups()[0].units[0].link).toBe(`/laboratory-directory/${LAB_ID}`);
    expect(groups()[0].units[0].link).not.toContain('/diagnostics');
  });

  it('uses the explicit empty state when no unit is publishable', () => {
    mount();
    http.expectOne('/diagnostic-units').flush({ items: [], count: 0 });
    expect(status()).toBe('empty');
  });

  it('uses the shared error state when the GET fails', () => {
    mount();
    http
      .expectOne('/diagnostic-units')
      .flush(
        { message: 'falló', requestId: 'req-labs' },
        { status: 500, statusText: 'Server Error' },
      );
    expect(status()).toBe('error');
  });

  it('does not print technical UUIDs in the directory', () => {
    mount();
    http.expectOne('/diagnostic-units').flush({ items: [LAB], count: 1 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Laboratorio Central');
    expect(fixture.nativeElement.textContent).not.toContain(LAB_ID);
  });
});
