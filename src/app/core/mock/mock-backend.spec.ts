import { HttpHeaders } from '@angular/common/http';

import { TIPO_CREDENCIAL } from './fixtures/conceptos';
import { credencialesDe, especialidadesDe, licenciasDe, PACIENTE, PACIENTES, PROFESIONALES, PROFESIONALES_DEMO_REGISTRADOS } from './fixtures/personas';
import { ESPECIALIDAD } from './fixtures/conceptos';
import {
  cupos,
  plantillas,
  recursoDe,
  recursoDeDemo,
  recursos,
  reservas,
  SEDES_DEMO,
  SITIO_OLIVOS,
  ZONA_HORARIA_POR_OMISION,
} from './fixtures/agenda';
import { publicaciones, vitrinas } from './fixtures/comunidad';
import { crearRouterSimulado } from './handlers';
import { perfilProfesionalDe } from './handlers/profiles.handlers';
import { esTelefonoCompleto } from '../../shared/components/molecules/phone-input/phone-input.paises';
import { isMockReply, type MockMethod, type MockRequest } from './mock-router';
import {
  buscarUsuario,
  emitirAccessToken,
  MOCK_USERS,
  TENANT_ASEGURADORA,
  TENANT_CLINICA,
  TENANT_CONSULTORIO,
  TENANT_HOSPITAL,
  type MockUser,
} from './mock-session';
import { decodeAccessToken } from '../auth/access-token';

/* ============================================================================
    El backend simulado, recorrido entero.

    Cada ruta registrada se llama con identificadores reales de los fixtures y
    con cada una de las cuentas de prueba. Lo que se comprueba es lo mínimo que
    hace falta para que la aplicación no se caiga: que ningún manejador lance,
    y que las lecturas no devuelvan 500. La forma de cada respuesta la valida
    la propia pantalla al usarla — esto es la red de seguridad de abajo.
    ========================================================================== */

const router = crearRouterSimulado();

/** Un valor plausible para cada parámetro de ruta, según su nombre. */
function valorDe(nombre: string, patron: string): string {
  if (nombre === 'code') return patron.includes('value-sets') ? 'VS_MEDICAL_SPECIALTY' : 'demo';
  if (nombre === 'slug') return vitrinas.todos()[0]!.slug;
  if (nombre === 'target') return 'profiles.persons.sex_at_birth_concept_id';
  if (/patient/i.test(nombre) || patron.includes('/patients/')) return PACIENTE.id;
  if (/practitioner/i.test(nombre) || patron.includes('/practitioners/')) return PROFESIONALES[0]!.id;
  if (patron.includes('/bookings/')) return reservas.todos()[0]!.id;
  if (patron.includes('/posts/')) return publicaciones.todos()[0]!.id;
  if (patron.includes('/community/profiles/')) return vitrinas.todos()[0]!.id;
  return PACIENTES[1]!.id;
}

function peticion(method: MockMethod, patron: string, user: MockUser | null): MockRequest {
  const params: Record<string, string> = {};
  const path = patron
    .split('/')
    .map((segmento) => {
      if (segmento.startsWith(':')) {
        const valor = valorDe(segmento.slice(1), patron);
        params[segmento.slice(1)] = valor;
        return valor;
      }
      return segmento === '*' ? 'x' : segmento;
    })
    .join('/');
  const token = user === null ? null : emitirAccessToken(user);
  return {
    method,
    path,
    params,
    query: new URLSearchParams({ limit: '5', q: 'a', lang: 'ES', ids: PACIENTE.id, code: 'VS_MEDICAL_SPECIALTY', target: 'profiles.persons.sex_at_birth_concept_id' }),
    body: {},
    headers: new HttpHeaders(token === null ? {} : { Authorization: `Bearer ${token}` }),
    user,
  };
}

function estadoDe(resultado: unknown): number {
  return isMockReply(resultado) ? resultado.status : 200;
}

