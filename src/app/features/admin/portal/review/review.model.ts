import type {
  AnnotationContent,
  CatalogObjectDetail,
} from '../../../../core/data-access/admin-portal/data-catalog.types';
import { describeApiFailure } from '../../../../core/http/api-failure';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { errorDeApi, sensitivityLabel } from '../../platform/platform-labels';

/** El mínimo que la API exige a un motivo de rechazo (`MIN_REJECTION_LENGTH`). */
export const MIN_REJECTION_LENGTH = 10;

/** Lo que se mira para decidir, en el orden en que una persona lo lee. */
const ANSWERED_FIELDS: readonly { readonly key: keyof AnnotationContent; readonly label: string }[] = [
  { key: 'businessName', label: 'Nombre de negocio' },
  { key: 'definition', label: 'Definición' },
  { key: 'purpose', label: 'Propósito' },
  { key: 'existenceRationale', label: 'Por qué existe' },
  { key: 'rowGrain', label: 'Qué es una fila' },
  { key: 'processSupported', label: 'Proceso que sostiene' },
  { key: 'sourceOfTruth', label: 'Fuente de verdad' },
  { key: 'deletionImpact', label: 'Qué pasa si se borra' },
];

/** Los faltantes que mide la cobertura, con las mismas palabras que la ficha del catálogo. */
const MISSING_LABELS: Readonly<Record<string, string>> = {
  purpose: 'propósito',
  existenceRationale: 'por qué existe',
  rowGrain: 'qué significa una fila',
  businessOwner: 'responsable',
  sensitivity: 'sensibilidad',
};

export function missingLabels(fields: readonly string[]): string {
  return fields.map((f) => MISSING_LABELS[f] ?? f).join(', ');
}

export interface Answer {
  readonly label: string;
  readonly text: string | null;
}

export function annotationAnswers(content: AnnotationContent): readonly Answer[] {
  return ANSWERED_FIELDS.map(({ key, label }) => {
    const value = content[key];
    return { label, text: typeof value === 'string' && value.trim() !== '' ? value : null };
  });
}

export function annotationFacts(object: CatalogObjectDetail): readonly Hecho[] {
  const a = object.annotation;
  const evidence = object.evidenceCount;
  return [
    { etiqueta: 'Revisión', valor: a ? `n.º ${a.currentRevisionNo}` : null },
    {
      etiqueta: 'Evidencias enlazadas',
      valor: evidence === 1 ? '1 evidencia' : `${evidence} evidencias`,
      tono: evidence > 0 ? 'ok' : 'aviso',
    },
    { etiqueta: 'Responsable de negocio', valor: a?.content.businessOwner ?? 'Sin declarar' },
    { etiqueta: 'Steward', valor: a?.content.dataSteward ?? 'Sin declarar' },
    { etiqueta: 'Sensibilidad', valor: sensitivityLabel(a?.content.sensitivity) },
  ];
}

export interface ReviewFailure {
  readonly message: string;
  /** La ficha cambió del otro lado: hay que volver a leerla antes de decidir. */
  readonly reload: boolean;
}

/**
 * Por qué la API no registró la decisión, en palabras de quien decide. Se
 * ramifica por la razón estable que manda la API (`details.reason` o la
 * violación), nunca por el texto.
 */
export function reviewFailure(error: unknown): ReviewFailure {
  const api = errorDeApi(error);
  const violations = (api.details?.['violations'] as { reason?: string }[] | undefined) ?? [];
  const reason =
    (typeof api.details?.['reason'] === 'string' ? api.details['reason'] : null) ??
    violations.find((v) => typeof v.reason === 'string')?.reason ??
    null;

  if (reason === 'SELF_REVIEW') {
    return {
      message: 'No puede decidir sobre una revisión que escribió usted: tiene que hacerlo otra persona.',
      reload: false,
    };
  }
  if (reason === 'APPROVAL_NEEDS_EVIDENCE') {
    return { message: 'No se aprueba una ficha sin al menos una evidencia enlazada.', reload: true };
  }
  if (reason === 'NOT_IN_REVIEW') {
    return { message: 'Esta ficha ya no está en revisión: otra persona la decidió.', reload: true };
  }
  if (reason === 'REJECTION_NEEDS_REASON') {
    return {
      message: `Un rechazo tiene que explicar qué falta o qué está mal (al menos ${MIN_REJECTION_LENGTH} caracteres).`,
      reload: false,
    };
  }
  if (api.status === 409) {
    return {
      message: 'La ficha cambió mientras la revisaba. Se cargó la versión vigente: revísela de nuevo.',
      reload: true,
    };
  }
  if (api.status === 403) return { message: 'Su rol no permite revisar fichas.', reload: false };
  return { message: describeApiFailure(error, 'No se pudo registrar la decisión.'), reload: false };
}
