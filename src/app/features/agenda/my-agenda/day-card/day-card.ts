import { HttpErrorResponse } from '@angular/common/http';
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
import { describeApiFailure, fieldErrorsOf } from '../../../../core/http/api-failure';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
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
export interface DayGap {
  readonly desde: Date;
  readonly hasta: Date;
  readonly rotulo: string;
  /**
   * Qué lo ocupa, y con eso qué peso tiene el choque.
   *
   * C-10 (2026-09-20) pide que **no se pueda** elegir un rato bloqueado ni de
   * descanso. Un choque con otra CITA, en cambio, sigue siendo un aviso: un
   * cupo de capacidad 2 admite una segunda, y la autoridad de eso es el
   * servidor, no esta pantalla (regla 95.6.1). La diferencia entre «no te dejo»
   * y «mirá que» no se puede tomar sin saber cuál de las dos cosas es.
   */
  readonly tipo: 'cita' | 'bloqueo';
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
  selector: 'app-day-card',
  imports: [
    Alert,
    AppButton,
    ContentDialog,
    FormField,
    Input,
    ReferenceCombobox,
    RouterLink,
    SegmentedControl,
  ],
  templateUrl: './day-card.html',
  styleUrl: './day-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayCard {
  private readonly scheduling = inject(SchedulingClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  /** El día sobre el que se crea. */
  readonly dia = input.required<Date>();

  /** La agenda (recurso) donde ocurre. */
  readonly resourceId = input.required<string>();

  /** El rato tocado, para prellenar. */
  readonly desdeInicial = input.required<Date>();
  readonly hastaInicial = input.required<Date>();

  /**
   * El cupo del que salió el rato, o `null` si se tocó aire.
   *
   * C-10 (2026-09-20) · **el cupo manda la hora.** Cuando el rato viene de un
   * cupo ya programado, la franja es un dato y no una pregunta: los campos de
   * hora desaparecen y se muestra la franja. Preguntar la hora sobre un cupo
   * que ya la tiene es ofrecer contradecir al horario publicado.
   *
   * Sobre aire —un hueco sin cupo detrás— los campos siguen, porque ahí la
   * franja no existe hasta que alguien la escribe.
   */
  readonly cupoId = input<string | null>(null);

  /** Lo que el día ya tiene tomado, para avisar el choque antes de guardar. */
  readonly ratosTomados = input<readonly DayGap[]>([]);

  /** Se creó algo: el contenedor recarga el día. */
  readonly creada = output<void>();

  /** Cerrar sin crear. */
  readonly cerrada = output<void>();

  /* -- El formulario ------------------------------------------------------- */

  protected readonly from = signal('');
  protected readonly hasta = signal('');
  protected readonly reason = signal('');
  protected readonly patient = signal<ReferenceOption | null>(null);
  /**
   * Por qué medio se atiende.
   *
   * Arranca en presencial porque es lo que pasa casi siempre; elegirlo
   * igualmente lo GUARDA, en vez de mandarlo vacío: «nadie lo dijo» y «dijeron
   * que es presencial» son cosas distintas en la historia del paciente.
   */
  protected readonly modality = signal<ModalidadDeAtencion>('PRESENCIAL');
  protected readonly modalities = MODALIDADES;

  /**
   * Las modalidades como opciones del control segmentado.
   *
   * C-21 y C-10 (2026-09-20): el doctor pidió alternancia en vez de radios.
   * Se reusa `segmented-control`, que es el `radiogroup` del sistema de diseño
   * —con flechas y un solo tabulador—, en vez de escribir otro control: son
   * tres opciones excluyentes, que es exactamente para lo que existe.
   */
  protected readonly modalityOptions: readonly SegmentedOption<ModalidadDeAtencion>[] =
    MODALIDADES.map((m) => ({ value: m.valor, label: m.nombre }));

  /** Si el alta salió de un cupo ya programado: la franja no se pregunta. */
  protected readonly fromSlot = computed(() => this.cupoId() !== null);

  /** La franja del cupo, en palabras, para mostrarla como dato. */
  protected readonly slotBand = computed(
    () => `${timeOf(this.desdeInicial())}–${timeOf(this.hastaInicial())}`,
  );
  protected readonly candidates = signal<readonly ReferenceOption[]>([]);
  protected readonly searching = signal(false);

  /**
   * Por qué la última búsqueda de pacientes no trajo nada, si fue un fallo.
   *
   * Sin esto, una búsqueda caída decía «Ningún paciente coincide»: el
   * profesional concluía que la persona no estaba registrada.
   */
  protected readonly failedSearch = signal<string | null>(null);
  protected readonly saving = signal(false);

  /** El fallo del guardado, con el mensaje del servidor tal cual. */
  protected readonly error = signal<string | null>(null);

  constructor() {
    // El prellenado va en el constructor y no en un effect: el rato tocado es
    // el estado INICIAL del formulario, no algo que lo pise mientras se edita.
    queueMicrotask(() => {
      this.from.set(timeOf(this.desdeInicial()));
      this.hasta.set(timeOf(this.hastaInicial()));
    });
  }

  protected readonly title = computed(() =>
    this.dia().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }),
  );

  /**
   * Qué va a pasar al guardar, dicho ANTES de apretar.
   *
   * Es la inferencia hecha visible: la tarjeta no tiene tipos, pero decirle a
   * la persona qué va a crear evita la sorpresa de una campana que no esperaba.
   */
  protected readonly willHappen = computed<string | null>(() => {
    if (this.patient() !== null) {
      // La modalidad entra en la frase sólo cuando NO es la de siempre: decir
      // «en el consultorio» en cada cita presencial es ruido, y lo que la
      // persona necesita confirmar de un vistazo es lo que se sale de la norma.
      const porVideo = this.modality() === 'TELECONSULTA';
      const aDomicilio = this.modality() === 'DOMICILIO';
      const donde = porVideo
        ? ' Va por videollamada.'
        : aDomicilio
          ? ' Va a su domicilio.'
          : '';
      return `Se agenda la cita y le avisamos al paciente. No tiene que confirmar nada.${donde}`;
    }
    if (this.reason().trim() !== '') {
      return 'Queda como tiempo ocupado suyo. El paciente no ve nada en ese rato.';
    }
    return null;
  });

  /**
   * El choque con lo ya cargado del día, avisado en vivo.
   *
   * Sólo mira lo que la pantalla ya sabe — sin viaje extra—. El servidor cruza
   * además las otras sedes al guardar.
   */
  /** El rato ya tomado que pisa lo que se está por crear, si hay alguno. */
  private readonly overlaps = computed<DayGap | null>(() => {
    const rango = this.range();
    if (rango === null) return null;
    return (
      this.ratosTomados().find(
        (rato) =>
          rato.desde.getTime() < rango.hasta.getTime() &&
          rato.hasta.getTime() > rango.desde.getTime(),
      ) ?? null
    );
  });

  protected readonly clashInLive = computed<string | null>(() => {
    const pisa = this.overlaps();
    if (pisa === null) return null;
    const cuando = `(${timeOf(pisa.desde)}–${timeOf(pisa.hasta)})`;
    return pisa.tipo === 'bloqueo'
      ? `Ese rato está bloqueado por ${pisa.rotulo} ${cuando}. No se puede agendar ahí: quite el bloqueo primero, o elija otro rato.`
      : `Ese rato pisa ${pisa.rotulo} ${cuando}.`;
  });

  /**
   * C-10 · sobre un bloqueo o un descanso **no se crea nada**.
   *
   * La regla se aplica donde se crea y no escondiendo el botón: el bloque ya no
   * es tocable en el día, pero al alta se puede llegar por el «+» del
   * encabezado con cualquier franja escrita a mano, y por ahí el bloqueo
   * quedaba sin defensa. El aviso dice además QUÉ lo bloquea y qué hacer.
   */
  protected readonly blockedByGap = computed(() => this.overlaps()?.tipo === 'bloqueo');

  protected readonly canSave = computed(() => {
    const rango = this.range();
    return (
      rango !== null &&
      !this.saving() &&
      !this.blockedByGap() &&
      (this.patient() !== null || this.reason().trim() !== '')
    );
  });

  /** Busca pacientes por nombre o código. La molécula ya espera antes de emitir. */
  protected searchPatient(texto: string): void {
    if (texto.trim() === '') {
      this.candidates.set([]);
      return;
    }
    this.searching.set(true);
    this.profiles.searchPatients({ query: texto.trim(), limit: 10 }).subscribe({
      next: (pagina) => {
        this.searching.set(false);
        this.failedSearch.set(null);
        this.candidates.set(
          pagina.items.map((item) => ({
            value: item.profileId,
            label: item.displayName ?? item.patientCode,
            // El código clínico como pista: es lo que distingue a dos personas
            // con el mismo nombre sin mostrar ningún uuid.
            hint: item.displayName === undefined ? undefined : item.patientCode,
          })),
        );
      },
      error: (error: unknown) => {
        this.searching.set(false);
        this.candidates.set([]);
        this.failedSearch.set(describeApiFailure(error, 'No se pudo buscar pacientes.'));
      },
    });
  }

  /**
   * Guardar: la inferencia decide qué se crea.
   *
   * El 422 del servidor —la regla madre, con qué/cuándo/dónde— se muestra tal
   * cual: ese mensaje ya está escrito para una persona.
   */
  protected save(): void {
    const rango = this.range();
    // `puedeGuardar()` ya incluye el bloqueo; se vuelve a mirar acá porque un
    // botón deshabilitado no es una regla: esta función se puede invocar por
    // teclado, por `submit` del formulario y desde una prueba.
    if (rango === null || this.blockedByGap() || !this.canSave()) return;

    this.saving.set(true);
    this.error.set(null);

    const paciente = this.patient();
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
          ...(this.reason().trim() === '' ? {} : { reasonText: this.reason().trim() }),
          channel: this.modality(),
        })
        .subscribe({
          next: (creado) => {
            this.saving.set(false);
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
          error: (error: unknown) => this.failure(error),
        });
      return;
    }

    this.scheduling
      .createException(this.resourceId(), {
        exceptionType: 'ABSENCE',
        startAt: rango.desde.toISOString(),
        endAt: rango.hasta.toISOString(),
        reason: this.reason().trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toasts.success(
            'El paciente no ve nada en ese rato.',
            'Tiempo ocupado guardado',
          );
          this.creada.emit();
        },
        error: (error: unknown) => this.failure(error),
      });
  }

  /**
   * El rango elegido como fechas del día mirado, o `null` si no cierra.
   *
   * **Sobre un cupo la franja sale del cupo y no de los campos** (C-10): no
   * alcanza con esconder los campos de hora, porque sus señales siguen vivas y
   * cualquier cosa que las escribiera terminaría en la cita. Acá se corta:
   * viniendo de un cupo, lo que se guarda es su franja, punto.
   */
  private range(): { desde: Date; hasta: Date } | null {
    if (this.fromSlot()) {
      return { desde: this.desdeInicial(), hasta: this.hastaInicial() };
    }
    const desde = withTime(this.dia(), this.from());
    const hasta = withTime(this.dia(), this.hasta());
    if (desde === null || hasta === null || desde.getTime() >= hasta.getTime()) {
      return null;
    }
    return { desde, hasta };
  }

  /**
   * Si hay algo que se perdería al cerrar.
   *
   * Decide si `Escape` y el clic en el fondo cierran solos o preguntan. Un
   * modal vacío que exige confirmar para salir es una traba; uno con un
   * paciente ya elegido que se cierra de un `Escape` de reflejo es una pérdida.
   */
  protected readonly hasWrittenContent = computed(
    () => this.patient() !== null || this.reason().trim() !== '',
  );

  /**
   * Intentaron cerrar con algo escrito: se pregunta antes de perderlo.
   *
   * Se usa el diálogo del sistema y no `confirm()` del navegador: `confirm()`
   * congela la página, no se puede recorrer con lector de pantalla y bloquea
   * cualquier automatización (regla 95.4.2).
   */
  protected requestDiscard(): void {
    void this.dialogs
      .confirm({
        title: '¿Descartar lo que escribió?',
        message: 'Lo que cargó en esta tarjeta se pierde y no se crea nada.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        destructive: true,
      })
      .then((descarta) => {
        if (descarta) this.cerrada.emit();
      });
  }

  /**
   * El fallo del guardado, con el motivo del servidor y el código de soporte.
   *
   * La regla madre ya responde con qué, cuándo y dónde: ese texto se muestra
   * tal cual. Las violaciones por campo se juntan en una frase (el formulario
   * no tiene campos que se llamen como los del DTO), y siempre que la API lo
   * mande se agrega el código con que se encuentra la línea del log.
   */
  private failure(error: unknown): void {
    this.saving.set(false);
    const campos = Object.values(fieldErrorsOf(error));
    const delServidor =
      campos.length > 0
        ? campos.join(' ')
        : (bodyMessage(error) ?? 'No se pudo guardar la cita. Intente de nuevo.');
    this.error.set(describeApiFailure(error, delServidor));
  }
}

/**
 * El `message` de un cuerpo de error **sin `code`** (un proxy, una regla que
 * responde texto suelto). Con `code`, quien decide si el mensaje es para la
 * persona es `describeApiFailure`: un «Error interno» no lo es.
 */
function bodyMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const cuerpo: unknown = error.error;
  if (typeof cuerpo !== 'object' || cuerpo === null || 'code' in cuerpo || !('message' in cuerpo)) {
    return null;
  }
  return typeof cuerpo.message === 'string' && cuerpo.message.trim() !== '' ? cuerpo.message : null;
}

/** `HH:mm` de un instante, para los campos de hora. */
function timeOf(instante: Date): string {
  const horas = String(instante.getHours()).padStart(2, '0');
  const minutos = String(instante.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

/** El día con la hora `HH:mm` puesta, o `null` si el texto no es una hora. */
function withTime(dia: Date, texto: string): Date | null {
  const partes = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(texto.trim());
  if (partes === null) return null;
  const fecha = new Date(dia);
  fecha.setHours(Number(partes[1]), Number(partes[2]), 0, 0);
  return fecha;
}
