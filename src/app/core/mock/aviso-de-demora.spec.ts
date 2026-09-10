import { HttpHeaders } from '@angular/common/http';

import { reservas } from './fixtures/agenda';
import { PACIENTE } from './fixtures/personas';
import { crearRouterSimulado } from './handlers';
import type { MockMethod, MockRequest } from './mock-router';
import { emitirAccessToken, MOCK_USERS } from './mock-session';

/* ============================================================================
    El aviso de demora, de punta a punta.

    El registro de procesos lo pide dos veces: el médico avisa (módulo Médico
    §1: «EL PACIENTE RECIBIRA UNA NOTIFICACION DEL COMUNICADO DEL MEDICO») y el
    paciente recibe (módulo Paciente §1: «SI EL MEDICO SE DEMORARÁ PUEDES
    RECIBIR UNA NOTIFICACION DE LA APP»).

    La demora ya viajaba pegada a la cita, y eso lo cubren las pantallas. Lo que
    esta prueba fija es el eslabón que faltaba: que del aviso del médico NAZCA
    una notificación en la campana del paciente. Sin esto, el aviso sólo se ve
    si el paciente entra a mirar su cita — justo lo que no hace mientras viaja
    al consultorio.
    ========================================================================== */

const router = crearRouterSimulado();

function peticion(
  method: MockMethod,
  path: string,
  body: unknown,
  usuario: (typeof MOCK_USERS)[number] | null,
): MockRequest {
  const segmentos = path.split('/').filter((s) => s !== '');
  const token = usuario === null ? null : emitirAccessToken(usuario);
  return {
    method,
    path,
    // El último segmento es el identificador en las dos rutas de demora.
    params: { id: segmentos[segmentos.length - 2] ?? '' },
    query: new URLSearchParams(),
    body,
    headers: new HttpHeaders(token === null ? {} : { Authorization: `Bearer ${token}` }),
    user: usuario,
  };
}

function llamar(
  method: MockMethod,
  path: string,
  body: unknown,
  usuario: (typeof MOCK_USERS)[number] | null,
  query = new URLSearchParams(),
): unknown {
  const req = { ...peticion(method, path, body, usuario), query };
  return router.match(method, path)!.handler(req);
}

/** Las notificaciones que hoy tiene esa persona en su campana. */
function campanaDe(usuario: (typeof MOCK_USERS)[number]): { id: string; subject: string; bodyText: string; category: string; unread: boolean }[] {
  // `limit=100` y no la página por omisión: `GET /notifications/me` **pagina de
  // a 20**, y estas pruebas van acumulando avisos sobre el mismo paciente. Sin
  // esto, a partir del vigésimo la campana dejaba de traer el recién emitido y
  // el fallo aparecía sólo al correr la suite entera, según qué se hubiera
  // ejecutado antes.
  const respuesta = llamar(
    'GET',
    '/notifications/me',
    {},
    usuario,
    new URLSearchParams({ limit: '100' }),
  ) as {
    items: { id: string; subject: string; bodyText: string; category: string; unread: boolean }[];
  };
  return respuesta.items;
}

describe('el aviso de demora le llega al paciente', () => {
  /**
   * Un turno futuro DEL PACIENTE DE PRUEBA.
   *
   * Tiene que ser suyo y no de cualquiera: las cuentas del simulador son dos
   * —`medica@` y `paciente@`—, así que sólo se puede leer la campana de esas.
   * Los otros ciento y pico de pacientes de los fixtures no tienen sesión con
   * la que consultar.
   */
  function turnoAvisable() {
    return reservas
      .todos()
      .filter((r) => r.patientProfileId === PACIENTE.id)
      .find((r) => new Date(r.startAt).getTime() > Date.now())!;
  }

  const MEDICA = MOCK_USERS.find((u) => u.email === 'medica@alovida.mock')!;
  const PACIENTE_USUARIO = MOCK_USERS.find((u) => u.email === 'paciente@alovida.mock')!;

  /**
   * El aviso **recién emitido**, encontrado por lo que no estaba antes.
   *
   * No `campana[0]`: la campana ordena por `availableAt`, y los fixtures siembran
   * avisos a horas fijas del día (`iso(0, 8, 30)`). Corriendo la suite de
   * madrugada, `ahora()` es **anterior** a esas horas y el aviso nuevo no queda
   * primero — las pruebas pasaban de día y fallaban de noche. Identificar el
   * propio por id no depende del reloj.
   */
  function avisoNuevoTras(accion: () => void): {
    subject: string;
    bodyText: string;
    category: string;
    unread: boolean;
  } {
    const antes = new Set(campanaDe(PACIENTE_USUARIO).map((a) => a.id));
    accion();
    const nuevo = campanaDe(PACIENTE_USUARIO).find((a) => !antes.has(a.id));
    if (nuevo === undefined) throw new Error('No se emitió ningún aviso nuevo');
    return nuevo;
  }

  it('avisar la demora de un turno le deja una notificación al paciente de ESE turno', () => {
    const turno = turnoAvisable();
    const antes = campanaDe(PACIENTE_USUARIO).length;

    let resultadoCrudo: unknown;
    const aviso = avisoNuevoTras(() => {
      resultadoCrudo = llamar(
        'POST',
        `/scheduling/bookings/${turno.id}/delay`,
        { delayMinutes: 20, message: 'Se me complicó una urgencia' },
        MEDICA,
      );
    });
    const resultado = resultadoCrudo as { notified: number; affected: number };

    expect(resultado.affected).toBe(1);
    expect(resultado.notified).toBe(1);

    expect(campanaDe(PACIENTE_USUARIO).length).toBe(antes + 1);
    expect(aviso.category).toBe('SCHEDULING');
    expect(aviso.unread).toBe(true);
    // Los tres datos que el paciente necesita: cuánto, de qué cita y por qué.
    expect(aviso.subject).toContain('20 minutos');
    expect(aviso.bodyText).toContain('20 minutos');
    expect(aviso.bodyText).toContain('Se me complicó una urgencia');
  });

  it('sin mensaje del profesional el aviso sigue diciendo cuánto y de qué cita', () => {
    const turno = turnoAvisable();

    const aviso = avisoNuevoTras(() =>
      llamar('POST', `/scheduling/bookings/${turno.id}/delay`, { delayMinutes: 15 }, MEDICA),
    );
    expect(aviso.subject).toContain('15 minutos');
    // Sin comillas vacías colgando al final del cuerpo.
    expect(aviso.bodyText).not.toContain('«»');
  });

  it('la demora sigue viajando pegada a la cita, además de la campana', () => {
    const turno = turnoAvisable();

    llamar('POST', `/scheduling/bookings/${turno.id}/delay`, { delayMinutes: 30 }, MEDICA);

    // Las pantallas del paciente —su portada y su listado— leen de acá, no de
    // la notificación: las dos vías tienen que quedar coherentes.
    expect(reservas.get(turno.id)!.delayNotice?.delayMinutes).toBe(30);
  });
});
