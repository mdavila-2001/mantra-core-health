import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GettingStarted, type Etapa } from './getting-started';

/**
 * El recorrido no guarda en qué paso va: lo deriva de lo que ya existe.
 *
 * Lo que estas pruebas fijan es esa derivación, que es donde se rompe callado:
 * el tenant semilla no cuenta como organización, una sola membresía es el dueño
 * y no un equipo, y una lectura caída no puede hacer que algo ya hecho aparezca
 * como pendiente.
 */
const TENANT_SEMILLA = {
  id: 't-0',
  code: 'DEFAULT',
  legalName: 'Organización por defecto',
  tenantTypeConceptId: 'c-provider',
  statusConceptId: 'c-activa',
  verificationStatusConceptId: 'c-verificada',
  createdAt: '2026-08-01T12:00:00.000Z',
};

const TENANT_REAL = {
  id: 't-9',
  code: 'CLINICA-SUR',
  legalName: 'Clínica del Sur S.R.L.',
  tenantTypeConceptId: 'c-provider',
  statusConceptId: 'c-pendiente',
  verificationStatusConceptId: 'c-sin-verificar',
  createdAt: '2026-08-22T12:00:00.000Z',
};

/** La misma organización, ya verificada: cambia el concepto, no el id. */
const TENANT_VERIFICADO = { ...TENANT_REAL, verificationStatusConceptId: 'c-verificada' };

const SIN_SEDES = { items: [], count: 0 };
const UNA_SEDE = {
  items: [
    {
      id: 'b-1',
      code: 'CENTRO',
      name: 'Sede Centro',
      statusConceptId: 'c-activa',
      createdAt: '2026-08-22T12:00:00.000Z',
    },
  ],
  count: 1,
};

const SOLO_EL_DUENO = { items: [], count: 1, limit: 2, nextCursor: null };
const CON_EQUIPO = { items: [], count: 2, limit: 2, nextCursor: null };

const ETIQUETA_VERIFICADA = {
  items: [{ conceptId: 'c-verificada', code: 'TENANT_VERIFIED', display: 'Verificada' }],
};
const ETIQUETA_SIN_VERIFICAR = {
  items: [{ conceptId: 'c-sin-verificar', code: 'DIR_TENANT_UNVERIFIED', display: 'Sin verificar' }],
};

