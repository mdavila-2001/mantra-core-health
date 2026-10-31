import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import {
  ID_TIPO_ATENCION_CONSULTA,
  TIPO_DESTINO_CONSULTAS,
} from '../../data-access/surveys/surveys-targets';
import type { SurveyInsights } from '../../data-access/surveys/surveys.types';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarEncuestas } from './surveys-forms.handlers';
import {
  generarEnviosBase,
  PREGUNTAS_BASE_CONSULTA,
  PREGUNTAS_BASE_SERVICIO,
} from './surveys-insights.simulator';

/**
 * El simulador de `GET /surveys/insights` y de `POST /surveys/assignments`.
 *
 * Lo que fija: las preguntas base son las del banco, hay respuestas de sobra para
 * que el resumen sea creíble, y el resumen se CALCULA de ellas (no es un número
 * escrito aparte: si cambian los datos, cambia el resumen y sigue cuadrando).
 */
describe('simulador de encuestas: resumen del médico y asociación', () => {
  const router = new MockRouter();
  registrarEncuestas(router);
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;

  interface Respuesta<T> {
    readonly status: number;
    readonly body: T;
  }

  function llamar<T = unknown>(
    method: MockMethod,
    path: string,
    quien = medica,
    body: unknown = {},
    query = new URLSearchParams(),
  ): Respuesta<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({ method, path, params: match.params, query, body, headers: new HttpHeaders(), user: quien });
    if (resultado !== null && typeof resultado === 'object' && 'status' in resultado && 'body' in resultado) {
      return resultado as Respuesta<T>;
    }
    return { status: 200, body: resultado as T };
  }

  /** Los presets del front, como meses calendario: núcleo/mock no importa de features/. */
  type PeriodoId = 'mes' | '3m' | '12m';
  const MESES: Readonly<Record<PeriodoId, number>> = { mes: 1, '3m': 3, '12m': 12 };
  const rangoDe = (periodo: PeriodoId): { from: string; to: string } => {
    const hoy = new Date();
    const dos = (n: number): string => String(n).padStart(2, '0');
    const dia = (f: Date): string => `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
    return {
      from: dia(new Date(hoy.getFullYear(), hoy.getMonth() - (MESES[periodo] - 1), 1)),
      to: dia(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
    };
  };
  const insights = (periodo: PeriodoId, serviceId?: string): Respuesta<SurveyInsights> => {
    const { from, to } = rangoDe(periodo);
    return llamar<SurveyInsights>(
      'GET',
      '/surveys/insights',
      medica,
      {},
      new URLSearchParams({ from, to, ...(serviceId === undefined ? {} : { serviceId }) }),
    );
  };
  const consulta = (from: string, to: string): Respuesta<SurveyInsights> =>
    llamar<SurveyInsights>('GET', '/surveys/insights', medica, {}, new URLSearchParams({ from, to }));

  describe('encuesta base', () => {
    it('consulta (v2): doce preguntas, obligatorias salvo la medicación y el comentario', () => {
      expect(PREGUNTAS_BASE_CONSULTA).toHaveLength(12);
      expect(PREGUNTAS_BASE_CONSULTA.filter((p) => !p.required).map((p) => p.dimension)).toEqual([
        'revision_medicacion',
        'comentario_abierto',
      ]);
      expect(PREGUNTAS_BASE_CONSULTA[11]).toMatchObject({ answerType: 'TEXT', required: false });
    });

    it('servicio: siete preguntas, todas opcionales', () => {
      expect(PREGUNTAS_BASE_SERVICIO).toHaveLength(7);
      expect(PREGUNTAS_BASE_SERVICIO.some((p) => p.required)).toBe(false);
    });

    it('lleva el texto EXACTO del banco y marca el origen SYSTEM', () => {
      expect(PREGUNTAS_BASE_CONSULTA[1]!.questionText).toBe(
        'Desde la hora acordada, ¿cuánto tiempo esperó hasta que comenzó su consulta? Incluya la espera en sala o en la videollamada.',
      );
      expect(PREGUNTAS_BASE_CONSULTA[1]!.options).toEqual([
        'Menos de 15 minutos',
        'De 15 a 30 minutos',
        'De 31 a 60 minutos',
        'Más de 1 hora',
        'No lo recuerdo',
      ]);
      expect(PREGUNTAS_BASE_CONSULTA[10]).toMatchObject({ scaleMin: 0, scaleMax: 10, dimension: 'recomendacion_nps' });
      expect(PREGUNTAS_BASE_CONSULTA[8]!.options![1]).toBe('Sí, y deseo que ALOVIDA me contacte para dar seguimiento');
      expect(PREGUNTAS_BASE_SERVICIO[0]!.questionText).toBe(
        'Desde la hora acordada (o desde que llegó, si no tenía hora), ¿cuánto esperó hasta que le atendieron?',
      );
      expect([...PREGUNTAS_BASE_CONSULTA, ...PREGUNTAS_BASE_SERVICIO].every((p) => p.source === 'SYSTEM')).toBe(true);
    });
  });

  describe('datos simulados', () => {
    it('hay al menos 30 respuestas en el año, con un NPS mixto y comentarios', () => {
      const anual = insights('12m').body;
      expect(anual.totals.answered).toBeGreaterThanOrEqual(30);
      expect(anual.totals.issued).toBeGreaterThan(anual.totals.answered);
      expect(anual.nps.promoters).toBeGreaterThan(0);
      expect(anual.nps.passives).toBeGreaterThan(0);
      expect(anual.nps.detractors).toBeGreaterThan(0);
      // Con 5 o más comentarios en el alcance, el servidor los manda.
      expect(anual.comments.length).toBeGreaterThanOrEqual(5);
    });

    it('los envíos son deterministas: dos lecturas dan lo mismo', () => {
      expect(insights('3m').body).toEqual(insights('3m').body);
      expect(generarEnviosBase().map((e) => e.id)).toEqual(generarEnviosBase().map((e) => e.id));
    });
  });

  describe('el resumen se calcula de los datos y cuadra consigo mismo', () => {
    const anual = insights('12m').body;

    it('el NPS es %promotores − %detractores sobre n', () => {
      const { promoters, passives, detractors, n, value } = anual.nps;
      expect(promoters + passives + detractors).toBe(n);
      expect(value).toBe(Math.round(((promoters - detractors) / n) * 100));
    });

    it('la distribución de cada escala suma n y el promedio sale de ella', () => {
      for (const p of anual.byQuestion.filter((q) => q.answerType === 'SCALE' && q.n > 0)) {
        const suma = p.distribution.reduce((a, b) => a + b.count, 0);
        expect(suma, p.text).toBe(p.n);
        const media = p.distribution.reduce((a, b) => a + b.value * b.count, 0) / p.n;
        expect(p.average!).toBeCloseTo(media, 1);
      }
    });

    it('las opciones de una elección suman n', () => {
      const espera = anual.byQuestion.find((q) => q.dimension === 'tiempo_espera' && q.answerType === 'SINGLE_CHOICE')!;
      expect(espera.optionCounts.reduce((a, b) => a + b.count, 0)).toBe(espera.n);
    });

    it('la tendencia suma las respuestas del período', () => {
      expect(anual.trend.reduce((a, b) => a + b.answered, 0)).toBe(anual.totals.answered);
      // Un año se agrupa por meses.
      expect(anual.trend.every((t) => /^\d{4}-\d{2}$/.test(t.period))).toBe(true);
      // Tres meses o menos se agrupan por semanas (su lunes).
      expect(insights('3m').body.trend.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.period))).toBe(true);
    });

    it('un período más corto nunca tiene más respuestas que uno más largo', () => {
      const a30 = insights('mes').body.totals.answered; // depende del día del mes: sólo se compara
      const a90 = insights('3m').body.totals.answered;
      expect(a30).toBeLessThanOrEqual(a90);
      expect(a90).toBeLessThanOrEqual(anual.totals.answered);
    });
  });

  describe('privacidad del agregado', () => {
    it('no trae ningún identificador de paciente, reserva ni invitación', () => {
      const crudo = JSON.stringify(insights('12m').body);
      for (const clave of ['patient', 'booking', 'invitation', 'appointment', 'userId', 'email']) {
        expect(crudo.toLowerCase(), clave).not.toContain(clave.toLowerCase());
      }
    });

    it('los comentarios llevan SÓLO el texto: ni día, ni mes, ni ninguna otra clave', () => {
      const comentarios = insights('12m').body.comments;
      expect(comentarios.length).toBeGreaterThan(0);
      for (const c of comentarios) expect(Object.keys(c)).toEqual(['text']);
    });

    it('van mezclados: su orden no sigue a las fechas de respuesta', () => {
      // Dos lecturas del mismo alcance dan el mismo orden (estable), pero ese orden
      // no es el cronológico: se arma por un hash del texto.
      const a = insights('12m').body.comments.map((c) => c.text);
      const b = insights('12m').body.comments.map((c) => c.text);
      expect(a).toEqual(b);
      const alfabetico = [...a].sort((x, y) => x.localeCompare(y, 'es'));
      expect(a).not.toEqual(alfabetico);
    });

    it('con menos de 5 comentarios en el alcance NO se manda ninguno', () => {
      // Un servicio con pocas respuestas cabe aunque tenga comentarios: el texto de
      // una sola persona la señala. (Suprimido o no, el array viene vacío.)
      const holter = insights('12m', uuid('service-HOLTER')).body;
      expect(holter.comments.length === 0 || holter.comments.length >= 5).toBe(true);
    });

    it('un paciente no lo puede leer', () => {
      expect(llamar('GET', '/surveys/insights', paciente, {}, new URLSearchParams({ from: rangoDe('mes').from, to: rangoDe('mes').to })).status).toBe(403);
    });
  });

  describe('filtro por servicio', () => {
    const ecg = uuid('service-ECG');
    const holter = uuid('service-HOLTER');
    const esfuerzo = uuid('service-ERGO');

    it('sólo cuenta los envíos de ese servicio y usa las preguntas de servicio', () => {
      const delServicio = insights('12m', ecg).body;
      const todo = insights('12m').body;
      expect(delServicio.totals.issued).toBeGreaterThan(0);
      expect(delServicio.totals.answered).toBeLessThan(todo.totals.answered);
      const textos = new Set(PREGUNTAS_BASE_SERVICIO.map((p) => p.questionText));
      expect(delServicio.byQuestion.every((q) => textos.has(q.text))).toBe(true);
    });

    it('un servicio con menos de 5 respuestas devuelve SÓLO los totales y suppressed', () => {
      const poco = insights('12m', esfuerzo).body;
      expect(poco.totals.answered).toBeGreaterThan(0);
      expect(poco.totals.answered).toBeLessThan(5);
      expect(poco.privacy).toEqual({ minCohort: 5, suppressed: true });
      // Nada que permita señalar a alguien: ni NPS, ni preguntas, ni tendencia, ni comentarios.
      expect(poco.nps).toEqual({ value: null, promoters: 0, passives: 0, detractors: 0, n: 0 });
      expect(poco.byQuestion).toEqual([]);
      expect(poco.trend).toEqual([]);
      expect(poco.safetyAlerts.n).toBe(0);
      expect(poco.comments).toEqual([]);
    });

    it('con 5 o más respuestas el resumen sale completo y suppressed es false', () => {
      const completo = insights('12m', ecg).body;
      expect(completo.totals.answered).toBeGreaterThanOrEqual(5);
      expect(completo.privacy).toEqual({ minCohort: 5, suppressed: false });
      expect(completo.byQuestion.length).toBeGreaterThan(0);
    });

    it('la regla se aplica al alcance FILTRADO: el mismo servicio puede estar suprimido en un período y completo en otro', () => {
      const esteMes = insights('mes', ecg).body;
      const delAnio = insights('12m', ecg).body;
      expect(delAnio.privacy.suppressed).toBe(false);
      // Con 11 envíos en el año, un solo mes no llega a 5 respuestas.
      expect(esteMes.privacy.suppressed).toBe(esteMes.totals.answered < 5);
    });

    it('una pregunta con menos de 5 respuestas llega suprimida, sin distribución ni promedio', () => {
      // En el año de ECG hay ≥ 5 respuestas en total, pero las preguntas opcionales
      // que algunos saltean pueden quedar por debajo.
      const preguntas = insights('12m', ecg).body.byQuestion;
      for (const q of preguntas.filter((x) => x.suppressed)) {
        expect(q.distribution).toEqual([]);
        expect(q.optionCounts).toEqual([]);
        expect(q.average).toBeNull();
        expect(q.n).toBe(0);
      }
      for (const q of preguntas.filter((x) => !x.suppressed)) expect(q.n).toBeGreaterThanOrEqual(5);
    });

    it('el NPS de menos de 5 personas llega sin valor (n = 0)', () => {
      const nps = insights('mes', ecg).body.nps;
      if (nps.value === null) expect(nps).toEqual({ value: null, promoters: 0, passives: 0, detractors: 0, n: 0 });
      else expect(nps.n).toBeGreaterThanOrEqual(5);
    });

    it('la demo completa (≥ 30 respuestas) muestra el resumen entero', () => {
      const todo = insights('12m').body;
      expect(todo.privacy.suppressed).toBe(false);
      expect(todo.totals.answered).toBeGreaterThanOrEqual(30);
    });

    it('un servicio sin envíos da un resumen vacío bien formado (n = 0, NPS sin valor)', () => {
      const vacio = insights('12m', uuid('service-sin-envios')).body;
      expect(vacio.privacy.suppressed).toBe(true);
      expect(vacio.totals).toMatchObject({ issued: 0, answered: 0, responseRate: 0 });
      expect(vacio.nps).toEqual({ value: null, promoters: 0, passives: 0, detractors: 0, n: 0 });
      expect(vacio.byQuestion).toEqual([]);
      expect(vacio.comments).toEqual([]);
    });

    it('Holter queda entre uno y varios: la suma de los servicios no pasa del total', () => {
      const suma = [ecg, holter, esfuerzo, uuid('service-ECO-DOPPLER')].reduce((a, id) => a + insights('12m', id).body.totals.answered, 0);
      expect(suma).toBeLessThanOrEqual(insights('12m').body.totals.answered);
    });
  });

  describe('validación de la consulta', () => {
    it('sin from/to o con fechas mal formadas es un 400', () => {
      expect(llamar('GET', '/surveys/insights', medica, {}, new URLSearchParams()).status).toBe(400);
      expect(consulta('ayer', '2026-10-31').status).toBe(400);
    });

    it('no hay rangos libres: from es día 1 y to es el último día de un mes', () => {
      expect(consulta('2026-10-05', '2026-10-31').status).toBe(400);
      expect(consulta('2026-10-01', '2026-10-30').status).toBe(400);
      expect(consulta('2026-10-01', '2026-10-31').status).toBe(200);
      // El fin de febrero también cuenta.
      expect(consulta('2026-02-01', '2026-02-28').status).toBe(200);
    });

    it('a lo sumo 12 meses, y from no puede ser posterior a to', () => {
      expect(consulta('2025-10-01', '2026-10-31').status).toBe(400); // 13 meses
      expect(consulta('2025-11-01', '2026-10-31').status).toBe(200); // 12 meses
      expect(consulta('2026-10-01', '2026-09-30').status).toBe(400);
    });

    it('los tres presets del front son rangos válidos', () => {
      for (const p of ['mes', '3m', '12m'] as const) expect(insights(p).status, p).toBe(200);
    });
  });

  describe('asociar a un servicio', () => {
    const publicada = uuid('survey-teleconsulta-v1');
    const borrador = uuid('survey-borrador-v1');
    const asociar = (surveyVersionId: string, targetType: string, targetId: string) =>
      llamar<{ id?: string }>('POST', '/surveys/assignments', medica, { surveyVersionId, targetType, targetId });

    it('un servicio que el médico ofrece se guarda y la ficha lo vuelve a leer', () => {
      const ecg = uuid('service-ECG');
      const antes = llamar<{ assignments: { targetId: string }[] }>('GET', `/surveys/templates/${uuid('survey-teleconsulta')}`).body.assignments;
      expect(antes.some((a) => a.targetId === ecg)).toBe(false);

      expect(asociar(publicada, 'SERVICE', ecg).status).toBe(201);

      const despues = llamar<{ assignments: { targetType: string; targetId: string }[] }>('GET', `/surveys/templates/${uuid('survey-teleconsulta')}`).body.assignments;
      expect(despues).toContainEqual(expect.objectContaining({ targetType: 'SERVICE', targetId: ecg }));
    });

    it('repetir el mismo destino es un 409', () => {
      const holter = uuid('service-HOLTER');
      expect(asociar(publicada, 'SERVICE', holter).status).toBe(201);
      expect(asociar(publicada, 'SERVICE', holter).status).toBe(409);
    });

    it('«Todas mis consultas» (CARE_TYPE) se acepta sólo con el tipo de atención consulta', () => {
      expect(asociar(publicada, TIPO_DESTINO_CONSULTAS, uuid('otro-tipo')).status).toBe(422);
      // La encuesta de satisfacción ya la tiene de fábrica.
      expect(asociar(uuid('survey-satisfaccion-v2'), TIPO_DESTINO_CONSULTAS, ID_TIPO_ATENCION_CONSULTA).status).toBe(409);
    });

    it('un servicio que no ofrece, una versión sin publicar y un id mal formado se rechazan', () => {
      expect(asociar(publicada, 'SERVICE', uuid('servicio-ajeno')).status).toBe(404);
      expect(asociar(borrador, 'SERVICE', uuid('service-ECG')).status).toBe(422);
      expect(asociar(publicada, 'SERVICE', 'no-es-un-uuid').status).toBe(400);
    });
  });

  describe('emisión automática de la encuesta base al completar una atención', () => {
    const emisora = buscarUsuario('medica')!;
    // Las invitaciones son memoria del módulo y el corredor no aísla los archivos de un mismo worker (`isolate: false`): las que
    // otro archivo emitió al completar consultas agotaban las reservas «sin invitación» que estas pruebas necesitan.
    beforeAll(async () => {
      const { reiniciarLasInvitacionesDeEncuesta } = await import('./surveys-forms.handlers');
      reiniciarLasInvitacionesDeEncuesta();
    });
    const registro = new MockRouter();
    registrarEncuestas(registro);

    const invitacionesDeLaPaciente = (): { id: string; title: string; appointmentBookingId: string; status: string }[] => {
      const match = registro.match('GET', '/surveys/me/invitations')!;
      return match.handler({ method: 'GET', path: '/surveys/me/invitations', params: match.params, query: new URLSearchParams(), body: {}, headers: new HttpHeaders(), user: paciente }) as never;
    };

    it('la consulta completada emite la encuesta base de CONSULTA, con todas sus preguntas y source SYSTEM', async () => {
      const { emitirInvitacionDeAtencion } = await import('./surveys-forms.handlers');
      const { reservas } = await import('../fixtures/agenda');
      // Una consulta de la paciente que todavía no tenga invitación (las sembradas ya la tienen).
      const conInvitacion = new Set(invitacionesDeLaPaciente().map((i) => i.appointmentBookingId));
      const consulta = reservas.todos().find((r) => r.patientProfileId === paciente.patientProfileId && (r.serviceOfferingId ?? null) === null && !conInvitacion.has(r.id))!;
      const antes = invitacionesDeLaPaciente().length;
      emitirInvitacionDeAtencion(consulta.id);
      const nuevas = invitacionesDeLaPaciente().filter((i) => i.appointmentBookingId === consulta.id);
      expect(nuevas).toHaveLength(1);
      expect(nuevas[0]!.title).toBe('Encuesta de su consulta médica');
      expect(nuevas[0]!.status).toBe('PENDING');
      expect(invitacionesDeLaPaciente().length).toBeGreaterThanOrEqual(antes);

      const match = registro.match('GET', `/surveys/me/invitations/${nuevas[0]!.id}`)!;
      const detalle = match.handler({ method: 'GET', path: '', params: match.params, query: new URLSearchParams(), body: {}, headers: new HttpHeaders(), user: paciente }) as { questions: { source?: string; required: boolean }[] };
      expect(detalle.questions).toHaveLength(PREGUNTAS_BASE_CONSULTA.length);
      expect(detalle.questions.every((q) => q.source === 'SYSTEM')).toBe(true);
      expect(detalle.questions.filter((q) => q.required)).toHaveLength(PREGUNTAS_BASE_CONSULTA.filter((q) => q.required).length);
    });

    it('es idempotente por reserva: completar dos veces no emite dos veces', async () => {
      const { emitirInvitacionDeAtencion } = await import('./surveys-forms.handlers');
      const { reservas } = await import('../fixtures/agenda');
      const conInvitacion = new Set(invitacionesDeLaPaciente().map((i) => i.appointmentBookingId));
      const otra = reservas.todos().filter((r) => r.patientProfileId === paciente.patientProfileId && (r.serviceOfferingId ?? null) === null && !conInvitacion.has(r.id))[1]!;
      emitirInvitacionDeAtencion(otra.id);
      emitirInvitacionDeAtencion(otra.id);
      expect(invitacionesDeLaPaciente().filter((i) => i.appointmentBookingId === otra.id)).toHaveLength(1);
    });

    it('reiniciar las invitaciones borra las que se emitieron y deja las de fábrica', async () => {
      const { emitirInvitacionDeAtencion, reiniciarLasInvitacionesDeEncuesta } = await import('./surveys-forms.handlers');
      const { reservas } = await import('../fixtures/agenda');
      reiniciarLasInvitacionesDeEncuesta();
      const deFabrica = invitacionesDeLaPaciente().length;
      const conInvitacion = new Set(invitacionesDeLaPaciente().map((i) => i.appointmentBookingId));
      const candidata = reservas.todos().find((r) => r.patientProfileId === paciente.patientProfileId && !conInvitacion.has(r.id))!;
      emitirInvitacionDeAtencion(candidata.id);
      expect(invitacionesDeLaPaciente().length).toBe(deFabrica + 1);
      reiniciarLasInvitacionesDeEncuesta();
      expect(invitacionesDeLaPaciente().length).toBe(deFabrica);
      expect(invitacionesDeLaPaciente().some((i) => i.appointmentBookingId === candidata.id)).toBe(false);
    });

    it('una reserva inexistente no emite nada ni rompe', async () => {
      const { emitirInvitacionDeAtencion } = await import('./surveys-forms.handlers');
      const antes = invitacionesDeLaPaciente().length;
      emitirInvitacionDeAtencion(uuid('reserva-que-no-existe'));
      expect(invitacionesDeLaPaciente()).toHaveLength(antes);
      expect(emisora).toBeDefined();
    });
  });

  describe('invitaciones sembradas', () => {
    it('las dos primeras cuelgan de reservas COMPLETADAS con encuentro terminado (para el puente a la reseña)', async () => {
      const { reservasTerminadasDe } = await import('../fixtures/atencion-resenable');
      const terminadas = reservasTerminadasDe(paciente.patientProfileId!).map((r) => r.id);
      const match = router.match('GET', '/surveys/me/invitations')!;
      const lista = match.handler({ method: 'GET', path: '/surveys/me/invitations', params: match.params, query: new URLSearchParams(), body: {}, headers: new HttpHeaders(), user: paciente }) as { id: string; appointmentBookingId: string }[];
      const primera = lista.find((i) => i.id === uuid('invitation-1'))!;
      const segunda = lista.find((i) => i.id === uuid('invitation-2'))!;
      expect(terminadas).toContain(primera.appointmentBookingId);
      expect(terminadas).toContain(segunda.appointmentBookingId);
    });
  });
});
