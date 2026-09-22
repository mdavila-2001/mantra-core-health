/* ============================================================================
    De un nombre de ciudad al departamento al que pertenece.

    Lo comparten los directorios que filtran por lugar en dos pasos —primero el
    departamento en el mapa, después la ciudad en un chip—: el de clínicas, el
    de farmacias y el público de hospitales. Vivía duplicado dentro del listado
    compartido de `public-directories`, y la copia se habría separado de la
    original en cuanto alguien cambiara la forma de normalizar.
    ========================================================================== */

import type { RamaDepartamento } from '@core/data-access/terminology/bo-municipalities.service';

/**
 * Quita tildes y baja a minúsculas, para casar el nombre de ciudad que trae el
 * directorio con el del municipio del catálogo.
 *
 * Los dos vienen escritos por gente distinta —uno lo cargó la organización en
 * su ficha, el otro lo siembra terminología— y «Potosí» y «potosi» tienen que
 * ser la misma ciudad. Sin esto el mapa dejaría fuera justo a los
 * departamentos cuyo nombre lleva tilde, que son la mitad.
 */
export function normalizarLugar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * De cada ciudad publicada al `conceptId` de su departamento.
 *
 * Se arma con los municipios del catálogo, que es el dueño del dato: una tabla
 * de ciudades escrita a mano se separaría del catálogo en cuanto alguien
 * sembrara un municipio nuevo, y el directorio empezaría a esconder centros sin
 * que nadie lo notara.
 */
export function departamentoPorCiudad(
  ramas: readonly RamaDepartamento[],
): ReadonlyMap<string, string> {
  const mapa = new Map<string, string>();
  for (const rama of ramas) {
    for (const municipio of rama.municipios) {
      mapa.set(normalizarLugar(municipio.nombre), rama.conceptId);
    }
  }
  return mapa;
}

/** Dónde queda una ciudad, cuando su nombre alcanza para saberlo. */
export interface LugarDeCiudad {
  /** `conceptId` del departamento. */
  readonly departamento: string;
  /** El nombre del municipio como lo escribe el catálogo, no como vino en la ficha. */
  readonly municipio: string;
}

/**
 * Como `departamentoPorCiudad`, pero **sin adivinar** cuando el nombre no
 * alcanza.
 *
 * Siete nombres de municipio se repiten entre departamentos —«San Pedro» está
 * en Santa Cruz y en Pando—, y el directorio público sólo trae la ciudad como
 * texto: una ficha de «San Pedro» no dice de cuál de los dos es.
 * `departamentoPorCiudad` se queda con el último que ve, así que la cuenta
 * como del otro departamento; acá esos nombres **no se asignan a ninguno**. Una
 * ficha ambigua no aparece al acotar por departamento —un faltante que la
 * pantalla puede explicar— en vez de aparecer en el departamento equivocado,
 * que no se puede explicar. Se sigue viendo al mirar todo el país.
 *
 * Qué nombres son ambiguos lo decide el catálogo, no una lista escrita acá.
 *
 * `departamentoPorCiudad` queda igual a propósito: la usan clínicas, farmacias
 * y hospitales, y cambiarles el comportamiento no es de la subtarea 2.3.
 */
export function lugarInequivocoPorCiudad(
  ramas: readonly RamaDepartamento[],
): ReadonlyMap<string, LugarDeCiudad> {
  const lugares = new Map<string, LugarDeCiudad>();
  const ambiguos = new Set<string>();
  for (const rama of ramas) {
    for (const municipio of rama.municipios) {
      const clave = normalizarLugar(municipio.nombre);
      const previo = lugares.get(clave);
      if (previo !== undefined) {
        if (previo.departamento !== rama.conceptId) {
          ambiguos.add(clave);
        }
        continue;
      }
      lugares.set(clave, { departamento: rama.conceptId, municipio: municipio.nombre });
    }
  }
  for (const clave of ambiguos) {
    lugares.delete(clave);
  }
  return lugares;
}
