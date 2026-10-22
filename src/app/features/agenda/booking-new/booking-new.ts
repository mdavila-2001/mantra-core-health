import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { PatientContextService } from '../../../core/patient-context/patient-context.service';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResourceSite,
  AgendaSlot,
  ServiceOffering,
  SlotHold,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { MIS_TURNOS_ROUTE } from '../../account/appointments/appointments.routes';
import {
  SymptomObservationsStore,
  comoMotivoDeConsulta,
} from '../../../core/symptom-notes/symptom-observations.store';
import { AGENDA_ROUTE } from '../agenda.routes';

/** Largo que declara `ConfirmBookingDto` para el motivo. */
const MAX_MOTIVO = 500;

/** Cuántos candidatos trae cada búsqueda del combobox de paciente. */
const CANDIDATOS_POR_BUSQUEDA = 10;

/**
 * Cuánto se ensancha, por lado, la ventana con que se relee la disponibilidad de un
 * servicio. El motor sólo ofrece un inicio si cabe **con su preparación y su limpieza**
 * dentro de la ventana pedida: con la ventana justa del turno (inicio → fin máximo) un
 * servicio con colchones nunca cabe y el horario se daría por perdido sin estarlo.
 * Preparación y limpieza son de minutos; dos horas sobran.
 */
const MARGEN_DE_RELECTURA_MS = 2 * 60 * 60 * 1000;

/**
 * Por dónde entró quien está reservando. Coincide con el `channel` que declara
 * `ConfirmBookingDto`, que es el dato que el backend guarda en la cita.
 *
 * - `DESK`: el mostrador reserva para otra persona y la elige de un buscador.
 * - `PORTAL`: el paciente reserva para sí mismo y no elige a nadie.
 *
 * Es lo ÚNICO que distingue a las dos entradas: la revalidación del cupo, el
 * ciclo retener → confirmar y el manejo del vencimiento son los mismos, y
 * duplicarlos sería mantener dos veces la misma lógica de concurrencia.
 */
type Entrada = 'DESK' | 'PORTAL';

/**
 * Reserva de un turno — el eslabón V41-09 → V41-05 del recorrido de demo
 * (`POST /scheduling/slots/:id/holds` → `POST /scheduling/holds/:token/confirm`).
 *
 * ## Una pantalla, dos entradas
 *
 * La usan el mostrador y el propio paciente. La ruta declara cuál es la entrada
 * (`data.entrada`) y de ahí sale todo lo que difiere: el `channel` que se
 * guarda en la cita, si hay que elegir paciente o ya se sabe quién es, y a
 * dónde se vuelve al terminar.
 *
 * Son dos pantallas distintas para quien las mira y una sola para quien la
 * mantiene. Duplicarla habría duplicado lo delicado —la revalidación del cupo y
 * el vencimiento de la retención—, que es justo lo que no conviene tener por
 * duplicado.
 *
 * ## Dos pasos porque el backend los exige, y se muestran como dos pasos
 *
 * Retener descuenta el cupo con anti-double-booking y vence solo (TTL de la
 * política, 300 s por defecto). La pantalla dice hasta cuándo vale la
 * retención, y si el confirm llega tarde **no lo trata como error terminal**:
 * la retención vencida vuelve al paso de retener, que es lo que de verdad hay
 * que repetir.
 *
 * ## El cupo se reencuentra, no se confía
 *
 * No existe `GET /scheduling/slots/:id`; la franja viaja por query string y la
 * pantalla vuelve a leer `GET /scheduling/slots` acotado a ella. Eso revalida
 * la disponibilidad al entrar —incluso tras recargar— en vez de pintar datos
 * que la fila de origen trajo hace quién sabe cuánto.
 */
