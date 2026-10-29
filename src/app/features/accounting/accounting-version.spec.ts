import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_VERSION,
  VERSION_OPTIONS,
  VERSION_STORAGE_KEY,
  saveVersion,
  savedVersion,
} from './accounting-version';

describe('la versión Doctor / Contador', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage?.removeItem(VERSION_STORAGE_KEY);
  });

  it('por omisión es Doctor y las dos opciones tienen nombre accesible', () => {
    expect(DEFAULT_VERSION).toBe('doctor');
    expect(VERSION_OPTIONS.map((o) => o.value)).toEqual(['doctor', 'contador']);
    expect(VERSION_OPTIONS.every((o) => (o.description ?? '').length > 0)).toBe(true);
  });

  it('guarda y recupera la versión elegida', () => {
    saveVersion('contador');
    expect(savedVersion()).toBe('contador');
    saveVersion('doctor');
    expect(savedVersion()).toBe('doctor');
  });

  it('con el almacenamiento bloqueado no se rompe y vale la de por omisión', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(savedVersion()).toBe('doctor');
    expect(() => saveVersion('contador')).not.toThrow();
  });
});
