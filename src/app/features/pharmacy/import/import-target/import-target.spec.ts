import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ImportTargetPicker } from './import-target';

describe('ImportTargetPicker', () => {
  let fixture: ComponentFixture<ImportTargetPicker>;
  let http: HttpTestingController;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const options = (): HTMLButtonElement[] => [
    ...root().querySelectorAll<HTMLButtonElement>('[data-testid="import-target"] [role="radio"]'),
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImportTargetPicker);
    fixture.detectChanges();
  });

  // Las pantallas montadas piden sus datos; acá sólo importa cuál se monta.
  afterEach(() => http.match(() => true));

  it('pregunta «Qué va a importar» con dos opciones —precios van con productos— y abre el asistente', () => {
    expect(root().textContent).toContain('Qué va a importar');
    expect(root().querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Qué va a importar');
    expect(options().map((option) => option.textContent?.trim())).toEqual([
      'Productos y precios',
      'Categorías',
    ]);
    expect(root().querySelector('app-pharmacy-import')).not.toBeNull();
    expect(root().querySelector('app-entity-import')).toBeNull();
  });

  it.each([[1, 'categories']] as const)('la opción %i monta la importación de %s en lugar del asistente', (index, entity) => {
    options()[index]!.click();
    fixture.detectChanges();

    expect(root().querySelector('app-pharmacy-import')).toBeNull();
    const screen = root().querySelector('app-entity-import');
    expect(screen).not.toBeNull();
    expect(options()[index]!.getAttribute('aria-checked')).toBe('true');
    // La pantalla genérica de esa entidad, con su propio `data-testid` cuando hay farmacia.
    http.match((r) => r.url.endsWith('/pharmacy/pharmacies')).forEach((r) =>
      r.flush({ items: [{ id: 'f-1', name: 'Farmacia', code: 'F', siteCount: 1, productCount: 0 }], count: 1 }),
    );
    fixture.detectChanges();
    expect(root().querySelector(`[data-testid="entity-import-${entity}"]`)).not.toBeNull();
  });

  describe('«Qué va a importar» en la URL', () => {
    let harness: RouterTestingHarness;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([{ path: 'catalog', component: ImportTargetPicker }]),
        ],
      });
      http = TestBed.inject(HttpTestingController);
      harness = await RouterTestingHarness.create();
    });

    const harnessRoot = (): HTMLElement => harness.routeNativeElement as HTMLElement;

    it('`?target=categories` abre directo la importación de categorías', async () => {
      await harness.navigateByUrl('/catalog?tab=import&target=categories', ImportTargetPicker);
      harness.detectChanges();

      expect(harnessRoot().querySelector('app-pharmacy-import')).toBeNull();
      expect(harnessRoot().querySelector('app-entity-import')?.getAttribute('entity')).toBe('categories');
    });

    it.each(['prices', 'sites'])('el enlace viejo `?target=%s` abre productos y precios', async (old) => {
      await harness.navigateByUrl(`/catalog?tab=import&target=${old}`, ImportTargetPicker);
      harness.detectChanges();

      expect(harnessRoot().querySelector('app-pharmacy-import')).not.toBeNull();
      expect(harnessRoot().querySelector('app-entity-import')).toBeNull();
    });

    it('con un valor desconocido abre productos', async () => {
      await harness.navigateByUrl('/catalog?target=nada', ImportTargetPicker);
      harness.detectChanges();

      expect(harnessRoot().querySelector('app-pharmacy-import')).not.toBeNull();
    });

    it('elegir una opción la escribe en la URL sin perder la pestaña', async () => {
      await harness.navigateByUrl('/catalog?tab=import', ImportTargetPicker);
      harness.detectChanges();

      const radios = [...harnessRoot().querySelectorAll<HTMLButtonElement>('[data-testid="import-target"] [role="radio"]')];
      radios[1]!.click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/catalog?tab=import&target=categories');
    });
  });
});
