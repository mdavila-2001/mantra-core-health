import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { DiagnosticsBlock, TARGET_ESTUDIO } from './diagnostics-block';

/**
 * Pedir un laboratorio o una imagen desde la ficha, y ver qué volvió — punto 10
 * del reclamo. Lo que estas pruebas fijan:
 *
 * 1. **El bloque lee lo suyo.** El circuito diagnóstico no sale del resumen
 *    clínico: es otra lectura y otro módulo, y el bloque la hace suya para que
 *    el expediente no tenga que cambiar.
 * 2. **El alta pega contra `clinical`.** Una orden diagnóstica es una orden de
 *    servicio con categoría; sus invariantes no viven en `diagnostics`.
 * 3. **La categoría es obligatoria acá aunque el contrato la deje opcional.**
 *    Es lo que hace que el pedido vuelva a aparecer en el histórico.
 * 4. **«Con resultado» quiere decir liberado, no redactado.** Un informe con
 *    versión vigente pero sin liberar es un borrador, y mostrarlo como
 *    resultado sería mostrar un borrador como diagnóstico.
 * 5. **Después de pedir se relee.** El bloque no pinta lo que el servidor no le
 *    confirmó.
 */

const CATALOGO = {
  code: 'service-request-code',
  name: 'Estudio',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    { conceptId: 'code-hemograma', code: 'LAB_CBC', display: 'Hemograma', ordinal: 1 },
  ],
};

const CIRCUITO_VACIO = {
  patientProfileId: 'p-1',
  orders: [],
  reports: [],
  limit: 25,
  truncated: [],
};

const ORDEN = {
  id: 'sr-1',
  patientProfileId: 'p-1',
  encounterId: 'enc-1',
  codeConceptId: 'code-hemograma',
  categoryConceptId: 'cat-lab',
  statusConceptId: 'st-activa',
  createdAt: '2026-08-14T10:00:00.000Z',
};

/** Un informe **liberado**: tiene versión liberada, no sólo vigente. */
const INFORME_LIBERADO = {
  id: 'dr-1',
  patientProfileId: 'p-1',
  serviceRequestId: 'sr-1',
  codeConceptId: 'code-hemograma',
  lifecycleStatusConceptId: 'st-final',
  currentVersionId: 'v-1',
  currentReleasedVersionId: 'v-1',
  createdAt: '2026-08-14T11:00:00.000Z',
};

/** El mismo informe **sin liberar**: redactado y todavía no validado. */
const INFORME_BORRADOR = {
  ...INFORME_LIBERADO,
  currentReleasedVersionId: undefined,
};

