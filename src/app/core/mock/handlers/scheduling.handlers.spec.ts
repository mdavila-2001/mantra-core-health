import { HttpHeaders } from '@angular/common/http';

import { registrarAgenda } from './scheduling.handlers';
import {
  RECURSO_MEDICA,
  TIPO_CITA_RECONSULTA,
  recursos,
  reservas,
  type ReservaSimulada,
} from '../fixtures/agenda';
import { ESTADO_RESERVA } from '../fixtures/conceptos';
import { MEDICA, PACIENTE } from '../fixtures/personas';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * El doble de los bloqueos de agenda no puede ser más permisivo que el
 * contrato real: la API valida `exceptionType` contra la lista cerrada de 7
 * (`scheduling-catalog.dto.ts:735`, `@IsIn(EXCEPTION_TYPES)` en la 754).
 * Estos tests cubren los tres niveles del contrato (regla 65): correcto,
 * límite e inválido.
 */
describe('handlers de bloqueos de agenda (excepciones)', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  const medica = buscarUsuario('medica')!;

  function call<T>(method: MockMethod, path: string, body: unknown = {}): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: medica,
    });
    return (
      resultado !== null && typeof resultado === 'object' && 'status' in resultado && 'body' in resultado
        ? (resultado as { body: T }).body
        : resultado
    ) as T;
  }

  function estado(method: MockMethod, path: string, body: unknown = {}): number {
    const match = router.match(method, path)!;
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: medica,
    });
    return resultado !== null && typeof resultado === 'object' && 'status' in resultado ? (resultado as { status: number }).status : 200;
  }

  it('la lista de tipos de excepción tiene exactamente los 7 del contrato real', () => {
    const { items } = call<{ items: readonly { type: string }[] }>('GET', '/scheduling/exception-types');
    expect(items.map((i) => i.type)).toEqual(['ABSENCE', 'HOLIDAY', 'VACATION', 'CONFERENCE', 'ERRAND', 'EXTRA', 'OTHER']);
  });

  it('correcto — "otros servicios" viaja como OTHER + texto libre, sin ampliar el enum (H2.S1)', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    const creado = call<{ id: string; blockedSlots: number }>('POST', path, {
      exceptionType: 'OTHER',
      reason: 'Otros servicios',
      startAt: '2026-10-01T10:00:00.000Z',
      endAt: '2026-10-01T11:00:00.000Z',
    });
    expect(creado.id).toBeTypeOf('string');

    // La lectura de la lista NO trae `exceptionType` (lo saca a propósito el
    // manejador: `.map(({ resourceId: _r, exceptionType: _e, ...b }) => b)`),
    // así que el motivo se verifica por `reasonLabel`, como lo ve la agenda.
    const { items } = call<{ items: readonly { id: string; reason: string; reasonLabel: string }[] }>(
      'GET',
      `/scheduling/resources/${RECURSO_MEDICA}/exceptions`,
    );
    const propia = items.find((i) => i.id === creado.id)!;
    expect(propia.reason).toBe('Otros servicios');
    expect(propia.reasonLabel).toBe('Otro');
  });

  it('correcto — EXTRA (horario extra de Pablo) crea disponibilidad, no un bloqueo (H2.S2)', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    const creado = call<{ id: string; blockedSlots: number }>('POST', path, {
      exceptionType: 'EXTRA',
      startAt: '2026-10-02T18:00:00.000Z',
      endAt: '2026-10-02T19:00:00.000Z',
    });
    expect(creado.blockedSlots).toBe(0);

    const { items } = call<{ items: readonly { id: string; reasonLabel: string; isAvailable: boolean }[] }>(
      'GET',
      `/scheduling/resources/${RECURSO_MEDICA}/exceptions`,
    );
    const propia = items.find((i) => i.id === creado.id)!;
    expect(propia.reasonLabel).toBe('Horario extra');
    expect(propia.isAvailable).toBe(false); // isAvailable no viajó: el default es "no libera cupos", coherente con "no bloquea" != "es disponibilidad publicada"
  });

  /**
   * `isAvailable` viaja del cuerpo del pedido, NUNCA del tipo — verificado
   * contra `scheduling-catalog.service.ts:1299` de la API real:
   * `const isAvailable = dto.isAvailable ?? false;`, sin ninguna rama que lo
   * derive de `exceptionType`. El catálogo de tipos SÍ declara
   * `blocks: type !== 'EXTRA'` (línea 1249 del mismo archivo), pero es sólo
   * la etiqueta informativa de `GET /scheduling/exception-types` — no
   * determina el `isAvailable` de una excepción concreta. Derivarlo del tipo
   * en el simulador sería MÁS permisivo que la API real, no menos: abriría
   * disponibilidad sin que quien crea la excepción lo haya pedido.
   */
  it('isAvailable es del cuerpo del pedido, no se deriva del tipo (ni siquiera para EXTRA)', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    const creado = call<{ id: string }>('POST', path, {
      exceptionType: 'EXTRA',
      isAvailable: true,
      startAt: '2026-10-09T18:00:00.000Z',
      endAt: '2026-10-09T19:00:00.000Z',
    });
    const { items } = call<{ items: readonly { id: string; isAvailable: boolean }[] }>(
      'GET',
      `/scheduling/resources/${RECURSO_MEDICA}/exceptions`,
    );
    expect(items.find((i) => i.id === creado.id)?.isAvailable).toBe(true);
  });

  it('límite — una franja de 1 minuto se acepta', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(
      estado('POST', path, { exceptionType: 'EXTRA', startAt: '2026-10-03T08:00:00.000Z', endAt: '2026-10-03T08:01:00.000Z' }),
    ).toBe(201);
  });

  it('inválido — un exceptionType fuera de la lista de 7 se rechaza con 400 (contrato de forma, @IsIn), no se acepta en silencio', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(estado('POST', path, { exceptionType: 'SERVICE', startAt: '2026-10-04T08:00:00.000Z', endAt: '2026-10-04T09:00:00.000Z' })).toBe(
      400,
    );
  });

  it('inválido — OTHER sin reason se rechaza con 400 (precondición de negocio, no de forma)', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(estado('POST', path, { exceptionType: 'OTHER', startAt: '2026-10-04T08:00:00.000Z', endAt: '2026-10-04T09:00:00.000Z' })).toBe(
      400,
    );
    expect(
      estado('POST', path, { exceptionType: 'OTHER', reason: '   ', startAt: '2026-10-04T08:00:00.000Z', endAt: '2026-10-04T09:00:00.000Z' }),
    ).toBe(400);
  });

  it('correcto — ABSENCE, CONFERENCE y ERRAND NO exigen reason (requiresText sólo en OTHER)', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    for (const tipo of ['ABSENCE', 'CONFERENCE', 'ERRAND']) {
      expect(
        estado('POST', path, { exceptionType: tipo, startAt: '2026-10-08T08:00:00.000Z', endAt: '2026-10-08T09:00:00.000Z' }),
        tipo,
      ).toBe(201);
    }
  });

  it('inválido — una franja invertida (fin antes que inicio) se rechaza', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(
      estado('POST', path, { exceptionType: 'ABSENCE', startAt: '2026-10-05T10:00:00.000Z', endAt: '2026-10-05T09:00:00.000Z' }),
    ).toBe(400);
  });

  it('inválido — una franja de cero minutos se rechaza', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    expect(
      estado('POST', path, { exceptionType: 'ABSENCE', startAt: '2026-10-06T10:00:00.000Z', endAt: '2026-10-06T10:00:00.000Z' }),
    ).toBe(400);
  });

  it('PATCH también rechaza un exceptionType inválido, sin dejarlo pasar en silencio', () => {
    const path = `/scheduling/resources/${RECURSO_MEDICA}/exceptions`;
    const creado = call<{ id: string }>('POST', path, {
      exceptionType: 'HOLIDAY',
      startAt: '2026-10-07T08:00:00.000Z',
      endAt: '2026-10-07T09:00:00.000Z',
    });
    expect(estado('PATCH', `/scheduling/exceptions/${creado.id}`, { exceptionType: 'NOPE' })).toBe(400);
  });
});