@Component({
  selector: 'app-booking-new',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    AppButtonLink,
    DatePipe,
    FormActions,
    FormField,
    FormSection,
    PageHeader,
    ReactiveFormsModule,
    ReferenceCombobox,
    RouterLink,
    Textarea,
  ],
  templateUrl: './booking-new.html',
  styleUrl: './booking-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingNew {
  private readonly scheduling = inject(SchedulingClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);
  private readonly contexto = inject(PatientContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly observaciones = inject(SymptomObservationsStore);

  /* ---- por dónde entró quien reserva ------------------------------------- */

  private motivoInicial(): string {
    const porUrl = this.route.snapshot.queryParamMap.get('motivo');
    if (porUrl !== null) {
      return porUrl.slice(0, MAX_MOTIVO);
    }
    const pendiente = this.route.snapshot.data['entrada'] === 'PORTAL' ? this.observaciones.pendiente() : null;
    return pendiente === null ? '' : comoMotivoDeConsulta(pendiente);
  }

  private readonly entrada: Entrada =
    this.route.snapshot.data['entrada'] === 'PORTAL' ? 'PORTAL' : 'DESK';

  /** El paciente reserva para sí mismo: no hay a quién elegir. */
  protected readonly esAutoservicio = this.entrada === 'PORTAL';

  /** Adónde se vuelve: a la agenda de la organización o a los turnos propios. */
  protected readonly rutaDeVuelta = this.esAutoservicio ? MIS_TURNOS_ROUTE : AGENDA_ROUTE;

  /**
   * Qué se espera en el campo de motivo, dicho para quien lo va a llenar.
   *
   * Antes decía «Opcional. Acompaña a la cita», que no explicaba ni para qué
   * sirve ni quién lo lee. Cambia según quién reserva porque no es lo mismo
   * contar lo que a uno le pasa que anotar lo que dijo el paciente por teléfono.
   */
  protected readonly ayudaDelMotivo = this.esAutoservicio
    ? 'Cuéntele al profesional qué le pasa o qué quiere consultar. Es opcional, y lo lee antes de atenderle.'
    : 'Lo que cuenta el paciente sobre su consulta. Es opcional, y el profesional lo lee antes de atenderlo.';

  /**
   * La cuenta no tiene perfil de paciente y entró por el portal.
   *
   * Pasa con el personal de salud y con administración: son cuentas reales, con
   * sesión válida, que simplemente no son de un paciente. Decirlo es más útil
   * que dejar el formulario servido para que el `confirm` lo rechace después.
   */
  protected readonly sinPerfilDePaciente =
    this.esAutoservicio && this.auth.patientProfileId() === null;

  /** El último escalón se reemplaza: desde la reserva se vuelve de dónde vino. */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: this.rutaDeVuelta },
      { label: 'Reservar' },
    ];
  });

  /* ---- lo que la URL trae ------------------------------------------------ */

  private readonly slotId = this.route.snapshot.paramMap.get('slotId') ?? '';
  private readonly resourceId = this.route.snapshot.queryParamMap.get('recurso');

  /**
   * La oferta de servicio que se está reservando (v4.2.40), o `null` si es una
   * consulta.
   *
   * Un servicio no tiene un cupo en la grilla que reencontrar: sus horarios se
   * **calculan** al leer y el cupo nace al retener. Por eso, con `oferta` en la
   * URL, esta pantalla relee la disponibilidad calculada en vez de la lista de
   * cupos, y retiene con el endpoint del servicio. Todo lo demás —el vencimiento,
   * el confirmar, el solicitar— es el mismo ciclo que una consulta.
   */
  private readonly ofertaId = this.route.snapshot.queryParamMap.get('oferta');

  /** Se reserva un servicio y no una consulta. */
  protected readonly esServicio = this.ofertaId !== null;

  /**
   * Lo que el catálogo y el profesional dicen del servicio: nombre, precio y
   * cuánto dura. `null` mientras se pide y para una consulta; su ausencia no
   * impide reservar, sólo deja el resumen sin ese renglón.
   */
  protected readonly servicio = signal<ServiceOffering | null>(null);

  /**
   * El precio de referencia con la moneda del producto. La API sirve el concepto de
   * moneda y no su código, y el helper asume el boliviano cuando no hay código: es
   * la moneda del producto y la única que declara hoy el catálogo.
   */
  protected readonly precio = computed(() => {
    const s = this.servicio();
    return s === null ? '' : withDisplayCurrency(s.price);
  });

  /** «30–45 min», o «20 min» cuando el mínimo y el máximo coinciden. */
  protected readonly duracion = computed(() => {
    const s = this.servicio();
    if (s === null) return '';
    return s.minDurationMinutes === s.maxDurationMinutes
      ? `${s.maxDurationMinutes} min`
      : `${s.minDurationMinutes}–${s.maxDurationMinutes} min`;
  });
  private readonly desde = instante(this.route.snapshot.queryParamMap.get('desde'));
  private readonly hasta = instante(this.route.snapshot.queryParamMap.get('hasta'));

  /** Sin franja no hay cómo reencontrar el cupo: se entra desde la agenda. */
  protected readonly sinContexto =
    this.slotId === '' || this.resourceId === null || this.desde === null || this.hasta === null;

  protected readonly rutaDeAgenda = AGENDA_ROUTE;
  protected readonly rutaDeMisTurnos = MIS_TURNOS_ROUTE;

  /* ---- el cupo, revalidado al entrar ------------------------------------- */

  /**
   * El cupo, revalidado contra la agenda. `empty` es su estado honesto cuando
   * ya no está o ya no tiene lugar: no es un fallo de red, es que alguien más
   * lo tomó primero.
   */
  protected readonly cupo = signal<ViewState<AgendaSlot>>(loading());

  /** El cupo cuando ya se puede ofrecer; `null` en cualquier otro estado. */
  protected readonly cupoListo = computed<AgendaSlot | null>(() => {
    const estado = this.cupo();
    return estado.status === 'ready' ? estado.data : null;
  });

  /** El mensaje del vacío, que la plantilla no puede sacar del estado tipada. */
  protected readonly mensajeDeVacio = computed(() => {
    const estado = this.cupo();
    return estado.status === 'empty' ? (estado.message ?? '') : '';
  });

  /* ---- dónde se atiende --------------------------------------------------- */

  /**
   * La sede del recurso, para decir **dónde** es el turno.
   *
   * Un turno sin dirección obliga a averiguarla por fuera del sistema, y quien
   * reserva por el portal no tiene a quién preguntarle. Se lee del recurso, que
   * ya la trae resuelta.
   *
   * `null` mientras se pide y también cuando el recurso no tiene sede vigente:
   * la reserva no depende de esto y el resumen simplemente no muestra el
   * renglón. Atarla al ciclo de reserva sería impedir reservar porque no se
   * pudo averiguar una dirección.
   */
  protected readonly sede = signal<AgendaResourceSite | null>(null);

  /**
   * Con quién es el turno, para poder confirmarlo sabiéndolo.
   *
   * Antes el resumen decía cuándo y dónde, pero no a quién: se confirmaba «a
   * ciegas» respecto de lo único que la persona eligió a mano. Sale del mismo
   * recurso del que ya se lee la sede, así que no cuesta una consulta más.
   *
   * Se prefiere `practitionerName` sobre `name` porque el segundo es el rótulo
   * de la agenda («Agenda Dra. Ríos») y el primero la persona. Vacío mientras
   * se pide o si el recurso no es de un profesional —un box, un equipo—, y en
   * ese caso el renglón no se dibuja.
   *
   * **Pendiente:** la especialidad, que Melissa también pidió (F-07), no viene
   * en el recurso; hoy no hay de dónde leerla sin otra llamada.
   */
  protected readonly profesional = signal<string>('');

  /** La ubicación en una línea, tal como se muestra en el resumen. */
  protected readonly ubicacion = computed(() => {
    const sede = this.sede();
    if (sede === null) {
      return '';
    }
    return sede.addressText === null ? sede.name : `${sede.name} · ${sede.addressText}`;
  });

  /* ---- el formulario ------------------------------------------------------ */

  protected readonly paciente = signal<ReferenceOption | null>(null);
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);

  /**
   * El motivo, que puede llegar escrito por query string (`motivo`): desde
   * Cotizaciones, el estudio que se eligió. Queda editable.
   */
  protected readonly motivo = new FormControl(this.motivoInicial(), { nonNullable: true });

  /**
   * La observación de síntomas que el paciente guardó en «¿A qué especialista consultar?» y todavía
   * no envió (propietario, 2026-10-08). Sólo cuando reserva para sí mismo y no llegó un motivo por
   * la URL; queda editable, y al solicitar el turno se marca como enviada.
   */
  protected readonly observacionPrecargada =
    this.esAutoservicio && !this.route.snapshot.queryParamMap.has('motivo') ? this.observaciones.pendiente() : null;

  /**
   * El formulario que envuelve al motivo. Un solo control, pero declarado como
   * grupo **a propósito**.
   *
   * Sin `[formGroup]` en el `<form>`, Angular no aplica ninguna directiva de
   * formulario, y entonces `(ngSubmit)` **no es una salida de nada**: el
   * navegador hace su envío nativo, la página recarga y la query string se
   * pierde. Acá eso no era cosmético — `recurso`, `desde` y `hasta` viajan por
   * query string y son lo único que permite reencontrar el cupo, así que tras
   * el recargo la pantalla mostraba «Elegí primero un horario» mientras el
   * `POST .../holds` ya había salido: el cupo quedaba retenido en el servidor
   * durante los 5 minutos del TTL y quien reservaba no se enteraba.
   *
   * Lo encontró el recorrido en navegador; las pruebas unitarias llaman a
   * `retener()` directamente y nunca pasan por el envío del formulario.
   */
  protected readonly formulario = new FormGroup({ motivo: this.motivo });
  protected readonly maxMotivo = MAX_MOTIVO;

  private readonly enviado = signal(false);
  protected readonly pacienteFaltante = computed(() => this.enviado() && this.paciente() === null);

  /* ---- la retención vigente ---------------------------------------------- */

  protected readonly retencion = signal<SlotHold | null>(null);

  /** El confirm llegó tarde: la retención venció y hay que volver a retener. */
  protected readonly retencionVencida = signal(false);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Su rol no puede reservar turnos.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revise su conexión y reintente.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    // Por el portal el paciente ya está decidido: es quien tiene la sesión. Se
    // fija acá y no en la plantilla para que el resto del ciclo —retener,
    // confirmar, el aviso de la retención— no tenga que saber por dónde entró.
    if (this.esAutoservicio) {
      // El paciente activo y no el del token (B.1): quien entró a pedirle turno
      // a su hijo lo eligió antes en la cabecera, y tomar el del token le
      // reservaría a ella misma sin decírselo.
      const perfil = this.contexto.activePatientProfileId();
      if (perfil !== null) {
        this.paciente.set({
          value: perfil,
          label: this.contexto.activePatientName() ?? 'Usted',
        });
      }
    }
    this.cargarCupo();
    this.cargarSede();
  }

  /**
   * Pide el recurso del cupo: de ahí salen **con quién** y **dónde** es el turno.
   *
   * Va por su lado y su fallo no se muestra: son contexto del turno, no una
   * precondición para reservarlo. Perder la reserva porque no se pudo leer
   * dónde queda el consultorio sería cambiar una comodidad por una
   * funcionalidad.
   */
  private cargarSede(): void {
    const tenantId = this.auth.activeTenantId();
    if (tenantId === null || this.resourceId === null) {
      return;
    }
    this.scheduling.listResources({ tenantId }).subscribe({
      next: (pagina) => {
        const recurso = pagina.items.find((item) => item.id === this.resourceId);
        this.sede.set(recurso?.site ?? null);
        this.profesional.set(recurso?.practitionerName ?? '');
        if (this.esServicio && recurso?.resourceRefId !== undefined) {
          this.cargarServicio(recurso.resourceRefId);
        }
      },
      error: () => {
        this.sede.set(null);
        this.profesional.set('');
      },
    });
  }

  /* ---- lecturas ----------------------------------------------------------- */

  /**
   * Reencuentra el cupo leyendo la franja que la URL trae. Que venga en la
   * respuesta y con lugar es la única prueba de que todavía se puede ofrecer.
   */
  protected cargarCupo(): void {
    if (
      this.sinContexto ||
      this.resourceId === null ||
      this.desde === null ||
      this.hasta === null
    ) {
      return;
    }

    this.cupo.set(loading());

    if (this.ofertaId !== null) {
      this.cargarHorarioDeServicio(this.ofertaId, this.resourceId, this.desde, this.hasta);
      return;
    }

    this.scheduling
      .listSlots({ resourceId: this.resourceId, from: this.desde, to: this.hasta })
      .subscribe({
        next: (pagina) => {
          const cupo = pagina.items.find((slot) => slot.id === this.slotId);
          if (cupo === undefined || cupo.remainingCapacity <= 0) {
            this.cupo.set(
              empty(
                this.esAutoservicio
                  ? { label: 'Elegir otro horario', route: MIS_TURNOS_ROUTE }
                  : { label: 'Volver a la agenda', route: AGENDA_ROUTE },
                this.esAutoservicio
                  ? 'Ese horario ya no está disponible: alguien lo tomó primero. Elija otro de la lista.'
                  : 'Ese cupo ya no está disponible: alguien lo tomó primero o se bloqueó. Elija otro desde la agenda.',
              ),
            );
            return;
          }
          this.cupo.set(ready(cupo));
        },
        error: (error: unknown) => this.cupo.set(errorToViewState<AgendaSlot>(error)),
      });
  }

  protected buscarPaciente(texto: string): void {
    if (texto === '') {
      this.candidatos.set([]);
      return;
    }

    this.buscando.set(true);
    this.profiles.searchPatients({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        this.candidatos.set(
          pagina.items.map((paciente) => ({
            value: paciente.profileId,
            label: paciente.displayName ?? `Sin nombre · ${paciente.patientCode}`,
            hint: paciente.patientCode,
          })),
        );
        this.buscando.set(false);
      },
      error: () => {
        this.candidatos.set([]);
        this.buscando.set(false);
      },
    });
  }

  /* ---- el ciclo hold → confirm -------------------------------------------- */

  protected retener(): void {
    if (this.enviando()) {
      return;
    }

    this.enviado.set(true);
    const paciente = this.paciente();
    if (paciente === null) {
      return;
    }

    this.retencionVencida.set(false);
    this.state.set(loading());

    if (this.ofertaId !== null && this.resourceId !== null && this.desde !== null) {
      this.retenerServicio(this.ofertaId, this.resourceId, this.desde, paciente.value);
      return;
    }

    this.scheduling.placeHold(this.slotId, { patientProfileId: paciente.value }).subscribe({
      next: (retencion) => {
        this.state.set(ready(null));
        this.retencion.set(retencion);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Retiene el turno de un servicio: crea su cupo con la duración máxima.
   *
   * Un 409 dice que el horario ya no cabe —otro paciente lo tomó entre la
   * lectura y ahora—. Se muestra el mensaje y se relee la disponibilidad: el
   * paso a repetir es elegir otro, no insistir con el mismo.
   */
  private retenerServicio(
    ofertaId: string,
    resourceId: string,
    inicio: Date,
    pacienteId: string,
  ): void {
    this.scheduling
      .placeServiceHold(ofertaId, { resourceId, startAt: inicio, patientProfileId: pacienteId })
      .subscribe({
        next: (retencion) => {
          this.state.set(ready(null));
          this.retencion.set({
            id: retencion.id,
            holdToken: retencion.holdToken,
            expiresAt: retencion.expiresAt,
            // El cupo del servicio es de un solo lugar y nace ya tomado.
            remainingCapacity: 0,
          });
        },
        error: (error: unknown) => {
          this.state.set(errorToViewState<null>(error));
          this.cargarCupo();
        },
      });
  }

  /**
   * Reencuentra el horario de un servicio en la disponibilidad calculada.
   *
   * Que venga en la respuesta es la única prueba de que todavía cabe: no hay un
   * cupo que revalidar porque el cupo todavía no existe. Se sintetiza uno con la
   * forma de {@link AgendaSlot} para que el resumen sea el mismo que el de una
   * consulta.
   */
  private cargarHorarioDeServicio(
    ofertaId: string,
    resourceId: string,
    desde: Date,
    hasta: Date,
  ): void {
    this.scheduling
      .getServiceAvailability({
        offeringId: ofertaId,
        resourceId,
        from: new Date(desde.getTime() - MARGEN_DE_RELECTURA_MS),
        to: new Date(hasta.getTime() + MARGEN_DE_RELECTURA_MS),
      })
      .subscribe({
        next: (disponibilidad) => {
          const horario = disponibilidad.items.find(
            (item) => item.startAt.getTime() === desde.getTime(),
          );
          if (horario === undefined) {
            this.cupo.set(
              empty(
                this.esAutoservicio
                  ? { label: 'Elegir otro horario', route: MIS_TURNOS_ROUTE }
                  : { label: 'Volver a la agenda', route: AGENDA_ROUTE },
                'Ese horario ya no está disponible: otra cita lo ocupó. Elija otro de la lista.',
              ),
            );
            return;
          }
          this.cupo.set(
            ready({
              id: this.slotId,
              resourceId,
              scheduleTemplateId: null,
              startAt: horario.startAt,
              endAt: horario.endAtMax,
              capacity: 1,
              remainingCapacity: 1,
              statusConceptId: '',
              serviceConceptId: null,
            }),
          );
        },
        error: (error: unknown) => this.cupo.set(errorToViewState<AgendaSlot>(error)),
      });
  }

  /** El nombre, el precio y la duración del servicio, de las ofertas del profesional. */
  private cargarServicio(practitionerProfileId: string): void {
    this.scheduling.listServiceOfferings(practitionerProfileId).subscribe({
      next: (lista) => this.servicio.set(lista.find((o) => o.id === this.ofertaId) ?? null),
      // Es contexto: perder la reserva por no poder leer el precio sería cambiar
      // una comodidad por una funcionalidad.
      error: () => this.servicio.set(null),
    });
  }

  protected confirmar(): void {
    const retencion = this.retencion();
    const paciente = this.paciente();
    const tenantId = this.auth.activeTenantId();
    if (this.enviando() || retencion === null || paciente === null || tenantId === null) {
      return;
    }

    this.state.set(loading());

    const motivo = this.motivo.value.trim();
    const cuerpo = {
      tenantId,
      patientProfileId: paciente.value,
      channel: this.entrada,
      ...(motivo === '' ? {} : { reasonText: motivo }),
    };

    // **El paciente solicita; el mostrador confirma** (corrección #11). Son dos
    // endpoints y no una bandera: quien pide desde el portal no puede
    // comprometer la agenda de nadie, así que su turno nace pendiente de que el
    // profesional lo acepte. El mostrador sí compromete, porque para eso está.
    const peticion = this.esAutoservicio
      ? this.scheduling.requestHold(retencion.holdToken, cuerpo)
      : this.scheduling.confirmHold(retencion.holdToken, cuerpo);

    peticion.subscribe({
      next: () => {
        this.state.set(ready(null));
        this.toast.success(
          this.esAutoservicio
            ? 'Enviamos su solicitud. El profesional la confirma o le propone otro horario.'
            : `La cita de ${paciente.label} quedó confirmada.`,
          this.esAutoservicio ? 'Cita solicitada' : 'Reserva confirmada',
        );
        if (this.esAutoservicio) {
          const precargada = this.observacionPrecargada;
          if (precargada !== null && motivo !== '') {
            this.observaciones.marcarUsada(precargada.id);
          }
          void this.router.navigateByUrl(MIS_TURNOS_ROUTE);
          return;
        }
        void this.router.navigate([AGENDA_ROUTE], {
          queryParams: this.resourceId === null ? {} : { recurso: this.resourceId },
        });
      },
      error: (error: unknown) => {
        const estado = errorToViewState<null>(error);
        // Un rechazo de validación o un «no existe» sobre el token es la
        // retención vencida o consumida: el paso a repetir es retener, no
        // insistir con un confirm que ya no puede salir bien.
        if (estado.status === 'validation' || estado.status === 'not-found') {
          this.retencion.set(null);
          this.retencionVencida.set(true);
          this.state.set(ready(null));
          this.cargarCupo();
          return;
        }
        this.state.set(estado);
      },
    });
  }

  /** Suelta la retención del lado de la pantalla; el TTL la devuelve al cupo. */
  protected volverAElegir(): void {
    this.retencion.set(null);
  }

  protected cancelar(): void {
    void this.router.navigateByUrl(this.rutaDeVuelta);
  }
}

/** Un instante de la query string, o `null` si falta o no es una fecha. */
function instante(valor: string | null): Date | null {
  if (valor === null) {
    return null;
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
