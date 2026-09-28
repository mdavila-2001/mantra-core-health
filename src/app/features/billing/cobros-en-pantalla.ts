/* ============================================================================
    Lo que las piezas de cobro reutilizables —el plan de pagos y el modal de
    la factura— calculan para mostrar. Funciones puras: se prueban sin montar
    nada.

    Las usan la pantalla de facturación y «Pagos» dentro de la consulta, así
    que el dinero se escribe igual en los dos lados: `Bs 1 234,50`, sin pasar
    nunca por `number` (mismo criterio que `payments-block.ts` y el tablero de
    Contabilidad).
    ========================================================================== */

import { HttpErrorResponse } from '@angular/common/http';

import type { SimulatedCharge } from '../../core/data-access/billing-simulated/billing-simulated.types';
import { readApiError } from '../../core/http/api-error';
import { estadoDeCobro, pagadoDeCobro } from './billing-summary';

/** Un decimal en texto a centavos enteros. */
export function centavos(valor: string | null | undefined): number {
  if (valor === null || valor === undefined || valor.trim() === '') return 0;
  const [entero = '0', decimales = ''] = valor.trim().split('.');
  const signo = entero.startsWith('-') ? -1 : 1;
  return signo * (Math.abs(Number(entero)) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2)));
}

export function deCentavos(valor: number): string {
  const signo = valor < 0 ? '-' : '';
  const absoluto = Math.abs(valor);
  return `${signo}${Math.floor(absoluto / 100)}.${String(absoluto % 100).padStart(2, '0')}`;
}

/** Espacio duro: «Bs» y los miles no se separan del número al partir la línea. */
const ESPACIO_DURO = '\u00a0';

/** `1234.5` → `Bs 1 234,50` (con espacios duros). Sólo formatea: el importe no se convierte a número. */
export function bs(valor: string): string {
  const [entero = '0', decimales = ''] = deCentavos(centavos(valor)).split('.');
  return `Bs${ESPACIO_DURO}${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACIO_DURO)},${decimales.padEnd(2, '0')}`;
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

const FORMATO_FECHA_Y_HORA = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** `2026-09-07T12:00:00Z` → `7 sept 2026`; si no es una fecha, el texto tal cual. */
export function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : FORMATO_FECHA.format(fecha);
}

/** Con la hora: la `fechaEmision` del SIAT llega sin zona y es hora de Bolivia. */
export function fechaYHora(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : FORMATO_FECHA_Y_HORA.format(fecha);
}

/** Las opciones de un catálogo sin el «(catálogo simulado)» que ya dice la ayuda del campo. */
export function sinMarcaDeCatalogo(descripcion: string): string {
  return descripcion.replace(/\s*\(cat[aá]logo simulado\)\s*$/i, '');
}

/** Lo que falta cobrar de un cobro: el saldo del plan, o el total si no se pagó. */
export function saldoDeCobro(cobro: SimulatedCharge): string {
  if (cobro.plan !== null) return cobro.plan.balance;
  return cobro.payment === null ? cobro.total : '0.00';
}

/** Lo que ya entró: el pago, o lo pagado con notas de venta. Una sola definición, la del resumen. */
export const cobradoDeCobro = pagadoDeCobro;

/**
 * Qué se ofrece para un cobro, en el orden de la pizarra:
 *
 * - con plan (más de una instancia) → abrir la tabla del plan;
 * - de una sola instancia sin pagar → cobrar y facturar en el mismo modal;
 * - pagado y sin factura vigente → facturar;
 * - con factura vigente → verla.
 */
export type AccionDeCobro = 'VER_PLAN' | 'COBRAR_Y_FACTURAR' | 'FACTURAR' | 'VER_FACTURA';

export function accionDeCobro(cobro: SimulatedCharge): AccionDeCobro {
  if (cobro.plan !== null) return 'VER_PLAN';
  if (cobro.payment === null) return 'COBRAR_Y_FACTURAR';
  return tieneFacturaVigente(cobro) ? 'VER_FACTURA' : 'FACTURAR';
}

/** Lo que dice el botón: corto, porque en el teléfono comparte fila con el servicio. */
export const ROTULO_DE_ACCION: Readonly<Record<AccionDeCobro, string>> = {
  VER_PLAN: 'Ver plan',
  COBRAR_Y_FACTURAR: 'Cobrar',
  FACTURAR: 'Facturar',
  VER_FACTURA: 'Ver factura',
};

/** Lo que anuncia el lector de pantalla: la acción entera, seguida del servicio. */
export const ACCION_COMPLETA: Readonly<Record<AccionDeCobro, string>> = {
  VER_PLAN: 'Ver plan de pagos',
  COBRAR_Y_FACTURAR: 'Cobrar y facturar',
  FACTURAR: 'Facturar',
  VER_FACTURA: 'Ver factura',
};

/** Validada u observada: la que cuenta. Una rechazada o anulada deja volver a facturar. */
export function tieneFacturaVigente(cobro: SimulatedCharge): boolean {
  const estado = estadoDeCobro(cobro);
  return estado === 'VALIDATED' || estado === 'OBSERVED';
}

/** «Pago único» o «Consulta + 2 reconsultas»: lo que el tipo de servicio implica. */
export function tipoDeServicio(cobro: SimulatedCharge): string {
  if (cobro.plan === null) return 'Pago único';
  const reconsultas = cobro.plan.instances.filter((i) => i.kind === 'FOLLOW_UP').length;
  return `Consulta + ${reconsultas} ${reconsultas === 1 ? 'reconsulta' : 'reconsultas'}`;
}

/**
 * El mensaje del backend simulado, o uno genérico si no vino ninguno. Con el
 * identificador de la petición cuando lo hay (S9): es lo que se le dicta a
 * soporte.
 */
export function mensajeDeError(error: unknown, generico = 'No se pudo completar la operación en el simulador.'): string {
  const cuerpo = error instanceof HttpErrorResponse ? readApiError(error) : null;
  const mensaje = cuerpo?.message || generico;
  return cuerpo?.correlationId ? `${mensaje} (ID de petición: ${cuerpo.correlationId})` : mensaje;
}
