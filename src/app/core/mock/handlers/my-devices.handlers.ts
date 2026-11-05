import { unauthorized, type MockRouter } from '../mock-router';
import { ahora, uuid } from '../mock-store';
import { dispositivos } from './support-access.session.handlers';

/**
 * `GET /iam/me/devices` — the devices the account signed in from. The simulated browser is
 * always one of them (untrusted until verified with the e-mailed code, `12345678`); verifying
 * reuses `…/confirm-code` and `…/confirm` from `support-access.session.handlers.ts`.
 */
export function registrarMisDispositivos(router: MockRouter): void {
  router.get('/iam/me/devices', (request) => {
    const user = request.user;
    if (user === null) return unauthorized('Sesión vencida');
    const actual = uuid(`este-dispositivo-${user.key}`);
    if (dispositivos.get(actual) === undefined) dispositivos.agregar({ id: actual, userId: user.id, trusted: false });
    const cuando = ahora();
    return dispositivos
      .filtrar((fila) => fila.userId === user.id)
      .map((fila) => ({
        id: fila.id,
        name: fila.id === actual ? 'Este navegador' : 'Chrome en Windows · equipo nuevo',
        platform: 'WEB',
        trusted: fila.trusted,
        current: fila.id === actual,
        activeSessions: fila.id === actual ? 1 : 0,
        lastSeenAt: cuando,
        createdAt: cuando,
      }));
  });
}
