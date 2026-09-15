import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import type { Dependent } from '../data-access/profiles/profiles.types';
import { PatientContextService } from './patient-context.service';

/**
 * Por quién se está operando.
 *
 * Lo que estas pruebas fijan es lo que no se deduce leyendo el servicio:
 *
 * - **El contexto cae al titular** cuando no hay nadie elegido, así que las
 *   pantallas pueden consumir un solo valor y olvidarse del caso normal.
 * - **Sólo se puede elegir a alguien de la lista**: un identificador suelto no
 *   deja la interfaz operando por un id fantasma. No es seguridad —la API tiene
 *   la suya—, es no mostrar un estado que no se puede explicar.
 * - **Cambiar de cuenta descarta la elección**: sin eso, entrar con otro usuario
 *   dejaría el nombre del dependiente anterior en la cabecera.
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
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.x`;
}

/**
 * Un dependiente **como viaja por el cable**.
 *
 * Sin fecha, que es el caso más simple; los que la traen la mandan como
 * instante ISO. Fabricar la respuesta con la forma de la vista dejaría sin
 * probar la conversión de la frontera.
 */
function dependiente(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'proxy-1',
    patientProfileId: 'pp-hijo',
    personId: 'per-hijo',
    fullName: 'Mateo Quispe',
    relationshipCode: 'CHILD',
    relationshipDisplay: 'Hijo/a',
    isLegalGuardian: true,
    ...overrides,
  };
}

describe('PatientContextService', () => {
  let servicio: PatientContextService;
  let http: HttpTestingController;
  let sesion: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  /** Abre sesión como paciente y construye el servicio. */
  function montar({ pid = 'pp-titular' }: { pid?: string | null } = {}): void {
    sesion.start({
      accessToken: jwt({
        sub: 'user-1',
        roles: ['USER', 'PATIENT'],
        tenants: ['t-1'],
        name: 'Ana Quispe',
        ...(pid === null ? {} : { pid }),
      }),
      refreshToken: 'r-1',
    });
    servicio = TestBed.inject(PatientContextService);
  }

  /** Responde la carga de dependientes con cuerpos del cable. */
  function responder(dependientes: readonly Record<string, unknown>[]): void {
    http
      .expectOne((r) => r.url === '/profiles/patients/me/dependents')
      .flush(dependientes);
  }

  it('sin nadie elegido, el paciente activo es el titular', () => {
    montar();

    expect(servicio.activePatientProfileId()).toBe('pp-titular');
    expect(servicio.isActingForDependent()).toBe(false);
    expect(servicio.activePatientName()).toBe('Ana Quispe');
  });

  it('carga los dependientes del titular', () => {
    montar();

    servicio.loadDependents();
    responder([dependiente()]);

    expect(servicio.dependents()).toHaveLength(1);
    expect(servicio.loaded()).toBe(true);
  });

  it('una cuenta sin perfil de paciente no pide nada', () => {
    // Quien atiende no tiene dependientes que listar: pedirlos igual sería una
    // llamada segura de fallar en cada pantalla del portal.
    montar({ pid: null });

    servicio.loadDependents();

    http.expectNone((r) => r.url === '/profiles/patients/me/dependents');
  });

  it('elegir a un dependiente cambia el paciente activo y su nombre', () => {
    montar();
    servicio.loadDependents();
    responder([dependiente()]);

    servicio.selectPatient('pp-hijo');

    expect(servicio.activePatientProfileId()).toBe('pp-hijo');
    expect(servicio.isActingForDependent()).toBe(true);
    expect(servicio.activePatientName()).toBe('Mateo Quispe');
    expect(servicio.activeDependent()?.relationshipDisplay).toBe('Hijo/a');
  });

  it('un identificador que no está en la lista no cambia nada', () => {
    montar();
    servicio.loadDependents();
    responder([dependiente()]);

    servicio.selectPatient('pp-inventado');

    expect(servicio.activePatientProfileId()).toBe('pp-titular');
    expect(servicio.isActingForDependent()).toBe(false);
  });

  it('volver a uno mismo deshace la elección', () => {
    montar();
    servicio.loadDependents();
    responder([dependiente()]);
    servicio.selectPatient('pp-hijo');

    servicio.resetToSelf();

    expect(servicio.activePatientProfileId()).toBe('pp-titular');
  });

  it('un fallo de la carga deja la lista vacía y no rompe la pantalla', () => {
    // El conmutador es una comodidad: sin él el titular sigue operando por sí
    // mismo, que es lo que hacía antes de que existieran los dependientes.
    montar();

    servicio.loadDependents();
    http
      .expectOne((r) => r.url === '/profiles/patients/me/dependents')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(servicio.dependents()).toEqual([]);
    expect(servicio.loaded()).toBe(true);
    expect(servicio.activePatientProfileId()).toBe('pp-titular');
  });

  it('si el elegido ya no está al recargar, se vuelve al titular', () => {
    // Le revocaron el apoderamiento, o la lista cambió: seguir operando por un
    // id que la API ya no acepta sólo produciría 403 sin explicación.
    montar();
    servicio.loadDependents();
    responder([dependiente()]);
    servicio.selectPatient('pp-hijo');

    servicio.loadDependents();
    responder([]);

    expect(servicio.activePatientProfileId()).toBe('pp-titular');
  });

  it('sumar un recién registrado lo deja disponible para elegir', () => {
    montar();
    servicio.loadDependents();
    responder([]);

    // Acá el objeto ya es de la vista y no del cable: `addDependent` recibe lo
    // que devolvió el alta, que el cliente ya convirtió.
    servicio.addDependent({
      id: 'proxy-2',
      patientProfileId: 'pp-abuela',
      personId: 'per-abuela',
      fullName: 'Rosa Quispe',
      relationshipCode: 'PARENT',
      relationshipDisplay: 'Padre/Madre',
      isLegalGuardian: true,
    } satisfies Dependent);
    servicio.selectPatient('pp-abuela');

    expect(servicio.dependents()).toHaveLength(1);
    expect(servicio.activePatientProfileId()).toBe('pp-abuela');
  });

  it('cambiar de cuenta descarta la elección y la lista', () => {
    montar();
    servicio.loadDependents();
    responder([dependiente()]);
    servicio.selectPatient('pp-hijo');
    expect(servicio.isActingForDependent()).toBe(true);

    // Otra persona entra en la misma pestaña.
    sesion.start({
      accessToken: jwt({
        sub: 'user-2',
        roles: ['USER', 'PATIENT'],
        tenants: ['t-1'],
        name: 'Luis Mamani',
        pid: 'pp-otro',
      }),
      refreshToken: 'r-2',
    });
    TestBed.tick();

    expect(servicio.activePatientProfileId()).toBe('pp-otro');
    expect(servicio.dependents()).toEqual([]);
    expect(servicio.isActingForDependent()).toBe(false);
  });
});