/** base64url **sobre UTF-8**, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('DiagnosticsBlock', () => {
  let fixture: ComponentFixture<DiagnosticsBlock>;
  let componente: DiagnosticsBlock;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });

    fixture = TestBed.createComponent(DiagnosticsBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'enc-1');
  });

  /**
   * Responde **todos** los catálogos pendientes, no sólo el del estudio.
   *
   * Son tres targets distintos y se piden a la vez: el bloque pregunta por el
   * suyo al construirse, y el formulario —que se pinta mientras la respuesta
   * viaja, porque `catalogoListo` arranca en `null`— monta los tres selectores.
   * Esperar uno solo acá fallaría por los otros dos, que no tienen nada de malo.
   *
   * @param estudio - Si el catálogo del estudio responde o no tiene binding.
   */
  function responderCatalogos(estudio: 'ok' | 'sin-binding' = 'ok'): void {
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      if (req.request.params.get('target') === TARGET_ESTUDIO && estudio === 'sin-binding') {
        // Sin binding declarado la API responde 404: es un dato que falta en el
        // catálogo, no un fallo transitorio.
        req.flush({ message: 'sin binding' }, { status: 404, statusText: 'Not Found' });
        continue;
      }
      req.flush(CATALOGO);
    }
  }

  /** Responde la lectura del circuito y la de etiquetas que la sigue. */
  function responderCircuito(circuito: object = CIRCUITO_VACIO): void {
    http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders').flush(circuito);

    // Las etiquetas sólo se piden si hay conceptos que traducir.
    for (const req of http.match((r) => r.url === '/terminology/concepts')) {
      req.flush({ items: [], total: 0 });
    }
  }

  afterEach(() => {
    // Los selectores que se montaron al final de la prueba dejan su pedido de
    // catálogo abierto; drenarlos deja que `verify()` hable de lo que importa.
    responderCatalogos();
    http.verify();
  });

  it('lee el circuito del paciente al arrancar: es otra lectura que el resumen clínico', () => {
    fixture.detectChanges();
    responderCatalogos();

    const req = http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders');
    expect(req.request.params.get('limit')).toBe('25');

    req.flush(CIRCUITO_VACIO);
  });

  it('sin estudios lo dice, en vez de mostrar una lista vacía', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();
    fixture.detectChanges();

    const vacio = fixture.nativeElement.querySelector('[data-testid="estudios-vacio"]');
    expect(vacio).not.toBeNull();
    expect(componente['estudios']().length).toBe(0);
  });

  it('un informe liberado marca su orden con resultado', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito({
      ...CIRCUITO_VACIO,
      orders: [ORDEN],
      reports: [INFORME_LIBERADO],
    });
    fixture.detectChanges();

    const estudios = componente['estudios']();
    expect(estudios.length).toBe(1);
    expect(estudios[0].conResultado).toBe(true);
  });

  /**
   * La distinción que hace que la pantalla no mienta: `currentVersionId` dice
   * que hay algo redactado, `currentReleasedVersionId` que alguien lo validó.
   */
  it('un informe sin liberar NO cuenta como resultado: es un borrador', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito({
      ...CIRCUITO_VACIO,
      orders: [ORDEN],
      reports: [INFORME_BORRADOR],
    });
    fixture.detectChanges();

    expect(componente['estudios']()[0].conResultado).toBe(false);
  });

  /**
   * Un resultado que llega en papel de un laboratorio externo no tiene orden en
   * el sistema. Esconderlo sería perder el dato clínico por prolijidad.
   */
  it('muestra los informes que no cuelgan de ninguna orden', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito({
      ...CIRCUITO_VACIO,
      orders: [],
      reports: [{ ...INFORME_LIBERADO, serviceRequestId: undefined }],
    });
    fixture.detectChanges();

    expect(componente['informesSueltos']().length).toBe(1);
  });

  it('avisa cuando el histórico quedó recortado por el tope', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito({ ...CIRCUITO_VACIO, orders: [ORDEN], truncated: ['orders'] });
    fixture.detectChanges();

    expect(componente['recortado']()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="estudios-recortado"]'),
    ).not.toBeNull();
  });

  it('sin encuentro abierto no ofrece el formulario, pero sí el histórico', () => {
    fixture.componentRef.setInput('encounterId', null);
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();
    fixture.detectChanges();

    expect(componente['hayEncuentro']()).toBe(false);
    expect(componente['puedePedir']()).toBe(false);
    // El histórico se ve igual: mirar qué se pidió antes no requiere atender.
    expect(fixture.nativeElement.querySelector('[data-testid="estudios-vacio"]')).not.toBeNull();
  });

  it('sin catálogo declarado no ofrece el formulario y lo dice', () => {
    fixture.detectChanges();
    responderCatalogos('sin-binding');
    responderCircuito();
    fixture.detectChanges();

    expect(componente['catalogoListo']()).toBe(false);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  /** La categoría es lo que hace que el pedido vuelva a aparecer en el histórico. */
  it('no deja pedir sin categoría, aunque el contrato la declare opcional', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();

    componente['estudio'].set('code-hemograma');
    componente['categoria'].set(null);
    expect(componente['puedePedir']()).toBe(false);

    componente['categoria'].set('cat-lab');
    expect(componente['puedePedir']()).toBe(true);
  });

  it('el alta pega contra `clinical`, que es donde viven las invariantes', () => {
    fixture.detectChanges();
    responderCatalogos();
    responderCircuito();

    componente['estudio'].set('code-hemograma');
    componente['categoria'].set('cat-lab');
    componente['pedir']();

    const req = http.expectOne((r) => r.url === '/clinical/service-requests');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.codeConceptId).toBe('code-hemograma');
    expect(req.request.body.categoryConceptId).toBe('cat-lab');
    expect(req.request.body.encounterId).toBe('enc-1');
    expect(req.request.body.custodianTenantId).toBe('t-1');
    // La prioridad no se eligió: la clave se omite, no viaja en null.
    expect('priorityConceptId' in req.request.body).toBe(false);

    req.flush({
      id: 'sr-1',
      patientProfileId: 'p-1',
      status: 'st-activa',
      intent: 'st-orden',
      createdAt: '2026-08-14T10:00:00.000Z',
    });

    // Y se relee: no se pinta lo que el servidor no confirmó.
    responderCircuito({ ...CIRCUITO_VACIO, orders: [ORDEN] });
    fixture.detectChanges();
    expect(componente['estudios']().length).toBe(1);
  });

  it('el fallo del histórico no impide pedir', () => {
    fixture.detectChanges();
    responderCatalogos();
    http
      .expectOne((r) => r.url === '/diagnostics/patients/p-1/orders')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(componente['errorDelHistorico']()).not.toBeNull();

    componente['estudio'].set('code-hemograma');
    componente['categoria'].set('cat-lab');
    expect(componente['puedePedir']()).toBe(true);
  });
});
