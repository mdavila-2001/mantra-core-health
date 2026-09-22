import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { WalkInAppointmentCreated } from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';

/**
 * Cuántos dígitos seguidos hacen que lo tecleado se lea como una cédula.
 *
 * Mismo número y misma razón que en `appointment-new`: el documento boliviano
 * más corto que circula tiene seis, y por debajo de eso lo escrito es casi
 * siempre el principio de un nombre.
 */
const DIGITOS_DE_CEDULA = 6;

/** Duraciones ofrecidas, en minutos. La del mostrador es la consulta corriente. */
const DURACIONES = [15, 20, 30, 45, 60] as const;
const DURACION_POR_DEFECTO = 30;

/**
 * En qué parte del gesto estamos.
 *
 * `buscando` es el paso que el mostrador hace nueve de cada diez veces: la
 * persona ya está en el sistema y sólo hay que encontrarla. `alta` es la
 * excepción — llegó alguien sin ficha— y por eso es un paso al que se entra a
 * propósito y no once campos vacíos debajo del buscador.
 */
type PasoDelMostrador = 'buscando' | 'alta';

/** Lo que el turno de mostrador deja hecho, para que el contenedor lo use. */
export interface TurnoDeMostrador {
  /** El perfil del paciente atendido, esté recién creado o ya registrado. */
  readonly patientProfileId: string;
  readonly bookingId: string;
  /** El encuentro abierto; sólo lo hay cuando el turno nació del walk-in. */
  readonly encounterId: string | null;
  /** El código de paciente, cuando el alta acaba de asignarlo. */
  readonly patientCode: string | null;
  readonly retractedSlots: number;
  /** Si la persona quedó registrada en este mismo gesto. */
  readonly esAltaNueva: boolean;
}

/**
 * **Ingreso por mostrador** — el turno de quien acaba de llegar (AC-C3-03).
 *
 * ## Qué problema resuelve
 *
 * Alguien entra al consultorio sin turno. Hasta hoy, atenderlo desde el sistema
 * costaba salir de la agenda, abrir `/schedule/appointment/new`, completar el
 * formulario largo y volver. Este modal es el atajo: se abre sobre la agenda
 * que se está mirando, busca por cédula o por nombre y crea la atención **ya
 * empezada**, sin perder de vista el día.
 *
 * ## Dos caminos, y la API decide cuál
 *
 * - **Ya registrado** → `POST /scheduling/appointments/direct`. La cita nace
 *   confirmada sobre un cupo único; es la misma llamada que usa el alta de cita
 *   del profesional.
 * - **Sin ficha** → `POST /scheduling/appointments/walk-in`. Registra a la
 *   persona, reserva, abre el encuentro y **arranca la atención en una sola
 *   transacción**. La reserva nace `IN_PROGRESS`, no confirmada: quien llegó al
 *   mostrador ya está ahí.
 *
 * La bifurcación mira el **paso**, no si hay alguien elegido en la lista: con
 * un paciente ya seleccionado, pasar a «paciente nuevo» y guardar habría
 * atendido al de antes.
 *
 * ## Por qué el alta pide cuatro campos y no once
 *
 * Porque es lo que la API exige (`WalkInPatientDto`): nombre, apellido,
 * documento y teléfono. Todo lo demás —el departamento emisor, la fecha de
 * nacimiento, la ocupación, el tutor— es opcional **a propósito**, porque quien
 * atiende el mostrador no siempre lo tiene a mano y la persona está esperando
 * de pie. La ficha completa se termina después, desde
 * `/schedule/appointment/new` o desde el propio expediente.
 *
 * ## El 409 no es un error de la persona que escribe
 *
 * Es «ese documento ya está registrado», y la salida es volver a buscar por él:
 * el mensaje lo dice con esas palabras y deja el documento escrito en el
 * buscador, en vez de pedir que se teclee de nuevo.
 */
