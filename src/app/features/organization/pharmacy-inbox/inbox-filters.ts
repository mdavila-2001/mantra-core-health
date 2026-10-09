import type { PharmacyDetail } from '../../../core/data-access/pharmacy/pharmacy.types';

/**
 * Las dos reglas de recorte del tablero de la bandeja, sin Angular: la sede
 * que se ve y la ventana de fechas de «Cerrados».
 *
 * Viven aparte del componente porque son decisiones, no pintura: cuál sede
 * abre por defecto y qué día es «hoy» se prueban sin montar nada.
 */

/** Cómo se llama la sede «todas» en la URL y en el selector. */
export const SITES_ALL = 'all';

/** Una sede elegible en el selector de la bandeja. */
export interface InboxSite {
  readonly id: string;
  readonly code: string;
  readonly nombre: string;
  /** La farmacia dueña: distingue sedes homónimas de cadenas distintas. */
  readonly farmacia: string;
  /** `true` si la sede es la casa matriz de su farmacia. */
  readonly esMatriz: boolean;
}

/** La sede con la que abre la bandeja, y si hubo que adivinarla. */
export interface SiteByDefault {
  /** `null` si la organización no tiene ninguna sede publicada. */
  readonly id: string | null;
  /**
   * `true` cuando hay varias sedes y ninguna está marcada como casa matriz:
   * se abrió con la de código más bajo y la pantalla lo dice.
   */
  readonly sinMatrizMarcada: boolean;
}

/**
 * Aplana las sedes de las farmacias de la organización.
 *
 * `isHeadOffice` todavía no lo declara el backend real (TODO(model): concepto
 * `PHARM_SITE_TYPE_HEAD_OFFICE` en el tipo de sede). Mientras no llegue, la
 * regla de {@link siteByDefault} cae a la única sede o a la de código más
 * bajo — nunca se deduce la matriz de la dirección legal, que es otra cosa.
 */
export function pharmaciesSites(farmacias: readonly PharmacyDetail[]): readonly InboxSite[] {
  return farmacias.flatMap((farmacia) =>
    farmacia.sites.map((sede) => ({
      id: sede.id,
      code: sede.code,
      nombre: sede.name,
      farmacia: farmacia.name,
      esMatriz: sede.isHeadOffice === true,
    })),
  );
}

/**
 * La sede con la que abre el tablero: la casa matriz; si no hay marcada, la
 * única sede; si hay varias sin matriz, la de código más bajo.
 */
export function siteByDefault(sedes: readonly InboxSite[]): SiteByDefault {
  const matriz = sedes.find((sede) => sede.esMatriz);
  if (matriz !== undefined) {
    return { id: matriz.id, sinMatrizMarcada: false };
  }
  const [primera, ...resto] = [...sedes].sort((a, b) =>
    a.code.localeCompare(b.code, 'es', { numeric: true }),
  );
  if (primera === undefined) {
    return { id: null, sinMatrizMarcada: false };
  }
  return { id: primera.id, sinMatrizMarcada: resto.length > 0 };
}

/**
 * Resuelve lo que dice la URL contra las sedes reales. Un valor ausente, de
 * otra organización o inventado no rompe la pantalla: vuelve al default.
 */
export function chosenSite(
  deLaUrl: string | null,
  sedes: readonly InboxSite[],
): string | null {
  if (deLaUrl === SITES_ALL) {
    return SITES_ALL;
  }
  if (deLaUrl !== null && sedes.some((sede) => sede.id === deLaUrl)) {
    return deLaUrl;
  }
  return siteByDefault(sedes).id;
}

/** Los recortes de fecha que ofrece la columna «Cerrados». */
export const CLOSED_CROPS = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'all', label: 'Todos' },
] as const;

export type ClosedCrop = (typeof CLOSED_CROPS)[number]['value'];

/** Con lo que abre la bandeja: lo cerrado hoy. */
export const CROP_BY_DEFAULT: ClosedCrop = 'today';

/** El día de un recorte, en palabras, para el encabezado de la columna. */
export function cropLabel(recorte: ClosedCrop): string {
  return CLOSED_CROPS.find((opcion) => opcion.value === recorte)?.label ?? '';
}

/** Un valor de la URL, o el recorte por defecto si no es uno de los cinco. */
export function urlCrop(valor: string | null): ClosedCrop {
  const conocido = CLOSED_CROPS.find((opcion) => opcion.value === valor);
  return conocido?.value ?? CROP_BY_DEFAULT;
}

/**
 * La zona de los pedidos. Bolivia no tiene horario de verano, así que un día
 * son siempre 24 h y restar días en milisegundos es exacto.
 */
const COUNTER_ZONE = 'America/La_Paz';

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` del instante, contado en la zona del mostrador. */
export function counterDay(instante: Date): string {
  // `en-CA` formatea ISO (año-mes-día): la comparación de texto ordena bien.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COUNTER_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/** Cuántos días hacia atrás, contando hoy, abarca cada recorte. */
const BACK_DAYS: Readonly<Record<'7d' | '30d', number>> = { '7d': 6, '30d': 29 };

/**
 * Si un pedido cerrado entra en el recorte elegido.
 *
 * **Se mide por la fecha de creación**, que es la única que el contrato del
 * pedido trae. TODO(FAR-E2): cuando la API publique cuándo se cerró, medir por
 * ésa — hoy un pedido creado ayer y retirado hoy cuenta como de ayer.
 */
export function closedInCrop(
  creadoEl: Date,
  recorte: ClosedCrop,
  ahora: Date,
): boolean {
  if (recorte === 'all') {
    return true;
  }
  const dia = counterDay(creadoEl);
  if (recorte === 'today') {
    return dia === counterDay(ahora);
  }
  if (recorte === 'yesterday') {
    return dia === counterDay(new Date(ahora.getTime() - DAY_MS));
  }
  const desde = counterDay(new Date(ahora.getTime() - BACK_DAYS[recorte] * DAY_MS));
  return dia >= desde && dia <= counterDay(ahora);
}
