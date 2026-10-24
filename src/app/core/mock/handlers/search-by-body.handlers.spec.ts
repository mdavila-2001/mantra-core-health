import { HttpHeaders } from '@angular/common/http';

import { registrarPerfiles } from './profiles.handlers';
import { registrarAuth } from './auth.handlers';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';

interface Page<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

interface PatientRow {
  readonly profileId: string;
  readonly displayName?: string;
  readonly nationalId?: string;
}

interface UserRow {
  readonly id: string;
  readonly displayName: string;
}

/**
 * `POST /profiles/patients/search` y `POST /iam/users/search`: la búsqueda con
 * los filtros en el cuerpo, que es la que usan los clientes para que el nombre,
 * el documento o el correo no viajen en la URL. El simulador tiene que
 * responder lo mismo que el `GET` obsoleto con esos filtros en la query: son la
 * misma búsqueda, sólo cambia por dónde llegan.
 */
describe('handlers de búsqueda por cuerpo', () => {
  const router = new MockRouter();
  registrarPerfiles(router);
  registrarAuth(router);
  const admin = buscarUsuario('admin')!;

  function call<T>(
    method: MockMethod,
    path: string,
    { body = null, query = '' }: { body?: unknown; query?: string } = {},
  ): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user: admin,
    }) as T;
  }

  const searchPatients = (body: unknown) =>
    call<Page<PatientRow>>('POST', '/profiles/patients/search', { body });
  const searchUsers = (body: unknown) =>
    call<Page<UserRow>>('POST', '/iam/users/search', { body });

  describe('pacientes', () => {
    it('correcto — por documento encuentra lo mismo que el GET con `?nationalId=`', () => {
      const someone = searchPatients({}).items.find((p) => (p.nationalId ?? '') !== '')!;

      const byBody = searchPatients({ nationalId: someone.nationalId });
      const byQuery = call<Page<PatientRow>>('GET', '/profiles/patients', {
        query: `nationalId=${someone.nationalId}`,
      });

      expect(byBody.items.map((p) => p.profileId)).toContain(someone.profileId);
      expect(byBody).toEqual(byQuery);
    });

    it('límite — respeta `limit` y `cursor` del cuerpo como paginación', () => {
      const first = searchPatients({ limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).toBe('2');

      const second = searchPatients({ limit: 2, cursor: first.nextCursor });
      expect(second.items[0]?.profileId).not.toBe(first.items[0]?.profileId);
    });

    it('inválido — un documento que nadie tiene devuelve una página vacía, y un cuerpo nulo no filtra', () => {
      expect(searchPatients({ nationalId: '0000000000' }).count).toBe(0);
      expect(searchPatients(null).count).toBe(searchPatients({}).count);
    });
  });

  describe('usuarios', () => {
    it('correcto — `q` filtra por el nombre visible', () => {
      const page = searchUsers({ q: 'Valeria' });

      expect(page.count).toBeGreaterThan(0);
      expect(page.items.every((u) => u.displayName.includes('Valeria'))).toBe(true);
    });

    it('límite — sin filtros devuelve el padrón paginado y `limit` lo corta', () => {
      const all = searchUsers({});
      const one = searchUsers({ limit: 1 });

      expect(all.count).toBeGreaterThan(1);
      expect(one.items).toHaveLength(1);
      expect(one.count).toBe(all.count);
    });

    it('inválido — un texto que nadie tiene y un estado inexistente devuelven vacío', () => {
      expect(searchUsers({ q: 'zzz-nadie-se-llama-así' }).count).toBe(0);
      expect(searchUsers({ status: 'estado-que-no-existe' }).count).toBe(0);
    });
  });
});
