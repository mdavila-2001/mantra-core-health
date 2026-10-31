import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AdminCatalogPage, AdminServiceItem, ServiceScopes } from '../../../../core/data-access/admin-portal/catalog-editor.types';
import { ServicesTab } from './services-tab';

const ALCANCE: ServiceScopes = {
  types: [
    { conceptId: 'tipo-clinica', code: 'PR_TYPE_CLINIC', display: 'Clínica' },
    { conceptId: 'tipo-lab', code: 'PR_TYPE_LAB', display: 'Laboratorio' },
  ],
  practices: [
    { id: 'pr-1', name: 'Clínica Demo', typeConceptId: 'tipo-clinica' },
    { id: 'pr-2', name: 'Laboratorio Demo', typeConceptId: 'tipo-lab' },
  ],
  currencies: [{ conceptId: 'moneda-bob', code: 'BOB' }],
};

function servicio(id: string, extra: Partial<AdminServiceItem> = {}): AdminServiceItem {
  return {
    id,
    practiceId: 'pr-1',
    practiceTypeConceptId: 'tipo-clinica',
    code: `COD-${id}`,
    name: `Servicio ${id}`,
    defaultPrice: '150.00',
    currencyConceptId: 'moneda-bob',
    currencyCode: 'BOB',
    isActive: true,
    rowVersion: 2,
    updatedAt: '2026-10-31T10:00:00.000Z',
    ...extra,
  };
}

const pagina = (items: AdminServiceItem[], nextCursor: string | null = null): AdminCatalogPage<AdminServiceItem> => ({ items, count: items.length, limit: 20, nextCursor });

interface Interno {
  ejecutar(fila: { id: string; item: AdminServiceItem }, accion: string): void;
  elegirTipo(id: string): void;
  elegirEstado(estado: 'todos' | 'activos' | 'inactivos'): void;
  buscar(texto: string): void;
  abrirAlta(): void;
  dialogo(): unknown;
  aviso(): { tono: string; texto: string } | null;
  enCurso(): string | null;
  lista(): { status: string };
  alcance(): { status: string };
}

