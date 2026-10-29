import { computed, signal, type DestroyRef, type Signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import type { SchedulingClient } from '../../../../core/data-access/scheduling/scheduling.client';
import type { TenantScope } from '../../../../core/data-access/scheduling/tenant-scope';
import { describeApiFailure } from '../../../../core/http/api-failure';
import type {
  OrganizationChoice,
  PractitionerOrganization,
} from '../../../../shared/components/molecules/organization-select/organization-select.types';
import { agendaResourceMy } from '../../my-resource';

/** Una organización afiliada: la que trae dónde buscar la agenda. */
type AffiliatedOrganization = PractitionerOrganization & { readonly tenantId: string };

/**
 * Dónde queda lo que se guarda: la agenda, y como qué organización se le habla
 * a la API para guardar ahí (`{}` es la organización activa de la sesión).
 */
export interface BookingTarget {
  readonly resourceId: string;
  readonly scope: TenantScope;
}

/**
 * Lo que se sabe de la agenda donde se guardaría, según la organización elegida.
 *
 * - `own` — «Mi consultorio»: la agenda es la que ya muestra «Mi agenda».
 * - `searching` — se está buscando la agenda del médico en la organización.
 * - `found` — tiene agenda ahí.
 * - `missing` — no publicó ninguna ahí.
 * - `failed` — no se pudo saber.
 */
type BookingDestinationState =
  | { readonly status: 'own' }
  | { readonly status: 'searching'; readonly organizationName: string }
  | { readonly status: 'found'; readonly resourceId: string; readonly tenantId: string }
  | { readonly status: 'missing'; readonly organizationName: string }
  | { readonly status: 'failed'; readonly message: string };

/**
 * **En qué agenda queda** lo que se guarda desde el modal del día.
 *
 * «Mi consultorio» usa la agenda que llega del contenedor, como siempre. Otra
 * organización usa la agenda del médico **en esa organización**, que se busca
 * con el mismo criterio que «Publicar agenda» (`agendaResourceMy`): el recurso
 * cuyo `resourceRefId` es su perfil profesional. Si tiene más de una, la
 * primera, como en esa pantalla.
 *
 * Mientras se busca, o si no hay ninguna, {@link target} es `null` y no se
 * guarda: no hay agenda donde poner la cita.
 *
 * ## Se le habla a la API como esa organización
 *
 * La API solo lista y solo agenda en la organización con que se le habla
 * (`X-Tenant-Id`). Por eso la búsqueda y el guardado en otra organización
 * declaran la suya ({@link BookingTarget.scope}); en «Mi consultorio» no se
 * declara nada y va la de la sesión.
 *
 * ## La búsqueda anterior se corta
 *
 * Si el médico cambia de organización antes de que vuelva la búsqueda, o se
 * cierra el modal, la búsqueda en curso se cancela: su respuesta guardaría la
 * cita en una agenda que ya no es la elegida.
 */
export class BookingDestination {
  private readonly state = signal<BookingDestinationState>({ status: 'own' });

  /** La organización afiliada elegida, o `null` en «Mi consultorio». */
  private chosen: AffiliatedOrganization | null = null;

  /** La búsqueda de la agenda en curso, para cortarla. */
  private request: Subscription | null = null;

  /** Dónde se guarda, o `null` mientras no haya una agenda. */
  readonly target: Signal<BookingTarget | null>;

  /** La organización donde se está buscando la agenda, mientras se busca. */
  readonly searchingIn = computed(() => {
    const state = this.state();
    return state.status === 'searching' ? state.organizationName : null;
  });

  /** La organización donde el médico no tiene agenda, si es la elegida. */
  readonly missingIn = computed(() => {
    const state = this.state();
    return state.status === 'missing' ? state.organizationName : null;
  });

  /** Por qué no se pudo buscar la agenda, con el código de soporte si llegó. */
  readonly failure = computed(() => {
    const state = this.state();
    return state.status === 'failed' ? state.message : null;
  });

  /**
   * @param scheduling - El cliente con que se listan las agendas de una organización.
   * @param practitionerProfileId - El perfil profesional de la sesión.
   * @param ownResourceId - La agenda de «Mi consultorio», la que pasa el contenedor.
   * @param destroyRef - El ciclo de vida de quien la usa: al destruirse, se corta la búsqueda.
   */
  constructor(
    private readonly scheduling: SchedulingClient,
    private readonly practitionerProfileId: Signal<string | null>,
    ownResourceId: Signal<string>,
    destroyRef: DestroyRef,
  ) {
    this.target = computed(() => {
      const state = this.state();
      if (state.status === 'own') return { resourceId: ownResourceId(), scope: {} };
      return state.status === 'found'
        ? { resourceId: state.resourceId, scope: { tenantId: state.tenantId } }
        : null;
    });
    destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  /** El médico eligió dónde agendar. */
  choose(choice: OrganizationChoice): void {
    this.request?.unsubscribe();
    this.chosen = affiliatedOf(choice);
    if (this.chosen === null) {
      this.state.set({ status: 'own' });
      return;
    }
    this.search(this.chosen);
  }

  /** Vuelve a buscar la agenda en la organización elegida, después de un fallo. */
  retry(): void {
    if (this.chosen !== null) this.search(this.chosen);
  }

  private search(organization: AffiliatedOrganization): void {
    this.request?.unsubscribe();
    const profileId = this.practitionerProfileId();
    if (profileId === null) {
      this.state.set({ status: 'missing', organizationName: organization.name });
      return;
    }
    this.state.set({ status: 'searching', organizationName: organization.name });
    const scope = { tenantId: organization.tenantId };
    this.request = agendaResourceMy(
      this.scheduling,
      organization.tenantId,
      profileId,
      scope,
    ).subscribe({
      next: (resource) =>
        this.state.set(
          resource === null
            ? { status: 'missing', organizationName: organization.name }
            : { status: 'found', resourceId: resource.id, tenantId: organization.tenantId },
        ),
      error: (error: unknown) =>
        this.state.set({
          status: 'failed',
          message: describeApiFailure(
            error,
            `No pudimos consultar su agenda en ${organization.name}.`,
          ),
        }),
    });
  }
}

/**
 * La organización afiliada de lo elegido, o `null` si es «Mi consultorio».
 *
 * El selector solo ofrece organizaciones con `tenantId`; la que no lo trae es
 * el consultorio propio, que agenda donde agendó siempre.
 */
function affiliatedOf(choice: OrganizationChoice): AffiliatedOrganization | null {
  const organization = choice.organization;
  if (organization === null || organization.isOwnOffice || organization.tenantId === null) {
    return null;
  }
  return { ...organization, tenantId: organization.tenantId };
}
