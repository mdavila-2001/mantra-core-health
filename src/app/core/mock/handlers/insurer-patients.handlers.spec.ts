import { HttpHeaders } from '@angular/common/http';

import type {
  InsurerPatientPage,
  PatientDirectoryOptions,
} from '../../data-access/insurance/insurance.types';
import { isMockReply, type MockMethod, type MockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { crearRouterSimulado } from './index';

/**
 * El directorio autorizado de pacientes del simulador: `POST /insurance/patients/search`,
 * `GET /insurance/patients/options` y `POST /insurance/patients/conversation`.
 *
 * Fija que obedece las reglas de `InsurerPatientsService` de la API: el padrón
 * completo para la administración, sólo los afiliados para la aseguradora, 403
 * para cualquier otra sesión. Sin manejadores la pantalla caía en el 501
 * genérico con cualquier sesión (#1424).
 */
describe('handlers del directorio de pacientes de la aseguradora', () => {
  const router = crearRouterSimulado();
  const admin = buscarUsuario('admin')!;
  const aseguradora = buscarUsuario('aseguradora')!;
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;

  function llamar<T>(
    metodo: MockMethod,
    path: string,
    user: MockRequest['user'],
    body: unknown = null,
  ): T | MockReply {
    const match = router.match(metodo, path);
    if (match === null) throw new Error(`No existe ${metodo} ${path}`);
    return match.handler({
      method: metodo,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest) as T | MockReply;
  }

  function buscar(user: MockRequest['user'], body: Record<string, unknown> = {}): InsurerPatientPage {
    const respuesta = llamar<InsurerPatientPage>('POST', '/insurance/patients/search', user, body);
    if (isMockReply(respuesta)) throw new Error(`Se esperaba la página y respondió ${respuesta.status}`);
    return respuesta;
  }

  function estado(respuesta: unknown): number | undefined {
    return isMockReply(respuesta) ? respuesta.status : undefined;
  }

  describe('alcance', () => {
    it('las tres rutas existen: ninguna cae en el 501 genérico', () => {
      expect(router.match('POST', '/insurance/patients/search')).not.toBeNull();
      expect(router.match('GET', '/insurance/patients/options')).not.toBeNull();
      expect(router.match('POST', '/insurance/patients/conversation')).not.toBeNull();
    });

    it('la administración lee el padrón completo, con y sin seguro', () => {
      const pagina = buscar(admin, { limit: 50 });
      const conSeguro = pagina.items.filter((fila) => fila.insurers.length > 0);
      const sinSeguro = pagina.items.filter((fila) => fila.insurers.length === 0);

      expect(pagina.total).toBeGreaterThan(10);
      expect(conSeguro.length).toBeGreaterThan(0);
      expect(sinSeguro.length).toBeGreaterThan(0);
    });

    it('la aseguradora lee sólo a sus afiliados y ve únicamente su aseguradora', () => {
      const pagina = buscar(aseguradora, { limit: 50 });

      expect(pagina.items.length).toBeGreaterThan(0);
      expect(pagina.total).toBeLessThan(buscar(admin, { limit: 50 }).total);
      for (const fila of pagina.items) {
        expect(fila.insurers).toHaveLength(1);
        expect(fila.insurers[0]!.name).toContain('Seguros Andina');
      }
    });

    it.each([
      ['la médica', medica],
      ['la paciente', paciente],
      ['sin sesión', null],
    ])('%s recibe 403 en las tres rutas', (_nombre, user) => {
      expect(estado(llamar('POST', '/insurance/patients/search', user, {}))).toBe(403);
      expect(estado(llamar('GET', '/insurance/patients/options', user))).toBe(403);
      expect(
        estado(
          llamar('POST', '/insurance/patients/conversation', user, {
            patientProfileId: '00000000-0000-4000-8000-000000000000',
            channel: 'internal',
          }),
        ),
      ).toBe(403);
    });
  });

  describe('opciones', () => {
    it('la administración ve todas las aseguradoras; la aseguradora, sólo la suya', () => {
      const todas = llamar<PatientDirectoryOptions>('GET', '/insurance/patients/options', admin);
      const propia = llamar<PatientDirectoryOptions>('GET', '/insurance/patients/options', aseguradora);
      if (isMockReply(todas) || isMockReply(propia)) throw new Error('Se esperaban las opciones');

      expect(todas.insurers.length).toBeGreaterThan(1);
      expect(propia.insurers).toHaveLength(1);
      expect(propia.insurers[0]!.name).toContain('Seguros Andina');
    });
  });

  describe('filtros y paginación', () => {
    it('ordena por nombre, con total exacto y cursor hasta agotar el padrón', () => {
      const primera = buscar(admin, { limit: 10 });
      const nombres = primera.items.map((fila) => fila.fullName);
      expect([...nombres].sort((a, b) => a.localeCompare(b, 'es'))).toEqual(nombres);
      expect(primera.limit).toBe(10);
      expect(primera.nextCursor).not.toBeNull();

      const vistos = new Set(primera.items.map((fila) => fila.patientProfileId));
      let siguiente = primera.nextCursor;
      while (siguiente !== null) {
        const pagina = buscar(admin, { limit: 10, cursor: siguiente });
        for (const fila of pagina.items) vistos.add(fila.patientProfileId);
        siguiente = pagina.nextCursor;
      }
      expect(vistos.size).toBe(primera.total);
    });

    it('la búsqueda ignora tildes y mayúsculas', () => {
      const pagina = buscar(admin, { search: 'PEREZ' });
      expect(pagina.items.map((fila) => fila.fullName)).toContain('Ana Lucía Pérez Quiroga');
    });

    it('el filtro por seguro separa a quienes lo tienen de quienes no', () => {
      const con = buscar(admin, { insuranceStatus: 'WITH_INSURANCE', limit: 50 });
      const sin = buscar(admin, { insuranceStatus: 'NO_INSURANCE', limit: 50 });

      expect(con.items.every((fila) => fila.insurers.length > 0)).toBe(true);
      expect(sin.items.every((fila) => fila.insurers.length === 0)).toBe(true);
      expect(con.total + sin.total).toBe(buscar(admin, { limit: 50 }).total);
    });

    it('un filtro no amplía el alcance: la aseguradora no ve afiliados de otra', () => {
      const todas = llamar<PatientDirectoryOptions>('GET', '/insurance/patients/options', admin);
      if (isMockReply(todas)) throw new Error('Se esperaban las opciones');
      const ajena = todas.insurers.find((a) => !a.name.includes('Seguros Andina'))!;

      expect(buscar(aseguradora, { insuranceCarrierId: ajena.id }).items).toEqual([]);
    });

    it('un tamaño de página que la tabla no ofrece es 400, como la API', () => {
      expect(estado(llamar('POST', '/insurance/patients/search', admin, { limit: 7 }))).toBe(400);
    });

    it('un cursor que no es de este directorio es 400', () => {
      expect(estado(llamar('POST', '/insurance/patients/search', admin, { cursor: 'no-es-un-cursor' }))).toBe(400);
    });

    it('quien no tiene fecha de nacimiento no trae edad: no se inventa una', () => {
      const filas = buscar(admin, { limit: 50 }).items;
      for (const fila of filas) {
        if (fila.birthDate === undefined) expect(fila.age).toBeUndefined();
        else expect(Number.isInteger(fila.age)).toBe(true);
      }
    });

    it('la respuesta es mínima: filiación y contacto, nada clínico', () => {
      // «Pérez Quiroga» es la paciente de demostración: trae fecha de nacimiento.
      const [fila] = buscar(admin, { search: 'Pérez Quiroga' }).items;
      expect(Object.keys(fila!).sort()).toEqual(
        expect.arrayContaining(['patientProfileId', 'fullName', 'birthDate', 'insurers', 'messaging']),
      );
      expect(Object.keys(fila!)).not.toContain('nationalId');
      expect(fila!.messaging.channel).toBe('internal');
    });
  });

  describe('conversación interna', () => {
    it('un paciente fuera del alcance de la aseguradora es 404, como uno que no existe', () => {
      const sinSeguro = buscar(admin, { insuranceStatus: 'NO_INSURANCE' }).items[0]!;

      expect(
        estado(
          llamar('POST', '/insurance/patients/conversation', aseguradora, {
            patientProfileId: sinSeguro.patientProfileId,
            channel: 'internal',
          }),
        ),
      ).toBe(404);
    });

    it('un canal que no es «internal» es 400', () => {
      const [fila] = buscar(aseguradora).items;
      expect(
        estado(
          llamar('POST', '/insurance/patients/conversation', aseguradora, {
            patientProfileId: fila!.patientProfileId,
            channel: 'sms',
          }),
        ),
      ).toBe(400);
    });

    it('un paciente sin perfil de comunidad no tiene chat interno y abrirlo es 422', () => {
      // Sin perfil de comunidad no hay con qué abrir el hilo, sea quien sea el
      // que escribe: no depende de qué otros archivos hayan creado vitrinas.
      const sinChat = buscar(aseguradora, { limit: 50 }).items.find((fila) => !fila.messaging.available);
      expect(sinChat, 'algún afiliado sin perfil de comunidad').toBeDefined();

      const respuesta = llamar('POST', '/insurance/patients/conversation', aseguradora, {
        patientProfileId: sinChat!.patientProfileId,
        channel: 'internal',
      });
      expect(estado(respuesta)).toBe(422);
    });
  });
});
