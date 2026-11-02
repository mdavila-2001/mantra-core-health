import { formatDate } from '@angular/common';
import type { ExternalSystemSummary } from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { FORMAT_LABEL } from './integration-system.texts';

/** La telemetría no invalida un borrador; cambiar configuración o credencial sí. */
export function systemConfigurationKey(system: ExternalSystemSummary | null): string {
  return JSON.stringify(system === null ? null : [
    system.format, system.baseUrl, system.externalPharmacyCode,
    system.configuredAt, system.apiKeyConfigured,
  ]);
}

export function systemFacts(system: ExternalSystemSummary | null, locale: string): readonly Hecho[] {
  if (system === null) return [];
  return [
    { etiqueta: 'Formato', valor: FORMAT_LABEL[system.format] },
    { etiqueta: 'Dirección', valor: system.baseUrl },
    { etiqueta: 'Código de la farmacia', valor: system.externalPharmacyCode },
    { etiqueta: 'Clave', valor: system.apiKeyConfigured ? 'Guardada' : 'Falta', tono: system.apiKeyConfigured ? 'ok' : 'aviso' },
    { etiqueta: 'Configurado el', valor: formatDate(system.configuredAt, 'd MMM y, HH:mm', locale) },
  ];
}

export function systemLastCheck(system: ExternalSystemSummary | null, locale: string): string {
  const check = system?.lastCheck;
  if (!check) return 'Todavía no hay una comprobación guardada.';
  const reason = check.errorReason === 'AUTH_REJECTED' ? ' · clave rechazada'
    : check.errorReason === 'UNREACHABLE' ? ' · no responde' : '';
  return `${check.status === 'ACTIVE' ? 'Activa' : 'Con error'}${reason} · ${formatDate(check.checkedAt, 'dd/MM/yyyy HH:mm', locale)}`;
}

export function validSystemUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return value.trim().length <= 500 && ['http:', 'https:'].includes(url.protocol) &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
