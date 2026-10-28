import { computed, effect, signal, untracked, type EffectRef, type Signal } from '@angular/core';

import type { OrganizationChoice } from '../../../shared/components/molecules/organization-select/organization-select.types';

/** Dónde se crea el recurso de agenda: la organización y, si se eligió una, su práctica. */
export interface PublicationTarget {
  readonly tenantId: string;
  /**
   * La práctica de la organización elegida. Ausente en «Mi consultorio»: ahí el
   * recurso lleva la práctica del formulario, como siempre.
   */
  readonly practiceId?: string;
}

/**
 * La organización donde se publica la agenda.
 *
 * - **Una organización afiliada** manda la suya: su `tenantId` y su práctica.
 *   El selector solo ofrece las que traen `tenantId`.
 * - **«Mi consultorio»**, o nada elegido todavía, publica en la organización
 *   activa de la sesión: exactamente lo que la pantalla hacía antes del
 *   selector.
 *
 * `null` cuando no hay ninguna de las dos: sin organización no hay dónde
 * publicar, y la pantalla ya lo avisa.
 *
 * @param choice - Lo elegido en el selector, o `null` si no corresponde elegir.
 * @param sessionTenantId - La organización activa de la sesión.
 */
export function publicationTargetOf(
  choice: OrganizationChoice | null,
  sessionTenantId: string | null,
): PublicationTarget | null {
  const organization = choice?.organization ?? null;
  if (organization !== null && organization.tenantId !== null) {
    return { tenantId: organization.tenantId, practiceId: organization.practiceId };
  }
  return sessionTenantId === null ? null : { tenantId: sessionTenantId };
}

/**
 * Lo elegido en «¿Dónde publica?» y la organización que resulta, como estado
 * de la pantalla.
 *
 * Elegir solo cuenta para quien publica su propia agenda: quien arma la de otro
 * recurso con el formulario técnico no ve el selector, y publica en la
 * organización de la sesión aunque antes hubiera elegido otra.
 */
export class PublicationPlace {
  /** Lo último que eligió el médico; `null` mientras siga «Mi consultorio» por omisión. */
  readonly choice = signal<OrganizationChoice | null>(null);

  readonly target: Signal<PublicationTarget | null>;

  /** La organización sola. Es lo que, al cambiar, cambia qué agendas hay. */
  readonly tenantId: Signal<string | null>;

  /**
   * @param sessionTenantId - La organización activa de la sesión.
   * @param choosesOwn - Si la pantalla publica la agenda propia (y por eso muestra el selector).
   */
  constructor(sessionTenantId: Signal<string | null>, choosesOwn: Signal<boolean>) {
    this.target = computed(() =>
      publicationTargetOf(choosesOwn() ? this.choice() : null, sessionTenantId()),
    );
    this.tenantId = computed(() => this.target()?.tenantId ?? null);
  }

  /**
   * Llama a `load` con la organización de ahora y otra vez cada vez que cambie.
   *
   * Lo que `load` lea no cuenta como dependencia: una petición lee la sesión
   * en sus interceptores, y renovar el token no es cambiar de organización.
   * Se llama desde un contexto de inyección, como el constructor de la
   * pantalla.
   */
  watchTenant(load: (tenantId: string | null) => void): EffectRef {
    return effect(() => {
      const tenantId = this.tenantId();
      untracked(() => load(tenantId));
    });
  }
}
