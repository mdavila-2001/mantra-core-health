import type { ClaimQuoteBreakdownVm } from '../../../shared/components/molecules/claim-quote-breakdown/claim-quote-breakdown.types';
import {
  ROTULO_DE_AUTORIZACION,
  type ClaimQuoteLineResult,
  type ClaimQuoteResult,
} from '../../../core/data-access/insurance/insurance.types';

/** Lo que dice la pantalla cuando una línea no tiene aprobación previa que mostrar. */
const SIN_COBERTURA = 'No cubierto por el plan';

/**
 * Traduce una cotización a la vista de la molécula de reparto. No suma ni
 * redondea: cada cifra es la que mandó el servidor. Las cifras de cabecera
 * salen del total del servidor; la cobertura y el copago solo se muestran
 * cuando todas las líneas los comparten, porque sumar copagos sería calcular.
 *
 * @param resultado - La cotización del servidor.
 * @param servicio - El texto del servicio que se cotiza.
 * @returns La vista de la molécula.
 */
export function aVistaDeCotizacion(
  resultado: ClaimQuoteResult,
  servicio: string,
  codigoDeMoneda: string | null,
): ClaimQuoteBreakdownVm {
  const lineas = resultado.lines.map((linea) => ({
    key: String(linea.lineSequence),
    serviceLabel: servicio,
    billedAmount: linea.billedAmount,
    coveragePercent: linea.coveragePercent,
    copayAmount: linea.copayAmount,
    patientAmount: linea.patientAmount,
    insurerAmount: linea.insurerAmount,
    covered: linea.covered,
    authorizationStatus: linea.priorAuthorizationStatus,
    authorizationLabel: rotuloDeLinea(linea),
  }));
  const unica = resultado.lines.length === 1 ? resultado.lines[0] : undefined;
  const coberturasIguales =
    resultado.lines.length > 0 &&
    resultado.lines.every((linea) => linea.coveragePercent === resultado.lines[0]?.coveragePercent);
  return {
    currencyCode: codigoDeMoneda,
    headline: {
      coverage: coberturasIguales ? (resultado.lines[0]?.coveragePercent ?? null) : null,
      copay: unica?.copayAmount ?? null,
      patient: resultado.totalPatientAmount,
      insurer: resultado.totalInsurerAmount,
    },
    lines: lineas,
  };
}

/** El rótulo de autorización de una línea, o «No cubierto» si el plan no cubre el servicio. */
export function rotuloDeLinea(linea: ClaimQuoteLineResult): string {
  return linea.priorAuthorizationStatus === null
    ? SIN_COBERTURA
    : ROTULO_DE_AUTORIZACION[linea.priorAuthorizationStatus];
}

/**
 * El texto que explica por qué no se puede enviar el cobro: la primera línea
 * que bloquea, dicha en usted. `null` si el cobro se puede enviar.
 */
export function motivoDeBloqueo(resultado: ClaimQuoteResult): string | null {
  const bloqueante = resultado.lines.find((linea) => linea.reason !== null);
  if (bloqueante === undefined) return null;
  switch (bloqueante.reason) {
    case 'SERVICE_NOT_COVERED':
      return 'El plan no cubre este servicio. Puede cobrarlo directamente a la persona.';
    case 'PRIOR_AUTHORIZATION_REQUIRED':
      return 'Este servicio requiere una aprobación previa de la aseguradora. Indique el número de la aprobación para poder enviar el cobro.';
    case 'PRIOR_AUTHORIZATION_PENDING':
      return 'La aprobación previa todavía está en trámite. Podrá enviar el cobro cuando la aseguradora la apruebe.';
    case 'PRIOR_AUTHORIZATION_MISMATCH':
      return 'La aprobación indicada no corresponde a este cobro. Revise el número de la aprobación.';
    default:
      return 'La aseguradora no permite enviar este cobro. Revise los datos antes de continuar.';
  }
}
