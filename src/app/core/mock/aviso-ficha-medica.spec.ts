import { HttpHeaders } from '@angular/common/http';

import { PACIENTE } from './fixtures/personas';
import { crearRouterSimulado } from './handlers';
import type { MockMethod, MockRequest } from './mock-router';
import { emitirAccessToken, MOCK_USERS } from './mock-session';

/* ============================================================================
    El aviso de la ficha médica, de punta a punta.

    Punto 2.6.1.1 del registro de procesos: «El medico realiza su Diagnóstico y
    crea su ficha medica del paciente en la APP quedando guardada y el paciente
    recibirá un TOUS donde recibirá el aviso de la recepción de su ficha medica
    creada por el médico».

    Lo que faltaba no era la ficha ni el diagnóstico —los dos existían— sino que
    de guardarlos naciera algo para el paciente. Estas pruebas fijan las tres
    cosas que hacen que el aviso sirva: que salga AL GUARDAR y no al cerrar la
    consulta, que sea UNO por consulta y no uno por campo, y que lleve a la
    historia clínica en vez de quedarse en un renglón sin destino.
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
    params: { id: segmentos[segmentos.length - 1] ?? '' },
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
): unknown {
  const req = peticion(method, path, body, usuario);
  return router.match(method, path)!.handler(req);
}

/** Las notificaciones que hoy tiene esa persona en su campana. */
function campanaDe(usuario: (typeof MOCK_USERS)[number]): {
  id: string;
  subject: string;
  bodyText: string;
  category: string;
  unread: boolean;
  destination: { type: string; id: string } | null;
}[] {
  const respuesta = llamar('GET', '/notifications/me', {}, usuario) as {
    items: {
      id: string;
      subject: string;
      bodyText: string;
      category: string;
      unread: boolean;
      destination: { type: string; id: string } | null;
    }[];
  };
  return respuesta.items;
}

const MEDICA = MOCK_USERS.find((u) => u.email === 'medica@alovida.mock')!;
const PACIENTE_USUARIO = MOCK_USERS.find((u) => u.email === 'paciente@alovida.mock')!;

/**
 * Abre una consulta del paciente de prueba y devuelve su identificador.
 *
 * Cada prueba abre la suya: el aviso es uno por encuentro y se recuerda para
 * toda la vida del módulo, así que dos pruebas que compartieran encuentro se
 * pisarían — la segunda no vería nacer nada y pasaría por el motivo
 * equivocado.
 */
function abrirConsulta(): string {
  const encuentro = llamar(
    'POST',
    '/clinical/encounters/check-in',
    { patientProfileId: PACIENTE.id, reasonText: 'Control' },
    MEDICA,
  ) as { body: { id: string } };
  return encuentro.body.id;
}

function guardarDiagnostico(encounterId: string): void {
  llamar(
    'POST',
    '/clinical/conditions',
    { patientProfileId: PACIENTE.id, codeConceptId: 'cx-hipertension', encounterId },
    MEDICA,
  );
}

function guardarNota(encounterId: string): void {
  llamar(
    'POST',
    '/charts/notes',
    {
      patientProfileId: PACIENTE.id,
      authorProfileId: MEDICA.practitionerProfileId,
      encounterId,
      subjectiveText: 'Refiere cefalea de tres días.',
    },
    MEDICA,
  );
}

describe('el aviso de la ficha médica le llega al paciente', () => {
  it('guardar el diagnóstico le deja el aviso al paciente, sin cerrar la consulta', () => {
    const encuentro = abrirConsulta();
    const antes = campanaDe(PACIENTE_USUARIO).length;

    guardarDiagnostico(encuentro);

    const despues = campanaDe(PACIENTE_USUARIO);
    expect(despues.length).toBe(antes + 1);

    const aviso = despues[0]!;
    expect(aviso.category).toBe('CLINICAL');
    expect(aviso.unread).toBe(true);
    expect(aviso.subject).toContain('ficha');
  });

  it('el aviso lleva a la consulta, que es lo que hay que ir a leer', () => {
    const encuentro = abrirConsulta();

    guardarDiagnostico(encuentro);

    // `ENCOUNTER` ya está ruteado a `/my-account/medical-record` en
    // `core/notifications/notification-routes.ts`: un aviso sin destino se
    // pinta como texto y deja a la persona buscando dónde estaba su ficha.
    expect(campanaDe(PACIENTE_USUARIO)[0]!.destination).toEqual({
      type: 'ENCOUNTER',
      id: encuentro,
    });
  });

  it('dice quién la escribió, y no adelanta el diagnóstico', () => {
    const encuentro = abrirConsulta();

    guardarDiagnostico(encuentro);

    const aviso = campanaDe(PACIENTE_USUARIO)[0]!;
    // El nombre de quien atiende, sin «Dr.» ni «Dra.» inventados.
    expect(aviso.bodyText).toContain('Valeria');
    // Un renglón de la campana se lee desde la pantalla bloqueada del
    // teléfono: ahí no va el nombre de una enfermedad.
    expect(aviso.subject.toLowerCase()).not.toContain('hipertensión');
    expect(aviso.bodyText.toLowerCase()).not.toContain('hipertensión');
  });

  it('es UNO por consulta: el diagnóstico y la nota no avisan dos veces', () => {
    const encuentro = abrirConsulta();
    const antes = campanaDe(PACIENTE_USUARIO).length;

    guardarDiagnostico(encuentro);
    guardarNota(encuentro);
    guardarDiagnostico(encuentro);

    // Tres escrituras de la MISMA ficha, un solo aviso. Media consulta no
    // puede llegarle al paciente como una ráfaga de pitidos.
    expect(campanaDe(PACIENTE_USUARIO).length).toBe(antes + 1);
  });

  it('si el médico arranca por la nota de evolución, el aviso sale igual', () => {
    const encuentro = abrirConsulta();
    const antes = campanaDe(PACIENTE_USUARIO).length;

    guardarNota(encuentro);

    expect(campanaDe(PACIENTE_USUARIO).length).toBe(antes + 1);
  });

  it('dos consultas distintas avisan por separado', () => {
    const primera = abrirConsulta();
    const segunda = abrirConsulta();
    const antes = campanaDe(PACIENTE_USUARIO).length;

    guardarDiagnostico(primera);
    guardarDiagnostico(segunda);

    expect(campanaDe(PACIENTE_USUARIO).length).toBe(antes + 2);
  });

  it('un diagnóstico sin consulta detrás no avisa nada', () => {
    const antes = campanaDe(PACIENTE_USUARIO).length;

    // Una corrección del expediente hecha fuera de una consulta. Llamarla «la
    // ficha de tu consulta» sería contarle al paciente algo que no pasó.
    llamar(
      'POST',
      '/clinical/conditions',
      { patientProfileId: PACIENTE.id, codeConceptId: 'cx-hipertension' },
      MEDICA,
    );

    expect(campanaDe(PACIENTE_USUARIO).length).toBe(antes);
  });

  it('el aviso es del paciente de esa ficha, no de la médica que la escribió', () => {
    const encuentro = abrirConsulta();
    const antesMedica = campanaDe(MEDICA).length;

    guardarDiagnostico(encuentro);

    expect(campanaDe(MEDICA).length).toBe(antesMedica);
  });
});
