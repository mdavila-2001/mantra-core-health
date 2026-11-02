import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CATALOG_EDITOR_LOADER, CATALOG_EDITOR_PATH } from './catalog-editor.routes';
import { CatalogEditor } from './catalog-editor';

describe('CatalogEditor', () => {
  let fixture: ComponentFixture<CatalogEditor>;
  let http: HttpTestingController;
  const root = () => fixture.nativeElement as HTMLElement;
  const abrir = (i: number) => {
    (fixture.componentInstance as unknown as { pestana: { set(i: number): void } }).pestana.set(i);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogEditor],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CatalogEditor);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('una sola tarjeta con cuatro pestañas, y la de servicios es la que abre', () => {
    expect(root().querySelectorAll('app-card').length).toBe(1);
    const etiquetas = Array.from(root().querySelectorAll('[role="tab"]')).map((t) => (t.textContent ?? '').trim());
    expect(etiquetas).toEqual(['Servicios', 'Glosarios', 'Reporte contable', 'Auditoría']);
    http.expectOne('/admin/catalogs/services/scopes').flush({ types: [], practices: [], currencies: [] });
  });

  it('el bloque principal no tiene tope propio de ancho ni deja columna vacía', () => {
    const bloque = root().querySelector<HTMLElement>('.editor-catalogos')!;
    expect(bloque).not.toBeNull();
    expect(bloque.querySelectorAll('app-card').length).toBe(1);
    http.expectOne('/admin/catalogs/services/scopes').flush({ types: [], practices: [], currencies: [] });
  });

  it('«Reporte contable» dice que el catálogo no existe y no llama a la API', () => {
    http.expectOne('/admin/catalogs/services/scopes').flush({ types: [], practices: [], currencies: [] });
    abrir(2);
    expect(root().querySelector('[data-testid="catalog-accounting-unavailable"]')?.textContent).toContain('todavía no existe en la API');
    http.expectNone((r) => r.url.includes('accounting') || r.url.includes('/admin/catalogs/glossary') || r.url === '/audit/log');
  });

  it('una pestaña ya abierta conserva su estado al volver: no se vuelve a pedir', () => {
    http.expectOne('/admin/catalogs/services/scopes').flush({ types: [], practices: [], currencies: [] });
    abrir(1);
    http.expectOne((r) => r.url === '/admin/catalogs/glossary').flush({ items: [], count: 0, limit: 20, nextCursor: null });
    abrir(0);
    abrir(1);
    http.expectNone((r) => r.url === '/admin/catalogs/glossary');
  });

  it('entrar sólo pide lo de Servicios: Glosarios y Auditoría esperan a que se abran', () => {
    http.expectOne('/admin/catalogs/services/scopes').flush({ types: [], practices: [], currencies: [] });
    http.expectNone((r) => r.url === '/admin/catalogs/glossary' || r.url === '/audit/log');
  });

  it('cada pestaña pide por su cuenta: abrir Glosarios no repite los pedidos de Servicios', () => {
    http.expectOne('/admin/catalogs/services/scopes').flush({ types: [], practices: [], currencies: [] });
    abrir(1);
    const req = http.expectOne((r) => r.url === '/admin/catalogs/glossary');
    expect(req.request.params.get('audience')).toBe('patient');
    req.flush({ items: [], count: 0, limit: 20, nextCursor: null });
  });

  it('exporta la ruta pedida y un cargador que resuelve el componente', async () => {
    expect(CATALOG_EDITOR_PATH).toBe('superadmin/catalog-editor');
    expect(await CATALOG_EDITOR_LOADER()).toBe(CatalogEditor);
    http.expectOne('/admin/catalogs/services/scopes').flush({ types: [], practices: [], currencies: [] });
  });
});
