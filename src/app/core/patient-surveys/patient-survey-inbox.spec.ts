import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PatientSurveyInbox } from './patient-survey-inbox';

const LECTURA = '/surveys/me/invitations';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Una invitación como viaja: fechas en texto, opcionales en `null`. */
function enElCable(id: string, status: string, expiraEnDias: number | null = 3) {
  return {
    id,
    title: 'Cómo le fue',
    description: null,
    status,
    issuedAt: new Date(Date.now() - DIA_MS).toISOString(),
    expiresAt: expiraEnDias === null ? null : new Date(Date.now() + expiraEnDias * DIA_MS).toISOString(),
    answeredAt: status === 'ANSWERED' ? new Date(Date.now() - DIA_MS).toISOString() : null,
    appointmentBookingId: `bk-${id}`,
  };
}

describe('PatientSurveyInbox', () => {
  function montar(plataforma: 'browser' | 'server' = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: plataforma },
      ],
    });
    return {
      bandeja: TestBed.inject(PatientSurveyInbox),
      http: TestBed.inject(HttpTestingController),
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('arranca sin nada: ni encuestas ni pendientes', () => {
    const { bandeja, http } = montar();

    expect(bandeja.hayInvitaciones()).toBe(false);
    expect(bandeja.pendientes()).toBe(0);
    expect(bandeja.cargada()).toBe(false);
    http.verify();
  });

  it('lee la bandeja con UNA sola petición y convierte las fechas', () => {
    const { bandeja, http } = montar();

    bandeja.cargarSiHaceFalta();
    // Pedirla otra vez con una lectura en vuelo no abre una segunda.
    bandeja.cargarSiHaceFalta();
    http.expectOne(LECTURA).flush([enElCable('i-1', 'PENDING'), enElCable('i-2', 'ANSWERED')]);

    expect(bandeja.cargada()).toBe(true);
    expect(bandeja.hayInvitaciones()).toBe(true);
    expect(bandeja.invitaciones()[0]!.expiresAt).toBeInstanceOf(Date);
    http.verify();
  });

  it('una vez leída, `cargarSiHaceFalta` no repite la lectura', () => {
    const { bandeja, http } = montar();
    bandeja.cargarSiHaceFalta();
    http.expectOne(LECTURA).flush([]);

    bandeja.cargarSiHaceFalta();

    http.expectNone(LECTURA);
    // Sin encuestas es una respuesta válida: hay lectura, no hay bandeja.
    expect(bandeja.cargada()).toBe(true);
    expect(bandeja.hayInvitaciones()).toBe(false);
  });

  it('las pendientes son las PENDING dentro del plazo (o sin plazo); vencidas y respondidas no', () => {
    const { bandeja } = montar();

    bandeja.refrescar();
    TestBed.inject(HttpTestingController)
      .expectOne(LECTURA)
      .flush([
        enElCable('i-1', 'PENDING', 3),
        enElCable('i-2', 'PENDING', null),
        enElCable('i-3', 'PENDING', -1),
        enElCable('i-4', 'ANSWERED'),
        enElCable('i-5', 'EXPIRED', -5),
      ]);

    expect(bandeja.pendientes()).toBe(2);
    expect(bandeja.hayInvitaciones()).toBe(true);
  });

  it('`refrescar` vuelve a pedir, y una lectura nueva reemplaza a la que seguía en vuelo', () => {
    const { bandeja, http } = montar();
    bandeja.refrescar();
    const primera = http.expectOne(LECTURA);

    bandeja.refrescar();
    expect(primera.cancelled).toBe(true);
    http.expectOne(LECTURA).flush([enElCable('i-1', 'ANSWERED')]);

    expect(bandeja.pendientes()).toBe(0);
    expect(bandeja.hayInvitaciones()).toBe(true);
  });

  it('`sincronizar` adopta lo que otra pantalla ya leyó, sin pedirlo de nuevo', () => {
    const { bandeja, http } = montar();

    bandeja.sincronizar([
      {
        id: 'i-1',
        title: 'T',
        status: 'PENDING',
        issuedAt: null,
        expiresAt: null,
        answeredAt: null,
        appointmentBookingId: 'bk-1',
      },
    ]);

    expect(bandeja.pendientes()).toBe(1);
    expect(bandeja.cargada()).toBe(true);
    http.expectNone(LECTURA);
  });

  it('si la lectura falla, la bandeja queda como estaba y no vuelve a intentar sola', () => {
    const { bandeja, http } = montar();
    bandeja.sincronizar([
      {
        id: 'i-1',
        title: 'T',
        status: 'PENDING',
        issuedAt: null,
        expiresAt: null,
        answeredAt: null,
        appointmentBookingId: 'bk-1',
      },
    ]);

    bandeja.refrescar();
    http.expectOne(LECTURA).flush({ message: 'boom' }, { status: 500, statusText: 'x' });

    expect(bandeja.pendientes()).toBe(1);
    http.expectNone(LECTURA);
  });

  it('`limpiar` olvida todo y cancela una lectura pendiente', () => {
    const { bandeja, http } = montar();
    bandeja.refrescar();
    const enVuelo = http.expectOne(LECTURA);

    bandeja.limpiar();

    expect(enVuelo.cancelled).toBe(true);
    expect(bandeja.hayInvitaciones()).toBe(false);
    expect(bandeja.cargada()).toBe(false);
  });

  it('bajo SSR no pide nada: no hay sesión de navegador', () => {
    const { bandeja, http } = montar('server');

    bandeja.cargarSiHaceFalta();
    bandeja.refrescar();

    http.expectNone(LECTURA);
    expect(bandeja.cargada()).toBe(false);
  });
});
