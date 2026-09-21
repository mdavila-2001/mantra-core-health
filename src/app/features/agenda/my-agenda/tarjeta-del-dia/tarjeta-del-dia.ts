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
export interface RatoDelDia {
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
  selector: 'app-tarjeta-del-dia',
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
  templateUrl: './tarjeta-del-dia.html',
  styleUrl: './tarjeta-del-dia.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarjetaDelDia {
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

  /**
   * Las modalidades como opciones del control segmentado.
   *
   * C-21 y C-10 (2026-09-20): el doctor pidió alternancia en vez de radios.
   * Se reusa `segmented-control`, que es el `radiogroup` del sistema de diseño
   * —con flechas y un solo tabulador—, en vez de escribir otro control: son
   * tres opciones excluyentes, que es exactamente para lo que existe.
   */
  protected readonly opcionesDeModalidad: readonly SegmentedOption<ModalidadDeAtencion>[] =
    MODALIDADES.map((m) => ({ value: m.valor, label: m.nombre }));

  /** Si el alta salió de un cupo ya programado: la franja no se pregunta. */
  protected readonly desdeUnCupo = computed(() => this.cupoId() !== null);

  /** La franja del cupo, en palabras, para mostrarla como dato. */
  protected readonly franjaDelCupo = computed(
    () => `${horaDe(this.desdeInicial())}–${horaDe(this.hastaInicial())}`,
  );
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
  /** El rato ya tomado que pisa lo que se está por crear, si hay alguno. */
  private readonly loQuePisa = computed<RatoDelDia | null>(() => {
    const rango = this.rango();
    if (rango === null) return null;
    return (
      this.ratosTomados().find(
        (rato) =>
          rato.desde.getTime() < rango.hasta.getTime() &&
          rato.hasta.getTime() > rango.desde.getTime(),
      ) ?? null
    );
  });

  protected readonly choqueEnVivo = computed<string | null>(() => {
    const pisa = this.loQuePisa();
    if (pisa === null) return null;
    const cuando = `(${horaDe(pisa.desde)}–${horaDe(pisa.hasta)})`;
    return pisa.tipo === 'bloqueo'
      ? `Ese rato está bloqueado por ${pisa.rotulo} ${cuando}. No se puede agendar ahí: quitá el bloqueo primero, o elegí otro rato.`
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
  protected readonly bloqueadoPorUnRato = computed(() => this.loQuePisa()?.tipo === 'bloqueo');

  protected readonly puedeGuardar = computed(() => {
    const rango = this.rango();
    return (
      rango !== null &&
      !this.guardando() &&
      !this.bloqueadoPorUnRato() &&
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
    // `puedeGuardar()` ya incluye el bloqueo; se vuelve a mirar acá porque un
    // botón deshabilitado no es una regla: esta función se puede invocar por
    // teclado, por `submit` del formulario y desde una prueba.
    if (rango === null || this.bloqueadoPorUnRato() || !this.puedeGuardar()) return;

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

  /**
   * El rango elegido como fechas del día mirado, o `null` si no cierra.
   *
   * **Sobre un cupo la franja sale del cupo y no de los campos** (C-10): no
   * alcanza con esconder los campos de hora, porque sus señales siguen vivas y
   * cualquier cosa que las escribiera terminaría en la cita. Acá se corta:
   * viniendo de un cupo, lo que se guarda es su franja, punto.
   */
  private rango(): { desde: Date; hasta: Date } | null {
    if (this.desdeUnCupo()) {
      return { desde: this.desdeInicial(), hasta: this.hastaInicial() };
    }
    const desde = conHora(this.dia(), this.desde());
    const hasta = conHora(this.dia(), this.hasta());
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
  protected readonly hayAlgoEscrito = computed(
    () => this.paciente() !== null || this.motivo().trim() !== '',
  );

  /**
   * Intentaron cerrar con algo escrito: se pregunta antes de perderlo.
   *
   * Se usa el diálogo del sistema y no `confirm()` del navegador: `confirm()`
   * congela la página, no se puede recorrer con lector de pantalla y bloquea
   * cualquier automatización (regla 95.4.2).
   */
  protected pedirDescarte(): void {
    void this.dialogs
      .confirm({
        title: '¿Descartar lo que escribiste?',
        message: 'Lo que cargaste en esta tarjeta se pierde y no se crea nada.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        destructive: true,
      })
      .then((descarta) => {
        if (descarta) this.cerrada.emit();
      });
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
