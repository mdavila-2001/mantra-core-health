import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import type { FlowsPage } from '../../../core/data-access/admin-portal/flows.types';
import { flujo, resumenDe } from './flows.fixture';
import { Flows } from './flows';

const URL = '/admin/qa/flows';

function pagina(items = [resumenDe()]): FlowsPage {
  return { items, modules: ['1 · Paciente', '2 · Médico'] };
}

describe('Flows', () => {
  let fixture: ComponentFixture<Flows>;
  let http: HttpTestingController;
  const q = <T extends Element>(selector: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const componente = () =>
    fixture.componentInstance as unknown as {
      cambiarModulo(m: string | null): void;
      cambiarCobertura(c: string | null): void;
      abrir(f: { id: string }): void;
      limpiar(): void;
      busqueda: { set(v: string): void };
      cargar(): void;
    };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Flows],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Flows);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('pide la lista sin filtros y muestra cada flujo con su contrato y su cobertura', () => {
    const r = http.expectOne(URL);
    expect(r.request.params.keys()).toEqual([]);
    r.flush(pagina());
    fixture.detectChanges();
    const tabla = q('[data-testid="flows-table"]')!.textContent!;
    expect(tabla).toContain('Flujo 9.9 · Cobrar la consulta');
    expect(tabla).toContain('1 de 2 en el contrato');
    expect(tabla).toContain('1 ausentes · 1 pasos sin endpoint');
    expect(tabla).toContain('2 de 2');
    expect(tabla).toContain('Con fallos');
  });

  it('un flujo sin sembrar dice «Sin sembrar» y no inventa una corrida', () => {
    const f = flujo();
    http.expectOne(URL).flush(
      pagina([resumenDe({ ...f, qa: { ...f.qa, seeded: false, suiteId: null, lastRun: null, casesLinked: 0, casesMissing: 2 } })]),
    );
    fixture.detectChanges();
    const tabla = q('[data-testid="flows-table"]')!.textContent!;
    expect(tabla).toContain('Sin sembrar');
    expect(tabla).not.toContain('R-0001');
  });

  it('filtrar por módulo y cobertura vuelve a pedir con esos criterios y sin claves vacías', () => {
    http.expectOne(URL).flush(pagina());
    componente().cambiarModulo('2 · Médico');
    let r = http.expectOne((x) => x.url === URL);
    expect(r.request.params.get('module')).toBe('2 · Médico');
    expect(r.request.params.has('coverage')).toBe(false);
    r.flush(pagina());
    componente().cambiarCobertura('NEVER_RAN');
    r = http.expectOne((x) => x.url === URL);
    expect(r.request.params.get('coverage')).toBe('NEVER_RAN');
    expect(r.request.params.get('module')).toBe('2 · Médico');
    r.flush(pagina());
  });

  it('la búsqueda viaja como `search`', () => {
    http.expectOne(URL).flush(pagina());
    componente().busqueda.set('factura');
    componente().cargar();
    const r = http.expectOne((x) => x.url === URL);
    expect(r.request.params.get('search')).toBe('factura');
    r.flush(pagina());
  });

  it('sin resultados con filtros, orienta a quitarlos', () => {
    http.expectOne(URL).flush(pagina());
    componente().cambiarCobertura('RAN');
    http.expectOne((x) => x.url === URL).flush({ items: [], modules: ['1 · Paciente'] });
    fixture.detectChanges();
    expect(texto()).toContain('Ningún flujo coincide con los filtros elegidos.');
  });

  it('sin flujos y sin filtros, explica dónde se declaran', () => {
    http.expectOne(URL).flush({ items: [], modules: [] });
    fixture.detectChanges();
    expect(texto()).toContain('No hay flujos declarados todavía.');
    expect(texto()).toContain('qa_lab/flows/catalog');
  });

  it('un error de la API no deja filas viejas', () => {
    http.expectOne(URL).flush({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(q('[data-testid="flows-table"] tbody tr')).toBeNull();
  });

  it('el módulo elegido no achica la lista de módulos disponibles', () => {
    http.expectOne(URL).flush(pagina());
    componente().cambiarModulo('2 · Médico');
    http.expectOne((x) => x.url === URL).flush({ items: [resumenDe()], modules: ['2 · Médico'] });
    fixture.detectChanges();
    const opciones = (fixture.componentInstance as unknown as { opcionesModulo(): { value: string | null }[] }).opcionesModulo();
    expect(opciones.map((o) => o.value)).toEqual([null, '1 · Paciente', '2 · Médico']);
  });

  it('abrir una fila navega al detalle del flujo', async () => {
    http.expectOne(URL).flush(pagina());
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    componente().abrir({ id: '9.9' });
    expect(navegar).toHaveBeenCalledWith(['/superadmin/flows', '9.9']);
  });
});
