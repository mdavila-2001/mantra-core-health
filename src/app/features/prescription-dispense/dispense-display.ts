import { HttpErrorResponse } from '@angular/common/http';

import type {
  PharmacyPrescriptionItem,
  SiteProductRef,
} from '../../core/data-access/pharmacy-prescription-shares/pharmacy-prescription-shares.types';

/**
 * Lo que la pantalla escribe a partir de los datos de la receta (FAR-02), en
 * funciones puras para que la plantilla no arme textos y se puedan probar
 * sin montar nada.
 */

/** La clave de una sede de un producto: identifica su interruptor. */
export function siteKey(ref: SiteProductRef): string {
  return `${ref.pharmacyId}|${ref.siteId}|${ref.productId}`;
}

/**
 * Singular y plural de las unidades que se venden por pieza. Solo las que la
 * receta puede traer con control de cantidad (D-5: `{bottle}`, `{tube}`) y las
 * dos más comunes sin él; el resto se escribe sin sustantivo.
 */
const UNIT_NOUNS: Readonly<Record<string, readonly [string, string]>> = {
  '{bottle}': ['frasco', 'frascos'],
  '{tube}': ['tubo', 'tubos'],
  '{tablet}': ['comprimido', 'comprimidos'],
  '{capsule}': ['cápsula', 'cápsulas'],
};

/** El sustantivo de la unidad para una cantidad, o `''` si no se conoce. */
export function unitNoun(unitCode: string | null, quantity: number): string {
  if (unitCode === null) {
    return '';
  }
  const nouns = UNIT_NOUNS[unitCode.replace(/^UNIT_/, '')];
  if (nouns === undefined) {
    return '';
  }
  return quantity === 1 ? nouns[0] : nouns[1];
}

/**
 * Cuántos ítems de la receta son del mismo fármaco que cada uno, en el orden
 * de los ítems.
 *
 * Con control de cantidad, la API repite en cada uno de esos ítems el total
 * **del fármaco en toda la receta** (`pharmacy-prescription-share.dto.ts`):
 * la pantalla tiene que decirlo, o en el mostrador se lee como uno por ítem.
 */
export function sameDrugCounts(items: readonly PharmacyPrescriptionItem[]): readonly number[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.medicationConceptId, (counts.get(item.medicationConceptId) ?? 0) + 1);
  }
  return items.map((item) => counts.get(item.medicationConceptId) ?? 1);
}

/** El total es del fármaco en toda la receta, no del ítem. */
function isDrugTotal(item: PharmacyPrescriptionItem, sameDrug: number): boolean {
  return sameDrug > 1 && item.remainingQuantity !== null;
}

/**
 * «Recetado: 2 frascos», «Recetado en total: 4 frascos» (el fármaco está en
 * más de un ítem y la cantidad es la de toda la receta), o «Cantidad no
 * indicada».
 *
 * @param sameDrug - Cuántos ítems de la receta son de este fármaco
 *   ({@link sameDrugCounts}).
 */
export function prescribedText(item: PharmacyPrescriptionItem, sameDrug = 1): string {
  if (item.prescribedQuantity === null) {
    return 'Cantidad no indicada';
  }
  const amount = `${item.prescribedQuantity} ${unitNoun(item.unitCode, item.prescribedQuantity)}`.trim();
  return isDrugTotal(item, sameDrug) ? `Recetado en total: ${amount}` : `Recetado: ${amount}`;
}

/**
 * «Quedan 1 de 2», con «entre los N ítems de este medicamento» cuando el
 * saldo es del fármaco en toda la receta, o «Sin control de cantidad» cuando
 * la API no lo calculó (unidad no comparable o sin cantidad recetada, D-5).
 */
export function balanceText(item: PharmacyPrescriptionItem, sameDrug = 1): string {
  if (item.remainingQuantity === null || item.prescribedQuantity === null) {
    return 'Sin control de cantidad';
  }
  const balance = `Quedan ${item.remainingQuantity} de ${item.prescribedQuantity}`;
  return isDrugTotal(item, sameDrug) ? `${balance}, entre los ${sameDrug} ítems de este medicamento` : balance;
}

/**
 * Las etiquetas de las pestañas, una por ítem. Dos ítems con el mismo nombre
 * se numeran («Jarabe (1)», «Jarabe (2)»): dos pestañas iguales no se pueden
 * distinguir ni con la vista ni con el lector.
 */
export function itemLabels(items: readonly PharmacyPrescriptionItem[]): readonly string[] {
  const base = items.map((item, index) => item.display ?? `Medicamento ${index + 1}`);
  const total = new Map<string, number>();
  for (const label of base) {
    total.set(label, (total.get(label) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return base.map((label) => {
    if ((total.get(label) ?? 0) < 2) {
      return label;
    }
    const nth = (seen.get(label) ?? 0) + 1;
    seen.set(label, nth);
    return `${label} (${nth})`;
  });
}

/**
 * Qué decir cuando el `PUT` falla sin un mensaje para la persona.
 *
 * Un 4xx (la sede o el producto ya no están, el cuerpo no se aceptó) no se
 * arregla esperando: se recarga la receta. Lo demás —un 5xx, un límite de
 * peticiones— sí puede pasar solo. Sin conexión lo resuelve
 * `describeApiFailure` antes de llegar acá.
 */
export function availabilityFallback(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  return status >= 400 && status < 500 && status !== 429
    ? 'Recargue la receta y vuelva a intentarlo.'
    : 'Intente de nuevo en unos segundos.';
}
