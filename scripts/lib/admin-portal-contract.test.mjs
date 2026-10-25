/* ============================================================================
    Pruebas de `admin-portal-contract.mjs`: la lectura de las llamadas HTTP de
    los clientes del portal y su comparación contra el contrato.

    Las fuentes de prueba reproducen las tres formas reales de los clientes:
    `this.http.<verbo>(this.url(…))` en una o varias líneas, el ayudante privado
    que recibe la ruta (`portal.client`) y la ruta armada sobre un `const base`.

    Uso:  node --test scripts/lib/admin-portal-contract.test.mjs
    ========================================================================== */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clientFiles, compare, extractOperations, readable, scanPortalOperations, shapeOf } from './admin-portal-contract.mjs';

const CONTRACT = [
  'GET /authz/roles',
  'POST /authz/users/{userId}/role-assignments',
  'DELETE /authz/users/{userId}/role-assignments/{assignmentId}',
  'GET /audit/log',
  'GET /admin/portal/flujos/{codigo}',
];

describe('shapeOf / readable', () => {
  it('iguala interpolación y llave sin importar el nombre del parámetro', () => {
    assert.equal(shapeOf('/authz/users/${encodeURIComponent(userId)}/x'), '/authz/users/{}/x');
    assert.equal(shapeOf('/authz/users/{id}/x'), '/authz/users/{}/x');
  });

  it('ignora la query y la barra final', () => {
    assert.equal(shapeOf('/audit/log?limit=5'), '/audit/log');
    assert.equal(shapeOf('/audit/log/'), '/audit/log');
  });

  it('lee `${encodeURIComponent(userId)}` como {userId}', () => {
    assert.equal(readable('/a/${encodeURIComponent(userId)}/b'), '/a/{userId}/b');
  });
});

describe('extractOperations', () => {
  it('lee la llamada en una línea y encadenada en varias', () => {
    const { operations, unresolved } = extractOperations(`
      a() { return this.http.get<readonly Role[]>(this.url('/authz/roles')); }
      b(userId: string) {
        return this.http
          .post<Created>(
            this.url(\`/authz/users/\${encodeURIComponent(userId)}/role-assignments\`),
            body,
          );
      }
    `);
    assert.deepEqual(
      operations.map((operation) => `${operation.method} ${operation.route}`),
      ['GET /authz/roles', 'POST /authz/users/${encodeURIComponent(userId)}/role-assignments'],
    );
    assert.equal(unresolved, 0);
  });

  it('resuelve el ayudante privado que recibe la ruta', () => {
    const { operations, unresolved } = extractOperations(`
      flow(codigo: string) { return this.get(\`/admin/portal/flujos/\${encodeURIComponent(codigo)}\`); }
      private get<T>(path: string, query = {}): Observable<T> {
        return this.http.get<T>(apiUrl(this.baseUrl, path), { params: query });
      }
    `);
    assert.deepEqual(operations.map((operation) => operation.method), ['GET']);
    assert.equal(unresolved, 0);
  });

  it('expande una ruta armada sobre un const base', () => {
    const { operations } = extractOperations(`
      list() {
        const base = '/audit';
        return this.http.get<X>(this.url(\`\${base}/log\`));
      }
    `);
    assert.equal(operations[0].route, '/audit/log');
  });

  it('cuenta como sin resolver la llamada con ruta no literal', () => {
    const { operations, unresolved } = extractOperations(`
      x(path: string) { return this.http.get<X>(this.url(path)); }
    `);
    assert.equal(operations.length, 0);
    assert.equal(unresolved, 1);
  });
});

describe('compare', () => {
  const scanOf = (...routes) => ({
    operations: routes.map(([method, route]) => ({ method, route, file: 'x.client.ts', key: `${method} ${shapeOf(route)}` })),
    unresolved: [],
  });

  it('acepta las llamadas que el contrato declara, con otro nombre de parámetro', () => {
    const result = compare(scanOf(['GET', '/authz/roles'], ['DELETE', '/authz/users/${id}/role-assignments/${a}']), CONTRACT);
    assert.deepEqual(result.missing, []);
  });

  it('denuncia la ruta inexistente y el método equivocado', () => {
    const result = compare(scanOf(['GET', '/authz/inexistente'], ['PUT', '/authz/roles']), CONTRACT);
    assert.deepEqual(
      result.missing.map((item) => item.call),
      ['GET /authz/inexistente', 'PUT /authz/roles'],
    );
  });

  it('tolera una brecha conocida y avisa cuando el contrato ya la declara', () => {
    const gap = { call: 'GET /audit/nueva', reason: 'solo en test' };
    const tolerated = compare(scanOf(['GET', '/audit/nueva']), CONTRACT, [gap]);
    assert.deepEqual(tolerated.missing, []);
    assert.equal(tolerated.tolerated.length, 1);

    const stale = compare(scanOf(['GET', '/audit/log']), CONTRACT, [{ call: 'GET /audit/log', reason: 'vencida' }]);
    assert.equal(stale.stale.length, 1);
  });
});

describe('clientes reales', () => {
  it('lee los clientes del repositorio sin dejar llamadas ilegibles', () => {
    const files = clientFiles();
    assert.ok(files.length > 0, 'no se encontró ningún cliente');
    const scan = scanPortalOperations(files);
    assert.deepEqual(scan.unresolved, []);
    assert.ok(scan.operations.length > 0);
  });
});
