/* ============================================================================
    Las categorías con las que el directorio público acota dentro de un
    vertical.

    `kind` dice de qué vertical es una ficha —farmacia, organización,
    aseguradora— y hasta ahora era lo único que decía **qué** es. El directorio
    de farmacias listaba sus 65 resultados de corrido, y el de clínicas mezclaba
    en una sola lista clínicas privadas, hospitales de referencia, cajas de
    salud y centros de primer nivel, que son cuatro cosas distintas para quien
    busca dónde atenderse.

    Este archivo es el escalón que faltaba. No inventa nada: cada categoría sale
    de un campo que la semilla **ya declara** —el sector del hospital, el ramo
    de la aseguradora, la cadena de la sucursal— y lo único que se agrega es el
    nombre con el que se escribe en pantalla.

    ## Por qué el código y la etiqueta viajan juntos

    Porque el código es identidad y la etiqueta es presentación: `?categoria=`
    lleva el código —estable, pegable en un mensaje— y el chip dibuja la
    etiqueta, que cambia con el catálogo y con el idioma. Un chip que llevara la
    etiqueta a la URL rompería el enlace de alguien el día que «Caja de salud»
    pase a llamarse «Seguridad social de corto plazo».
    ========================================================================== */

/** Una categoría: su código estable y cómo se escribe. */
export interface CategoriaSimulada {
  readonly code: string;
  readonly label: string;
}

/**
 * Las categorías fijas, las que no dependen de un catálogo que crece.
 *
 * Las de farmacia no están acá: salen de la cadena de cada sucursal, que es
 * una lista que el corpus puede ampliar. Ver {@link categoriaDeCadena}.
 */
export const CATEGORIA = {
  /* ---- organizaciones ---------------------------------------------------- */
  CLINICA_PRIVADA: { code: 'clinica-privada', label: 'Clínica privada' },
  HOSPITAL_PUBLICO: { code: 'hospital-publico', label: 'Hospital público' },
  /** Las cajas de la seguridad social de corto plazo. No son hospital público
      ni son privadas: atienden a sus asegurados, y quien no lo es no entra. */
  CAJA_DE_SALUD: { code: 'caja-de-salud', label: 'Caja de salud' },
  CENTRO_DE_PRIMER_NIVEL: {
    code: 'centro-de-primer-nivel',
    label: 'Centro de primer nivel',
  },

  /* ---- centros de diagnóstico -------------------------------------------- */
  LABORATORIO_CLINICO: { code: 'laboratorio-clinico', label: 'Laboratorio clínico' },
  IMAGENOLOGIA: { code: 'imagenologia', label: 'Imagenología' },

  /* ---- aseguradoras ------------------------------------------------------ */
  SEGURO_DE_SALUD: { code: 'seguro-de-salud', label: 'Seguro de salud' },
  /** Las que la planilla lista en el ramo de generales y fianzas: figuran en el
      directorio porque existen, pero no cubren salud y el chip lo dice. */
  SEGUROS_GENERALES: { code: 'seguros-generales', label: 'Seguros generales y fianzas' },

  /* ---- farmacias --------------------------------------------------------- */
  FARMACIA_INDEPENDIENTE: {
    code: 'farmacia-independiente',
    label: 'Farmacia independiente',
  },
  /**
   * La sucursal pertenece a una cadena que el corpus todavía no reconcilió
   * —`farmacia_cadena_o_nombre_comercial_pendiente_reconciliacion`—.
   *
   * Va a su propia categoría y no a «independiente»: llamarla independiente
   * sería afirmar algo que la fuente dice expresamente que no sabe.
   */
  CADENA_SIN_CONFIRMAR: { code: 'cadena-sin-confirmar', label: 'Cadena sin confirmar' },
} as const satisfies Record<string, CategoriaSimulada>;

/** `Farmacias Chávez` → `cadena-farmacias-chavez`. */
function codigoDeCadena(nombre: string): string {
  return `cadena-${nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')}`;
}

/**
 * La categoría de una sucursal de farmacia: **su cadena**.
 *
 * ## Por qué la cadena y no un tipo
 *
 * Porque es lo que distingue una farmacia de otra para quien elige. Las 65 del
 * directorio son casi todas mostradores que despachan lo mismo; lo que cambia
 * entre una y otra es la lista de precios, el programa de puntos y qué seguros
 * le aceptan, y las tres cosas cuelgan de la cadena. Un eje de «retail /
 * hospitalaria / homeopática» sería más limpio de contar y no lo podría usar
 * nadie: las 65 caerían en la primera casilla.
 *
 * Las que no pertenecen a ninguna cadena son `FARMACIA_INDEPENDIENTE`, que en
 * este directorio son quince y no un caso raro.
 */
export function categoriaDeCadena(
  nombreDeLaCadena: string | null,
  reconciliada = true,
): CategoriaSimulada {
  if (nombreDeLaCadena === null || nombreDeLaCadena === '') {
    return CATEGORIA.FARMACIA_INDEPENDIENTE;
  }
  if (!reconciliada) {
    return CATEGORIA.CADENA_SIN_CONFIRMAR;
  }
  return { code: codigoDeCadena(nombreDeLaCadena), label: nombreDeLaCadena };
}

/**
 * A qué cadena pertenece una farmacia de la que sólo se tiene el nombre.
 *
 * Las siete farmacias de la planilla del propietario son **razones sociales**
 * —«FARMACORP S.A.», «FARMACIA HIPERMAXI»—, no sucursales, así que no traen un
 * `chainId` que seguir. Se reconocen por el nombre contra las cadenas que el
 * corpus sí declara, y la que no coincide con ninguna queda independiente,
 * que es lo que es hasta que alguien demuestre lo contrario.
 */
export function cadenaPorNombre(
  nombre: string,
  cadenas: readonly { readonly name: string }[],
): string | null {
  const normal = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  for (const cadena of cadenas) {
    // La primera palabra distintiva de la cadena: «Farmacorp» de «Farmacorp»,
    // «hipermaxi» de «Hipermaxi Farmacias», «chavez» de «Farmacias Chávez».
    const clave = cadena.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/\s+/)
      .find((palabra) => palabra !== 'farmacias' && palabra !== 'farmacia');
    if (clave !== undefined && clave.length > 3 && normal.includes(clave)) {
      return cadena.name;
    }
  }
  return null;
}