describe('GettingStarted', () => {
  let fixture: ComponentFixture<GettingStarted>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GettingStarted],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GettingStarted);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  /**
   * Las etapas ya resueltas, indexadas por su clave.
   *
   * Se tipan con la `Etapa` del componente y no con una forma escrita acá: una
   * copia estructural pasa a mentir en cuanto la interfaz gana un campo, y eso
   * fue exactamente lo que dejó sin cubrir la ruta de la primera etapa.
   */
  function etapas(): Map<string, Etapa> {
    const lista = crudo<() => readonly Etapa[]>('etapas').call(fixture.componentInstance);
    return new Map(lista.map((etapa) => [etapa.key, etapa]));
  }

  /**
   * Responde el listado de organizaciones y, si hay una real, sus tres lecturas.
   *
   * @param tenants - Lo que devuelve `GET /admin/tenants`.
   * @param detalle - Las respuestas de sedes, membresías y etiquetas.
   */
  function responder(
    tenants: readonly object[],
    detalle?: { sedes: object; membresias: object; etiquetas: object },
  ): void {
    http
      .expectOne((r) => r.url === '/admin/tenants')
      .flush({ items: tenants, count: tenants.length, limit: 2, nextCursor: null });

    if (detalle !== undefined) {
      http.expectOne((r) => r.url === `/tenants/${TENANT_REAL.id}/branches`).flush(detalle.sedes);
      http
        .expectOne((r) => r.url === `/tenants/${TENANT_REAL.id}/memberships`)
        .flush(detalle.membresias);
      http.expectOne((r) => r.url === '/terminology/concepts').flush(detalle.etiquetas);
    }

    fixture.detectChanges();
  }

  it('el tenant semilla no cuenta como organización', () => {
    // Existe para que el administrador tenga dónde estar, no porque la
    // plataforma esté puesta en marcha. Contarlo daría por hecho el primer paso.
    responder([TENANT_SEMILLA]);

    expect(etapas().get('organizacion')?.completa).toBe(false);
    expect(etapas().get('organizacion')?.actual).toBe(true);
  });

  it('sin organización, el botón lleva a crearla y ofrece crear la cuenta dueña', () => {
    // Las dos ramas estaban cruzadas: sin organización el único botón iba al
    // alta de cuentas —un callejón, porque desde ahí nada enlaza al alta de la
    // organización— y con organización el botón decía «Ver» pero navegaba al
    // formulario de creación.
    responder([TENANT_SEMILLA]);

    const etapa = etapas().get('organizacion');
    expect(etapa?.ruta).toBe('/administration/organizations/new');
    expect(etapa?.accion).toBe('Crear la organización');
    // La cuenta dueña se elige de una lista, así que tiene que existir antes:
    // ése es el único motivo del segundo camino.
    // `/administration/users` ES el alta (`UserRegistration`), no un listado.
    expect(etapa?.rutaSecundaria).toBe('/administration/users');
  });

  it('con la organización creada, el botón la muestra en vez de ofrecer otra', () => {
    responder([TENANT_SEMILLA, TENANT_REAL], {
      sedes: SIN_SEDES,
      membresias: SOLO_EL_DUENO,
      etiquetas: ETIQUETA_SIN_VERIFICAR,
    });

    const etapa = etapas().get('organizacion');
    expect(etapa?.accion).toBe('Ver la organización');
    expect(etapa?.ruta).toContain(TENANT_REAL.id);
    // Y ya no ofrece el atajo a crear cuentas: sólo servía para poder empezar.
    expect(etapa?.rutaSecundaria).toBeUndefined();
  });

  it('con una organización real avanza a verificarla', () => {
    responder([TENANT_SEMILLA, TENANT_REAL], {
      sedes: SIN_SEDES,
      membresias: SOLO_EL_DUENO,
      etiquetas: ETIQUETA_SIN_VERIFICAR,
    });

    const resueltas = etapas();
    expect(resueltas.get('organizacion')?.completa).toBe(true);
    expect(resueltas.get('verificacion')?.completa).toBe(false);
    expect(resueltas.get('verificacion')?.actual).toBe(true);
    // Y la etapa apunta a la pantalla de esa organización, no a una genérica.
    expect(resueltas.get('verificacion')?.ruta).toContain(TENANT_REAL.id);
  });

  it('una sola membresía es el dueño, no un equipo', () => {
    // El alta crea la membresía owner en la misma transacción, así que «hay
    // membresías» siempre sería cierto y la etapa nunca pediría nada.
    responder([TENANT_VERIFICADO], {
      sedes: UNA_SEDE,
      membresias: SOLO_EL_DUENO,
      etiquetas: ETIQUETA_VERIFICADA,
    });

    const resueltas = etapas();
    expect(resueltas.get('sede')?.completa).toBe(true);
    expect(resueltas.get('plantilla')?.completa).toBe(false);
    expect(resueltas.get('plantilla')?.actual).toBe(true);
  });

  it('con todo hecho el recorrido se declara completo', () => {
    responder([TENANT_VERIFICADO], {
      sedes: UNA_SEDE,
      membresias: CON_EQUIPO,
      etiquetas: ETIQUETA_VERIFICADA,
    });

    expect(crudo<() => boolean>('completo').call(fixture.componentInstance)).toBe(true);
    expect(crudo<() => number>('cumplidas').call(fixture.componentInstance)).toBe(4);
  });

  it('si el catálogo no responde, la organización se asume sin verificar', () => {
    // Es el lado que ofrece la acción en vez de esconderla: dar por verificada
    // una organización que quizá no lo está escondería el paso que falta.
    http
      .expectOne((r) => r.url === '/admin/tenants')
      .flush({ items: [TENANT_REAL], count: 1, limit: 2, nextCursor: null });
    http.expectOne((r) => r.url === `/tenants/${TENANT_REAL.id}/branches`).flush(UNA_SEDE);
    http.expectOne((r) => r.url === `/tenants/${TENANT_REAL.id}/memberships`).flush(CON_EQUIPO);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({ message: 'roto' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(etapas().get('verificacion')?.completa).toBe(false);
    // Y las otras dos lecturas, que sí respondieron, no se pierden.
    expect(etapas().get('sede')?.completa).toBe(true);
  });
});
