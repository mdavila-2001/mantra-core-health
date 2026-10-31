import { HttpHeaders } from '@angular/common/http';

import { messageList, showcaseOf, MEDICAL_SHOWCASE, PATIENT_SHOWCASE, type SimulatedMessage } from '../fixtures/community';
import { PROFESSIONALS } from '../fixtures/people';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarComunidad } from './community.handlers';

interface Result<T> {
  readonly status: number;
  readonly body: T;
}

function caller(router: MockRouter) {
  return function call<T>(method: MockMethod, path: string, options: { body?: unknown; user?: MockUser } = {}): Result<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: options.body ?? {},
      headers: new HttpHeaders(),
      user: options.user ?? buscarUsuario('paciente')!,
    });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  };
}

/**
 * La respuesta automática redactada por la IA, tal como la simula la maqueta.
 *
 * La médica de la maqueta la tiene encendida de fábrica, así que lo que se
 * fija es el comportamiento que la API va a tener: contesta en su nombre con la
 * etiqueta `AUTO_REPLY_AI`, ante signos de alarma deriva a Emergencia, no
 * indica medicamentos, respeta el descanso por conversación y, si no hay texto
 * que leer, manda el respaldo **sin** la etiqueta de IA.
 */
describe('respuesta automática con IA (maqueta)', () => {
  const router = new MockRouter();
  registrarComunidad(router);
  const call = caller(router);
  const conversacion = uuid('conv-medica-paciente');
  const HORA = 3_600_000;
  let reloj = new Date('2026-10-01T10:00:00').getTime();

  const medica = buscarUsuario('medica')!;
  const configurar = (cambios: Record<string, unknown> = {}) =>
    call('PUT', `/community/profiles/${MEDICAL_SHOWCASE.id}/auto-reply`, {
      user: medica,
      body: {
        isActive: true,
        inactivityMinutes: 30,
        bodyText: 'Gracias por escribir. En este momento no estoy disponible; le respondo apenas pueda.',
        cooldownHours: 4,
        onlyOutsideBusinessHours: false,
        replyMode: 'AI',
        ...cambios,
      },
    });

  beforeEach(() => {
    vi.useFakeTimers();
    // Cada prueba arranca pasado el descanso de la anterior y con la médica
    // como viene de fábrica: ninguna depende del orden de las otras.
    reloj += 5 * HORA;
    vi.setSystemTime(reloj);
    configurar();
  });

  afterEach(() => vi.useRealTimers());

  const escribir = (bodyText: string, extra: Record<string, unknown> = {}) =>
    call('POST', `/community/conversations/${conversacion}/messages`, {
      body: { senderProfileId: PATIENT_SHOWCASE.id, bodyText, ...extra },
    });

  /** Los messageList de la médica en la conversación, en orden de llegada. */
  const respuestasDeLaMedica = (): SimulatedMessage[] =>
    messageList.filtrar((m) => m.conversationId === conversacion && m.senderProfileId === MEDICAL_SHOWCASE.id);

  it('la configuración de la médica dice que responde con IA, sin un horario que no declaró', () => {
    const config = call<{ replyMode: string; isActive: boolean }>('GET', `/community/profiles/${MEDICAL_SHOWCASE.id}/auto-reply`);
    expect(config.body).toMatchObject({ replyMode: 'AI', isActive: true });
  });

  it('no menciona un horario de atención que no se declaró', () => {
    escribir('Hola, ¿qué tal?');
    vi.advanceTimersByTime(2000);

    expect(respuestasDeLaMedica().at(-1)!.bodyText).not.toContain('horario');
  });

  it('dentro del horario declarado no contesta; fuera, contesta y lo menciona', () => {
    // Al día siguiente, para no caer dentro del descanso de las pruebas de antes.
    const manana = reloj + 24 * HORA;
    vi.setSystemTime(new Date(manana).setHours(10, 0, 0, 0));
    configurar({ onlyOutsideBusinessHours: true, businessHoursFrom: '08:00', businessHoursTo: '18:00' });
    const antes = respuestasDeLaMedica().length;
    escribir('Hola');
    vi.advanceTimersByTime(2000);
    expect(respuestasDeLaMedica()).toHaveLength(antes);

    reloj = new Date(manana).setHours(22, 0, 0, 0);
    vi.setSystemTime(reloj);
    escribir('¿Sigue ahí?');
    vi.advanceTimersByTime(2000);
    expect(respuestasDeLaMedica()).toHaveLength(antes + 1);
    expect(respuestasDeLaMedica().at(-1)!.bodyText).toContain('El horario de atención es de 08:00 a 18:00.');
  });

  it('preguntar por un análisis de sangre no es una urgencia', () => {
    escribir('¿Ya están mis análisis de sangre?');
    vi.advanceTimersByTime(2000);

    expect(respuestasDeLaMedica().at(-1)!.bodyText).not.toContain('puede ser una urgencia');
  });

  it('en una conversación de grupo no contesta nadie con IA', () => {
    const grupo = uuid('conv-equipo-cardio');
    const enElGrupo = () => messageList.filtrar((m) => m.conversationId === grupo && m.senderProfileId === MEDICAL_SHOWCASE.id).length;
    const antes = enElGrupo();
    call('POST', `/community/conversations/${grupo}/messages`, {
      user: medica,
      body: { senderProfileId: showcaseOf(PROFESSIONALS[1]!.id)!.id, bodyText: 'Hola equipo' },
    });
    vi.advanceTimersByTime(2000);

    expect(enElGrupo()).toBe(antes);
  });

  it('contesta en su nombre, rotulada como IA y sin diagnosticar', () => {
    const antes = respuestasDeLaMedica().length;
    expect(escribir('Buenas noches, ¿mañana atienden?').status).toBe(201);
    expect(respuestasDeLaMedica()).toHaveLength(antes);

    vi.advanceTimersByTime(2000);

    const respuesta = respuestasDeLaMedica().at(-1)!;
    expect(respuestasDeLaMedica()).toHaveLength(antes + 1);
    expect(respuesta.contentType).toBe('AUTO_REPLY_AI');
    expect(respuesta.bodyText).toContain('Si tiene una urgencia, acuda a Emergencia');
  });

  it('ante signos de alarma, deriva a Emergencia', () => {
    escribir('Tengo un dolor de pecho muy fuerte y me falta el aire');
    vi.advanceTimersByTime(2000);

    expect(respuestasDeLaMedica().at(-1)!.bodyText).toMatch(/^Lo que describe puede ser una urgencia\. Por favor, acuda de inmediato a Emergencia/);
  });

  it('no indica medicamentos ni dosis', () => {
    escribir('¿Cuánto ibuprofeno puedo tomar por día?');
    vi.advanceTimersByTime(2000);

    expect(respuestasDeLaMedica().at(-1)!.bodyText).toContain('no podemos indicarle medicamentos ni dosis');
  });

  it('respeta el descanso: un segundo mensaje no recibe otra respuesta', () => {
    escribir('Hola');
    vi.advanceTimersByTime(2000);
    const despuesDeLaPrimera = respuestasDeLaMedica().length;

    escribir('¿Sigue ahí?');
    vi.advanceTimersByTime(2000);

    expect(respuestasDeLaMedica()).toHaveLength(despuesDeLaPrimera);
  });

  it('sin texto que leer manda el respaldo, sin la etiqueta de IA', () => {
    escribir('', { contentType: 'MEDIA', attachmentFileId: uuid('file-cualquiera') });
    vi.advanceTimersByTime(2000);

    const respuesta = respuestasDeLaMedica().at(-1)!;
    expect(respuesta.contentType).toBeUndefined();
    expect(respuesta.bodyText).toContain('En este momento no estoy disponible');
  });

  it('guardar el modo lo conserva', () => {
    const guardada = configurar({ replyMode: 'FIXED' }) as { body: { replyMode: string } };
    expect(guardada.body.replyMode).toBe('FIXED');
    expect(call<{ replyMode: string }>('GET', `/community/profiles/${MEDICAL_SHOWCASE.id}/auto-reply`).body.replyMode).toBe('FIXED');

    // Con texto fijo, el simulador ya no contesta con IA.
    const antes = respuestasDeLaMedica().length;
    escribir('Hola de nuevo');
    vi.advanceTimersByTime(2000);
    expect(respuestasDeLaMedica()).toHaveLength(antes);
  });
});