describe('ServicesTab', () => {
  let fixture: ComponentFixture<ServicesTab>;
  let http: HttpTestingController;

  const esLista = (r: { url: string }) => r.url === '/admin/catalogs/services';
  const interno = () => fixture.componentInstance as unknown as Interno;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const filas = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="catalog-services-table"] tbody tr'));

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({ imports: [ServicesTab], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServicesTab);
    fixture.detectChanges();
  }

  function cargarInicial(items: AdminServiceItem[] = [servicio('1'), servicio('2', { isActive: false })]): void {
    http.expectOne('/admin/catalogs/services/scopes').flush(ALCANCE);
    http.expectOne(esLista).flush(pagina(items));
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('S2: mientras llega el alcance no pide la lista; luego pide el primer tipo con 20 por página', async () => {
    await montar();
    http.expectNone(esLista);
    http.expectOne('/admin/catalogs/services/scopes').flush(ALCANCE);
    const req = http.expectOne(esLista);
    expect(req.request.params.get('practiceTypeConceptId')).toBe('tipo-clinica');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.has('isActive')).toBe(false);
    req.flush(pagina([servicio('1')]));
    fixture.detectChanges();
    expect(filas().length).toBe(1);
  });

  it('muestra el precio como cadena exacta con su moneda y el estado en palabras', async () => {
    await montar();
    cargarInicial([servicio('1', { defaultPrice: '9007199254740993.10' }), servicio('2', { isActive: false })]);
    expect(texto()).toContain('9007199254740993.10 Bs');
    expect(texto()).toContain('Desactivado');
    expect(texto()).toContain('Activo');
  });

  it('cambiar de tipo, estado o búsqueda vuelve a pedir desde la primera página', async () => {
    await montar();
    cargarInicial();
    interno().elegirTipo('tipo-lab');
    expect(http.expectOne(esLista).request.params.get('practiceTypeConceptId')).toBe('tipo-lab');
    interno().elegirEstado('inactivos');
    const porEstado = http.expectOne(esLista);
    expect(porEstado.request.params.get('isActive')).toBe('false');
    expect(porEstado.request.params.has('cursor')).toBe(false);
    interno().buscar(' hemo ');
    const porTexto = http.expectOne(esLista);
    expect(porTexto.request.params.get('q')).toBe('hemo');
    porTexto.flush(pagina([]));
    fixture.detectChanges();
    expect(interno().lista().status).toBe('empty');
    expect(texto()).toContain('No hay servicios con estos filtros');
  });

  it('S5: sin permiso la lista lo dice y no ofrece nada que no pueda hacer', async () => {
    await montar();
    http.expectOne('/admin/catalogs/services/scopes').flush({ statusCode: 403, code: 'FORBIDDEN', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(interno().alcance().status).toBe('forbidden');
  });

  it('S9: un error inesperado del servidor muestra el código de soporte y ofrece reintentar', async () => {
    await montar();
    http.expectOne('/admin/catalogs/services/scopes').flush({ statusCode: 500, code: 'INTERNAL', message: 'Error interno', correlationId: 'req-77' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(interno().alcance().status).toBe('error');
    expect(texto()).toContain('req-77');
    expect(texto()).toContain('Reintentar');
  });

  it('desactivar manda la versión leída y relee la lista: lo que se ve es lo persistido', async () => {
    await montar();
    cargarInicial();
    interno().ejecutar({ id: '1', item: servicio('1') }, 'deactivate');
    const req = http.expectOne('/admin/catalogs/services/1/deactivate');
    expect(req.request.body).toEqual({ expectedRowVersion: 2 });
    expect(interno().enCurso()).toBe('1');
    req.flush(servicio('1', { isActive: false, rowVersion: 3 }));
    http.expectOne(esLista).flush(pagina([servicio('1', { isActive: false, rowVersion: 3 })]));
    fixture.detectChanges();
    expect(interno().aviso()?.texto).toContain('quedó desactivado (versión 3)');
    expect(interno().enCurso()).toBeNull();
    expect(texto()).toContain('Desactivado');
  });

  it('sin doble envío: otra acción mientras una está en curso no manda nada', async () => {
    await montar();
    cargarInicial();
    interno().ejecutar({ id: '1', item: servicio('1') }, 'deactivate');
    interno().ejecutar({ id: '2', item: servicio('2') }, 'deactivate');
    http.expectOne('/admin/catalogs/services/1/deactivate').flush(servicio('1', { isActive: false }));
    http.expectOne(esLista).flush(pagina([]));
  });

  it('409 de versión al reactivar: avisa en ámbar, no pisa y relee la lista', async () => {
    await montar();
    cargarInicial();
    interno().ejecutar({ id: '2', item: servicio('2', { isActive: false }) }, 'reactivate');
    http.expectOne('/admin/catalogs/services/2/reactivate').flush(
      { statusCode: 409, code: 'CONFLICT', message: 'x', reason: 'SERVICE_CATALOG_VERSION_MISMATCH', details: { expected: 2, actual: 5 } },
      { status: 409, statusText: 'Conflict' },
    );
    expect(interno().aviso()?.tono).toBe('warning');
    expect(interno().aviso()?.texto).toMatch(/Otra persona modificó/);
    http.expectOne(esLista).flush(pagina([servicio('2', { rowVersion: 5 })]));
    expect(interno().enCurso()).toBeNull();
  });

  it('403 al desactivar se explica y no relee', async () => {
    await montar();
    cargarInicial();
    interno().ejecutar({ id: '1', item: servicio('1') }, 'deactivate');
    http.expectOne('/admin/catalogs/services/1/deactivate').flush({ statusCode: 403, code: 'FORBIDDEN', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    expect(interno().aviso()?.tono).toBe('error');
    expect(interno().aviso()?.texto).toMatch(/no tiene permiso/i);
  });

  it('«Nuevo servicio» abre el modal de alta', async () => {
    await montar();
    cargarInicial();
    interno().abrirAlta();
    fixture.detectChanges();
    expect(interno().dialogo()).toEqual({ servicio: null });
    expect((fixture.nativeElement as HTMLElement).querySelector('app-service-dialog')).not.toBeNull();
  });

  it('pagina con cursor: «siguiente» pide la página con el cursor y «anterior» vuelve a la primera', async () => {
    await montar();
    http.expectOne('/admin/catalogs/services/scopes').flush(ALCANCE);
    http.expectOne(esLista).flush(pagina([servicio('1')], 'c2'));
    fixture.detectChanges();
    const comp = fixture.componentInstance as unknown as { mover(c: string): void; paginador: { cursor(): { prevCursor?: string | null } } };
    comp.mover('c2');
    const segunda = http.expectOne(esLista);
    expect(segunda.request.params.get('cursor')).toBe('c2');
    segunda.flush(pagina([servicio('3')], null));
    const previa = comp.paginador.cursor().prevCursor!;
    comp.mover(previa);
    const primera = http.expectOne(esLista);
    expect(primera.request.params.has('cursor')).toBe(false);
    primera.flush(pagina([servicio('1')], 'c2'));
  });
});
