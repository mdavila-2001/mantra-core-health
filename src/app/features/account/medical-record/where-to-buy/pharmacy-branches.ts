/**
 * Las sucursales de farmacia de «Dónde conseguir lo de mi receta»: los tipos
 * con que la pantalla las pinta y las funciones puras que las evalúan contra la
 * receta, las ordenan, las pasan al mapa y arman el borrador del pedido o las
 * líneas del carrito. Sin estado ni inyección: el componente las orquesta.
 */

import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import type {
  AvailabilityProduct,
  AvailabilityResult,
  AvailabilitySite,
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
import { directionsUrl, formatKm } from './where-to-buy.route';

/** Las letras con las que el mapa y las tarjetas se refieren a la misma sede. */
const BRANCH_CODES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Lo que se muestra cuando el registro no trae ese dato. */
const NOT_RECORDED = 'Sin registrar';

/**
 * Un envase por renglón recetado: la receta no declara cantidades, y la
 * confirmación del pedido las muestra tal cual — inventar más sería decidir
 * por la persona.
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
  /**
   * El producto publicado que responde a ese medicamento, o `null` si el
   * directorio no publica ninguno. Hoy es **un representante por
   * medicamento** (el primero publicado): si una sede tiene otra marca del
   * mismo genérico, esta consulta no la ve: el catálogo no agrupa productos
   * por concepto.
   */
  readonly productId: string | null;
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
  /** Renglones incluidos que aprueba el seguro; `0` vacía la variante con seguro. */
  readonly includedApprovedCount: number;
}

/** Sin sucursales que mostrar: la pantalla no llegó a consultar. */
export const NO_BRANCHES: BranchResult = { branches: [], withoutProduct: [], includedApprovedCount: 0 };

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

/** El renglón ya traducido y con su producto representante. */
export function prescriptionItemOf(
  row: MedicationRequest,
  labels: ConceptLabels,
  products: ReadonlyMap<string, string | null>,
): PrescriptionItem {
  return {
    conceptId: row.medicationConceptId,
    medication: labels.get(row.medicationConceptId)?.display ?? NOT_RECORDED,
    instructions: [row.doseText, row.frequencyText].filter(Boolean).join(' · '),
    issued: row.issuedAt !== undefined,
    productId: products.get(row.medicationConceptId) ?? null,
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

/** El estado del pin: el mismo criterio que el badge de la tarjeta. */
export function pinStatusOf(branch: VisibleBranch, withInsurance: boolean): PinStatus {
  if (withInsurance) {
    return branch.insured.complete
      ? { etiqueta: 'Tiene todo lo aprobado', tono: 'success' }
      : { etiqueta: 'Le falta algo aprobado', tono: 'warning' };
  }
  return branch.complete
    ? { etiqueta: 'Tiene todo', tono: 'success' }
    : { etiqueta: 'Le falta algo', tono: 'warning' };
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
 * Exportada a propósito: es pura y el spec la ejercita directo — el clic que
 * la dispara sólo existe con la demostración encendida.
 */
export function orderDraftOf(
  requestId: string,
  site: AvailabilitySite,
  queryable: readonly (PrescriptionItem & { productId: string })[],
  withoutProduct: readonly string[],
): BorradorDePedido {
  const byProduct = new Map(site.products.map((product) => [product.productId, product]));
  const lines: readonly LineaDePedido[] = [
    ...queryable.map((item): LineaDePedido => {
      const product = byProduct.get(item.productId);
      const available =
        product !== undefined && !site.missingProductIds.includes(item.productId);
      const price = product?.price?.patientAmount ?? product?.price?.unitAmount ?? null;
      return {
        productId: item.productId,
        medicamento: item.medication,
        presentacion: presentationOf(product),
        cantidad: UNITS_PER_LINE,
        precio: available ? price : null,
        moneda:
          available && price !== null
            ? (product?.price?.currency?.code ?? site.currency?.code ?? null)
            : null,
        disponible: available,
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

/** La sede del carrito, tal como la publica la disponibilidad. */
export function cartSiteOf(site: AvailabilitySite): CartSite {
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
 * La «completa» del backend habla de los productos consultados; acá se exige
 * además que ningún medicamento incluido haya quedado afuera por no tener
 * producto publicado — una sede no puede declararse completa sobre una
 * consulta que no pudo incluirlo todo. El orden del backend se conserva.
 *
 * Las coordenadas viajan crudas: la cartografía es del organismo de mapa
 * (FAR-I1), no de esta pantalla.
 */
export function evaluateBranches(
  response: AvailabilityResult,
  queryable: readonly (PrescriptionItem & { productId: string })[],
  withoutProduct: readonly string[],
  withoutProductItems: readonly PrescriptionItem[],
  approved: ReadonlySet<string>,
): BranchResult {
  const nameByProduct = new Map(queryable.map((item) => [item.productId, item.medication]));

  const branches = response.items.map((branch, index): VisibleBranch => {
    const missing = [
      ...branch.missingProductIds.map(
        (productId) => nameByProduct.get(productId) ?? 'Un medicamento de su receta',
      ),
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
          .filter((item) => !branch.missingProductIds.includes(item.productId))
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
    };
  });

  const includedApproved =
    queryable.filter((item) => approved.has(item.conceptId)).length +
    withoutProductItems.filter((item) => approved.has(item.conceptId)).length;

  return { branches, withoutProduct, includedApprovedCount: includedApproved };
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
  branch: AvailabilitySite,
  queryable: readonly (PrescriptionItem & { productId: string })[],
  withoutProductItems: readonly PrescriptionItem[],
  approved: ReadonlySet<string>,
): InsuredCoverage {
  const byProduct = new Map(branch.products.map((product) => [product.productId, product]));
  const available = (item: PrescriptionItem & { productId: string }) =>
    byProduct.has(item.productId) && !branch.missingProductIds.includes(item.productId);

  const approvedWithProduct = queryable.filter((item) => approved.has(item.conceptId));
  const approvedWithoutProduct = withoutProductItems.filter((item) =>
    approved.has(item.conceptId),
  );
  const missing = [
    ...approvedWithProduct.filter((item) => !available(item)).map((item) => item.medication),
    ...approvedWithoutProduct.map((item) => item.medication),
  ];
  const approvedCount = approvedWithProduct.length + approvedWithoutProduct.length;

  const amountOf = (items: readonly (PrescriptionItem & { productId: string })[]) =>
    productsAmount(
      items.filter(available).map((item) => byProduct.get(item.productId)),
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