/**
 * La reconsulta (C4): `POST /scheduling/appointments/direct` con `followUpOf`.
 *
 * Los seis casos del contrato —el correcto y los cinco rechazos— más las dos
 * lecturas que tienen que devolver el vínculo en los dos sentidos. Cubre los
 * tres niveles de la regla 65: correcto, límite (una reconsulta de una
 * reconsulta, y el horario justo en el pasado) e inválido (paciente ajeno,
 * agenda ajena, origen inexistente).
 */
describe('handlers de reconsulta (cita directa con followUpOf)', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  const medica = buscarUsuario('medica')!;

  interface Respuesta<T> {
    readonly status: number;
    readonly body: T;
  }

  function pedir<T>(
    method: MockMethod,
    path: string,
    body: unknown = {},
    query = new URLSearchParams(),
  ): Respuesta<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user: medica,
    });
    if (
      resultado !== null &&
      typeof resultado === 'object' &&
      'status' in resultado &&
      'body' in resultado
    ) {
      return resultado as Respuesta<T>;
    }
    return { status: 200, body: resultado as T };
  }

  /** Dentro de una semana, que es futuro y cae dentro de los +90 días. */
  function enUnaSemana(): string {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  /**
   * Una consulta ya atendida de la médica que todavía no tiene reconsulta.
   *
   * Se busca en vez de fijarse por índice: el generador de reservas reparte los
   * estados por posición, y un cambio suyo dejaría el test apuntando a una cita
   * cancelada sin que nada avisara. Cada caso toma la suya, así que ninguno
   * depende de que otro haya corrido antes.
   */
  function origenLibre(): ReservaSimulada {
    const ocupados = new Set(
      reservas
        .todos()
        .map((r) => r.followUpOf?.bookingId)
        .filter((id): id is string => id !== undefined),
    );
    const candidata = reservas
      .todos()
      .filter((r) => r.resourceId === RECURSO_MEDICA)
      .filter((r) => r.statusConceptId === ESTADO_RESERVA['BK-COMPLETED'])
      .filter((r) => new Date(r.startAt).getTime() < Date.now())
      .find((r) => !ocupados.has(r.id));
    if (candidata === undefined) {
      throw new Error('El fixture no tiene ninguna consulta atendida sin reconsulta');
    }
    return candidata;
  }

  function agendarReconsulta(
    origen: ReservaSimulada,
    cambios: Record<string, unknown> = {},
  ): Respuesta<{ bookingId: string }> {
    return pedir<{ bookingId: string }>('POST', '/scheduling/appointments/direct', {
      patientProfileId: origen.patientProfileId,
      resourceId: RECURSO_MEDICA,
      startAt: enUnaSemana(),
      durationMinutes: 30,
      followUpOf: { bookingId: origen.id, encounterId: null },
      ...cambios,
    });
  }

  it('la seed trae una reconsulta futura colgada de una consulta atendida', () => {
    const sembrada = reservas.todos().find((r) => r.typeConceptId === TIPO_CITA_RECONSULTA);
    expect(sembrada, 'el fixture tiene que sembrar una reconsulta').toBeDefined();
    expect(sembrada!.followUpOf).not.toBeNull();
    expect(new Date(sembrada!.startAt).getTime()).toBeGreaterThan(Date.now());
    expect(sembrada!.reasonText.startsWith('Reconsulta: ')).toBe(true);

    const origen = reservas.get(sembrada!.followUpOf!.bookingId);
    expect(origen, 'la cita de origen tiene que existir').toBeDefined();
    expect(origen!.patientProfileId).toBe(sembrada!.patientProfileId);
    expect(origen!.statusConceptId).toBe(ESTADO_RESERVA['BK-COMPLETED']);
    expect(new Date(origen!.startAt).getTime()).toBeLessThan(Date.now());
  });

  it('correcto — crea la reconsulta confirmada, con su tipo y su motivo heredado', () => {
    const origen = origenLibre();

    const { status, body } = agendarReconsulta(origen);

    expect(status).toBe(201);
    const creada = reservas.get(body.bookingId)!;
    expect(creada.statusConceptId).toBe(ESTADO_RESERVA['BK-CONFIRMED']);
    expect(creada.typeConceptId).toBe(TIPO_CITA_RECONSULTA);
    expect(creada.followUpOf).toEqual({ bookingId: origen.id, encounterId: null });
    expect(creada.reasonText).toBe(`Reconsulta: ${origen.reasonText}`);
  });

  it('correcto — el motivo que manda el bloque gana sobre el heredado, y el encuentro viaja', () => {
    const origen = origenLibre();

    const { body } = agendarReconsulta(origen, {
      reasonText: 'Reconsulta: traer el laboratorio',
      followUpOf: { bookingId: origen.id, encounterId: 'encuentro-de-la-consulta' },
    });

    const creada = reservas.get(body.bookingId)!;
    expect(creada.reasonText).toBe('Reconsulta: traer el laboratorio');
    expect(creada.followUpOf?.encounterId).toBe('encuentro-de-la-consulta');
  });

  it('404 — la cita de origen no existe', () => {
    const origen = origenLibre();

    const { status } = agendarReconsulta(origen, {
      followUpOf: { bookingId: 'no-existe-esta-cita', encounterId: null },
    });

    expect(status).toBe(404);
  });

  it('400 — el paciente no es el de la cita de origen', () => {
    const origen = origenLibre();
    const otro = reservas.todos().find((r) => r.patientProfileId !== origen.patientProfileId)!;

    const { status } = agendarReconsulta(origen, { patientProfileId: otro.patientProfileId });

    expect(status).toBe(400);
  });

  it('400 — el horario no es futuro, y el límite es AHORA y no el día de hoy', () => {
    const origen = origenLibre();

    expect(
      agendarReconsulta(origen, { startAt: new Date(Date.now() - 60_000).toISOString() }).status,
    ).toBe(400);
    // El límite exacto: un instante que pasó por un segundo tampoco entra.
    expect(
      agendarReconsulta(origen, { startAt: new Date(Date.now() - 1_000).toISOString() }).status,
    ).toBe(400);
  });

  it('403 — la agenda no es del profesional de la sesión', () => {
    const origen = origenLibre();
    const ajena = recursos.todos().find((r) => r.resourceRefId !== MEDICA.id)!;

    const { status } = agendarReconsulta(origen, { resourceId: ajena.id });

    expect(status).toBe(403);
  });

  it('409 — la segunda reconsulta de la misma consulta se rechaza, diciendo cuál ya hay', () => {
    const origen = origenLibre();

    const primera = agendarReconsulta(origen);
    expect(primera.status).toBe(201);

    const segunda = agendarReconsulta(origen);

    expect(segunda.status).toBe(409);
    const conflicto = segunda.body as unknown as { details: { bookingId: string } };
    expect(conflicto.details.bookingId).toBe(primera.body.bookingId);
  });

  it('límite — una reconsulta de una reconsulta se admite', () => {
    const origen = origenLibre();
    const primera = reservas.get(agendarReconsulta(origen).body.bookingId)!;

    const segunda = pedir<{ bookingId: string }>('POST', '/scheduling/appointments/direct', {
      patientProfileId: primera.patientProfileId,
      resourceId: RECURSO_MEDICA,
      startAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      reasonText: primera.reasonText,
      followUpOf: { bookingId: primera.id, encounterId: null },
    });

    expect(segunda.status).toBe(201);
    expect(reservas.get(segunda.body.bookingId)!.followUpOf?.bookingId).toBe(primera.id);
  });

  it('una cita directa SIN followUpOf se sigue creando como antes, y sin 403', () => {
    const ajena = recursos.todos().find((r) => r.resourceRefId !== MEDICA.id)!;

    const { status, body } = pedir<{ bookingId: string }>(
      'POST',
      '/scheduling/appointments/direct',
      {
        patientProfileId: PACIENTE.id,
        resourceId: ajena.id,
        startAt: enUnaSemana(),
        durationMinutes: 30,
        reasonText: 'Cita puntual de siempre',
      },
    );

    expect(status).toBe(201);
    const creada = reservas.get(body.bookingId)!;
    expect(creada.followUpOf).toBeNull();
    expect(creada.typeConceptId).not.toBe(TIPO_CITA_RECONSULTA);
  });

  it('GET /scheduling/bookings trae followUpOf en la reconsulta y followUpBookingId en su origen', () => {
    const origen = origenLibre();
    const { body } = agendarReconsulta(origen);

    const listado = pedir<{
      items: readonly { id: string; followUpOf: unknown; followUpBookingId: string | null }[];
    }>(
      'GET',
      '/scheduling/bookings',
      {},
      new URLSearchParams({ resourceId: RECURSO_MEDICA, limit: '2000', includeCancelled: 'true' }),
    );

    const reconsulta = listado.body.items.find((i) => i.id === body.bookingId)!;
    // La lectura resuelve **cuándo** fue la consulta de origen, que es lo que
    // el contrato declara en `FollowUpOriginRef.startAt` y lo que permite decir
    // «de la cita del 12 de septiembre» sin una petición por fila.
    expect(reconsulta.followUpOf).toEqual({
      bookingId: origen.id,
      encounterId: null,
      startAt: origen.startAt,
    });

    const laDeOrigen = listado.body.items.find((i) => i.id === origen.id)!;
    expect(laDeOrigen.followUpBookingId).toBe(body.bookingId);
  });

  it('GET /scheduling/bookings/:id trae los dos campos, y null cuando no hay reconsulta', () => {
    const origen = origenLibre();
    const { body } = agendarReconsulta(origen);

    const detalle = pedir<{ followUpOf: unknown; followUpBookingId: string | null }>(
      'GET',
      `/scheduling/bookings/${body.bookingId}`,
    );
    expect(detalle.body.followUpOf).toEqual({
      bookingId: origen.id,
      encounterId: null,
      startAt: origen.startAt,
    });
    // La reconsulta recién creada no tiene todavía una propia.
    expect(detalle.body.followUpBookingId).toBeNull();

    const deOrigen = pedir<{ followUpBookingId: string | null }>(
      'GET',
      `/scheduling/bookings/${origen.id}`,
    );
    expect(deOrigen.body.followUpBookingId).toBe(body.bookingId);
  });

  it('cancelar la reconsulta libera la consulta de origen: se puede agendar otra', () => {
    const origen = origenLibre();
    const primera = agendarReconsulta(origen);

    pedir('POST', `/scheduling/bookings/${primera.body.bookingId}/cancel`, {
      cancelledBy: 'PROVIDER',
      reasonText: 'Se acordó otra fecha',
    });

    expect(agendarReconsulta(origen).status).toBe(201);
  });
});
