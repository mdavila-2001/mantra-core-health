import { TestBed } from '@angular/core/testing';

import { SessionBroadcast } from './session-broadcast';

/**
 * El canal reparte credenciales entre pestañas del mismo origen, así que lo que
 * entra por él tiene que validarse igual que lo que entra por la red. Una sesión
 * a medias adoptada como buena dejaría a la persona con un token roto hasta el
 * siguiente 401 — y el fallo aparecería lejos de su causa.
 *
 * En jsdom no hay `BroadcastChannel` real, así que `publicar` no llega a
 * ninguna parte: lo que se prueba acá es la mitad que sí corre en todos lados,
 * la de decidir qué se acepta.
 */
describe('SessionBroadcast', () => {
  let broadcast: SessionBroadcast;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    broadcast = TestBed.inject(SessionBroadcast);
  });

  it('arranca sin nada publicado', () => {
    expect(broadcast.ultimaPublicada()).toBeNull();
  });

  it('recuerda la última sesión recibida', () => {
    const session = {
      accessToken: 'a-1',
      refreshToken: 'r-1',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    };
    broadcast.recibir(session);

    expect(broadcast.ultimaPublicada()).toEqual(session);
  });

  it('la última gana: una rotación posterior reemplaza a la anterior', () => {
    const vieja = {
      accessToken: 'a-1',
      refreshToken: 'r-1',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    };
    const nueva = {
      accessToken: 'a-2',
      refreshToken: 'r-2',
      expiresAt: new Date('2026-08-01T12:15:00.000Z'),
    };
    broadcast.recibir(vieja);
    broadcast.recibir(nueva);

    expect(broadcast.ultimaPublicada()?.refreshToken).toBe('r-2');
  });

  it('publicar sin canal disponible no rompe', () => {
    // Bajo jsdom no hay `BroadcastChannel`: el servicio tiene que degradar, no
    // lanzar. Si lanzara, se llevaría por delante el refresco entero — que es
    // el camino del que cuelga la sesión.
    expect(() =>
      broadcast.publicar({
        accessToken: 'a-1',
        refreshToken: 'r-1',
        expiresAt: new Date('2026-08-01T12:00:00.000Z'),
      }),
    ).not.toThrow();
  });
});
