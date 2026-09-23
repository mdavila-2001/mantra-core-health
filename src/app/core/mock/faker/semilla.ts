import { fakerES } from '@faker-js/faker';

/* ============================================================================
    La semilla del generador.

    El backend simulado era determinista antes de que existiera este módulo:
    `uuid(semilla)` deriva los identificadores de un texto, así que un enlace
    copiado —`/p/valeria-rojas`, una cita, una receta— seguía abriendo lo mismo
    después de recargar. Meter un generador de datos falsos sin cuidado rompe
    justamente eso: `faker` arranca con una semilla aleatoria y cada recarga
    inventaría personas distintas con identificadores distintos.

    Por eso acá no se usa `faker` a secas en ningún sitio. Se usa `conSemilla`,
    que **resiembra antes de cada entidad** con un número derivado del nombre
    de esa entidad. Dos consecuencias que importan:

      1. El paciente número 37 es el mismo en cada carga, en cada pestaña y en
         cada máquina.
      2. Y lo es **independientemente del orden de generación**: si mañana un
         fixture pide sus pacientes antes que sus profesionales, nada cambia.
         Sin resembrar, el generador es un flujo y el orden lo decide todo.
    ========================================================================== */

/**
 * El mismo hash que `uuid()` en `mock-store.ts`, reducido a un entero.
 *
 * Se repite aquí en vez de importarlo para no atar `mock-store` —que es la
 * base de todo el mock— a este módulo, que es una hoja. La propiedad que se
 * necesita es la misma: mismo texto, mismo número, siempre.
 */
export function semillaDe(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Resiembra el generador y devuelve la instancia lista para usar.
 *
 * Se llama una vez por entidad, con un nombre que la identifique:
 *
 *   const f = conSemilla(`paciente-${indice}`);
 *   const nombre = f.person.firstName('female');
 */
export function conSemilla(nombre: string): typeof fakerES {
  fakerES.seed(semillaDe(nombre));
  return fakerES;
}

/**
 * Un apellido simple.
 *
 * El locale español de `faker` devuelve apellidos compuestos —«Narváez
 * Burgos»— porque asume que un apellido es el campo entero. Acá los dos
 * apellidos son campos distintos (`lastName` y `motherLastName`, que es como
 * viaja en el modelo), así que se toma sólo el primero.
 */
export function apellido(f: typeof fakerES): string {
  return f.person.lastName().split(' ')[0]!;
}

/** El slug con el que viaja una persona en las URLs públicas. */
export function slugDeNombre(nombre: string, apellidoPaterno: string): string {
  return `${nombre.split(' ')[0]}-${apellidoPaterno}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}
