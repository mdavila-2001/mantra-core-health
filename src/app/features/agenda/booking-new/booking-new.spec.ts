import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { BookingNew } from './booking-new';

/**
 * La reserva es el eslabón hold → confirm del recorrido de demo. Estas
 * pruebas fijan lo que el backend hace cumplir y la pantalla debe honrar:
 * el cupo se revalida al entrar, el token viaja del hold al confirm, y una
 * retención vencida vuelve al paso de retener en vez de morir en un error.
 */

/** base64url sobre UTF-8, como el token real. */
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

const CUPO = {
  id: 's-1',
  resourceId: 'r-1',
  scheduleTemplateId: null,
  startAt: '2026-08-12T13:00:00.000Z',
  endAt: '2026-08-12T13:30:00.000Z',
  capacity: 2,
  remainingCapacity: 1,
  statusConceptId: 'c-abierto',
  serviceConceptId: null,
};

const PACIENTE: ReferenceOption = { value: 'pp-1', label: 'Ana Salas', hint: 'PAC-1' };

const RUTA =
  '/schedule/book/s-1?recurso=r-1&desde=2026-08-12T13:00:00.000Z&hasta=2026-08-12T13:30:00.000Z';

describe('BookingNew', () => {
  let harness: RouterTestingHarness;
  let componente: BookingNew;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'schedule/book/:slotId', component: BookingNew },
          { path: '**', children: [] },
        ]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.start({
      accessToken: jwt({ sub: 'u-1', roles: ['SCHEDULING_AGENT'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
  });

  afterEach(() => http.verify());

  async function montar(url: string = RUTA): Promise<void> {
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(url, BookingNew);
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function crudo<T>(nombre: string): T {
    return (componente as unknown as Record<string, unknown>)[nombre] as T;
  }

  function responderCupo(items: unknown[] = [CUPO]): void {
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ items, count: items.length, limit: 500, truncated: false });
    harness.detectChanges();
  }

  it('revalida el cupo al entrar, acotado a la franja de la URL', async () => {
    await montar();

    const req = http.expectOne((r) => r.url === '/scheduling/slots');
    expect(req.request.params.get('resourceId')).toBe('r-1');
    expect(req.request.params.get('from')).toBe('2026-08-12T13:00:00.000Z');
    expect(req.request.params.get('to')).toBe('2026-08-12T13:30:00.000Z');

    req.flush({ items: [CUPO], count: 1, limit: 500, truncated: false });
    harness.detectChanges();

    expect(interno<() => { status: string }>('cupo')().status).toBe('ready');
  });

  it('sin franja en la URL no pide nada: se entra desde la agenda', async () => {
    await montar('/schedule/book/s-1');

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(crudo<boolean>('sinContexto')).toBe(true);
  });

  it('un cupo que ya no está (o quedó sin lugar) sale como vacío con salida', async () => {
    await montar();
    responderCupo([{ ...CUPO, remainingCapacity: 0 }]);

    const estado = interno<() => { status: string; message?: string }>('cupo')();
    expect(estado.status).toBe('empty');
    expect(estado.message).toContain('ya no está disponible');
  });

  it('sin paciente elegido no se retiene nada', async () => {
    await montar();
    responderCupo();

    interno<() => void>('retener')();

    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('retener manda el cupo por la ruta y el paciente en el cuerpo', async () => {
    await montar();
    responderCupo();
    crudo<{ set: (v: ReferenceOption) => void }>('paciente').set(PACIENTE);

    interno<() => void>('retener')();

    const req = http.expectOne('/scheduling/slots/s-1/holds');
    expect(req.request.body).toEqual({ patientProfileId: 'pp-1' });

    req.flush({
      id: 'h-1',
      holdToken: 'tok-1',
      expiresAt: '2026-08-12T13:05:00.000Z',
      remainingCapacity: 0,
    });

    expect(interno<() => { holdToken: string } | null>('retencion')()?.holdToken).toBe('tok-1');
  });

  it('confirmar consume el token y manda tenant, paciente y canal', async () => {
    await montar();
    responderCupo();
    crudo<{ set: (v: ReferenceOption) => void }>('paciente').set(PACIENTE);
    interno<() => void>('retener')();
    http.expectOne('/scheduling/slots/s-1/holds').flush({
      id: 'h-1',
      holdToken: 'tok-1',
      expiresAt: '2026-08-12T13:05:00.000Z',
      remainingCapacity: 0,
    });

    const router = TestBed.inject(Router);
    const navegado: unknown[] = [];
    vi.spyOn(router, 'navigate').mockImplementation((comandos, extras) => {
      navegado.push([comandos, extras?.queryParams]);
      return Promise.resolve(true);
    });

    interno<() => void>('confirmar')();

    const req = http.expectOne('/scheduling/holds/tok-1/confirm');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      patientProfileId: 'pp-1',
      channel: 'DESK',
    });

    req.flush({
      id: 'b-9',
      bookableSlotId: 's-1',
      statusConceptId: 'c-confirmada',
      remindersScheduled: 0,
    });

    // Vuelve a la agenda del recurso: es donde la cita recién confirmada se ve.
    expect(navegado).toEqual([[['/schedule'], { recurso: 'r-1' }]]);
  });

  /**
   * El TTL es real: un confirm que llega tarde recibe un rechazo. La pantalla
   * lo trata como S4 con reintento — volver a retener — y revalida el cupo,
   * porque el vencimiento pudo habérselo dado a otra persona.
   */
  it('una retención vencida vuelve al paso de retener y revalida el cupo', async () => {
    await montar();
    responderCupo();
    crudo<{ set: (v: ReferenceOption) => void }>('paciente').set(PACIENTE);
    interno<() => void>('retener')();
    http.expectOne('/scheduling/slots/s-1/holds').flush({
      id: 'h-1',
      holdToken: 'tok-1',
      expiresAt: '2026-08-12T13:05:00.000Z',
      remainingCapacity: 0,
    });

    interno<() => void>('confirmar')();
    http
      .expectOne('/scheduling/holds/tok-1/confirm')
      .flush(
        { code: 'PRECONDITION_FAILED', message: 'La retención expiró' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    harness.detectChanges();

    expect(interno<() => unknown>('retencion')()).toBeNull();
    expect(interno<() => boolean>('retencionVencida')()).toBe(true);

    // La revalidación es una lectura nueva del cupo.
    responderCupo();
    expect(interno<() => { status: string }>('cupo')().status).toBe('ready');
  });

  it('la búsqueda de paciente traduce filas a opciones con el código de pista', async () => {
    await montar();
    responderCupo();

    interno<(t: string) => void>('buscarPaciente')('ana');

    http.expectOne((r) => r.url === '/profiles/patients').flush({
      items: [
        {
          profileId: 'pp-1',
          personId: 'p-1',
          patientCode: 'PAC-1',
          displayName: 'Ana Salas',
          birthDate: null,
          deceased: false,
        },
      ],
      count: 1,
      limit: 10,
      nextCursor: null,
    });

    expect(interno<() => readonly ReferenceOption[]>('candidatos')()).toEqual([
      { value: 'pp-1', label: 'Ana Salas', hint: 'PAC-1' },
    ]);
  });
});