@Component({
  selector: 'app-walk-in-form',
  imports: [Alert, AppButton, ContentDialog, FormField, Input, ReferenceCombobox, Select],
  templateUrl: './walk-in-form.html',
  styleUrl: './walk-in-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalkInForm {
  private readonly profiles = inject(ProfilesClient);
  private readonly scheduling = inject(SchedulingClient);

  /**
   * La agenda donde ocurre la atención.
   *
   * Requerida y no opcional: sin recurso no hay dónde poner el turno, y el
   * contenedor sólo ofrece el botón cuando hay uno elegido. Elegir el recurso
   * ES elegir la sede — el gating del vínculo ya gobernó quién puede tener
   * agenda dónde.
   */
  readonly resourceId = input.required<string>();

  /** Cerrar sin hacer nada. */
  readonly cerrado = output<void>();

  /** El turno quedó creado. */
  readonly creado = output<TurnoDeMostrador>();

  protected readonly paso = signal<PasoDelMostrador>('buscando');
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  /* -- La búsqueda ---------------------------------------------------------- */

  protected readonly paciente = signal<ReferenceOption | null>(null);
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);

  /**
   * Lo último que se tecleó en el buscador.
   *
   * Se guarda para dos cosas: precargar el documento cuando se pasa al alta
   * —pedirlo de nuevo dos renglones más abajo es trabajo repetido— y volver a
   * ofrecerlo cuando el alta rebota con 409.
   */
  private readonly ultimaBusqueda = signal('');

  /* -- El alta -------------------------------------------------------------- */

  protected readonly nuevoNombre = signal('');
  protected readonly nuevoApellido = signal('');
  protected readonly nuevoDocumento = signal('');
  protected readonly nuevoTelefono = signal('');

  /* -- El rato -------------------------------------------------------------- */

  protected readonly motivo = signal('');
  protected readonly minutos = signal(DURACION_POR_DEFECTO);

  protected readonly opcionesDeDuracion: readonly SelectOption<string>[] = DURACIONES.map((m) => ({
    value: String(m),
    label: `${m} minutos`,
  }));

  /** La duración como la compara el `<select>`: cadena, igual que sus opciones. */
  protected readonly duracionElegida = computed(() => String(this.minutos()));

  protected cambiarDuracion(valor: string | null): void {
    const minutos = Number(valor);
    if (Number.isFinite(minutos) && minutos > 0) this.minutos.set(minutos);
  }

  /**
   * Si se puede crear el turno.
   *
   * En `buscando`, que haya alguien elegido. En `alta`, los cuatro campos que
   * la API declara obligatorios — ni uno más: agregar una condición acá que el
   * servidor no tiene deja un botón apagado sin nadie que explique por qué.
   */
  protected readonly puedeGuardar = computed(() => {
    if (this.guardando()) return false;
    if (this.paso() === 'buscando') return this.paciente() !== null;
    return (
      this.nuevoNombre().trim() !== '' &&
      this.nuevoApellido().trim() !== '' &&
      this.nuevoDocumento().trim() !== '' &&
      this.nuevoTelefono().trim() !== ''
    );
  });

  protected buscarPaciente(texto: string): void {
    const limpio = texto.trim();
    this.ultimaBusqueda.set(limpio);
    if (limpio === '') {
      this.candidatos.set([]);
      return;
    }
    this.buscando.set(true);
    this.profiles
      .searchPatients(
        esDocumento(limpio) ? { nationalId: limpio, limit: 10 } : { query: limpio, limit: 10 },
      )
      .subscribe({
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
        // Sin candidatos la salida sigue existiendo —dar de alta— así que el
        // fallo de la búsqueda no bloquea el mostrador.
        error: () => {
          this.buscando.set(false);
          this.candidatos.set([]);
        },
      });
  }

  /** Pasa a registrar a alguien que no está en el sistema. */
  protected registrarNuevo(): void {
    this.paso.set('alta');
    this.error.set(null);
    // Suelta al elegido: si quedara seleccionado, «a quién atiendo» tendría dos
    // respuestas a la vez y sólo una de las dos se vería en pantalla.
    this.paciente.set(null);
    this.candidatos.set([]);
    // Si lo que se buscó era una cédula, ya está escrita.
    const buscado = this.ultimaBusqueda();
    if (esDocumento(buscado) && this.nuevoDocumento() === '') {
      this.nuevoDocumento.set(buscado);
    }
  }

  /** Vuelve a buscar, dejando escrito lo que ya se sabe del documento. */
  protected volverABuscar(): void {
    this.paso.set('buscando');
    this.error.set(null);
  }

  protected guardar(): void {
    if (!this.puedeGuardar()) return;
    this.guardando.set(true);
    this.error.set(null);

    // «Ahora» se toma al guardar y no al abrir: entre que el modal se abre y
    // alguien termina de teclear una cédula pueden pasar dos minutos, y un
    // turno de mostrador que empieza en el pasado es un turno mal fechado.
    const comienza = new Date().toISOString();
    const motivo = this.motivo().trim();

    if (this.paso() === 'buscando') {
      const elegido = this.paciente();
      if (elegido === null) {
        this.guardando.set(false);
        return;
      }
      this.scheduling
        .createDirectAppointment({
          patientProfileId: elegido.value,
          resourceId: this.resourceId(),
          startAt: comienza,
          durationMinutes: this.minutos(),
          ...(motivo === '' ? {} : { reasonText: motivo }),
        })
        .subscribe({
          next: (creada) => {
            this.guardando.set(false);
            this.creado.emit({
              patientProfileId: elegido.value,
              bookingId: creada.bookingId,
              // La cita puntual no abre encuentro: la atención se abre desde la
              // agenda cuando el médico la empieza. Sólo el walk-in lo trae.
              encounterId: null,
              patientCode: null,
              retractedSlots: creada.retractedSlots,
              esAltaNueva: false,
            });
          },
          error: (error: unknown) => this.fallo(error),
        });
      return;
    }

    this.scheduling
      .createWalkInAppointment({
        patient: {
          name: this.nuevoNombre().trim(),
          lastName: this.nuevoApellido().trim(),
          nationalId: this.nuevoDocumento().trim(),
          phone: this.nuevoTelefono().trim(),
        },
        resourceId: this.resourceId(),
        startAt: comienza,
        durationMinutes: this.minutos(),
        ...(motivo === '' ? {} : { reasonText: motivo }),
      })
      .subscribe({
        next: (creado: WalkInAppointmentCreated) => {
          this.guardando.set(false);
          this.creado.emit({
            patientProfileId: creado.patientProfileId,
            bookingId: creado.bookingId,
            encounterId: creado.encounterId,
            patientCode: creado.patientCode,
            retractedSlots: creado.retractedSlots,
            esAltaNueva: true,
          });
        },
        error: (error: unknown) => this.fallo(error),
      });
  }

  /**
   * Muestra el rechazo tal como lo redactó el servidor.
   *
   * El 422 de la regla madre llega con qué, cuándo y dónde, y ese texto ya está
   * escrito para una persona: reescribirlo acá sólo podría empeorarlo o mentir.
   * El único que se trata aparte es el **409 del alta**, y no por el texto sino
   * por la salida: hay que volver a buscar por ese documento, y eso no está en
   * ningún mensaje que el servidor pueda mandar.
   *
   * Se mira el código HTTP y no el `ViewState`: `errorToViewState` convierte
   * `CONFLICT` en `validation`, igual que un 422, así que a esa altura los dos
   * rechazos ya son indistinguibles.
   */
  private fallo(error: unknown): void {
    this.guardando.set(false);

    if (error instanceof HttpErrorResponse && error.status === 409 && this.paso() === 'alta') {
      this.ultimaBusqueda.set(this.nuevoDocumento().trim());
      this.paso.set('buscando');
      this.error.set(
        'Ese documento ya está registrado. Buscalo por su cédula acá arriba y agendale el turno.',
      );
      return;
    }

    this.error.set(mensajeDeError(errorToViewState<never>(error)));
  }
}

/**
 * Saca el texto de un fallo, tal como lo redactó el servidor.
 *
 * `validation` (S4 del M34) **nunca** trae `message` en el nivel de arriba —
 * sólo en cada `issues[].message`—, y es justamente el estado en el que caen el
 * choque de horario y la regla madre. Leer `estado.message` a secas daría
 * `undefined` y el 422 con qué, cuándo y dónde no llegaría a verse nunca. Es el
 * mismo defecto que ya se corrigió en `appointment-new`.
 */
function mensajeDeError(estado: ViewState<never>): string {
  const generico = 'No pudimos registrar el ingreso. Probá de nuevo.';
  if (estado.status === 'validation') {
    return estado.issues[0]?.message ?? generico;
  }
  if ('message' in estado && typeof estado.message === 'string' && estado.message !== '') {
    return estado.message;
  }
  return generico;
}

/** Lo tecleado se lee como documento si son sólo dígitos y alcanzan. */
function esDocumento(texto: string): boolean {
  return new RegExp(`^\\d{${DIGITOS_DE_CEDULA},}$`).test(texto);
}
