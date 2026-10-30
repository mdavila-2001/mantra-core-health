import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import { SearchMemoryService } from './search-memory.service';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

const ANA = makeToken({ sub: 'u-ana', sid: 's-1', roles: ['USER'], tenants: ['t-1'] });
const BRUNO = makeToken({ sub: 'u-bruno', sid: 's-2', roles: ['USER'], tenants: ['t-1'] });

describe('SearchMemoryService', () => {
  let memory: SearchMemoryService;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    session = TestBed.inject(SessionStore);
    session.start({ accessToken: ANA, refreshToken: 'r-1' });
    memory = TestBed.inject(SearchMemoryService);
  });

  it('correcto — devuelve lo último que se guardó para esa pantalla, y cada pantalla tiene lo suyo', () => {
    memory.write('patients', { q: 'Quispe' });
    memory.write('clinical-record', { nationalId: '4455667' });

    expect(memory.read('patients')).toEqual({ q: 'Quispe' });
    expect(memory.read('clinical-record')).toEqual({ nationalId: '4455667' });
  });

  it('límite — guardar sólo valores vacíos es olvidar, y `forget` también', () => {
    memory.write('patients', { q: 'Quispe' });
    memory.write('patients', { q: '', nationalId: '' });
    expect(memory.read('patients')).toEqual({});

    memory.write('patients', { q: 'Quispe' });
    memory.forget('patients');
    expect(memory.read('patients')).toEqual({});
  });

  it('inválido — lo que buscó una sesión no lo ve la siguiente, ni tras cerrar sesión', () => {
    memory.write('patients', { q: 'Quispe' });

    session.clear();
    TestBed.tick();
    session.start({ accessToken: BRUNO, refreshToken: 'r-2' });

    expect(memory.read('patients')).toEqual({});
  });

  it('inválido — al cerrar sesión se olvida sin esperar a la próxima lectura', () => {
    memory.write('patients', { q: 'Quispe' });

    session.clear();
    TestBed.tick();
    // Vuelve la misma cuenta: igual no hay nada, porque ya se había olvidado.
    session.start({ accessToken: ANA, refreshToken: 'r-3' });

    expect(memory.read('patients')).toEqual({});
  });
});
