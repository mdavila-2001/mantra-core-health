import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { AgendaResource } from '../../../core/data-access/scheduling/scheduling.types';
import {
  MODALIDADES,
  type ModalidadDeAtencion,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AGENDA_MINE_ROUTE } from '../agenda.routes';
import { misRecursosDeAgenda } from '../mi-recurso';

/**
 * Duraciones ofrecidas, en minutos.
 *
 * Son atajos, **no un tope**: el campo admite escribir cualquier número porque
 * «la cirugía de tres horas y la consulta de cuarenta y cinco conviven», y
 * acotar la duración a la del turno publicado convertiría esta pantalla en el
 * formulario del paciente, que es justo lo que no es.
 */
const DURACIONES = [15, 20, 30, 45, 60, 90, 120] as const;

/** Duración por omisión: la consulta corriente. */
const DURACION_POR_DEFECTO = 30;

/**
 * Alta de cita del profesional — `/schedule/appointment/new`.
 *
 * ## Por qué no se copió el formulario del paciente
 *
 * Porque no hacen lo mismo. `booking-new` parte de un **cupo ya publicado** y
 * lo toma en dos pasos con vencimiento (`hold` → `confirm`); esto parte de un
 * **rato cualquiera**, en una sola transacción, y **retira** los cupos libres
 * que pisa. Copiar aquella pantalla habría duplicado por tercera vez lo
 * delicado —la revalidación del cupo y el vencimiento de la retención— para un
 * caso de uso que no lo tiene. Lo que se reusa son las **piezas**: el combobox
 * de paciente, el campo de motivo, el select de modalidad.
 *
 * ## El doctor no se elige
 *
 * No hay campo de profesional, y no es una omisión de la interfaz: la cita
 * nace en la agenda de quien tiene la sesión. El servidor impone lo mismo
 * (`assertRecursoDelActor`), así que forzar el `resourceId` de otra agenda
 * responde 403 — esconder el campo no es la barrera, es la consecuencia.
 *
 * ## La sede se elige eligiendo la agenda
 *
 * Un profesional con dos consultorios tiene dos recursos. Con uno solo la
 * pregunta no aparece: un select de una opción es una decisión que no existe.
 *
 * ## Los choques los decide el servidor
 *
 * La regla madre cruza **todas** las sedes y esta pantalla ve una; su 422
 * llega con qué, cuándo y dónde, y se muestra tal cual porque ese texto ya
 * está escrito para una persona. Acá no se adivina nada antes de guardar.
 */
