import { describe, expect, it } from 'vitest';

import type { TablaOperacion } from '../../../../core/data-access/admin-portal/portal.types';
import { groupTables, tablesPhrase } from './operation-tables';

function row(over: Partial<TablaOperacion>): TablaOperacion {
  return {
    schema: 'billing',
    tabla: 'bills',
    operacion: 'LEE',
    detalle: 'LEE',
    confianza: 'DIRECTA',
    via: ['C.h', 'S.m', 'R.f'],
    fuente: 'bills.repository.ts:155',
    catalogada: true,
    ...over,
  };
}

describe('groupTables', () => {
  it('sin filas devuelve todo vacío y todos los conteos en cero', () => {
    const g = groupTables([]);
    expect(g.escribe).toEqual([]);
    expect(g.lee).toEqual([]);
    expect(g.otros).toEqual([]);
    expect(g.resumen).toEqual({
      distintas: 0,
      escribe: 0,
      lee: 0,
      soloLee: 0,
      leeYEscribe: 0,
      borra: 0,
      accesos: 0,
    });
  });

  it('separa lo que lee de lo que escribe y una tabla que hace las dos cosas sale en los dos grupos', () => {
    const g = groupTables([
      row({ operacion: 'ESCRIBE', detalle: 'CREA', fuente: 'bills.repository.ts:177' }),
      row({ operacion: 'LEE', fuente: 'bills.repository.ts:155' }),
      row({ tabla: 'vendors', fuente: 'bills.repository.ts:166' }),
    ]);
    expect(g.escribe.map((t) => t.clave)).toEqual(['billing.bills']);
    expect(g.lee.map((t) => t.clave)).toEqual(['billing.bills', 'billing.vendors']);
    expect(g.escribe[0]!.accesos.map((a) => a.fuente)).toEqual(['bills.repository.ts:177']);
    expect(g.lee[0]!.accesos.map((a) => a.fuente)).toEqual(['bills.repository.ts:155']);
    expect(g.resumen).toMatchObject({ distintas: 2, escribe: 1, lee: 2, soloLee: 1, leeYEscribe: 1, accesos: 3 });
  });

  it('cuenta tablas, no filas: dos accesos a la misma tabla son una tabla', () => {
    const g = groupTables([
      row({ operacion: 'ESCRIBE', detalle: 'CREA' }),
      row({ operacion: 'ESCRIBE', detalle: 'ACTUALIZA' }),
    ]);
    expect(g.escribe).toHaveLength(1);
    expect(g.escribe[0]!.accesos).toHaveLength(2);
    expect(g.resumen).toMatchObject({ distintas: 1, escribe: 1, accesos: 2 });
  });

  it('BORRA cuenta como escritura y además se informa aparte', () => {
    const g = groupTables([row({ operacion: 'BORRA', detalle: 'BORRA' }), row({ tabla: 'x', operacion: 'ESCRIBE' })]);
    expect(g.escribe.map((t) => t.tabla)).toEqual(['bills', 'x']);
    expect(g.resumen).toMatchObject({ escribe: 2, borra: 1 });
  });

  it('un verbo desconocido no se descarta ni se cuenta como lectura o escritura', () => {
    const g = groupTables([row({ operacion: 'TRUNCA' })]);
    expect(g.otros).toHaveLength(1);
    expect(g.lee).toEqual([]);
    expect(g.escribe).toEqual([]);
    expect(g.resumen).toMatchObject({ distintas: 1, lee: 0, escribe: 0, accesos: 1 });
  });

  it('una tabla fuera del catálogo en cualquiera de sus accesos queda marcada como tal', () => {
    const g = groupTables([row({ catalogada: true }), row({ catalogada: false })]);
    expect(g.lee[0]!.catalogada).toBe(false);
  });
});

describe('tablesPhrase', () => {
  it('concuerda en singular y plural y dice «ninguna» en cero', () => {
    expect(tablesPhrase(0)).toBe('ninguna');
    expect(tablesPhrase(1)).toBe('1 tabla');
    expect(tablesPhrase(4)).toBe('4 tablas');
  });
});
