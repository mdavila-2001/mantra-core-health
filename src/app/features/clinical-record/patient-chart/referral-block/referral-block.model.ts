import type {
  Referral,
  ReferralTargetKind,
  ReferralTargetService,
  ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import type { StatusSealVariant } from '../../../../shared/components/organisms/status-seal/status-seal.types';

/* ============================================================================
    Lo que el bloque de derivación dice en palabras. Separado del componente
    porque es traducción pura —código → rótulo, fila → renglón— y se prueba
    sin montar nada.
    ========================================================================== */

/**
 * «Tratamiento» primero y por defecto: es lo que el cliente pidió
 * literalmente («derivación de servicios específicos… tipo tratamiento»).
 */
export const TIPO_POR_DEFECTO: ReferralType = 'TREATMENT';

const ROTULO_DEL_TIPO: Readonly<Record<ReferralType, string>> = {
  TREATMENT: 'Tratamiento',
  CONSULTATION: 'Interconsulta',
  DIAGNOSTIC_STUDY: 'Estudio diagnóstico',
  PROCEDURE: 'Procedimiento',
  SECOND_OPINION: 'Segunda opinión',
};

export const OPCIONES_DE_TIPO: readonly SelectOption<ReferralType>[] = (
  Object.keys(ROTULO_DEL_TIPO) as ReferralType[]
).map((value) => ({ value, label: ROTULO_DEL_TIPO[value] }));

export const OPCIONES_DE_DESTINO: readonly SegmentedOption<ReferralTargetKind>[] = [
  { value: 'PRACTITIONER', label: 'Profesional', icon: 'stethoscope' },
  // Rótulo corto: a 390 px «Organización médica» se cortaba con puntos
  // suspensivos. El nombre accesible es el completo y contiene al visible.
  { value: 'ORGANIZATION', label: 'Organización', icon: 'hospital', description: 'Organización médica' },
];

/**
 * Los tres estados que siembra la API, por **código**: el rótulo del catálogo
 * puede venir en inglés si el concepto no tiene designación en castellano, y
 * el tono del sello no se deduce de un texto.
 */
const ESTADO_POR_CODIGO: Readonly<
  Record<string, { readonly rotulo: string; readonly variante: StatusSealVariant }>
> = {
  REF_REQUESTED: { rotulo: 'Solicitada', variante: 'pending' },
  REF_ACCEPTED: { rotulo: 'Aceptada', variante: 'approved' },
  REF_REJECTED: { rotulo: 'Rechazada', variante: 'rejected' },
};

/** Una derivación ya resuelta para la lista. */
export interface DerivacionEnPantalla {
  readonly id: string;
  readonly tipo: string;
  readonly destino: string;
  readonly servicio: string | null;
  readonly estado: string;
  readonly variante: StatusSealVariant;
  readonly emitida: Date;
  readonly vigencia: Date | null;
  readonly motivo: string | null;
}

export function derivacionEnPantalla(
  derivacion: Referral,
  etiquetas: ConceptLabels,
): DerivacionEnPantalla {
  const concepto = etiquetas.get(derivacion.statusConceptId);
  const conocido = concepto === undefined ? undefined : ESTADO_POR_CODIGO[concepto.code];
  return {
    id: derivacion.id,
    tipo: derivacion.referralType === undefined ? 'Sin tipo' : ROTULO_DEL_TIPO[derivacion.referralType],
    destino: derivacion.targetDisplayName ?? 'Destino sin nombre',
    servicio: derivacion.targetServiceName ?? null,
    // Un estado que esta versión no conoce no se inventa ni se oculta: se
    // dice con el rótulo del catálogo, en neutro.
    estado: conocido?.rotulo ?? concepto?.display ?? 'Sin registrar',
    variante: conocido?.variante ?? 'unknown',
    emitida: derivacion.createdAt,
    vigencia: derivacion.validUntil ?? null,
    motivo: derivacion.reasonText ?? null,
  };
}

/** «Bs 250.00» o «USD 40», tal como llegó; sin arancel, se dice. */
export function precioDe(servicio: ReferralTargetService): string {
  if (servicio.price === null || servicio.price === '') {
    return 'Sin arancel declarado';
  }
  const moneda = servicio.currency === 'BOB' ? 'Bs' : servicio.currency;
  return moneda === null ? String(servicio.price) : `${moneda} ${servicio.price}`;
}

/** El servicio es opcional: la primera opción dice que se deriva sin uno. */
export function opcionesDeServicio(
  servicios: readonly ReferralTargetService[],
): readonly SelectOption<string | null>[] {
  return [
    { value: null, label: 'Sin un servicio en particular' },
    ...servicios.map((s) => ({ value: s.id, label: `${s.name} · ${precioDe(s)}` })),
  ];
}
