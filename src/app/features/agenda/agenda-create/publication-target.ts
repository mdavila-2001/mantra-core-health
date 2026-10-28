import { computed, effect, signal, untracked, type EffectRef, type Signal } from '@angular/core';

import type { RetiredTemplate } from '../../../core/data-access/scheduling/scheduling.types';
import type { TenantScope } from '../../../core/data-access/scheduling/tenant-scope';
import type { OrganizationChoice } from '../../../shared/components/molecules/organization-select/organization-select.types';

/** Dónde se crea el recurso de agenda: la organización y, si se eligió una, su práctica. */
export interface PublicationTarget {
  readonly tenantId: string;
  /**
   * La práctica de la organización elegida. Ausente en «Mi consultorio»: ahí el
   * recurso lleva la práctica del formulario, como siempre.
   */
  readonly practiceId?: string;
  /**
   * Como qué organización se le habla a la API en cada paso de la publicación.
   *
   * La API resuelve la organización con `X-Tenant-Id`, rechaza con 403 el
   * `tenantId` del cuerpo o de la query que no es ése (`TENANT_SCOPE_CONFLICT`)
   * y no ve el recurso de otra. Por eso la organización elegida se declara;
   * «Mi consultorio» la deja vacía y la petición sale como siempre, con la de
   * la sesión.
   */
  readonly scope: TenantScope;
}

/**
 * La organización donde se publica la agenda.
 *
 * - **Una organización afiliada** manda la suya: su `tenantId` y su práctica,
 *   y se la declara en `scope`. El selector solo ofrece las que traen `tenantId`.
 * - **«Mi consultorio»**, o nada elegido todavía, publica en la organización
 *   activa de la sesión, sin declararla: exactamente lo que la pantalla hacía
 *   antes del selector.
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
    const tenantId = organization.tenantId;
    return { tenantId, practiceId: organization.practiceId, scope: { tenantId } };
  }
  return sessionTenantId === null ? null : { tenantId: sessionTenantId, scope: {} };
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

  /** Como qué organización se leen sus agendas y su horario: el `scope` de {@link target}. */
  readonly scope: Signal<TenantScope>;

  /**
   * @param sessionTenantId - La organización activa de la sesión.
   * @param choosesOwn - Si la pantalla publica la agenda propia (y por eso muestra el selector).
   */
  constructor(sessionTenantId: Signal<string | null>, choosesOwn: Signal<boolean>) {
    this.target = computed(() =>
      publicationTargetOf(choosesOwn() ? this.choice() : null, sessionTenantId()),
    );
    this.tenantId = computed(() => this.target()?.tenantId ?? null);
    this.scope = computed(() => this.target()?.scope ?? {});
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

/**
 * Lo que un intento de publicación ya hizo y tiene que recordar entre un paso
 * y el siguiente: dónde publica y si el horario vigente ya se retiró.
 *
 * Es de **una** agenda en **una** organización. Reintentar tras un fallo
 * posterior al retiro no vuelve a retirar lo que ya está retirado; pero
 * cambiar de organización o de agenda lo suelta entero, porque el retiro hecho
 * en una no dice nada del horario de la otra: saltear el retiro de la nueva
 * por creerlo hecho dejaría dos horarios vigentes sobre la misma agenda.
 */
export class PublicationAttempt {
  /** Dónde publica: lo elegido al tocar «Publicar», hasta el último paso. */
  private readonly target = signal<PublicationTarget | null>(null);

  /** Lo que soltó y conservó el retiro del horario vigente; `null` si no se retiró. */
  readonly retirement = signal<RetiredTemplate | null>(null);

  /** Empieza (o retoma) la publicación en `target`. Lo ya retirado sigue retirado. */
  begin(target: PublicationTarget): void {
    this.target.set(target);
  }

  /** Como qué organización habla cada paso de este intento. */
  scope(): TenantScope | undefined {
    return this.target()?.scope;
  }

  /** Se cambió de organización o de agenda: nada de lo hecho vale para la nueva. */
  reset(): void {
    this.target.set(null);
    this.retirement.set(null);
  }
}
