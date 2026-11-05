import type {
  LabServiceKind,
  LabServiceStatus,
} from '../../data-access/lab-portal/lab-portal.types';

/** One row of the simulated lab catalog (`lab-portal.handlers.ts`). */
export interface ServicioSimulado {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly categoryId: string | null;
  readonly sampleType: string | null;
  readonly preparation: string | null;
  readonly description: string | null;
  readonly turnaroundHours: number | null;
  readonly requiresMedicalOrder: boolean;
  readonly homeCollection: boolean;
  /** Two decimals, or `null` while the service has no price (the API answers the same). */
  readonly price: string | null;
  readonly alovidaDiscountPercent: number | null;
  readonly status: LabServiceStatus;
  readonly available: boolean;
  readonly updatedAt: string;
}

/** The registration placeholders carry the modality study code (`MODALITY_*`). */
export function kindOf(s: Pick<ServicioSimulado, 'code'>): LabServiceKind {
  return s.code.startsWith('MODALITY_') ? 'MODALITY' : 'SERVICE';
}

/** List price minus the AloVida discount, or `null` without a price. */
export function precioAloVida(s: ServicioSimulado): string | null {
  if (s.price === null) return null;
  const descuento = s.alovidaDiscountPercent ?? 0;
  return ((Number(s.price) * (100 - descuento)) / 100).toFixed(2);
}

/** The `LabService` shape the API answers, given the category name lookup. */
export function servicioDeRespuesta(s: ServicioSimulado, categoryName: string | null) {
  const { tenantId: _t, ...resto } = s;
  return { ...resto, kind: kindOf(s), categoryName, alovidaPrice: precioAloVida(s), currency: 'BOB' as const };
}
