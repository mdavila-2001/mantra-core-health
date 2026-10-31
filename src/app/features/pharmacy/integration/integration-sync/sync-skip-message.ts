import type {
  SyncSkippedLine,
  SyncSkipReason,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';

/**
 * Por qué una línea con vínculo no se aplicó, dicho para la persona y con lo
 * que le toca hacer. Se ramifica por `reason`, que es contrato.
 */
export const SYNC_SKIP_TEXT: Readonly<Record<SyncSkipReason, string>> = {
  PRODUCT_NOT_AVAILABLE: 'El producto ya no es de su farmacia: deshaga o corrija el vínculo.',
  PRODUCT_NOT_PUBLISHED: 'El producto es un borrador o está retirado: publíquelo para que sincronice.',
  PRODUCT_OUT_OF_STOCK_DECLARED: 'El catálogo marca el producto sin stock; la sincronización no lo cambia.',
  SITE_PRODUCT_KEPT_BY_LOTS: 'La sede lleva este producto por lotes: se cambia desde «Inventario».',
  SITE_MARKED_NOT_AVAILABLE: 'La sede marcó «No lo tengo» a mano y la sincronización no lo pisa: se cambia desde la sede.',
  UNIT_MISMATCH: 'El sistema de la farmacia cuenta en otra unidad que la del vínculo y no se convierte.',
  UNIT_NOT_REPORTED: 'El vínculo declara una unidad y el sistema de la farmacia no dice en cuál cuenta.',
};

/** Lo que se muestra cuando una unidad no viene. */
const NO_UNIT = 'sin informar';

/**
 * El texto de una línea no aplicada. Con los motivos de unidad suma las dos
 * unidades, para que se vea cuál corregir: «unidad del vínculo X / del sistema Y».
 */
export function syncSkipMessage(line: SyncSkippedLine): string {
  const text = SYNC_SKIP_TEXT[line.reason] ?? 'No se aplicó.';
  if (line.reason !== 'UNIT_MISMATCH' && line.reason !== 'UNIT_NOT_REPORTED') {
    return text;
  }
  const mappingUnit = line.mappingUnitCode || NO_UNIT;
  const externalUnit = line.externalUnitCode || NO_UNIT;
  return `${text} Unidad del vínculo ${mappingUnit} / del sistema ${externalUnit}.`;
}
