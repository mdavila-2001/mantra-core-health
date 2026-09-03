/* ============================================================================
    De una fila de `GET /public/medications` a la tarjeta de un medicamento.

    Identificadores en inglés, prosa en castellano (TAREA 29).

    Los importes son SIEMPRE texto: el backend los declara `numeric` y un
    `number` de JavaScript no representa 0.10 sin error. Acá no se hace
    aritmética con ellos — se reformatean, no se convierten.
    ========================================================================== */

import type { TarjetaDeMedicamento } from '@core/data-access/public-marketplace/public-marketplace.types';
import type { CardDetailRow } from '@shared/components/molecules/card-detail-panel/card-detail-panel.types';
import { inicialesDe } from '@shared/text/iniciales';

import type { CentroAtributo, CentroTarjeta } from '../centro-card/centro-card.types';
import { addRow } from '../centro-card/directory-card.mapper';

/** Un medicamento con su tarjeta y el resto de sus datos. */
export interface MedicationCard {
  /** El concepto del vademécum: la clave estable de la grilla. */
  readonly id: string;
  /** La fila cruda, para pedir su disponibilidad. */
  readonly medication: TarjetaDeMedicamento;
  readonly card: CentroTarjeta;
  readonly details: readonly CardDetailRow[];
}

/**
 * «Bs 18,50» a partir del texto exacto del backend.
 *
 * El importe **no se convierte a número**: se reformatea el texto. Pasar por
 * `Number` y volver perdería el centavo que la farmacia publicó, que es
 * justamente el dato que la pantalla promete mostrar sin tocar.
 */
export function formatMoney(value: string, currency: string): string {
  const symbol = currency === 'BOB' ? 'Bs' : currency;
  return `${symbol} ${value.replace('.', ',')}`;
}

/** «1,2 km», con coma decimal. `null` sin origen. */
export function formatDistance(km: number | null): string | null {
  return km === null ? null : `${km.toFixed(1).replace('.', ',')} km`;
}

/** `true` si las farmacias no coinciden en el precio. */
export function hasPriceRange(medication: TarjetaDeMedicamento): boolean {
  return medication.priceFrom !== medication.priceTo;
}

/**
 * El precio que encabeza la tarjeta: siempre el más bajo publicado.
 *
 * El rótulo «desde» sólo aparece cuando hay rango: con una sola farmacia —o
 * con todas cobrando lo mismo— «desde» insinuaría que en algún lado sale más
 * caro, y no es cierto.
 */
export function priceText(medication: TarjetaDeMedicamento): string {
  const from = formatMoney(medication.priceFrom, medication.currency);
  return hasPriceRange(medication) ? `desde ${from}` : from;
}

/**
 * Los atributos de la fila inferior de un medicamento.
 *
 * Son **los tres que AC-06-4 pide para este vertical** y los tres existen en
 * la API: precio desde, en cuántas farmacias se consigue, y si requiere
 * receta —esto último como sello sobre la portada, que es donde se ve antes de
 * leer—. La distancia se suma sólo cuando hay origen, y dice «en línea recta»
 * porque eso es lo que `nearestKm` mide.
 */
function medicationAttributes(medication: TarjetaDeMedicamento): CentroAtributo[] {
  const attributes: CentroAtributo[] = [
    {
      clave: 'precio',
      texto: priceText(medication),
      etiqueta: hasPriceRange(medication)
        ? `El más barato publicado hoy; el más caro es ${formatMoney(medication.priceTo, medication.currency)}`
        : 'Precio publicado hoy',
    },
    {
      clave: 'farmacias',
      texto: `${medication.pharmacyCount} ${
        medication.pharmacyCount === 1 ? 'farmacia' : 'farmacias'
      }`,
      etiqueta: 'Farmacias que lo publican',
    },
  ];

  const nearest = formatDistance(medication.nearestKm);
  if (nearest !== null) {
    attributes.push({
      clave: 'distancia',
      texto: `a ${nearest}`,
      etiqueta: `La farmacia más cercana que lo tiene está a ${nearest} en línea recta`,
    });
  }

  return attributes;
}

function medicationRows(medication: TarjetaDeMedicamento): CardDetailRow[] {
  const rows: CardDetailRow[] = [];
  addRow(rows, 'Código ATC', medication.atcCode);
  addRow(rows, 'Grupo terapéutico', medication.therapeuticGroup);
  addRow(
    rows,
    'Marcas publicadas',
    medication.brands.length === 0 ? null : medication.brands.join(' · '),
  );
  addRow(
    rows,
    'Presentaciones',
    medication.presentations.length === 0 ? null : medication.presentations.join(' · '),
  );
  addRow(
    rows,
    'Precio publicado',
    hasPriceRange(medication)
      ? `entre ${formatMoney(medication.priceFrom, medication.currency)} y ${formatMoney(medication.priceTo, medication.currency)}`
      : formatMoney(medication.priceFrom, medication.currency),
  );
  addRow(
    rows,
    'Farmacias que lo publican',
    `${medication.pharmacyCount} ${medication.pharmacyCount === 1 ? 'farmacia' : 'farmacias'}`,
  );

  const nearest = formatDistance(medication.nearestKm);
  addRow(rows, 'La más cercana', nearest === null ? null : `${nearest} en línea recta`);

  addRow(
    rows,
    'Venta',
    medication.requiresPrescription ? 'Sólo contra receta médica' : 'Venta libre',
  );
  return rows;
}

/**
 * Traduce un medicamento a la tarjeta con portada del directorio.
 *
 * ## Sin imagen, y no es un pendiente de diseño (AC-06-3)
 *
 * `TarjetaDeMedicamento` **no tiene campo de imagen**, y no lo va a tener por
 * ahora: una foto de la caja es material del fabricante y puede tener
 * implicancias regulatorias en salud (P-06-3). La tarjeta degrada a lo que
 * `CentroCard` ya hace bien: el degradado del tema con las iniciales del
 * principio activo. Poner una foto de archivo de «unas pastillas» sobre el
 * nombre de un medicamento concreto es exactamente lo que la regla 00.8
 * prohíbe.
 *
 * ## Sin ficha, sin enlace
 *
 * `link: null`. El contrato público sirve cinco prefijos de ficha y ninguno es
 * de medicamento —un medicamento vive en el catálogo de farmacia, no en
 * `community.public_profiles`—. Antes el mapeador devolvía `/search/medications`,
 * que convertía la tarjeta en un enlace a la pantalla donde ya se estaba.
 */
export function toMedicationCard(medication: TarjetaDeMedicamento): MedicationCard {
  const seals: CentroTarjeta['sellos'] = medication.requiresPrescription
    ? [
        { texto: medication.therapeuticGroup, tono: 'info' as const },
        { texto: 'Con receta', tono: 'aviso' as const },
      ]
    : [{ texto: medication.therapeuticGroup, tono: 'info' as const }];

  return {
    id: medication.conceptId,
    medication,
    card: {
      id: medication.conceptId,
      nombre: medication.genericName,
      link: null,
      titular: medication.brands.length === 0 ? null : medication.brands.join(' · '),
      // Un medicamento no queda en ningún lado: dónde se consigue es el modal
      // de farmacias, no un renglón de la tarjeta.
      donde: null,
      portada: null,
      logo: null,
      iniciales: inicialesDe(medication.genericName),
      sellos: seals,
      atributos: medicationAttributes(medication),
    },
    details: medicationRows(medication),
  };
}
