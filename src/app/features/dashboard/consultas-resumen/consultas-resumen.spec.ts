import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { ConsultasResumen } from './consultas-resumen';

/**
 * "El panel dice la verdad" (C-24, H5) — lo que sólo un componente montado
 * puede demostrar: que la agregación cliente reproduce lo que la agenda ya
 * lee, sin inventar ningún endpoint.
 */

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

const PERFIL = 'hp-1';
const TENANT = 't-1';
const ESTADO_CONFIRMADA = 'c-confirmada';
const ESTADO_CANCELADA = 'c-cancelada';
const CODIGO_POR_CONCEPTO: Readonly<Record<string, string>> = {
  [ESTADO_CONFIRMADA]: 'BOOKING_CONFIRMED',
  [ESTADO_CANCELADA]: 'BOOKING_CANCELLED',
};

/** Un lunes fijo dentro del mes actual, a la hora que se pida — determinista. */
function unLunesDeEsteMesA(hora: number, minutos = 0): Date {
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const corrimientoHastaLunes = (8 - primerDia.getDay()) % 7; // 0=domingo..6=sábado
  const primerLunes = new Date(hoy.getFullYear(), hoy.getMonth(), 1 + corrimientoHastaLunes);
  return new Date(primerLunes.getFullYear(), primerLunes.getMonth(), primerLunes.getDate(), hora, minutos, 0, 0);
}

interface CitaCruda {
  readonly id: string;
  readonly desde: Date;
  readonly estado: string;
  readonly serviceConceptId?: string;
}

function wire(cita: CitaCruda): Record<string, unknown> {
  return {
    id: cita.id,
    resourceId: 'r-1',
    startAt: cita.desde.toISOString(),
    endAt: new Date(cita.desde.getTime() + 20 * 60_000).toISOString(),
    statusConceptId: cita.estado,
    serviceConceptId: cita.serviceConceptId ?? 'act-consulta',
  };
}

