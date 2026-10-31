import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { isReservedBlock, RESERVED_BLOCK_LABEL } from '../../../core/access-challenge/access-challenge';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { canDrag } from './agenda-actions';
import { clock, isVisible } from './agenda-grouping';
import { eventLabel, orgToneColors, STATUS_TEXT, type AgendaEvent } from './agenda-model';

/** Cómo se ve un evento mientras se arrastra una cita. */
export type DragRole = 'source' | 'target-ok' | 'target-no' | 'possible' | null;

/**
 * Un horario o una cita, dibujado como un botón. Lo usan las tres vistas: la
 * posición (arriba/izquierda/ancho) la pone quien lo contiene; lo que dice y
 * cómo se distingue —**sin depender solo del color**— se resuelve acá:
 *
 * - **libre**: borde discontinuo y la palabra «Libre»;
 * - **reservada**: borde punteado y la marca «Por confirmar»;
 * - **confirmada**: borde sólido;
 * - **ya llegó**: borde doble y la marca «Llegó»;
 * - **sin permiso**: atenuada, con trama y la marca «Sin permiso» (el motivo va
 *   en el globo y en la etiqueta accesible);
 * - **reservado**: atenuada, con la marca «Reservado»; se activa para preguntar «¿Por qué no puedo?».
 */
@Component({
  selector: 'button[app-agenda-event]',
  templateUrl: './agenda-event.html',
  styleUrl: './agenda-event.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // El globo con el motivo lo escribe quien usa el evento: `[tooltip]="…"` llega a la directiva de globo.
  hostDirectives: [{ directive: Tooltip, inputs: ['appTooltip: tooltip'] }],
  host: {
    type: 'button',
    class: 'celda',
    '[class.celda--libre]': 'event().status === "FREE" && visible()',
    '[class.celda--reservada]': 'event().status === "BOOKED"',
    '[class.celda--llego]': 'event().status === "CHECKED_IN"',
    '[class.celda--atenuada]': '!visible()',
    '[class.celda--compacta]': 'compact()',
    '[class.celda--minima]': 'tiny()',
    '[class.celda--densa]': 'dense()',
    '[class.celda--seleccionada]': 'selected()',
    '[class.celda--arrastrable]': 'draggable()',
    '[class.celda--origen]': 'dragRole() === "source"',
    '[class.celda--destino-ok]': 'dragRole() === "target-ok"',
    '[class.celda--destino-no]': 'dragRole() === "target-no"',
    '[class.celda--posible]': 'dragRole() === "possible"',
    '[attr.data-testid]': '"item-" + event().id',
    '[attr.data-estado]': 'event().status',
    '[attr.data-event-id]': 'event().id',
    '[attr.data-draggable]': 'draggable() ? "true" : null',
    '[attr.aria-label]': 'label()',
    '[attr.aria-disabled]': '!visible() && !reserved() ? "true" : null',
    '[attr.aria-pressed]': 'selected() ? "true" : null',
    '[style.--doctor-color]': 'color().border',
    '[style.--doctor-fondo]': 'color().bg',
  },
})
export class AgendaEventButton {
  readonly event = input.required<AgendaEvent>();
  readonly color = input.required<{ readonly bg: string; readonly border: string }>();
  readonly multiOrg = input(false);
  readonly compact = input(false);
  /** Solo la franja de color: para las barras de la línea de tiempo cuando no cabe texto. */
  readonly tiny = input(false);
  /** Vista apretada (semana): los horarios libres pesan menos para que se vean las citas. */
  readonly dense = input(false);
  readonly selected = input(false);
  /** Qué decir en la segunda línea: lo que la columna no dice ya. */
  readonly subline = input<'DOCTOR_SPACE' | 'SPACE' | 'DOCTOR'>('DOCTOR_SPACE');
  readonly dragRole = input<DragRole>(null);

  protected readonly visible = computed(() => isVisible(this.event()));
  /** Un bloque «Reservado» no es un permiso que falta: está ocupado y su detalle no se muestra; se puede preguntar por qué. */
  protected readonly reserved = computed(() => isReservedBlock(this.event()));
  protected readonly draggable = computed(() => canDrag(this.event()));
  protected readonly label = computed(() => eventLabel(this.event(), this.multiOrg()));

  protected readonly hora = computed(() => clock(this.event().start));
  protected readonly texto = computed(() => {
    const e = this.event();
    if (this.reserved()) return RESERVED_BLOCK_LABEL;
    if (!this.visible()) return 'Sin permiso';
    return e.status === 'FREE' ? 'Libre' : (e.patientLabel ?? 'Cita');
  });
  protected readonly sub = computed(() => {
    const e = this.event();
    switch (this.subline()) {
      case 'SPACE':
        return e.careSpaceName;
      case 'DOCTOR':
        return e.doctorName;
      default:
        return `${e.doctorName} · ${e.careSpaceName}`;
    }
  });

  /** La marca de texto del estado: lo que el color no puede decir solo. */
  protected readonly marca = computed(() => {
    const e = this.event();
    if (!this.visible()) return null;
    if (e.status === 'BOOKED') return 'Por confirmar';
    if (e.status === 'CHECKED_IN') return 'Llegó ✓';
    if (e.status === 'FREE' && e.waitlistCount !== undefined) return `${e.waitlistCount} en espera`;
    return null;
  });

  protected readonly orgColors = computed(() => orgToneColors(this.event().orgTone));
  protected readonly estadoTexto = computed(() => STATUS_TEXT[this.event().status]);
}