@Component({
  selector: 'app-appointment-new',
  imports: [
    Alert,
    AppButton,
    DatePicker,
    FormField,
    Input,
    PageHeader,
    ReferenceCombobox,
    RouterLink,
    Select,
  ],
  templateUrl: './appointment-new.html',
  styleUrl: './appointment-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentNew {
  private readonly auth = inject(AuthService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly rutaDeMiAgenda = AGENDA_MINE_ROUTE;

  /* -- Las agendas de quien tiene la sesión -------------------------------- */

  protected readonly agendas = signal<readonly AgendaResource[]>([]);
  protected readonly agendaElegida = signal<string | null>(null);
  protected readonly cargandoAgendas = signal(true);

  /** Con una sola agenda no se pregunta: no hay decisión que tomar. */
  protected readonly hayQueElegirAgenda = computed(() => this.agendas().length > 1);

  protected readonly opcionesDeAgenda = computed<readonly SelectOption<string>[]>(
    () => this.agendas().map((agenda) => ({ value: agenda.id, label: agenda.name })),
  );

  /* -- El formulario ------------------------------------------------------- */

  protected readonly paciente = signal<ReferenceOption | null>(null);
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);

  /**
   * El día de la cita.
   *
   * `Date` y no cadena: el organismo de fecha ya trabaja con `Date`, y pasar
   * por texto obligaría a parsear un formato en el medio — que es donde
   * aparecen las citas adelantadas un día.
   */
  protected readonly dia = signal<Date | null>(null);

  /** Hoy, a medianoche: no se agenda para atrás. */
  protected readonly hoy = new Date(new Date().setHours(0, 0, 0, 0));

  protected readonly hora = signal('');
  protected readonly duracion = signal(String(DURACION_POR_DEFECTO));
  protected readonly motivo = signal('');

  /**
   * Por qué medio se atiende.
   *
   * Arranca en presencial porque es lo que pasa casi siempre, y **se guarda
   * igual**: «nadie lo dijo» y «dijeron que es presencial» son cosas distintas
   * en la historia del paciente, y el contrato distingue las dos —omitirla
   * deja la columna en nulo—.
   */
  protected readonly modalidad = signal<ModalidadDeAtencion>('PRESENCIAL');
  protected readonly modalidades = MODALIDADES;

  protected readonly opcionesDeDuracion: readonly SelectOption<string>[] =
    DURACIONES.map((minutos) => ({
      value: String(minutos),
      label: minutos < 60
        ? `${minutos} minutos`
        : minutos === 60
          ? '1 hora'
          : `${minutos / 60} horas`,
    }));

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.cargarAgendas();
  }

  /**
   * Cuándo empieza la cita, o `null` si falta o no es una fecha.
   *
   * La hora se valida acá y no en el campo: `09:30` es válido, `9:5` no, y un
   * texto libre que llega mal armado produce una cita en un instante que nadie
   * eligió.
   */
  protected readonly comienza = computed<Date | null>(() => {
    const dia = this.dia();
    const hora = this.hora().trim();
    if (dia === null || !/^\d{1,2}:\d{2}$/.test(hora)) return null;

    const [hh, mm] = hora.split(':').map(Number);
    if (hh > 23 || mm > 59) return null;

    // Se compone sobre el día elegido, en hora local. Armarlo desde una
    // cadena ISO sin zona lo interpretaría en UTC en algunos navegadores y
    // adelantaría la cita cuatro horas en Bolivia.
    const cuando = new Date(dia);
    cuando.setHours(hh, mm, 0, 0);
    return cuando;
  });

  /** Los minutos que dura, o `null` si lo escrito no es un número positivo. */
  protected readonly minutos = computed<number | null>(() => {
    const valor = Number(this.duracion());
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  });

  /** Cómo termina la frase de confirmación, para decir qué va a pasar. */
  protected readonly queVaAPasar = computed<string | null>(() => {
    if (this.paciente() === null) return null;
    const porVideo = this.modalidad() === 'TELECONSULTA';
    const aDomicilio = this.modalidad() === 'DOMICILIO';
    const donde = porVideo
      ? ' Va por videollamada.'
      : aDomicilio
        ? ' Vas a su domicilio.'
        : '';
    return `Se agenda la cita y le avisamos al paciente. No tiene que confirmar nada.${donde}`;
  });

  protected readonly puedeGuardar = computed(
    () =>
      !this.guardando() &&
      this.paciente() !== null &&
      this.comienza() !== null &&
      this.minutos() !== null &&
      this.agendaElegida() !== null,
  );

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
            // El código clínico como pista: distingue a dos personas con el
            // mismo nombre sin mostrar ningún uuid.
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
   * Crea la cita.
   *
   * El 422 del servidor —la regla madre, con qué, cuándo y dónde— se muestra
   * **tal cual**: ese mensaje ya está redactado para una persona, y
   * reescribirlo acá sólo podría empeorarlo o mentir.
   */
  protected guardar(): void {
    const paciente = this.paciente();
    const comienza = this.comienza();
    const minutos = this.minutos();
    const resourceId = this.agendaElegida();
    if (
      !this.puedeGuardar() ||
      paciente === null ||
      comienza === null ||
      minutos === null ||
      resourceId === null
    ) {
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    this.scheduling
      .createDirectAppointment({
        patientProfileId: paciente.value,
        resourceId,
        startAt: comienza.toISOString(),
        durationMinutes: minutos,
        ...(this.motivo().trim() === '' ? {} : { reasonText: this.motivo().trim() }),
        channel: this.modalidad(),
      })
      .subscribe({
        next: (creada) => {
          this.guardando.set(false);
          this.toasts.success(
            creada.retractedSlots > 0
              ? `Le avisamos al paciente. Esto quitó ${creada.retractedSlots} ${
                  creada.retractedSlots === 1
                    ? 'horario disponible'
                    : 'horarios disponibles'
                }.`
              : 'Le avisamos al paciente. No tiene que confirmar nada.',
            'Cita agendada',
          );
          void this.router.navigate([AGENDA_MINE_ROUTE]);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const estado = errorToViewState<never>(error);
          this.error.set(
            'message' in estado && typeof estado.message === 'string'
              ? estado.message
              : 'No pudimos agendar la cita.',
          );
        },
      });
  }

  /**
   * Trae las agendas del profesional de la sesión.
   *
   * Se busca por el **perfil profesional**, que es el mismo criterio con el
   * que el servidor decide si la agenda es suya: preguntarlo de otra forma
   * daría una respuesta que después se contradice con un 403.
   */
  private cargarAgendas(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.cargandoAgendas.set(false);
      return;
    }

    misRecursosDeAgenda(this.scheduling, tenantId, perfil).subscribe({
      next: (recursos) => {
        this.cargandoAgendas.set(false);
        this.agendas.set(recursos);
        // Con una sola, se elige sola: preguntar por algo que no tiene
        // alternativa es un paso de más.
        this.agendaElegida.set(recursos[0]?.id ?? null);
      },
      error: () => {
        this.cargandoAgendas.set(false);
        this.agendas.set([]);
      },
    });
  }
}
