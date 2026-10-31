import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import type { ExplainMyAccessRequest } from '../../../core/data-access/access-governance/access-explain.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AccessWhyNot } from '../../access-governance/why-not/why-not';
import { missingNote, offeredActions, statusText, type EventAction } from './agenda-actions';
import { isPlaceRejection } from './agenda-errors';
import { clock } from './agenda-grouping';
import { orgToneColors, type AgendaEvent } from './agenda-model';
import { PatientFinder, type PickedPatient } from './patient-finder';

/** Lo que el panel le pide al contenedor cuando hay un paciente de por medio. */
export interface BookRequest {
  readonly mode: 'CREATE' | 'WALK_IN' | 'WAITLIST';
  readonly picked: PickedPatient;
  readonly reason: string;
}

type PanelMode = EventAction | null;

/**
 * El panel lateral de un horario o una cita: dice **qué es**, **en qué
 * organización se actúa** y ofrece solo las acciones que la API permitió
 * (`allowedActions`). Lo que no está permitido no tiene botón: tiene una nota
 * que lo explica.
 *
 * No habla con la red. Avisa qué se quiere hacer y el contenedor lo ejecuta; así
 * el mismo panel sirve para el clic, el arrastre y el teclado.
 */
@Component({
  selector: 'app-agenda-panel',
  imports: [AccessWhyNot, Alert, AppButton, FormField, Input, PatientFinder],
  templateUrl: './agenda-panel.html',
  styleUrl: './agenda-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPanel {
  readonly event = input.required<AgendaEvent>();
  /** Horarios libres a los que se puede mover esta cita (solo si se puede reprogramar). */
  readonly candidates = input<readonly AgendaEvent[]>([]);
  readonly busy = input(false);
  readonly failure = input<string | null>(null);
  /** Qué preguntarle a «¿Por qué no puedo?» si la acción fue rechazada (la misma acción, sobre este horario). */
  readonly explain = input<ExplainMyAccessRequest | null>(null);
  /** El paciente que ya se eligió con «Nueva cita» o «Buscar paciente». */
  readonly holding = input<PickedPatient | null>(null);

  readonly closed = output<void>();
  readonly checkIn = output<void>();
  readonly confirmBooking = output<void>();
  readonly cancelBooking = output<void>();
  readonly reschedule = output<AgendaEvent>();
  readonly book = output<BookRequest>();
  readonly dropHeld = output<void>();

  protected readonly mode = signal<PanelMode>(null);
  protected readonly chosen = signal<PickedPatient | null>(null);
  protected readonly reason = signal('');

  /** La API dijo que el doctor no atiende en ese espacio o no presta ese servicio: se puede elegir otro. */
  protected readonly placeRejected = computed(() => isPlaceRejection(this.failure()));
  protected readonly offered = computed(() => offeredActions(this.event()));
  protected readonly note = computed(() => missingNote(this.event()));
  protected readonly canRegister = computed(() => this.event().allowedActions.includes('patient.register'));
  protected readonly createMissing = computed(() => this.event().status === 'FREE' && !this.event().allowedActions.includes('schedule.create'));

  protected readonly title = computed(() => `${clock(this.event().start)} · ${statusText(this.event())}`);
  protected readonly dateText = computed(() =>
    new Date(this.event().start).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  );
  protected readonly orgColors = computed(() => orgToneColors(this.event().orgTone));

  /** Los destinos posibles, agrupados por día. */
  protected readonly byDay = computed(() => {
    const grupos = new Map<string, { label: string; items: AgendaEvent[] }>();
    for (const c of this.candidates()) {
      const fecha = new Date(c.start);
      const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
      const grupo = grupos.get(clave) ?? { label: fecha.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }), items: [] };
      grupo.items.push(c);
      grupos.set(clave, grupo);
    }
    return [...grupos.values()];
  });

  constructor() {
    // Un horario nuevo empieza de cero: no arrastra el paciente ni el motivo del anterior.
    effect(() => {
      this.event();
      this.mode.set(null);
      this.chosen.set(null);
      this.reason.set('');
    });
  }

  protected readonly clock = clock;

  protected hora(event: AgendaEvent): string {
    return clock(event.start);
  }

  protected start(action: EventAction): void {
    switch (action) {
      case 'CHECK_IN':
        this.checkIn.emit();
        return;
      case 'CONFIRM':
        this.confirmBooking.emit();
        return;
      case 'CANCEL':
        this.cancelBooking.emit();
        return;
      default:
        this.mode.set(action);
        this.reason.set(action === 'WALK_IN' ? 'Atención sin cita' : action === 'CREATE' ? 'Consulta' : '');
    }
  }

  protected back(): void {
    this.mode.set(null);
    this.chosen.set(null);
  }

  /** «Elegir otro horario, doctor o servicio»: se cierra el panel y la agenda sigue ahí, con el paciente en mano. */
  protected chooseAnother(): void {
    this.closed.emit();
  }

  /** El paciente en mano (si lo hay) o el que se acaba de elegir. */
  protected readonly patient = computed(() => this.chosen() ?? this.holding());

  protected pick(picked: PickedPatient): void {
    this.chosen.set(picked);
  }

  protected confirmBook(): void {
    const mode = this.mode();
    const picked = this.patient();
    if ((mode !== 'CREATE' && mode !== 'WALK_IN' && mode !== 'WAITLIST') || picked === null || this.busy()) return;
    this.book.emit({ mode, picked, reason: this.reason().trim() });
  }

  protected actionLabel(): string {
    const org = this.event().orgName;
    switch (this.mode()) {
      case 'CREATE':
        return `Crear la cita en ${org}`;
      case 'WALK_IN':
        return `Atender sin cita en ${org}`;
      default:
        return `Anotar en la lista de espera de ${org}`;
    }
  }

  protected setReason(value: string | number | null): void {
    this.reason.set('' + (value ?? ''));
  }
}