describe('backend simulado', () => {
  const lecturas = router.rutas().filter((r) => r.method === 'GET');
  const escrituras = router.rutas().filter((r) => r.method !== 'GET');

  it('registra rutas de todos los dominios', () => {
    const patrones = router.rutas().map((r) => r.pattern);
    for (const raiz of ['/iam/auth/login', '/terminology/concepts', '/profiles/patients/me', '/scheduling/bookings', '/clinical/patients/:id/summary', '/community/feed', '/public/posts', '/notifications/me', '/insurance-claims', '/accounting/journal', '/pharmacy/orders', '/diagnostic-results/me', '/procedure-cases', '/pharma-labs', '/system-context/dynamic-enums', '/authz/care-relationships']) {
      expect(patrones.some((p) => p.startsWith(raiz)), `falta ${raiz}`).toBe(true);
    }
  });

  it('registra una sola vez cada ruta trasladada y la reserva de C3', () => {
    const routes = [
      { method: 'POST', pattern: '/charts/notes' },
      { method: 'PUT', pattern: '/charts/notes/:id/versions' },
      { method: 'POST', pattern: '/charts/notes/:id/versions' },
      { method: 'POST', pattern: '/clinical/service-requests' },
      { method: 'POST', pattern: '/clinical/conditions/:id/verification' },
    ];
    for (const route of routes) {
      expect(router.rutas().filter((candidate) =>
        candidate.method === route.method && candidate.pattern === route.pattern,
      )).toEqual([route]);
    }
  });

  it('la verificación reservada para C3 responde 404 con su mensaje contractual', () => {
    const request = peticion('POST', '/clinical/conditions/:id/verification', buscarUsuario('medica')!);
    const match = router.match('POST', request.path);
    expect(match).not.toBeNull();
    expect(match!.handler(request)).toEqual({
      status: 404,
      body: {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Pendiente: carril C3',
        error: 'Not Found',
      },
    });
  });

  it('cada cuenta de prueba entra y su token vuelve a ella', () => {
    for (const user of MOCK_USERS) {
      const login = router.match('POST', '/iam/auth/login')!;
      const respuesta = login.handler({ ...peticion('POST', '/iam/auth/login', null), body: { email: user.email, password: 'x' } }) as { accessToken: string };
      expect(respuesta.accessToken).toBeTypeOf('string');
      expect(buscarUsuario(user.email)?.id).toBe(user.id);
    }
  });

  it('el token dice de qué tipo es cada organización de la cuenta (tenantTypes)', () => {
    const aseguradora = MOCK_USERS.find((u) => u.key === 'aseguradora')!;
    const claimsAseguradora = decodeAccessToken(emitirAccessToken(aseguradora));
    expect(claimsAseguradora?.tenantTypes).toEqual({ [TENANT_ASEGURADORA]: 'PAYER' });

    // La médica tiene tres organizaciones, de tres tipos distintos: el
    // consultorio propio y la clínica son prestador; el hospital es
    // institucional.
    const medica = MOCK_USERS.find((u) => u.key === 'medica')!;
    const claimsMedica = decodeAccessToken(emitirAccessToken(medica));
    expect(claimsMedica?.tenantTypes).toEqual({
      [TENANT_CONSULTORIO]: 'PROVIDER',
      [TENANT_CLINICA]: 'PROVIDER',
      [TENANT_HOSPITAL]: 'HOSPITAL',
    });
  });

  it('dynamic-enum de credenciales replica las cinco opciones canónicas del API', () => {
    const target = 'profiles.professional_credentials.credential_type_concept_id';
    const ruta = router.match('GET', '/system-context/dynamic-enums')!;
    const respuesta = ruta.handler({
      ...peticion('GET', '/system-context/dynamic-enums', null),
      query: new URLSearchParams({ target }),
    }) as {
      options: readonly {
        conceptId: string;
        code: string;
        display: string;
        ordinal: number;
        isDefault: boolean;
      }[];
    };
    // Los cinco códigos, en su orden y con el primero por defecto, son los del
    // API. El rótulo es la designación en castellano que el API sirve
    // (`terminology-designations.es.ts`): la maqueta ya no repite el nombre en
    // inglés del sistema de codificación.
    const opcionesCanonicas = [
      ['CREDENTIAL_TYPE_DEGREE', 'Título universitario'],
      ['CREDENTIAL_TYPE_DIPLOMA', 'Diplomado'],
      ['CREDENTIAL_TYPE_MASTER', 'Maestría'],
      ['CREDENTIAL_TYPE_DOCTORATE', 'Doctorado'],
      ['CREDENTIAL_TYPE_SPECIALTY', 'Título de especialidad'],
    ] as const;

    expect(respuesta.options).toEqual(
      opcionesCanonicas.map(([code, display], ordinal) => ({
        conceptId: TIPO_CREDENCIAL[code]!,
        code,
        display,
        ordinal,
        isDefault: ordinal === 0,
      })),
    );
  });

  for (const user of [null, ...MOCK_USERS]) {
    const nombre = user?.key ?? 'sin sesión';

    it(`${nombre}: ninguna lectura lanza ni devuelve 500 (${lecturas.length} rutas)`, () => {
      const fallos: string[] = [];
      for (const ruta of lecturas) {
        const req = peticion('GET', ruta.pattern, user);
        try {
          const estado = estadoDe(router.match('GET', req.path)!.handler(req));
          if (estado >= 500) fallos.push(`${estado} GET ${ruta.pattern}`);
        } catch (error) {
          fallos.push(`lanzó GET ${ruta.pattern}: ${(error as Error).message}`);
        }
      }
      expect(fallos).toEqual([]);
    });

    it(`${nombre}: ninguna escritura lanza con cuerpo vacío (${escrituras.length} rutas)`, () => {
      const fallos: string[] = [];
      for (const ruta of escrituras) {
        const req = peticion(ruta.method, ruta.pattern, user);
        try {
          const estado = estadoDe(router.match(ruta.method, req.path)!.handler(req));
          if (estado >= 500) fallos.push(`${estado} ${ruta.method} ${ruta.pattern}`);
        } catch (error) {
          fallos.push(`lanzó ${ruta.method} ${ruta.pattern}: ${(error as Error).message}`);
        }
      }
      expect(fallos).toEqual([]);
    });
  }
});

