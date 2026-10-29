import { HttpErrorResponse } from '@angular/common/http';

import type { LayoutItemError, PlanFailure } from './floor-plan.types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readItemErrors(value: unknown): LayoutItemError[] {
  if (!Array.isArray(value)) return [];
  const result: LayoutItemError[] = [];
  for (const raw of value) {
    const item = asRecord(raw);
    if (item === null || typeof item['id'] !== 'string' || typeof item['code'] !== 'string') continue;
    result.push(item as unknown as LayoutItemError);
  }
  return result;
}

/**
 * Lee de un fallo de HTTP lo que el plano necesita (CONTRATO-PLANO §3.4):
 * la razón de negocio (`reason`), el `requestId`, los errores **por elemento**
 * de `PLAN_LAYOUT_INVALID` y la versión vigente de un 412.
 *
 * La `reason` puede venir en la raíz del cuerpo (`DomainException`) o dentro
 * de `details`; se aceptan ambas. Un cuerpo que no es JSON (un proxy, un 502)
 * da una falla sin razón: quien llama la trata como error inesperado.
 */
export function readPlanFailure(error: unknown): PlanFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, reason: null, requestId: null, message: null, errors: [], currentVersion: null, changedSummary: null, requiredRoles: [] };
  }
  const body = asRecord(error.error);
  const details = asRecord(body?.['details']);
  const reason = body?.['reason'] ?? details?.['reason'];
  const requestId = body?.['requestId'] ?? body?.['correlationId'] ?? error.headers?.get('x-request-id');
  const currentVersion = body?.['currentVersion'] ?? details?.['currentVersion'];
  const changed = body?.['changedSummary'] ?? details?.['changedSummary'];
  const roles = details?.['requiredRoles'];
  return {
    status: error.status,
    reason: typeof reason === 'string' ? reason : null,
    requestId: typeof requestId === 'string' ? requestId : null,
    message: typeof body?.['message'] === 'string' ? (body['message'] as string) : null,
    errors: readItemErrors(body?.['errors'] ?? details?.['errors']),
    currentVersion: typeof currentVersion === 'number' ? currentVersion : null,
    changedSummary: typeof changed === 'string' ? changed : null,
    requiredRoles: Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [],
  };
}
