import type { LocationNode } from '../../../core/data-access/support-access/support-access.types';
import type { GridColumn } from './agenda-grid';
import { groupAgenda, type AgendaView } from './agenda-grouping';
import { dayKeyOf, sameDay, toDayKey, type AgendaData, type AgendaEvent, type AgendaOrg } from './agenda-model';

/**
 * Cómo se reparten los eventos en columnas, para la vista de **día** (una columna
 * por doctor, consultorio o servicio) y la de **semana** (una por día). Lógica pura.
 */
export interface DayColumnsInput {
  readonly events: readonly AgendaEvent[];
  readonly day: Date;
  readonly group: AgendaView;
  readonly data: AgendaData;
  readonly orgs: readonly AgendaOrg[];
  readonly multiOrg: boolean;
  readonly now: Date;
  /** Doctores apagados en «Mis doctores»: no tienen columna aunque no tengan horarios. */
  readonly hiddenDoctors: ReadonlySet<string>;
  /** Con un filtro de servicio o de ubicación, un doctor sin horarios no se muestra vacío. */
  readonly narrowed: boolean;
}

export function dayColumns(input: DayColumnsInput): readonly GridColumn[] {
  const { data, day, group } = input;
  const delDia = input.events.filter((e) => dayKeyOf(e.start) === toDayKey(day));
  const grupos = groupAgenda(delDia, group, data.doctors, data.services, data.locations as readonly LocationNode[]);
  const hoy = sameDay(day, input.now);
  const columnas: GridColumn[] = grupos.map((g) => ({
    key: g.key,
    label: g.label,
    ...(g.sub === undefined ? {} : { sub: g.sub }),
    day,
    today: hoy,
    events: g.items,
  }));

  if (group !== 'DOCTOR') return columnas;

  // Un doctor prendido sin horarios ese día sigue teniendo su columna: se ve que no atiende, no que desapareció.
  if (!input.narrowed) {
    for (const d of data.doctors) {
      if (input.hiddenDoctors.has(d.id) || columnas.some((c) => c.key === d.id)) continue;
      columnas.push({ key: d.id, label: d.name, sub: d.specialty, day, today: hoy, events: [] });
    }
    columnas.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  if (!input.multiOrg) return columnas;
  // Con varias organizaciones, la columna de cada doctor dice a cuál pertenece.
  return columnas.map((c) => {
    const doctor = data.doctors.find((d) => d.id === c.key);
    const sigla = input.orgs.find((o) => o.id === doctor?.orgId)?.short;
    return sigla === undefined ? c : { ...c, sub: `${c.sub ?? ''} · ${sigla}` };
  });
}

export function weekColumns(events: readonly AgendaEvent[], days: readonly Date[], now: Date): readonly GridColumn[] {
  return days.map((dia) => ({
    key: toDayKey(dia),
    label: dia.toLocaleDateString('es-BO', { weekday: 'short' }),
    sub: dia.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }),
    day: dia,
    today: sameDay(dia, now),
    events: events.filter((e) => dayKeyOf(e.start) === toDayKey(dia)),
  }));
}