/**
 * Los teléfonos que sirve el perfil profesional.
 *
 * `esTelefonoCompleto` pide «+591 » y OCHO dígitos SEGUIDOS. La maqueta servía
 * el fijo del trabajo como `'+591 3 3456789'` —con un espacio adentro— y eso
 * tenía una consecuencia que no se veía mirando el fixture: el editor del
 * médico nacía con ese control inválido y **se negaba a guardar cualquier
 * cosa**, aunque nadie hubiera tocado ese campo. Se descubrió el 19/09/2026
 * intentando cargar un NIT.
 */
describe('el perfil profesional de la maqueta sirve teléfonos que el editor acepta', () => {
  it('los tres teléfonos pasan `esTelefonoCompleto`', () => {
    const perfil = perfilProfesionalDe(PROFESIONALES[0]!) as unknown as Record<string, string>;

    for (const campo of ['phone', 'mobilePhone', 'workMobilePhone', 'workLandline']) {
      expect(esTelefonoCompleto(perfil[campo] ?? ''), `${campo}: «${perfil[campo]}»`).toBe(true);
    }
  });

  it('el NIT y la razón social viajan en el perfil, como en el del paciente', () => {
    const perfil = perfilProfesionalDe(PROFESIONALES[0]!) as unknown as Record<string, string>;

    expect(perfil['taxId']).toBe(`${PROFESIONALES[0]!.nationalId}011`);
    expect(perfil['taxHolderName']).toBe(PROFESIONALES[0]!.displayName);
  });
});

/* ============================================================================
    Agendas para 13 profesionales de demostración (R-03, 22/09/2026;
    D-H3-PROV-01, 23/09/2026).

    Las 13 personas de la planilla del propietario son reales y la planilla no
    dice dónde atienden: no reciben agenda. La reciben 13 actores sintéticos
    («Profesional demo NN»), con sede en una de las dos instituciones inventadas
    de la maqueta, plantilla de lunes a viernes y cupos ±21 días, siempre
    iguales. Los límites se prueban con personas que ya existen: el médico
    escrito sin especialidad y la red de las aseguradoras siguen sin agenda.
    ========================================================================== */
