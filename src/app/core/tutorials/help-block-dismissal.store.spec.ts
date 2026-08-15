import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import { HELP_BLOCK_STORAGE, HelpBlockDismissalStore } from './help-block-dismissal.store';

/**
 * Lo que estas pruebas fijan:
 *
 * 1. Un bloque cerrado queda cerrado hasta que se le pida explícitamente.
 * 2. El cierre es por cuenta, no del navegador — mismo criterio que el
 *    progreso de tutoriales.
 * 3. Un almacenamiento caído degrada a memoria, nunca tumba la pantalla.
 */

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

class MemoriaStorage {
  readonly datos = new Map<string, ReadonlySet<string>>();
  read(clave: string): ReadonlySet<string> {
    return this.datos.get(clave) ?? new Set();
  }
  write(clave: string, descartadas: ReadonlySet<string>): void {
    this.datos.set(clave, descartadas);
  }
}

describe('HelpBlockDismissalStore', () => {
  let store: HelpBlockDismissalStore;
  let storage: MemoriaStorage;
  let session: SessionStore;

  beforeEach(() => {
    storage = new MemoriaStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: HELP_BLOCK_STORAGE, useValue: storage }],
    });
    store = TestBed.inject(HelpBlockDismissalStore);
    session = TestBed.inject(SessionStore);
  });

  function abrirSesion(usuario: string): void {
    session.start({
      accessToken: jwt({ sub: usuario, roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
  }

  it('un bloque nunca cerrado no está descartado', () => {
    expect(store.isDismissed('perfil-trayectoria-ayuda')).toBe(false);
  });

  it('cerrar un bloque lo deja descartado', () => {
    store.dismiss('perfil-trayectoria-ayuda');
    expect(store.isDismissed('perfil-trayectoria-ayuda')).toBe(true);
  });

  it('cerrar un bloque no afecta a los demás', () => {
    store.dismiss('perfil-trayectoria-ayuda');
    expect(store.isDismissed('perfil-credenciales-ayuda')).toBe(false);
  });

  it('el cierre es por cuenta: cambiar de sesión no hereda lo del anterior', () => {
    abrirSesion('doctora-1');
    TestBed.tick();
    store.dismiss('perfil-trayectoria-ayuda');
    expect(store.isDismissed('perfil-trayectoria-ayuda')).toBe(true);

    abrirSesion('doctora-2');
    TestBed.tick();
    expect(store.isDismissed('perfil-trayectoria-ayuda')).toBe(false);
  });

  it('volver a entrar con la cuenta de antes recupera lo suyo', () => {
    abrirSesion('doctora-1');
    TestBed.tick();
    store.dismiss('perfil-trayectoria-ayuda');

    abrirSesion('doctora-2');
    TestBed.tick();
    abrirSesion('doctora-1');
    TestBed.tick();

    expect(store.isDismissed('perfil-trayectoria-ayuda')).toBe(true);
  });

  it('un almacenamiento que tira al escribir no rompe el cierre en memoria', () => {
    const rota = new MemoriaStorage();
    rota.write = () => {
      throw new Error('cuota llena');
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: HELP_BLOCK_STORAGE, useValue: rota }] });
    const rotaStore = TestBed.inject(HelpBlockDismissalStore);

    expect(() => rotaStore.dismiss('perfil-trayectoria-ayuda')).not.toThrow();
    expect(rotaStore.isDismissed('perfil-trayectoria-ayuda')).toBe(true);
  });
});
