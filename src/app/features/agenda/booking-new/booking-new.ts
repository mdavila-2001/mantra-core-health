import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaSlot,
  SlotHold,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
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
import { AGENDA_ROUTE } from '../agenda.routes';

/** Largo que declara `ConfirmBookingDto` para el motivo. */
const MAX_MOTIVO = 500;

/** Cuántos candidatos trae cada búsqueda del combobox de paciente. */
const CANDIDATOS_POR_BUSQUEDA = 10;

/**
 * Canal fijo de esta pantalla: la usa quien agenda en el mostrador
 * (`SCHEDULING_AGENT`/`SCHEDULING_ADMIN`). La entrada del paciente (canal
 * `PORTAL`, M1 del plan de demo) reusa esta misma pantalla con el paciente
 * resuelto por la sesión — pendiente de coordinar, no de rehacer.
 */
const CANAL = 'DESK' as const;

/**
 * Reserva de un turno — el eslabón V41-09 → V41-05 del recorrido de demo
 * (`POST /scheduling/slots/:id/holds` → `POST /scheduling/holds/:token/confirm`).
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** El último escalón se reemplaza: desde la reserva se vuelve a la agenda. */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: AGENDA_ROUTE },
      { label: 'Reservar' },
    ];
  });

  /* ---- lo que la URL trae ------------------------------------------------ */

  private readonly slotId = this.route.snapshot.paramMap.get('slotId') ?? '';
  private readonly resourceId = this.route.snapshot.queryParamMap.get('recurso');
  private readonly desde = instante(this.route.snapshot.queryParamMap.get('desde'));
  private readonly hasta = instante(this.route.snapshot.queryParamMap.get('hasta'));

  /** Sin franja no hay cómo reencontrar el cupo: se entra desde la agenda. */
  protected readonly sinContexto =
    this.slotId === '' ||
    this.resourceId === null ||
    this.desde === null ||
    this.hasta === null;

  protected readonly rutaDeAgenda = AGENDA_ROUTE;

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

  /* ---- el formulario ------------------------------------------------------ */

  protected readonly paciente = signal<ReferenceOption | null>(null);
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);

  protected readonly motivo = new FormControl('', { nonNullable: true });
  protected readonly maxMotivo = MAX_MOTIVO;

  private readonly enviado = signal(false);
  protected readonly pacienteFaltante = computed(
    () => this.enviado() && this.paciente() === null,
  );

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
      return state.message ?? 'Tu rol no puede reservar turnos.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    this.cargarCupo();
  }

  /* ---- lecturas ----------------------------------------------------------- */

  /**
   * Reencuentra el cupo leyendo la franja que la URL trae. Que venga en la
   * respuesta y con lugar es la única prueba de que todavía se puede ofrecer.
   */
  protected cargarCupo(): void {
    if (this.sinContexto || this.resourceId === null || this.desde === null || this.hasta === null) {
      return;
    }

    this.cupo.set(loading());

    this.scheduling
      .listSlots({ resourceId: this.resourceId, from: this.desde, to: this.hasta })
      .subscribe({
        next: (pagina) => {
          const cupo = pagina.items.find((slot) => slot.id === this.slotId);
          if (cupo === undefined || cupo.remainingCapacity <= 0) {
            this.cupo.set(
              empty(
                { label: 'Volver a la agenda', route: AGENDA_ROUTE },
                'Ese cupo ya no está disponible: alguien lo tomó primero o se bloqueó. Elegí otro desde la agenda.',
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

    this.scheduling.placeHold(this.slotId, { patientProfileId: paciente.value }).subscribe({
      next: (retencion) => {
        this.state.set(ready(null));
        this.retencion.set(retencion);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
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
    this.scheduling
      .confirmHold(retencion.holdToken, {
        tenantId,
        patientProfileId: paciente.value,
        channel: CANAL,
        ...(motivo === '' ? {} : { reasonText: motivo }),
      })
      .subscribe({
        next: () => {
          this.state.set(ready(null));
          this.toast.success(
            `El turno de ${paciente.label} quedó confirmado.`,
            'Reserva confirmada',
          );
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
    void this.router.navigateByUrl(AGENDA_ROUTE);
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
