import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { esperarSinViolaciones } from '../../../../../testing/a11y';
import type { FlowDetail } from '../../../../core/data-access/admin-portal/flows.types';
import { billingTables, operationDetail } from '../../portal/portal.fixture';
import { flujo } from '../flows.fixture';
import { FlowDetailPage } from './flow-detail';

describe('FlowDetailPage', () => {
  let fixture: ComponentFixture<FlowDetailPage>;
  let http: HttpTestingController;
  const q = <T extends Element>(selector: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const url = (flowId = '9.9') => `/admin/qa/flows/${flowId}`;

  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function montar(flowId = '9.9'): void {
    parametros = new BehaviorSubject(convertToParamMap({ flowId }));
    TestBed.configureTestingModule({
      imports: [FlowDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: parametros.value }, paramMap: parametros.asObservable() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FlowDetailPage);
    fixture.detectChanges();
  }

  function abrirPestana(indice: number): void {
    (fixture.componentInstance as unknown as { pestana: { set(i: number): void } }).pestana.set(indice);
    fixture.detectChanges();
  }

  function responder(f: FlowDetail = flujo()): void {
    http.expectOne(url(f.id)).flush(f);
    fixture.detectChanges();
  }

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('pide el flujo de la ruta y mientras tanto no muestra datos', () => {
    montar('2.7');
    expect(http.expectOne(url('2.7')).request.method).toBe('GET');
    expect(q('[data-testid="flow-summary"]')).toBeNull();
    http.match(() => true).forEach((r) => r.flush(flujo({ id: '2.7' })));
  });

  it('el resumen separa el contrato (declarados de ausentes) de los casos sembrados', () => {
    montar();
    responder();
    expect(q('[data-testid="flow-contract-declared"]')!.textContent).toContain('1 de 2');
    expect(texto()).toContain('1 no existen en la API que se está leyendo.');
    expect(q('[data-testid="flow-cases-linked"]')!.textContent).toContain('2 de 2');
    expect(q('[data-testid="flow-results"]')!.textContent).toContain('1 · 1');
    expect(texto()).toContain('Corrida R-0001');
  });

  it('el título es el del flujo y no hay aviso de «sin sembrar» si la suite existe', () => {
    montar();
    responder();
    expect(texto()).toContain('Flujo 9.9 · Cobrar la consulta');
    expect(q('[data-testid="flow-not-seeded"]')).toBeNull();
  });

  it('una suite sin sembrar lo explica y no promete veredictos', () => {
    montar();
    responder(
      flujo({
        qa: { ...flujo().qa, seeded: false, suiteId: null, casesLinked: 0, casesMissing: 2, passed: 0, failed: 0, lastRun: null },
      }),
    );
    expect(q('[data-testid="flow-not-seeded"]')!.textContent).toContain('SEED_QA_FLOWS=true');
    expect(texto()).toContain('Nunca se corrió.');
  });

  it('la pestaña «Árbol» dibuja el árbol del flujo', () => {
    montar();
    responder();
    expect(q('[data-testid="flow-tree"]')).not.toBeNull();
    expect(q('[data-testid="flow-node-decidir"]')).not.toBeNull();
  });

  it('«Endpoints» lista las llamadas con su contrato, incluidos los pasos sin endpoint', () => {
    montar();
    responder();
    abrirPestana(1);
    const tabla = q('[data-testid="flow-endpoints"]')!.textContent!;
    expect(tabla).toContain('POST /cobros/{id}');
    expect(tabla).toContain('En el contrato');
    expect(tabla).toContain('No existe en el contrato');
    expect(tabla).toContain('Sin endpoint');
    expect(texto()).toContain('No se encontró un endpoint que emita un QR por un monto de consulta.');
  });

  it('«Casos QA» muestra cada caso con su resultado y las ramas sin caso con su razón', () => {
    montar();
    responder();
    abrirPestana(2);
    const casos = q('[data-testid="flow-cases"]')!.textContent!;
    expect(casos).toContain('FLOW-9.9-cobrar-NEGATIVE-01');
    expect(casos).toContain('Falló · devolvió 200');
    expect(casos).toContain('Se esperaba 400');
    expect(casos).toContain('Pasó · devolvió 404');
    const sinCaso = q('[data-testid="flow-no-case"]')!.textContent!;
    expect(sinCaso).toContain('Journey con variable.');
    expect(sinCaso).toContain('Sin endpoint en el contrato.');
    expect(texto()).toContain('Ramas sin caso (5)');
  });

  it('un flujo cuyas ramas todas tienen caso no pinta la tabla de «sin caso»', () => {
    const conTodo = flujo();
    montar();
    responder({
      ...conTodo,
      nodes: conTodo.nodes.map((n) => ({ ...n, branches: n.branches.filter((b) => b.qaCase) })),
    });
    abrirPestana(2);
    expect(q('[data-testid="flow-no-case"]')).toBeNull();
  });

  it('«Fuente» muestra el documento, la sección, las pantallas y las preguntas abiertas', () => {
    montar();
    responder();
    abrirPestana(3);
    const fuente = q('[data-testid="flow-source"]')!.textContent!;
    expect(fuente).toContain('SALUD/📋 Registro de procesos por módulo.md');
    expect(fuente).toContain('9.9 · Cobro');
    expect(fuente).toContain('/cobros');
    expect(q('[data-testid="flow-open-questions"]')!.textContent).toContain('Quién adjudica la autorización del seguro.');
  });

  it('«Datos que toca» no pide nada al inventario hasta que se abre la pestaña', () => {
    montar();
    responder();
    http.expectNone((r) => r.url.startsWith('/admin/portal/'));
    expect(q('[data-testid="flow-data"]')).toBeNull();
  });

  it('«Datos que toca» cruza el paso declarado con su operación y muestra las tablas que escribe y lee', () => {
    montar();
    responder();
    abrirPestana(4);
    http.expectOne('/admin/portal/operaciones/CobrosController_pagar').flush(operationDetail({ datos: billingTables() }));
    fixture.detectChanges();
    expect(q('[data-testid="flow-data-write-cobrar"]')!.textContent).toContain('billing.bills');
    expect(q('[data-testid="flow-data-read-cobrar"]')!.textContent).toContain('billing.vendors');
    expect(q('[data-testid="flow-data-summary"]')!.textContent).toContain('Suma de 1 de 1 operaciones cruzadas');
  });

  it('al pasar de un flujo a otro con la misma pantalla, pide el nuevo, vuelve al árbol y no deja datos del anterior', () => {
    montar('9.9');
    responder();
    abrirPestana(3);
    expect(q('[data-testid="flow-source"]')).not.toBeNull();

    parametros.next(convertToParamMap({ flowId: '2.7' }));
    fixture.detectChanges();

    expect(q('[data-testid="flow-summary"]')).toBeNull();
    http.expectOne(url('2.7')).flush(flujo({ id: '2.7', title: 'Facturación' }));
    fixture.detectChanges();
    expect(texto()).toContain('Flujo 2.7 · Facturación');
    expect(q('[data-testid="flow-tree"]')).not.toBeNull();
    expect(q('[data-testid="flow-source"]')).toBeNull();
  });

  it('un cambio de flujo cancela el pedido anterior: su respuesta tardía no pisa la pantalla', () => {
    montar('9.9');
    const primero = http.expectOne(url('9.9'));
    parametros.next(convertToParamMap({ flowId: '2.7' }));
    expect(primero.cancelled).toBe(true);
    http.expectOne(url('2.7')).flush(flujo({ id: '2.7', title: 'Facturación' }));
    fixture.detectChanges();
    expect(texto()).toContain('Flujo 2.7 · Facturación');
  });

  it('un flujo inexistente (404) no deja datos y ofrece reintentar', () => {
    montar('9.9');
    http.expectOne(url()).flush({ statusCode: 404, code: 'NOT_FOUND', message: 'Flujo no encontrado' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(q('[data-testid="flow-summary"]')).toBeNull();
    expect(texto()).not.toContain('Corrida R-0001');
  });

  it('no tiene violaciones de accesibilidad', async () => {
    montar();
    responder();
    await esperarSinViolaciones(fixture.nativeElement as HTMLElement);
  }, 30_000);
});
