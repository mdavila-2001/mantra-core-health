/**
 * Las sucursales de farmacia de «Dónde conseguir lo de mi receta»: los tipos
 * con que la pantalla las pinta y las funciones puras que las evalúan contra la
 * receta, las ordenan, las pasan al mapa y arman el borrador del pedido o las
 * líneas del carrito. Sin estado ni inyección: el componente las orquesta.
 */

import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import type {
  AvailabilityProduct,
  AvailabilitySite,
  MedicationAvailabilityProduct,
  MedicationAvailabilityResult,
  MedicationAvailabilitySite,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import { aCentavos, aTexto } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import type { CartLine, CartSite } from '../../../../core/data-access/pharmacy-cart/pharmacy-cart.types';
import type {
  BorradorDePedido,
  LineaDePedido,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { withDisplayCurrency } from '../../../../core/money/display-currency';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import type { PinStatus } from '../../../../shared/components/organisms/map/map-pin.types';
import type { Tone } from '../../../../shared/components/tone/tone.types';
import { staleStockNoticeOf } from './stock-freshness';
import { directionsUrl, formatKm } from './where-to-buy.route';

/** Las letras con las que el mapa y las tarjetas se refieren a la misma sede. */
const BRANCH_CODES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Lo que se muestra cuando el registro no trae ese dato. */
const NOT_RECORDED = 'Sin registrar';

/**
 * Un envase por renglón recetado. Lo que declara la receta viaja aparte
 * (`cantidadDeclarada`) y se muestra: está en la unidad que recetó el médico
 * («4 comprimidos»), que no es la del envase, y convertirla sería decidir por
 * la persona. La farmacia confirma cuántos envases corresponden.
 */
const UNITS_PER_LINE = 1;

/** Cómo se ordenan las sucursales en la lista (T-E2 · F2.1.4). */
export type BranchSortOrder = 'complete-first' | 'nearest' | 'cheapest';

/**
 * Las tres maneras de mirar la misma lista. La primera es la del backend y es
 * la que se abre: ordenar no vuelve a consultar, sólo reacomoda lo que llegó.
 */
export const SORT_OPTIONS: readonly SegmentedOption<BranchSortOrder>[] = [
  { value: 'complete-first', label: 'Receta completa primero' },
  { value: 'nearest', label: 'Más cerca' },
  { value: 'cheapest', label: 'Más barato' },
];

/** Un renglón de la receta, listo para incluirse en la consulta. */
export interface PrescriptionItem {
  readonly conceptId: string;
  readonly medication: string;
  readonly instructions: string;
  readonly issued: boolean;
  /** La cantidad que declara la receta, o `null` si no declara (FAR-03, B3). */
  readonly declaredQuantity?: number | null;
}

/** La receta ya traducida, con sus renglones consultables. */
export interface ShoppingList {
  readonly items: readonly PrescriptionItem[];
}

/** Una sede candidata, ya evaluada contra los renglones incluidos. */
export interface VisibleBranch {
  /** Identifica la sede al armar el borrador del pedido. Jamás se pinta. */
  readonly siteId: string;
  /** La farmacia dueña de la sede: la llave para cruzar sus promociones. */
  readonly pharmacyId: string;
  readonly code: string;
  readonly pharmacy: string;
  readonly site: string;
  readonly address: string | null;
  /** «1,2 km», o `null` sin origen o sin coordenadas de la sede. */
  readonly distance: string | null;
  /** La distancia del backend sin formatear: la clave de «Más cerca». */
  readonly distanceKm: number | null;
  readonly complete: boolean;
  /** Los medicamentos de la receta que esta sede NO puede confirmar. */
  readonly missing: readonly string[];
  /** Los medicamentos que sí confirma, por concepto: lo que pesa el recorrido. */
  readonly covers: ReadonlySet<string>;
  /** «Cómo llegar»: el punto en el mapa, o `null` sin coordenadas. */
  readonly directions: string | null;
  /** «96.50 BOB», o `null` si falta un precio o las listas mezclan monedas. */
  readonly total: string | null;
  /** El total en centavos, o `null` si no es un importe: la clave de «Más barato». */
  readonly totalCents: number | null;
  readonly pickup: boolean | null;
  readonly delivery: boolean | null;
  /** Coordenadas reales de la sede; `null` si el directorio no las publica. */
  readonly lat: number | null;
  readonly lng: number | null;
  /** La misma sede evaluada sólo sobre lo aprobado por el seguro (demostración). */
  readonly insured: InsuredCoverage;
  /**
   * «Existencias informadas hace 3 días; confirme…» si la existencia de la
   * sede ya no está al día, o `null` (al día o sin fecha). Con aviso, la
   * tarjeta y el pin no afirman «Tiene todo» (REQ-19-009).
   */
  readonly staleStockNotice: string | null;
}

/**
 * Una sede mirada con seguro (T-E2 · F2.2.2): la cobertura cuenta sólo los
 * renglones aprobados, y el precio se parte en lo aprobado y lo que paga la
 * persona. Se calcula junto con la vista normal para que el conmutador no
 * vuelva a consultar nada.
 */
export interface InsuredCoverage {
  /** Cuántos renglones incluidos aprueba el seguro: el «M» de «N de M». */
  readonly approvedCount: number;
  /** Cuántos de esos puede confirmar esta sede: el «N». */
  readonly coveredCount: number;
  readonly complete: boolean;
  /** Los aprobados que esta sede NO puede confirmar. */
  readonly missing: readonly string[];
  /** «68.00 BOB» por lo aprobado disponible, o `null` si falta un precio. */
  readonly approved: string | null;
  /** «28.50 BOB» por lo no aprobado disponible, o `null` si falta un precio. */
  readonly outOfPocket: string | null;
}

/** El resultado de la consulta, listo para pintarse. */
export interface BranchResult {
  readonly branches: readonly VisibleBranch[];
  /** Medicamentos incluidos sin producto publicado: nadie puede confirmarlos. */
  readonly withoutProduct: readonly string[];
  /** Los mismos, por concepto: la llave para marcarlos en la lista. */
  readonly withoutProductConceptIds: readonly string[];
  /** Renglones incluidos que aprueba el seguro; `0` vacía la variante con seguro. */
  readonly includedApprovedCount: number;
}

/** Sin sucursales que mostrar: la pantalla no llegó a consultar. */
export const NO_BRANCHES: BranchResult = {
  branches: [],
  withoutProduct: [],
  withoutProductConceptIds: [],
  includedApprovedCount: 0,
};

/**
 * Las filas de la receta elegida: las del mismo encuentro que la fila con ese
 * id (FAR-03 · D-3). Una fila sin encuentro es una receta sola; un id que no
 * está en la lista no trae nada.
 *
 * El pedido viaja con un único `medicationRequestId` y la API rechaza los
 * productos que esa receta no prescribe: mezclar aquí fármacos de otras
 * consultas sería armar un pedido que no se puede enviar.
 */
export function rowsOfPrescription(
  rows: readonly MedicationRequest[],
  requestId: string,
): readonly MedicationRequest[] {
  const chosen = rows.find((row) => row.id === requestId);
  if (chosen === undefined) {
    return [];
  }
  // La API manda `null` (no omite la clave) cuando la columna está vacía: dos
  // fármacos sueltos no son la misma receta por compartir ese `null`.
  const encounterId = chosen.encounterId;
  if (!encounterId) {
    return [chosen];
  }
  return rows.filter((row) => row.encounterId === encounterId);
}

/** Un renglón por medicamento: dos recetas del mismo remedio son una compra. */
export function uniqueByMedication(prescriptions: readonly MedicationRequest[]): readonly MedicationRequest[] {
  const byConcept = new Map<string, MedicationRequest>();
  for (const prescription of prescriptions) {
    const previous = byConcept.get(prescription.medicationConceptId);
    // La emitida le gana a la que no lo está: es la que se puede comprar.
    if (previous === undefined || (previous.issuedAt === undefined && prescription.issuedAt !== undefined)) {
      byConcept.set(prescription.medicationConceptId, prescription);
    }
  }
  return [...byConcept.values()];
}

/**
 * El renglón ya traducido. No lleva producto: cada sede surte el medicamento
 * con un producto suyo, y eso lo dice la disponibilidad por medicamento.
 */
export function prescriptionItemOf(row: MedicationRequest, labels: ConceptLabels): PrescriptionItem {
  return {
    conceptId: row.medicationConceptId,
    medication: labels.get(row.medicationConceptId)?.display ?? NOT_RECORDED,
    instructions: [row.doseText, row.frequencyText].filter(Boolean).join(' · '),
    issued: row.issuedAt !== undefined,
    declaredQuantity:
      typeof row.quantityDecimal === 'number' && row.quantityDecimal > 0 ? row.quantityDecimal : null,
  };
}

/**
 * El renglón secundario del pin: distancia rotulada y dirección, lo que haya;
 * con seguro, primero la cobertura de lo aprobado — lo mismo que dice la tarjeta.
 */
export function pinSubtitleOf(branch: VisibleBranch, withInsurance: boolean): string | undefined {
  const parts = [
    withInsurance ? approvedCoverageLabel(branch.insured) : null,
    branch.distance === null ? null : `${branch.distance} en línea recta`,
    branch.address,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/**
 * El estado de la sede: el badge de la tarjeta y el pin del mapa dicen lo
 * mismo. Con existencias desactualizadas, «tiene todo» pasa al pasado y pierde
 * el verde: es lo que se informó, no lo que se puede afirmar hoy (REQ-19-009).
 */
export function pinStatusOf(
  branch: VisibleBranch,
  withInsurance: boolean,
): PinStatus & { readonly tono: Tone } {
  const complete = withInsurance ? branch.insured.complete : branch.complete;
  if (!complete) {
    return { etiqueta: withInsurance ? 'Le falta algo aprobado' : 'Le falta algo', tono: 'warning' };
  }
  const scope = withInsurance ? ' lo aprobado' : '';
  return branch.staleStockNotice === null
    ? { etiqueta: `Tiene todo${scope}`, tono: 'success' }
    : { etiqueta: `Tenía todo${scope}`, tono: 'info' };
}

/** «Cobertura de lo aprobado: 3 de 3». */
export function approvedCoverageLabel(coverage: InsuredCoverage): string {
  return `Cobertura de lo aprobado: ${coverage.coveredCount} de ${coverage.approvedCount}`;
}

/**
 * Las sedes en el orden elegido (T-E2 · F2.1.4). **Pura y sin mutar**: devuelve
 * la misma lista con «Receta completa primero» —el orden del backend, sin
 * recalcular nada— y una copia reacomodada con las otras dos.
 *
 * - «Más cerca»: distancia ascendente.
 * - «Más barato»: total ascendente, en centavos.
 * - Un valor ausente o que no es un número finito no negativo va al final;
 *   el `0` es un valor válido (una sede a 0 km, un total 0.00).
 * - Los empates, entre sí y entre ausentes, conservan el orden del backend:
 *   el índice original desempata, sin depender de la estabilidad del `sort`.
 */
export function sortBranches<
  T extends { readonly distanceKm: number | null; readonly totalCents: number | null },
>(branches: readonly T[], sortOrder: BranchSortOrder): readonly T[] {
  if (sortOrder === 'complete-first') {
    return branches;
  }
  const keyOf = (branch: T) => (sortOrder === 'nearest' ? branch.distanceKm : branch.totalCents);
  return branches
    .map((branch, index) => ({ site: branch, indice: index, sortKey: validSortKey(keyOf(branch)) }))
    .sort((a, b) => {
      if (a.sortKey === null || b.sortKey === null) {
        if (a.sortKey === b.sortKey) {
          return a.indice - b.indice;
        }
        return a.sortKey === null ? 1 : -1;
      }
      return a.sortKey - b.sortKey || a.indice - b.indice;
    })
    .map(({ site: branch }) => branch);
}

/** Un número utilizable para ordenar, o `null`. `0` vale; `NaN` e infinitos no. */
function validSortKey(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * El borrador del pedido (FAR-I2): los renglones incluidos, evaluados contra
 * la sede elegida, con el precio que la sede publica.
 *
 * Cada medicamento sale con **el producto de esa sede**: un producto de otra
 * farmacia no se puede pedir ahí, y la API lo rechaza con un 404. Lo que la
 * sede no tiene viaja sin producto y marcado `missingAtSite`: se muestra por
 * su nombre, pero no se envía.
 *
 * Exportada a propósito: es pura y el spec la ejercita directo — el clic que
 * la dispara sólo existe con la demostración encendida.
 */
export function orderDraftOf(
  requestId: string,
  site: MedicationAvailabilitySite,
  queryable: readonly PrescriptionItem[],
  withoutProduct: readonly string[],
): BorradorDePedido {
  const lines: readonly LineaDePedido[] = [
    ...queryable.map((item): LineaDePedido => {
      const product = siteProductOf(site, item.conceptId);
      if (product === undefined) {
        return {
          productId: null,
          medicamento: item.medication,
          presentacion: null,
          cantidad: UNITS_PER_LINE,
          ...(typeof item.declaredQuantity === 'number' ? { cantidadDeclarada: item.declaredQuantity } : {}),
          precio: null,
          moneda: null,
          disponible: false,
          missingAtSite: true,
        };
      }
      const price = product.price?.patientAmount ?? product.price?.unitAmount ?? null;
      return {
        productId: product.productId,
        medicamento: item.medication,
        presentacion: presentationOf(product),
        cantidad: UNITS_PER_LINE,
        ...(typeof item.declaredQuantity === 'number' ? { cantidadDeclarada: item.declaredQuantity } : {}),
        precio: price,
        moneda: price !== null ? (product.price?.currency?.code ?? site.currency?.code ?? null) : null,
        disponible: true,
      };
    }),
    // Sin producto publicado nadie puede confirmarlo: viaja igual en el
    // pedido, dicho claro, para que la farmacia sepa qué más pide la receta.
    ...withoutProduct.map((medication): LineaDePedido => ({
      productId: null,
      medicamento: medication,
      presentacion: null,
      cantidad: UNITS_PER_LINE,
      precio: null,
      moneda: null,
      disponible: false,
    })),
  ];
  return {
    requestId,
    siteId: site.siteId,
    pharmacyId: site.pharmacyId,
    farmacia: site.pharmacyName,
    sede: site.siteName,
    direccion: site.addressText,
    lineas: lines,
    totalEstimado: site.totalAmount,
    moneda: site.currency?.code ?? null,
  };
}

/**
 * El borrador, convertido en las líneas que el carrito acepta (carril 43 · H5).
 *
 * ## Qué entra y qué no
 *
 * Sólo las líneas con `productId` **y** `disponible`. Las otras dos clases se
 * quedan afuera a propósito y vuelven en `omitted` con su nombre:
 *
 * - **sin producto publicado** (`productId === null`): no existe nada que
 *   agregar, y `createOrderRequest` rechaza esa línea con
 *   `UnsupportedPharmacyOrderLineError`;
 * - **sin stock en esta sede** (`disponible === false`): existe el producto,
 *   pero esta sede no lo puede confirmar hoy.
 *
 * Es la decisión Q-J3 del plan: al carrito va sólo lo disponible, lo faltante
 * se avisa. Meterlo igual sería armar un pedido que la farmacia no puede
 * cumplir y que el backend rechaza.
 *
 * ## Toda línea de una receta exige receta
 *
 * `requiresPrescription: true` sin excepción: el borrador nace de una
 * `medicationRequest`, no del catálogo libre. El carrito lo acepta porque
 * `replaceWith` lo arma **con** `requestId` — que es justamente lo que
 * distingue este camino del «Agregar» suelto de la tienda.
 *
 * Exportada porque es pura y el spec la ejercita directo.
 */
export function cartLinesFromDraft(orderDraft: BorradorDePedido): {
  lines: CartLine[];
  omitted: string[];
} {
  const lines: CartLine[] = [];
  const omitted: string[] = [];
  for (const line of orderDraft.lineas) {
    if (line.productId === null || !line.disponible) {
      omitted.push(line.medicamento);
      continue;
    }
    lines.push({
      productId: line.productId,
      name: line.medicamento,
      presentation: line.presentacion,
      quantity: line.cantidad,
      unitAmount: line.precio,
      currency: line.moneda,
      requiresPrescription: true,
      medicationConceptId: line.conceptId ?? null,
    });
  }
  return { lines, omitted };
}

/** El producto suyo con que la sede surte ese medicamento, o `undefined` si no lo tiene. */
export function siteProductOf(
  site: MedicationAvailabilitySite,
  conceptId: string,
): MedicationAvailabilityProduct | undefined {
  if (site.missingMedicationConceptIds.includes(conceptId)) {
    return undefined;
  }
  return site.products.find((product) => product.medicationConceptId === conceptId);
}

/** La sede del carrito, tal como la publica la disponibilidad. */
export function cartSiteOf(
  site: Pick<AvailabilitySite, 'pharmacyId' | 'pharmacyName' | 'siteId' | 'siteName' | 'addressText'>,
): CartSite {
  return {
    pharmacyId: site.pharmacyId,
    pharmacyName: site.pharmacyName,
    siteId: site.siteId,
    siteName: site.siteName,
    addressText: site.addressText,
  };
}

/** «500 mg · caja x 20», con lo que el directorio publique. */
export function presentationOf(product: AvailabilityProduct | undefined): string | null {
  const parts = [product?.strengthText, product?.packageSizeText].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  return parts.length === 0 ? null : parts.join(' · ');
}

/**
 * Las sedes del backend, evaluadas contra la receta.
 *
 * El backend evalúa por medicamento en toda la red. Acá se exige además que
 * ningún medicamento incluido haya quedado afuera por no tener producto
 * publicado en ninguna farmacia — una sede no puede declararse completa sobre
 * una consulta que no pudo incluirlo todo. El orden del backend se conserva.
 *
 * Las coordenadas viajan crudas: la cartografía es del organismo de mapa
 * (FAR-I1), no de esta pantalla. `now` es el reloj contra el que se mide la
 * antigüedad de las existencias de cada sede.
 */
export function evaluateBranches(
  response: MedicationAvailabilityResult,
  included: readonly PrescriptionItem[],
  approved: ReadonlySet<string>,
  now: Date = new Date(),
): BranchResult {
  const { queryable, withoutProductItems } = splitByPublication(response, included);
  const withoutProduct = withoutProductItems.map((item) => item.medication);

  const branches = response.items.map((branch, index): VisibleBranch => {
    const missing = [
      ...queryable
        .filter((item) => siteProductOf(branch, item.conceptId) === undefined)
        .map((item) => item.medication),
      ...withoutProduct,
    ];
    return {
      siteId: branch.siteId,
      pharmacyId: branch.pharmacyId,
      code: BRANCH_CODES[index] ?? String(index + 1),
      pharmacy: branch.pharmacyName,
      site: branch.siteName,
      address: branch.addressText,
      distance: branch.distanceKm === null ? null : formatKm(branch.distanceKm),
      distanceKm: branch.distanceKm,
      complete: missing.length === 0,
      missing,
      covers: new Set(
        queryable
          .filter((item) => siteProductOf(branch, item.conceptId) !== undefined)
          .map((item) => item.conceptId),
      ),
      directions: directionsUrl(branch.latitude, branch.longitude),
      total:
        branch.totalAmount === null
          ? null
          : withDisplayCurrency(branch.totalAmount, branch.currency?.code),
      totalCents: branch.totalAmount === null ? null : aCentavos(branch.totalAmount),
      pickup: branch.pickupAvailable,
      delivery: branch.homeDeliveryAvailable,
      lat: branch.latitude,
      lng: branch.longitude,
      insured: insuredCoverageOf(branch, queryable, withoutProductItems, approved),
      staleStockNotice: staleStockNoticeOf(branch.stockUpdatedAt, now),
    };
  });

  const includedApproved =
    queryable.filter((item) => approved.has(item.conceptId)).length +
    withoutProductItems.filter((item) => approved.has(item.conceptId)).length;

  return {
    branches,
    withoutProduct,
    withoutProductConceptIds: withoutProductItems.map((item) => item.conceptId),
    includedApprovedCount: includedApproved,
  };
}

/** Los renglones que alguna farmacia de la red publica (`queryable`) y los que ninguna. */
export function splitByPublication(
  response: Pick<MedicationAvailabilityResult, 'unpublishedMedicationConceptIds'>,
  included: readonly PrescriptionItem[],
): { queryable: readonly PrescriptionItem[]; withoutProductItems: readonly PrescriptionItem[] } {
  const unpublished = new Set(response.unpublishedMedicationConceptIds);
  return {
    queryable: included.filter((item) => !unpublished.has(item.conceptId)),
    withoutProductItems: included.filter((item) => unpublished.has(item.conceptId)),
  };
}

/**
 * Una sede evaluada sólo sobre los renglones aprobados (T-E2 · F2.2.2).
 *
 * - **Cobertura:** de los aprobados incluidos, cuántos confirma la sede. Un
 *   aprobado sin producto publicado cuenta y falta, como en la vista normal.
 * - **Aprobado / a tu cargo:** lo que la sede cobra por lo disponible, partido
 *   por la aprobación. Lo que la sede no tiene no suma en ninguno de los dos.
 * - **Aritmética en centavos** (`pharmacy-campaigns.money`): un precio que
 *   falta, que no es un importe o que viene en otra moneda deja esa parte en
 *   `null` — se dice, no se estima.
 *
 * Exportada a propósito: es pura y el spec la ejercita directo.
 */
export function insuredCoverageOf(
  branch: MedicationAvailabilitySite,
  queryable: readonly PrescriptionItem[],
  withoutProductItems: readonly PrescriptionItem[],
  approved: ReadonlySet<string>,
): InsuredCoverage {
  const available = (item: PrescriptionItem) => siteProductOf(branch, item.conceptId) !== undefined;

  const approvedWithProduct = queryable.filter((item) => approved.has(item.conceptId));
  const approvedWithoutProduct = withoutProductItems.filter((item) =>
    approved.has(item.conceptId),
  );
  const missing = [
    ...approvedWithProduct.filter((item) => !available(item)).map((item) => item.medication),
    ...approvedWithoutProduct.map((item) => item.medication),
  ];
  const approvedCount = approvedWithProduct.length + approvedWithoutProduct.length;

  const amountOf = (items: readonly PrescriptionItem[]) =>
    productsAmount(
      items.filter(available).map((item) => siteProductOf(branch, item.conceptId)),
      branch.currency?.code ?? null,
    );

  return {
    approvedCount,
    coveredCount: approvedCount - missing.length,
    complete: approvedCount > 0 && missing.length === 0,
    missing,
    approved: amountOf(approvedWithProduct),
    outOfPocket: amountOf(queryable.filter((item) => !approved.has(item.conceptId))),
  };
}

/**
 * Lo que paga el paciente por esos productos, un envase por renglón, sumado en
 * centavos: «96.50 BOB». `null` si alguno no tiene precio, no es un importe o
 * viene en otra moneda que el resto. Sin productos, «0.00»: no pagar nada es
 * un dato, no una ausencia.
 */
function productsAmount(
  products: readonly (AvailabilityProduct | undefined)[],
  siteCurrency: string | null,
): string | null {
  let cents = 0;
  let currency = siteCurrency;
  for (const product of products) {
    const price = product?.price ?? null;
    const amount = price?.patientAmount ?? price?.unitAmount ?? null;
    const inCents = amount === null ? null : aCentavos(amount);
    if (price === null || inCents === null) {
      return null;
    }
    const itsCurrency = price.currency?.code ?? currency;
    if (currency !== null && itsCurrency !== null && itsCurrency !== currency) {
      return null;
    }
    currency = itsCurrency;
    cents += inCents * UNITS_PER_LINE;
  }
  // Sin moneda en el dato no se agrega ninguna: el contrato E2 deja esa parte
  // en el número pelado y su prueba lo fija.
  return currency === null ? aTexto(cents) : withDisplayCurrency(aTexto(cents), currency);
}
