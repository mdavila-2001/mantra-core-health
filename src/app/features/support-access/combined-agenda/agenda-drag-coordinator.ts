import { computed, type Signal } from '@angular/core';

import { canDrag, dropVerdict, rescheduleCandidates } from './agenda-actions';
import { AgendaDragController, type DragHost } from './agenda-drag';
import { clock } from './agenda-grouping';
import type { AgendaEvent } from './agenda-model';

/** Lo que el arrastre necesita saber de la pantalla. */
export interface DragDeps {
  readonly doc: Document;
  /** Todos los eventos cargados (con o sin filtros). */
  readonly allEvents: Signal<readonly AgendaEvent[]>;
  /** Solo los que se ven: son los destinos posibles. */
  readonly visibleEvents: Signal<readonly AgendaEvent[]>;
  readonly now: Signal<Date>;
  /** La organización de la cita que se está agendando, si hay un paciente en mano. */
  readonly holdingOrgId: Signal<string | null>;
  readonly onDrop: (sourceId: string, targetId: string) => void;
  readonly onReject: (reason: string) => void;
  /** El contenedor que se desplaza, para seguir al puntero cuando llega al borde. */
  readonly scroller: () => HTMLElement | undefined;
}

/**
 * Une el controlador de arrastre con la agenda: qué hay bajo el puntero, qué cita
 * se puede arrastrar, si el destino sirve y cuáles son los destinos posibles
 * (para pintarlos antes de soltar). Devuelve las señales que las vistas pintan.
 */
export function createAgendaDrag(deps: DragDeps) {
  const find = (id: string): AgendaEvent | null => deps.allEvents().find((e) => e.id === id) ?? null;

  const host: DragHost = {
    hit: (x, y) => deps.doc.elementFromPoint(x, y)?.closest('[data-event-id]')?.getAttribute('data-event-id') ?? null,
    canStart: (id) => {
      const e = find(id);
      return e !== null && canDrag(e);
    },
    verdict: (source, target) => {
      const s = find(source);
      const t = find(target);
      return s === null || t === null ? { ok: false, reason: 'No es un horario de la agenda.' } : dropVerdict(s, t, deps.now());
    },
    label: (id) => {
      const e = find(id);
      return e === null ? '' : `${clock(e.start)} · ${e.patientLabel ?? 'Cita'}`;
    },
    drop: (source, target) => deps.onDrop(source, target),
    rejected: (_source, reason) => {
      if (reason !== null) deps.onReject(reason);
    },
    autoscroll: (x, y) => {
      const el = deps.scroller();
      if (el === undefined) return;
      const rect = el.getBoundingClientRect();
      const borde = 48;
      if (y < rect.top + borde) el.scrollTop -= 14;
      else if (y > rect.bottom - borde) el.scrollTop += 14;
      if (x < rect.left + borde) el.scrollLeft -= 14;
      else if (x > rect.right - borde) el.scrollLeft += 14;
    },
  };

  const controller = new AgendaDragController(host, deps.doc);

  const sourceId = computed(() => controller.state()?.sourceId ?? null);
  const overId = computed(() => controller.state()?.overId ?? null);
  const overOk = computed(() => controller.state()?.verdict?.ok === true);

  /** Los horarios donde se puede soltar la cita que se arrastra, o donde cae la cita que se está agendando. */
  const targets = computed<ReadonlySet<string>>(() => {
    const origen = sourceId();
    if (origen !== null) {
      const e = find(origen);
      return e === null ? new Set() : new Set(rescheduleCandidates(e, deps.visibleEvents(), deps.now(), Number.MAX_SAFE_INTEGER).map((c) => c.id));
    }
    const org = deps.holdingOrgId();
    if (org === null) return new Set();
    return new Set(deps.visibleEvents().filter((e) => e.status === 'FREE' && e.orgId === org && e.allowedActions.includes('schedule.create')).map((e) => e.id));
  });

  return { controller, sourceId, overId, overOk, targets };
}
