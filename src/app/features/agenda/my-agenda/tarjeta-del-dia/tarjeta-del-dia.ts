import { RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { SchedulingClient } from '../../../../core/data-access/scheduling/scheduling.client';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import {
  MODALIDADES,
  type ModalidadDeAtencion,
} from '../../../../core/data-access/scheduling/scheduling.types';

/** Un rato ya tomado del día, para avisar el choque ANTES de guardar. */
export interface RatoDelDia {
  readonly desde: Date;
  readonly hasta: Date;
  readonly rotulo: string;
}

/**
 * LA TARJETA — el único gesto de creación del calendario (AG-5, parte 2).
 *
 * ## El sistema infiere: el doctor nunca elige un «tipo»
 *
 * Tocás un rato, describís qué pasa ahí, y la tarjeta decide sola:
 * - puso **paciente** → cita puntual (AG-2): nace confirmada, campana al
 *   paciente con la salida de «pedir cambio».
 * - no puso paciente, puso **motivo** → tiempo ocupado (AG-3): la reunión, la
 *   guardia — el paciente nunca lo ve.
 *
 * Los tres tipos existen sólo en el modelo interno, jamás como menú. La
 * tercera inferencia —«abrir este rato para que reserven», la franja suelta—
 * espera el `gap_minutes` de AG-4: el respiro es parte de su diseño y
 * construirla sin él sería entregarla dos veces. Mientras tanto, el enlace
 * discreto a Publicar cubre a quien cayó acá buscando el horario semanal.
 *
 * ## Los choques, en vivo y en el servidor
 *
 * Al elegir el rango, si pisa algo del día YA CARGADO la tarjeta lo dice antes
 * de guardar — con lo que la pantalla ya sabe, sin viaje extra. El servidor
 * sigue siendo la última palabra: la regla madre cruza TODAS las sedes (acá
 * sólo se ve un día de una), y su 422 llega con qué, cuándo y dónde — se
 * muestra tal cual.
 */
@Component({
  selector: 'app-tarjeta-del-dia',
  imports: [Alert, AppButton, FormField, Input, ReferenceCombobox, RouterLink],
  templateUrl: './tarjeta-del-dia.html',
  styleUrl: './tarjeta-del-dia.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarjetaDelDia {
  private readonly scheduling = inject(SchedulingClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly toasts = inject(ToastService);

  /** El día sobre el que se crea. */
  readonly dia = input.required<Date>();

  /** La agenda (recurso) donde ocurre. */
  readonly resourceId = input.required<string>();

  /** El rato tocado, para prellenar. */
  readonly desdeInicial = input.required<Date>();
  readonly hastaInicial = input.required<Date>();

  /** Lo que el día ya tiene tomado, para avisar el choque antes de guardar. */
  readonly ratosTomados = input<readonly RatoDelDia[]>([]);

  /** Se creó algo: el contenedor recarga el día. */
  readonly creada = output<void>();

  /** Cerrar sin crear. */
  readonly cerrada = output<void>();

  /* -- El formulario ------------------------------------------------------- */

  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly motivo = signal('');
  protected readonly paciente = signal<ReferenceOption | null>(null);
  /**
   * Por qué medio se atiende.
   *
   * Arranca en presencial porque es lo que pasa casi siempre; elegirlo
   * igualmente lo GUARDA, en vez de mandarlo vacío: «nadie lo dijo» y «dijeron
   * que es presencial» son cosas distintas en la historia del paciente.
   */
  protected readonly modalidad = signal<ModalidadDeAtencion>('PRESENCIAL');
  protected readonly modalidades = MODALIDADES;
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);
  protected readonly guardando = signal(false);

  /** El fallo del guardado, con el mensaje del servidor tal cual. */
  protected readonly error = signal<string | null>(null);

  constructor() {
    // El prellenado va en el constructor y no en un effect: el rato tocado es
    // el estado INICIAL del formulario, no algo que lo pise mientras se edita.
    queueMicrotask(() => {
      this.desde.set(horaDe(this.desdeInicial()));
      this.hasta.set(horaDe(this.hastaInicial()));
    });
  }

  protected readonly titulo = computed(() =>
    this.dia().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }),
  );

  /**
   * Qué va a pasar al guardar, dicho ANTES de apretar.
   *
   * Es la inferencia hecha visible: la tarjeta no tiene tipos, pero decirle a
   * la persona qué va a crear evita la sorpresa de una campana que no esperaba.
   */
  protected readonly queVaAPasar = computed<string | null>(() => {
    if (this.paciente() !== null) {
      // La modalidad entra en la frase sólo cuando NO es la de siempre: decir
      // «en el consultorio» en cada cita presencial es ruido, y lo que la
      // persona necesita confirmar de un vistazo es lo que se sale de la norma.
      const porVideo = this.modalidad() === 'TELECONSULTA';
      const aDomicilio = this.modalidad() === 'DOMICILIO';
      const donde = porVideo
        ? ' Va por videollamada.'
        : aDomicilio
          ? ' Vas a su domicilio.'
          : '';
      return `Se agenda la cita y le avisamos al paciente. No tiene que confirmar nada.${donde}`;
    }
    if (this.motivo().trim() !== '') {
      return 'Queda como tiempo ocupado tuyo. El paciente no ve nada en ese rato.';
    }
    return null;
  });

  /**
   * El choque con lo ya cargado del día, avisado en vivo.
   *
   * Sólo mira lo que la pantalla ya sabe — sin viaje extra—. El servidor cruza
   * además las otras sedes al guardar.
   */
  protected readonly choqueEnVivo = computed<string | null>(() => {
    const rango = this.rango();
    if (rango === null) return null;
    const pisa = this.ratosTomados().find(
      (rato) => rato.desde.getTime() < rango.hasta.getTime() && rato.hasta.getTime() > rango.desde.getTime(),
    );
    return pisa === null || pisa === undefined
      ? null
      : `Ese rato pisa ${pisa.rotulo} (${horaDe(pisa.desde)}–${horaDe(pisa.hasta)}).`;
  });

  protected readonly puedeGuardar = computed(() => {
    const rango = this.rango();
    return (
      rango !== null &&
      !this.guardando() &&
      (this.paciente() !== null || this.motivo().trim() !== '')
    );
  });

  /** Busca pacientes por nombre o código. La molécula ya espera antes de emitir. */
  protected buscarPaciente(texto: string): void {
    if (texto.trim() === '') {
      this.candidatos.set([]);
      return;
    }
    this.buscando.set(true);
    this.profiles.searchPatients({ query: texto.trim(), limit: 10 }).subscribe({
      next: (pagina) => {
        this.buscando.set(false);
        this.candidatos.set(
          pagina.items.map((item) => ({
            value: item.profileId,
            label: item.displayName ?? item.patientCode,
            // El código clínico como pista: es lo que distingue a dos personas
            // con el mismo nombre sin mostrar ningún uuid.
            hint: item.displayName === undefined ? undefined : item.patientCode,
          })),
        );
      },
      error: () => {
        this.buscando.set(false);
        this.candidatos.set([]);
      },
    });
  }

  /**
   * Guardar: la inferencia decide qué se crea.
   *
   * El 422 del servidor —la regla madre, con qué/cuándo/dónde— se muestra tal
   * cual: ese mensaje ya está escrito para una persona.
   */
  protected guardar(): void {
    const rango = this.rango();
    if (rango === null || !this.puedeGuardar()) return;

    this.guardando.set(true);
    this.error.set(null);

    const paciente = this.paciente();
    if (paciente !== null) {
      const duracionMin = Math.round(
        (rango.hasta.getTime() - rango.desde.getTime()) / 60_000,
      );
      this.scheduling
        .createDirectAppointment({
          patientProfileId: paciente.value,
          resourceId: this.resourceId(),
          startAt: rango.desde.toISOString(),
          durationMinutes: duracionMin,
          ...(this.motivo().trim() === '' ? {} : { reasonText: this.motivo().trim() }),
          channel: this.modalidad(),
        })
        .subscribe({
          next: (creado) => {
            this.guardando.set(false);
            this.toasts.success(
              creado.retractedSlots > 0
                ? `Le avisamos al paciente. Esto quitó ${creado.retractedSlots} ${
                    creado.retractedSlots === 1 ? 'horario disponible' : 'horarios disponibles'
                  }.`
                : 'Le avisamos al paciente. No tiene que confirmar nada.',
              'Cita agendada',
            );
            this.creada.emit();
          },
          error: (error: unknown) => this.fallo(error),
        });
      return;
    }

    this.scheduling
      .createException(this.resourceId(), {
        exceptionType: 'ABSENCE',
        startAt: rango.desde.toISOString(),
        endAt: rango.hasta.toISOString(),
        reason: this.motivo().trim(),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.toasts.success(
            'El paciente no ve nada en ese rato.',
            'Tiempo ocupado guardado',
          );
          this.creada.emit();
        },
        error: (error: unknown) => this.fallo(error),
      });
  }

  /** El rango elegido como fechas del día mirado, o `null` si no cierra. */
  private rango(): { desde: Date; hasta: Date } | null {
    const desde = conHora(this.dia(), this.desde());
    const hasta = conHora(this.dia(), this.hasta());
    if (desde === null || hasta === null || desde.getTime() >= hasta.getTime()) {
      return null;
    }
    return { desde, hasta };
  }

  private fallo(error: unknown): void {
    this.guardando.set(false);
    const mensaje =
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof (error as { error?: { message?: unknown } }).error?.message === 'string'
        ? ((error as { error: { message: string } }).error.message)
        : 'No se pudo guardar. Probá de nuevo.';
    this.error.set(mensaje);
  }
}

/** `HH:mm` de un instante, para los campos de hora. */
function horaDe(instante: Date): string {
  const horas = String(instante.getHours()).padStart(2, '0');
  const minutos = String(instante.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

/** El día con la hora `HH:mm` puesta, o `null` si el texto no es una hora. */
function conHora(dia: Date, texto: string): Date | null {
  const partes = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(texto.trim());
  if (partes === null) return null;
  const fecha = new Date(dia);
  fecha.setHours(Number(partes[1]), Number(partes[2]), 0, 0);
  return fecha;
}
