import { HttpErrorResponse } from '@angular/common/http';

import {
  describirHorario,
  nombreDelHorarioGeneral,
  resolveDeviceBlock,
  resolverHorario,
} from '../../../core/data-access/diagnostic-units/center-schedule.rules';
import type {
  CenterEquipment,
  CenterSchedule,
  CenterScheduleView,
  CenterStudy,
  EquipmentStatus,
} from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { MODALIDADES, type ModalityCode } from '../../../core/data-access/diagnostic-units/modalidades';

/* ============================================================================
    Pure rules of the «Horarios y equipos» screen, without Angular.

    Every device that gives appointments is a production line with its own
    hours, or the center's general schedule while it has none. A modality
    schedule only exists for modalities without devices yet: it is the
    default their devices will inherit.
    ========================================================================== */

export const STATUS_LABEL: Readonly<Record<EquipmentStatus, string>> = {
  OPERATIONAL: 'Operativo',
  MAINTENANCE: 'En mantenimiento',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

/** A modality the center attends (it offers one of its studies), with its devices. */
export interface CenterModality {
  readonly code: ModalityCode;
  readonly label: string;
  readonly deviceSingular: string;
  readonly devicePlural: string;
  readonly devices: readonly CenterEquipment[];
  readonly operational: number;
  readonly studies: readonly CenterStudy[];
}

/** The modalities of the center's studies, in catalog order. */
export function modalitiesOf(center: CenterScheduleView): CenterModality[] {
  return MODALIDADES.filter((m) => center.studies.some((s) => s.modalityCode === m.code)).map((m) => {
    const devices = center.equipment.filter((e) => e.modalityCode === m.code);
    return {
      code: m.code,
      label: m.label,
      deviceSingular: m.equipmentLabel[0],
      devicePlural: m.equipmentLabel[1],
      devices,
      operational: devices.filter((d) => d.status === 'OPERATIONAL').length,
      studies: center.studies.filter((s) => s.modalityCode === m.code),
    };
  });
}

/** One line of «Así queda»: a device, or a modality still without devices. */
export interface SummaryLine {
  readonly key: string;
  readonly name: string;
  readonly origin: string;
  readonly hours: string;
  /** Down or missing: the hours exist but give no appointments. */
  readonly idle: boolean;
}

export interface SummaryRow {
  readonly code: ModalityCode;
  readonly label: string;
  readonly capacity: string;
  readonly lines: readonly SummaryLine[];
  readonly exceptions: readonly { readonly name: string; readonly hours: string }[];
}

/** What every modality ends up offering with the draft schedule, device by device. */
export function summaryOf(modalities: readonly CenterModality[], draft: CenterSchedule): SummaryRow[] {
  const general = nombreDelHorarioGeneral(draft);
  return modalities.map((m) => {
    const common = m.studies.find((s) => !draft.studies.some((x) => x.studyCode === s.code)) ?? m.studies[0]!;
    const lines: SummaryLine[] =
      m.devices.length === 0
        ? [
            {
              key: m.code,
              name: `Sin ${m.devicePlural} cargados`,
              origin: resolverHorario(draft, common.code, m.code).origin === 'MODALITY' ? 'Horario de la modalidad' : general,
              hours: describirHorario(resolverHorario(draft, common.code, m.code).block),
              idle: true,
            },
          ]
        : m.devices.map((d) => {
            const { block, origin } = resolveDeviceBlock(draft, d, common.code, m.code);
            return {
              key: d.id,
              name: d.name,
              origin: origin === 'EQUIPMENT' ? 'Horario propio' : general,
              hours: describirHorario(block),
              idle: d.status !== 'OPERATIONAL',
            };
          });
    return {
      code: m.code,
      label: m.label,
      capacity:
        m.operational === 0
          ? `Sin ${m.devicePlural} operativos: no se dan citas`
          : `Hasta ${m.operational} ${m.operational === 1 ? 'paciente' : 'pacientes'} a la vez (${m.operational} ${m.operational === 1 ? m.deviceSingular : m.devicePlural} en línea)`,
      lines,
      exceptions: m.studies
        .filter((s) => draft.studies.some((x) => x.studyCode === s.code))
        .map((s) => ({ name: s.name, hours: describirHorario(resolverHorario(draft, s.code, m.code).block) })),
    };
  });
}

/** The server's message for a failed write, or the given fallback. */
export function serverMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string } | null;
    if (typeof body?.message === 'string' && body.message !== '') return body.message;
  }
  return fallback;
}
