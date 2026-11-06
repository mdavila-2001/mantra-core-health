/* ============================================================================
    Del informe liberado que lee el profesional
    (`GET /diagnostics/patients/:id/reports/:reportId`) al resultado del panel.

    - El valor llega como texto. Sólo un valor numérico (`QUANTITY`, `DECIMAL`,
      `INTEGER`) con un número decimal limpio se pasa a número: así se compara
      con el rango. El resto se muestra tal cual (un booleano en palabras).
    - La interpretación del laboratorio se muestra con su rótulo («Alto») y
      su código HL7 v3 (ObservationInterpretation: «H», «LL», «A»…) decide la
      lectura (`interpretacionDelCodigo`). Sólo sin código —o con uno que no es
      de ese catálogo— se compara el número contra el rango (`leerValor`).
    ========================================================================== */

import type {
  PractitionerDiagnosticResult,
  PractitionerResultValue,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type {
  InterpretacionDeValor,
  RangoDeReferencia,
  ResultadoDeEstudio,
  ValorDeResultado,
} from './red-clinica.types';

/**
 * HL7 v3 ObservationInterpretation codes → reading. HU/LU («significantly
 * high/low») and H>/L< (off scale) are specializations of H/L, not of HH/LL,
 * so they are not critical; AA is critical without a direction. The API sends
 * the code of the interpretation concept (`interpretationCode`) as is.
 */
const POR_CODIGO_HL7: Readonly<Record<string, InterpretacionDeValor>> = {
  N: 'normal',
  H: 'alto',
  HU: 'alto',
  'H>': 'alto',
  L: 'bajo',
  LU: 'bajo',
  'L<': 'bajo',
  HH: 'critico-alto',
  LL: 'critico-bajo',
  A: 'anormal',
  AA: 'critico',
};

/** The reading of a lab interpretation code; `undefined` if absent or not HL7 v3. */
export function interpretacionDelCodigo(codigo: string | null | undefined): InterpretacionDeValor | undefined {
  const limpio = codigo?.trim().toUpperCase();
  return limpio ? POR_CODIGO_HL7[limpio] : undefined;
}

const NUMERICOS: ReadonlySet<string> = new Set(['QUANTITY', 'DECIMAL', 'INTEGER']);
const DECIMAL = /^-?\d+(\.\d+)?$/;

function decimal(texto: string | null): number | undefined {
  return texto !== null && DECIMAL.test(texto.trim()) ? Number(texto.trim()) : undefined;
}

function valorDe(v: PractitionerResultValue): number | string {
  if (v.value === null) return 'Sin valor';
  if (v.valueKind !== null && NUMERICOS.has(v.valueKind)) return decimal(v.value) ?? v.value;
  if (v.valueKind === 'BOOLEAN') return v.value === 'true' ? 'Sí' : v.value === 'false' ? 'No' : v.value;
  return v.value;
}

function rangoDe(v: PractitionerResultValue): RangoDeReferencia | undefined {
  const r = v.referenceRange;
  if (r === null) return undefined;
  const bajo = decimal(r.low);
  const alto = decimal(r.high);
  const texto = r.text?.trim() || undefined;
  if (bajo === undefined && alto === undefined && texto === undefined) return undefined;
  return {
    ...(bajo === undefined ? {} : { bajo }),
    ...(alto === undefined ? {} : { alto }),
    ...(texto === undefined ? {} : { texto }),
  };
}

export function valorDelInforme(v: PractitionerResultValue): ValorDeResultado {
  const unidad = v.unit?.trim() || v.referenceRange?.unit?.trim() || undefined;
  const rango = rangoDe(v);
  const rotulo = v.interpretation?.trim() || undefined;
  const interpretacion = interpretacionDelCodigo(v.interpretationCode);
  return {
    nombre: v.name?.trim() || 'Valor sin nombre',
    valor: valorDe(v),
    ...(unidad === undefined ? {} : { unidad }),
    ...(rango === undefined ? {} : { rango }),
    ...(interpretacion === undefined ? {} : { interpretacion }),
    ...(rotulo === undefined ? {} : { interpretacionDelInforme: rotulo }),
  };
}

/** El informe leído, como resultado del panel. */
export function resultadoDelInforme(informe: PractitionerDiagnosticResult): ResultadoDeEstudio {
  const conclusion = informe.conclusionText?.trim() || undefined;
  return {
    liberadoEn: informe.releasedAt,
    ...(conclusion === undefined ? {} : { conclusion }),
    valores: informe.values.map(valorDelInforme),
    archivos: [...informe.files]
      .sort((a, b) => (a.ordinal ?? Number.MAX_SAFE_INTEGER) - (b.ordinal ?? Number.MAX_SAFE_INTEGER))
      .map((f, i) => ({ fileId: f.fileId, nombre: f.name?.trim() || `Informe ${i + 1}.pdf` })),
    informeId: informe.reportId,
    publicadoAlPaciente: informe.patientVisible,
  };
}
