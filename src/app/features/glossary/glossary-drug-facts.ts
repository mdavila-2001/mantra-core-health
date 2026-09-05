import {
  listaDeTextos,
  type GlossaryTermDetail,
} from '../../core/data-access/terminology/terminology.types';

/**
 * Ficha de medicamento (TAREA-25, «el más importante» según el propietario):
 * principios activos, forma farmacéutica, vía y fabricante.
 *
 * ## Lo que NO está acá, y por qué
 *
 * **Posología, dosis y contraindicaciones no aparecen en este tipo, a
 * propósito.** `.claude/rules/00-non-negotiables.md` §7/§8 y
 * `.claude/rules/70-data-seeders.md` prohíben mostrar un dato clínico
 * generado o sin fuente verificada — hoy no existe ninguna fuente importada
 * para esos tres campos (P-25-1, ficha TAREA-25 §9). Un campo ausente es
 * correcto; uno inventado es un daño clínico. Cuando la fuente exista, se
 * agrega acá **con su procedencia** (AC-25-7), no antes.
 */
export interface GlossaryDrugFacts {
  readonly activeIngredients: readonly string[];
  readonly dosageForm: string | null;
  readonly route: readonly string[];
  readonly manufacturer: string | null;
}

/**
 * Lee una propiedad como texto simple, o `null` si no tiene esa forma.
 *
 * Mismo criterio que {@link listaDeTextos}: una forma inesperada es un dato
 * del catálogo que este consumidor no sabe mostrar, no una falla de la
 * pantalla.
 */
function textoDe(propiedades: Readonly<Record<string, unknown>>, codigo: string): string | null {
  const valor = propiedades[codigo];
  if (typeof valor !== 'string') {
    return null;
  }
  const recortado = valor.trim();
  return recortado === '' ? null : recortado;
}

/**
 * Resuelve la ficha de medicamento de un término, o `null` si no tiene
 * ninguno de los cuatro datos — es el patrón *Null Object*: quien llama no
 * necesita preguntar «¿tiene ficha de medicamento?» antes de usarla, sólo
 * comprobar que no sea `null`.
 *
 * Desde FND-25-02 los 6 términos de `pharmacology` traen estos 4 datos
 * —copiados verbatim de un producto real del FDA NDC Directory, ver
 * `glossary-terms.catalog.ts` en el backend—, así que esta función devuelve
 * una ficha real para ellos. Para los demás términos curados sigue
 * devolviendo `null` y el bloque de medicamento se omite entero en la
 * plantilla — eso sigue siendo el criterio de AC-25-6/AC-25-8, no una falla.
 *
 * @param termino - La ficha ya leída del glosario.
 * @returns Los datos disponibles, o `null` si no hay ninguno.
 */
export function drugFactsFrom(termino: GlossaryTermDetail): GlossaryDrugFacts | null {
  // El contrato dice `properties` obligatorio (lo que hoy siempre manda el
  // backend); el `?? {}` es sólo una segunda barrera para que un cambio de
  // contrato no tumbe la ficha entera del término por un dato accesorio.
  const propiedades = termino.properties ?? {};
  const facts: GlossaryDrugFacts = {
    activeIngredients: listaDeTextos(propiedades, 'active_ingredients'),
    dosageForm: textoDe(propiedades, 'dosage_form'),
    route: listaDeTextos(propiedades, 'route'),
    manufacturer: textoDe(propiedades, 'manufacturer'),
  };

  const sinDatos =
    facts.activeIngredients.length === 0 &&
    facts.dosageForm === null &&
    facts.route.length === 0 &&
    facts.manufacturer === null;

  return sinDatos ? null : facts;
}
