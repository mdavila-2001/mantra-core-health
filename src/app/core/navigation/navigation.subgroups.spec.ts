import { describe, expect, it } from 'vitest';

import { APP_SECTIONS } from './navigation.map';
import { NAV_GROUP_ICONS, NAV_SUBGROUPS, SUBGROUP_BY_PATH } from './navigation.subgroups';
import { NAV_GROUPS, NAV_ICON_NAMES } from './navigation.types';

/* ============================================================================
    El guardia del reparto.

    `navigation.subgroups.ts` nombra secciones por su `path`, y el registro vive
    en otro archivo: sin estas pruebas las dos listas se separan en silencio, y
    la forma de enterarse sería una barra con un renglón suelto al final o un
    bloque que se dibuja vacío. Cada `it` de acá es una de las maneras concretas
    en que pueden separarse.
    ========================================================================== */

describe('NAV_SUBGROUPS', () => {
  const rutasDelRegistro = APP_SECTIONS.map((seccion) => seccion.path);
  const rutasRepartidas = NAV_SUBGROUPS.flatMap((bloque) => bloque.paths);

  it('cada bloque nombra rutas que el registro declara', () => {
    const inventadas = rutasRepartidas.filter((ruta) => !rutasDelRegistro.includes(ruta));

    // Una ruta que ya no existe no rompe nada visible —el bloque simplemente
    // no la encuentra— y por eso hace falta preguntarlo: es exactamente lo que
    // deja un renombre de sección a medio hacer.
    expect(inventadas).toEqual([]);
  });

  it('reparte el registro entero: ninguna sección se queda sin bloque', () => {
    const sinBloque = rutasDelRegistro.filter((ruta) => !rutasRepartidas.includes(ruta));

    // Si esto falla, la sección nueva funciona igual: el armazón la dibuja
    // suelta, con su propio ícono. Lo que falta es decidir **con quién va**, y
    // eso es una línea en `NAV_SUBGROUPS`, no un arreglo de código.
    expect(sinBloque).toEqual([]);
  });

  it('ninguna sección está en dos bloques a la vez', () => {
    const vistas = new Set<string>();
    const repetidas = rutasRepartidas.filter((ruta) => {
      if (vistas.has(ruta)) {
        return true;
      }
      vistas.add(ruta);
      return false;
    });

    // Estar en dos la dibujaría dos veces, y el menú diría que hay dos puertas
    // donde hay una.
    expect(repetidas).toEqual([]);
  });

  it('un bloque no mezcla dominios: sus secciones son todas de su grupo', () => {
    const mezcladas = NAV_SUBGROUPS.flatMap((bloque) =>
      bloque.paths
        .map((ruta) => APP_SECTIONS.find((seccion) => seccion.path === ruta))
        .filter((seccion) => seccion !== undefined && seccion.group !== bloque.group)
        .map((seccion) => `${bloque.label} ← ${seccion?.path} (${seccion?.group})`),
    );

    // El bloque se dibuja dentro de su grupo: una sección de otro dominio
    // metida acá **no se dibujaría en ningún lado**, porque el armazón sólo le
    // pasa a cada grupo sus propias secciones.
    expect(mezcladas).toEqual([]);
  });

  it('cada bloque declara un grupo del menú y un ícono del set cerrado', () => {
    for (const bloque of NAV_SUBGROUPS) {
      expect(NAV_GROUPS).toContain(bloque.group);
      expect(NAV_ICON_NAMES).toContain(bloque.icon);
      expect(bloque.label.trim()).not.toBe('');
    }
  });

  it('dos bloques del mismo grupo no comparten rótulo: es la clave del plegado', () => {
    const claves = NAV_SUBGROUPS.map((bloque) => `${bloque.group}/${bloque.label}`);

    // El armazón recuerda qué desplegó la persona con esa clave, y `@for` la
    // usa de `track`. Repetida, plegar uno plegaría el otro.
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('el índice por ruta ve lo mismo que la lista', () => {
    expect(SUBGROUP_BY_PATH.size).toBe(rutasRepartidas.length);
    for (const bloque of NAV_SUBGROUPS) {
      for (const ruta of bloque.paths) {
        expect(SUBGROUP_BY_PATH.get(ruta)).toBe(bloque);
      }
    }
  });
});

describe('NAV_GROUP_ICONS', () => {
  it('todos los grupos del menú tienen ícono, y del set cerrado', () => {
    for (const grupo of NAV_GROUPS) {
      const icono = NAV_GROUP_ICONS[grupo];
      expect(icono).toBeDefined();
      expect(NAV_ICON_NAMES).toContain(icono);
    }
  });
});
