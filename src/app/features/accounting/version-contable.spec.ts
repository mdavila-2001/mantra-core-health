import { afterEach, describe, expect, it, vi } from 'vitest';

import { GLOSARIO, glosarioDe } from './registros/registros.formato';
import {
  CLAVE_DE_VERSION,
  OPCIONES_DE_VERSION,
  VERSION_POR_OMISION,
  guardarVersion,
  versionGuardada,
} from './version-contable';

describe('la versión Doctor / Contador', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage?.removeItem(CLAVE_DE_VERSION);
  });

  it('por omisión es Doctor y las dos opciones tienen nombre accesible', () => {
    expect(VERSION_POR_OMISION).toBe('doctor');
    expect(OPCIONES_DE_VERSION.map((o) => o.value)).toEqual(['doctor', 'contador']);
    expect(OPCIONES_DE_VERSION.every((o) => (o.description ?? '').length > 0)).toBe(true);
  });

  it('guarda y recupera la versión elegida', () => {
    guardarVersion('contador');
    expect(versionGuardada()).toBe('contador');
    guardarVersion('doctor');
    expect(versionGuardada()).toBe('doctor');
  });

  it('con el almacenamiento bloqueado no se rompe y vale la de por omisión', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(versionGuardada()).toBe('doctor');
    expect(() => guardarVersion('contador')).not.toThrow();
  });

  it('el glosario del doctor no trae el vocabulario de los libros', () => {
    const doctor = glosarioDe(false).map((t) => t.termino);
    expect(doctor).toEqual(['Gasto', 'Activo', 'Deuda']);
    expect(glosarioDe(true)).toEqual(GLOSARIO);
    expect(glosarioDe(true).map((t) => t.termino)).toEqual(
      expect.arrayContaining(['Debe', 'Haber', 'Transacción', 'Cuenta']),
    );
  });
});