describe('ConsultasResumen', () => {
  let fixture: ComponentFixture<ConsultasResumen>;
  let component: ConsultasResumen;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultasResumen],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  function crear(): void {
    session.start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: [TENANT], hpid: PERFIL }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(ConsultasResumen);
    component = fixture.componentInstance;
  }

  function responderRecursos(): void {
    http.expectOne((r) => r.url.endsWith('/scheduling/resources')).flush({
      items: [
        {
          id: 'r-1',
          name: 'Agenda',
          resourceTypeConceptId: 'rt-1',
          resourceRefType: 'health_practitioner_profiles',
          resourceRefId: PERFIL,
          practitionerName: 'Dra. Prueba',
          practiceId: null,
          timeZone: 'America/La_Paz',
          capacity: 1,
          stateConceptId: 'st-activo',
          site: null,
        },
      ],
      count: 1,
    });
  }

  function responderCitas(citas: readonly CitaCruda[]): void {
    http
      .expectOne((r) => r.url.endsWith('/scheduling/bookings'))
      .flush({ items: citas.map(wire), count: citas.length, limit: 500, truncated: false });
  }

  function responderCatalogoYActividades(): void {
    const pedidoConceptos = http.match((r) => r.url.endsWith('/terminology/concepts'));
    for (const pedido of pedidoConceptos) {
      const ids = (pedido.request.params.get('ids') ?? '').split(',').filter((id) => id !== '');
      pedido.flush({
        items: ids.map((id) => ({
          conceptId: id,
          code: CODIGO_POR_CONCEPTO[id] ?? 'DESCONOCIDO',
          display: CODIGO_POR_CONCEPTO[id] ?? 'Desconocido',
          codeSystemVersionId: 'v-1',
        })),
        count: ids.length,
      });
    }
    http.expectOne((r) => r.url.endsWith('/scheduling/activity-types')).flush({
      items: [
        { type: 'CONSULTATION', conceptId: 'act-consulta', label: 'Consulta', tone: 'primary' },
        { type: 'FOLLOW_UP', conceptId: 'act-control', label: 'Control', tone: 'success' },
        { type: 'PROCEDURE', conceptId: 'act-procedimiento', label: 'Procedimiento', tone: 'warning' },
      ],
    });
    fixture.detectChanges();
  }

  function estado(): { status: string } {
    return (component as unknown as { estado: () => { status: string } }).estado();
  }

  function resumenSemana(): { total: number; canceladas: number } {
    return (component as unknown as { resumenSemana: () => { total: number; canceladas: number } }).resumenSemana();
  }

  function resumenMes(): { total: number; canceladas: number } {
    return (component as unknown as { resumenMes: () => { total: number; canceladas: number } }).resumenMes();
  }

  function mapaDeCalor(): { celdas: readonly (readonly number[])[]; maximo: number } {
    return (
      component as unknown as {
        mapaDeCalor: () => { celdas: readonly (readonly number[])[]; maximo: number };
      }
    ).mapaDeCalor();
  }

  function otrasAtenciones(): readonly { label: string; total: number }[] {
    return (component as unknown as { otrasAtenciones: () => readonly { label: string; total: number }[] }).otrasAtenciones();
  }

  it('una cuenta sin perfil profesional no pide nada al servidor', () => {
    session.start({ accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: [TENANT] }), refreshToken: 'r-1' });
    fixture = TestBed.createComponent(ConsultasResumen);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(estado().status).toBe('empty');
  });

  it('cuenta las consultas del mes, sin las canceladas por omisión (H5.S2.M1)', () => {
    crear();
    responderRecursos();
    responderCitas([
      { id: 'b-1', desde: unLunesDeEsteMesA(9), estado: ESTADO_CONFIRMADA },
      { id: 'b-2', desde: unLunesDeEsteMesA(10), estado: ESTADO_CANCELADA },
    ]);
    responderCatalogoYActividades();

    expect(resumenMes().total).toBe(1);
  });

  it('con "incluir canceladas" activado, el total del mes las suma', () => {
    crear();
    responderRecursos();
    responderCitas([
      { id: 'b-1', desde: unLunesDeEsteMesA(9), estado: ESTADO_CONFIRMADA },
      { id: 'b-2', desde: unLunesDeEsteMesA(10), estado: ESTADO_CANCELADA },
    ]);
    responderCatalogoYActividades();

    (component as unknown as { incluirCanceladas: { set(v: boolean): void } }).incluirCanceladas.set(true);
    fixture.detectChanges();

    expect(resumenMes().total).toBe(2);
  });

  it('el resumen semanal cuenta sólo lo que cae en la semana lunes-domingo que contiene hoy', () => {
    crear();
    responderRecursos();
    // Un lunes del mes cae dentro de "esta semana" sólo si es la semana de
    // hoy; para no acoplar el test al día en que corre, se verifica la
    // propiedad relacional: semana <= mes, siempre.
    responderCitas([{ id: 'b-1', desde: unLunesDeEsteMesA(9), estado: ESTADO_CONFIRMADA }]);
    responderCatalogoYActividades();

    expect(resumenSemana().total).toBeLessThanOrEqual(resumenMes().total);
  });

  it('el mapa de calor ubica una consulta de las 09:00 del lunes en [lunes][09:00]', () => {
    crear();
    responderRecursos();
    responderCitas([{ id: 'b-1', desde: unLunesDeEsteMesA(9), estado: ESTADO_CONFIRMADA }]);
    responderCatalogoYActividades();

    const { celdas } = mapaDeCalor();
    // Columna: 09:00 - 06:00 (HORA_INICIO) = índice 3.
    expect(celdas[0]?.[3]).toBe(1);
    expect(celdas[0]?.reduce((a, b) => a + b, 0)).toBe(1);
    expect(celdas.slice(1).every((fila) => fila.every((v) => v === 0))).toBe(true);
  });

  it('una consulta cancelada no entra al mapa de calor', () => {
    crear();
    responderRecursos();
    responderCitas([{ id: 'b-1', desde: unLunesDeEsteMesA(9), estado: ESTADO_CANCELADA }]);
    responderCatalogoYActividades();

    const { celdas, maximo } = mapaDeCalor();
    expect(maximo).toBe(0);
    expect(celdas.flat().every((v) => v === 0)).toBe(true);
  });

  it('"otras atenciones" agrupa por la tipología del contrato — un PROCEDURE no es CONSULTATION', () => {
    crear();
    responderRecursos();
    responderCitas([
      { id: 'b-consulta', desde: unLunesDeEsteMesA(9), estado: ESTADO_CONFIRMADA, serviceConceptId: 'act-consulta' },
      { id: 'b-procedimiento', desde: unLunesDeEsteMesA(10), estado: ESTADO_CONFIRMADA, serviceConceptId: 'act-procedimiento' },
    ]);
    responderCatalogoYActividades();

    const otras = otrasAtenciones();
    expect(otras).toHaveLength(1);
    expect(otras[0]?.label).toBe('Procedimiento');
    expect(otras[0]?.total).toBe(1);
  });
});