describe('las agendas de los profesionales de demostración', () => {
  const DIA = 24 * 60 * 60 * 1000;
  const demos = PROFESIONALES.filter((p) => p.origen === 'DEMO');
  const sedes = new Set(Object.values(SEDES_DEMO).map((s) => s.site.id));

  function recursosDe(profileId: string) {
    return recursos.filtrar((r) => r.resourceRefId === profileId);
  }

  function cuposLibres(resourceId: string, desde: number, hasta: number): number {
    const coincidencia = router.match('GET', '/scheduling/slots')!;
    const query = new URLSearchParams({
      resourceId,
      from: new Date(desde).toISOString(),
      to: new Date(hasta).toISOString(),
      onlyAvailable: 'true',
    });
    const resultado = coincidencia.handler({ method: 'GET', path: '/scheduling/slots', params: coincidencia.params, query, body: null, headers: new HttpHeaders(), user: null });
    return (resultado as { count: number }).count;
  }

  it('son 13, al final del padrón, con semillas propias y nombres que dicen «demo»', () => {
    expect(demos.length).toBe(13);
    expect(demos).toEqual([...PROFESIONALES_DEMO_REGISTRADOS]);
    expect(PROFESIONALES.slice(-13)).toEqual(demos);
    demos.forEach((p, i) => {
      const numero = String(i + 1).padStart(2, '0');
      expect(p.displayName).toBe(`Profesional demo ${numero}`);
      expect(p.slug).toBe(`profesional-demo-${numero}`);
    });
    expect(new Set(demos.map((p) => p.id)).size).toBe(13);
  });

  it('su especialidad sale del catálogo y no están verificados ni puntuados', () => {
    const catalogo = new Set(Object.values(ESPECIALIDAD));
    for (const p of demos) {
      expect(p.especialidades.length, p.id).toBe(1);
      expect(catalogo.has(p.especialidades[0]!), p.id).toBe(true);
      expect(p.verified).toBe(false);
      expect(p.ratingCount).toBe(0);
      expect(p.matricula).toBe('');
    }
  });

  it('no tienen credenciales, matrícula ni especialidad certificada: no hay título que fingir', () => {
    for (const p of demos) {
      expect(credencialesDe(p), p.id).toEqual([]);
      expect(licenciasDe(p), p.id).toEqual([]);
      expect(especialidadesDe(p).some((e) => e.boardCertified), p.id).toBe(false);
    }
  });

  it('cada uno tiene un recurso en una de las dos sedes inventadas, que coincide con su organización', () => {
    for (const p of demos) {
      const suyos = recursosDe(p.id);
      expect(suyos.length, p.id).toBe(1);
      expect(suyos[0]!.id, p.id).toBe(recursoDe(p));
      expect(sedes.has(suyos[0]!.site!.id), p.id).toBe(true);
      expect(suyos[0]!.site).toEqual(SEDES_DEMO[p.organizacion as keyof typeof SEDES_DEMO].site);
      expect(suyos[0]!.name, p.id).toContain('simulada');
      expect(suyos[0]!.resourceRefType).toBe('health_practitioner_profiles');
    }
    expect(new Set(demos.map((p) => recursosDe(p.id)[0]!.site!.id)).size).toBe(2);
  });

  it('dos cargas dan el mismo recurso', () => {
    for (const p of demos) expect(recursoDeDemo(p)).toEqual(recursosDe(p.id)[0]);
  });

  it('cada uno tiene una plantilla publicada de lunes a viernes, mañana y tarde alternadas', () => {
    const nombres: string[] = [];
    for (const p of demos) {
      const suyas = plantillas.filtrar((t) => t.resourceId === recursoDe(p) && !t.retired);
      expect(suyas.length, p.id).toBe(1);
      expect(suyas[0]!.rules.map((r) => r.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
      nombres.push(suyas[0]!.name);
    }
    expect(new Set(nombres)).toEqual(new Set(['Horario de mañana', 'Horario de tarde']));
  });

  it('cada uno tiene cupos libres en las próximas dos semanas, y cupos generados ±21 días', () => {
    const ahora = Date.now();
    for (const p of demos) {
      expect(cuposLibres(recursoDe(p), ahora, ahora + 14 * DIA), p.id).toBeGreaterThan(0);
      const suyos = cupos.filtrar((c) => c.resourceId === recursoDe(p));
      const dias = suyos.map((c) => Math.round((new Date(c.startAt).getTime() - ahora) / DIA));
      expect(Math.min(...dias), p.id).toBeLessThan(-14);
      expect(Math.max(...dias), p.id).toBeGreaterThan(14);
    }
  });

  it('las personas de la planilla del propietario no tienen agenda: la planilla no dice dónde atienden', () => {
    const deLaPlanilla = PROFESIONALES.filter((p) => p.origen === 'USUARIO_PROPIETARIO');
    expect(deLaPlanilla.length).toBe(13);
    for (const p of deLaPlanilla) expect(recursosDe(p.id), p.id).toEqual([]);
  });

  it('el médico escrito sin especialidad sigue sin agenda: no hay nada que reservarle', () => {
    const sinEspecialidad = PROFESIONALES.filter((p) => p.origen === undefined && p.especialidades.length === 0);
    expect(sinEspecialidad.length).toBeGreaterThan(0);
    for (const p of sinEspecialidad) {
      expect(recursosDe(p.id), p.id).toEqual([]);
    }
  });

  it('una sede sin zona horaria cae en la zona por omisión', () => {
    const p = demos[0]!;
    const sinZona = recursoDeDemo(p, { practiceId: 'x', site: { ...SITIO_OLIVOS, timeZone: null } });
    expect(sinZona.timeZone).toBe(ZONA_HORARIA_POR_OMISION);
    const sinSede = recursoDeDemo(p, { practiceId: 'x', site: null });
    expect(sinSede.timeZone).toBe(ZONA_HORARIA_POR_OMISION);
  });
});
