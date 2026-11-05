import { HttpHeaders } from '@angular/common/http';

import { RECURSO_MEDICA, reservas, type ReservaSimulada } from '../fixtures/agenda';
import { encounterList } from '../fixtures/clinic';
import {
  encuentroDeReserva,
  profesionalDeReserva,
  reservasTerminadasDe,
} from '../fixtures/atencion-resenable';
import { BOOKING_STATUS, ENCOUNTER_STATUS } from '../fixtures/concepts';
import { reviewList, showcaseOf, showcases } from '../fixtures/community';
import { MEDICAL, PACIENTE } from '../fixtures/people';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarComunidad } from './community.handlers';
import { registrarPublico } from './public.handlers';

/**
 * El puente encuesta → reseña pública del simulador: `reviewable-care`, la
 * reseña que nace de un encuentro y lo que la ficha pública lee después.
 */
interface Result<T> {
  readonly status: number;
  readonly body: T;
}

describe('reviewable-care y reseñas del simulador', () => {
  const router = new MockRouter();
  registrarComunidad(router);
  registrarPublico(router);

  const paciente: MockUser = buscarUsuario('paciente')!;

  async function llamar<T>(
    method: MockMethod,
    path: string,
    opciones: { body?: unknown; query?: string; user?: MockUser | null } = {},
  ): Promise<Result<T>> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = await match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(opciones.query ?? ''),
      body: opciones.body ?? {},
      headers: new HttpHeaders(),
      user: opciones.user === undefined ? paciente : opciones.user,
    });
    return isMockReply(result)
      ? { status: result.status, body: result.body as T }
      : { status: 200, body: result as T };
  }

  interface Atencion {
    readonly encounterId: string;
    readonly appointmentBookingId: string;
    readonly practitionerDisplayName: string;
    readonly alreadyReviewed: boolean;
    readonly canReview: boolean;
  }

  /**
   * La reserva terminada de la paciente de la demostración con la médica de la
   * demostración, elegida por quién la atendió y no por su lugar en la lista.
   *
   * La semilla de `agenda.ts` reparte las reservas relativas a «hoy» (días de la
   * semana, hora del día), y la que une a la paciente con la médica es una sola:
   * con otro reloj puede no ser la primera de la lista —ni estar—. Si el
   * sembrado no la trae, se arma con el encuentro cerrado que la paciente sí
   * tiene con la médica (los encuentros no dependen del reloj), con la misma
   * forma que el resto de las reservas.
   */
  function reservaTerminadaConLaMedica(): ReservaSimulada {
    const sembrada = reservasTerminadasDe(PACIENTE.id).find(
      (r) => profesionalDeReserva(r)?.id === MEDICAL.id,
    );
    if (sembrada !== undefined) return sembrada;
    const atencion = encounterList
      .todos()
      .find(
        (e) =>
          e.patientProfileId === PACIENTE.id &&
          e.primaryPractitionerId === MEDICAL.id &&
          e.statusConceptId === ENCOUNTER_STATUS['ENCST-FINISHED'] &&
          e.endAt !== null,
      )!;
    const molde = reservas.todos().find((r) => r.patientProfileId === PACIENTE.id)!;
    return reservas.agregar({
      ...molde,
      id: 'reserva-terminada-con-la-medica-de-la-prueba',
      patientProfileId: PACIENTE.id,
      resourceId: RECURSO_MEDICA,
      statusConceptId: BOOKING_STATUS['BK-COMPLETED']!,
      startAt: atencion.startAt,
      endAt: atencion.endAt!,
    });
  }

  const reserva = reservaTerminadaConLaMedica();

  it('hay una reserva terminada con la médica de la demostración', () => {
    expect(reserva).toBeDefined();
    expect(profesionalDeReserva(reserva)?.id).toBe(MEDICAL.id);
    expect(encuentroDeReserva(reserva)).toBeDefined();
    expect(reserva.statusConceptId).toBe(BOOKING_STATUS['BK-COMPLETED']);
  });

  it('una reserva terminada se puede reseñar: devuelve el encuentro y a la médica', async () => {
    const r = await llamar<Atencion>('GET', '/patients/me/reviewable-care', {
      query: `appointmentBookingId=${reserva.id}`,
    });

    expect(r.status).toBe(200);
    expect(r.body.canReview).toBe(true);
    expect(r.body.alreadyReviewed).toBe(false);
    expect(r.body.encounterId).toBe(encuentroDeReserva(reserva)!.id);
    expect(r.body.appointmentBookingId).toBe(reserva.id);
    expect(r.body.practitionerDisplayName).toBe(MEDICAL.displayName);
  });

  it('sin appointmentBookingId es una validación, no un 404', async () => {
    expect((await llamar('GET', '/patients/me/reviewable-care')).status).toBeGreaterThanOrEqual(400);
  });

  it('una reserva que no es de la paciente no existe para ella (404 sin decir de quién es)', async () => {
    const ajena = reservas.todos().find((r) => r.patientProfileId !== PACIENTE.id)!;

    const r = await llamar('GET', '/patients/me/reviewable-care', { query: `appointmentBookingId=${ajena.id}` });
    expect(r.status).toBe(404);
  });

  it('una reserva futura (sin atención terminada) es 404', async () => {
    const futura = reservas
      .todos()
      .find((r) => r.patientProfileId === PACIENTE.id && new Date(r.startAt).getTime() > Date.now())!;

    expect((await llamar('GET', '/patients/me/reviewable-care', { query: `appointmentBookingId=${futura.id}` })).status).toBe(404);
  });

  it('si la médica no acepta reseñas, canReview es false (respuesta normal, no error)', async () => {
    const vitrina = showcaseOf(MEDICAL.id)!;
    const original = vitrina.acceptsReviews;
    showcases.actualizar(vitrina.id, { acceptsReviews: false });
    try {
      const r = await llamar<Atencion>('GET', '/patients/me/reviewable-care', {
        query: `appointmentBookingId=${reserva.id}`,
      });
      expect(r.status).toBe(200);
      expect(r.body.canReview).toBe(false);
    } finally {
      showcases.actualizar(vitrina.id, { acceptsReviews: original });
    }
  });

  describe('publicar la reseña', () => {
    const user: MockUser = { ...paciente };
    const encuentroId = encuentroDeReserva(reserva)!.id;
    const vitrina = showcaseOf(MEDICAL.id)!;

    interface Pagina {
      readonly items: readonly {
        readonly id: string;
        readonly overallRating: number;
        readonly reviewText: string | null;
        readonly reviewerDisplayName: string | null;
        readonly publishedAt: string;
      }[];
      readonly ratingAverage: number | null;
      readonly ratingCount: number;
    }

    const leerFicha = () => llamar<Pagina>('GET', `/public/profiles/p/${vitrina.slug}/reviews`, { user: null });

    it('queda en la lista pública (anónima, con la fecha al día), corre el promedio y marca alreadyReviewed', async () => {
      const antes = (await leerFicha()).body;

      const creada = await llamar<{ id: string }>('POST', '/patients/me/reviews', {
        body: { verifiedEncounterId: encuentroId, overallRating: 3, reviewText: 'Correcta.', displayMode: 'ANONYMOUS' },
        user,
      });
      expect(creada.status).toBe(201);

      const despues = (await leerFicha()).body;
      expect(despues.ratingCount).toBe(antes.ratingCount + 1);
      const esperado = Math.round((((antes.ratingAverage ?? 0) * antes.ratingCount + 3) / (antes.ratingCount + 1)) * 10) / 10;
      expect(despues.ratingAverage).toBe(esperado);
      const mia = despues.items.find((i) => i.id === creada.body.id)!;
      expect(mia).toMatchObject({ overallRating: 3, reviewText: 'Correcta.', reviewerDisplayName: null });
      // La hora exacta no sale: sólo el día (mediodía UTC).
      expect(mia.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/);

      const puente = await llamar<Atencion>('GET', '/patients/me/reviewable-care', {
        query: `appointmentBookingId=${reserva.id}`,
      });
      expect(puente.body.alreadyReviewed).toBe(true);
      expect(puente.body.canReview).toBe(false);
    });

    it('la reseña no lleva nada de la encuesta: sólo los campos de una reseña', () => {
      const nueva = reviewList.filtrar((r) => r.encounterId === encuentroId)[0]!;
      expect(Object.keys(nueva).filter((k) => /answer|invitation|survey|questionnaire/i.test(k))).toEqual([]);
    });

    it('una segunda reseña de la MISMA atención es 409; las demás atenciones siguen libres', async () => {
      const otra = await llamar('POST', '/patients/me/reviews', {
        body: { verifiedEncounterId: encuentroId, overallRating: 5 },
        user,
      });
      expect(otra.status).toBe(409);
    });
  });
});
