import { computed, signal, type Signal } from '@angular/core';

import type { SchedulingClient } from '../../../../core/data-access/scheduling/scheduling.client';
import { describeApiFailure } from '../../../../core/http/api-failure';
import type {
  OrganizationChoice,
  PractitionerOrganization,
} from '../../../../shared/components/molecules/organization-select/organization-select.types';
import { agendaResourceMy } from '../../my-resource';

/** Una organización afiliada: la que trae dónde buscar la agenda. */
type AffiliatedOrganization = PractitionerOrganization & { readonly tenantId: string };

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
  | { readonly status: 'found'; readonly resourceId: string }
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
 * Mientras se busca, o si no hay ninguna, {@link resourceId} es `null` y no se
 * guarda: no hay agenda donde poner la cita.
 *
 * ## La respuesta que llega tarde se descarta
 *
 * Si el médico cambia de organización antes de que vuelva la búsqueda, la
 * respuesta de la anterior ya no manda: guardaría la cita en una agenda que no
 * es la que está elegida.
 */
export class BookingDestination {
  private readonly state = signal<BookingDestinationState>({ status: 'own' });

  /** La organización afiliada elegida, o `null` en «Mi consultorio». */
  private chosen: AffiliatedOrganization | null = null;

  /** El recurso donde se guarda, o `null` mientras no haya uno. */
  readonly resourceId: Signal<string | null>;

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
   */
  constructor(
    private readonly scheduling: SchedulingClient,
    private readonly practitionerProfileId: Signal<string | null>,
    ownResourceId: Signal<string>,
  ) {
    this.resourceId = computed(() => {
      const state = this.state();
      if (state.status === 'own') return ownResourceId();
      return state.status === 'found' ? state.resourceId : null;
    });
  }

  /** El médico eligió dónde agendar. */
  choose(choice: OrganizationChoice): void {
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
    const profileId = this.practitionerProfileId();
    if (profileId === null) {
      this.state.set({ status: 'missing', organizationName: organization.name });
      return;
    }
    this.state.set({ status: 'searching', organizationName: organization.name });
    agendaResourceMy(this.scheduling, organization.tenantId, profileId).subscribe({
      next: (resource) => {
        if (this.chosen !== organization) return;
        this.state.set(
          resource === null
            ? { status: 'missing', organizationName: organization.name }
            : { status: 'found', resourceId: resource.id },
        );
      },
      error: (error: unknown) => {
        if (this.chosen !== organization) return;
        this.state.set({
          status: 'failed',
          message: describeApiFailure(
            error,
            `No pudimos consultar su agenda en ${organization.name}.`,
          ),
        });
      },
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
