/* ============================================================================
    Contratos del selector de organización — sistema ALOVIDA v1.0.

    Responde «¿dónde publico esto?»: en el consultorio propio del médico o en
    una de las organizaciones donde tiene una afiliación activa. Lo consumen
    «Publicar agenda» y el modal del día.
    ========================================================================== */

/**
 * Una organización donde el médico puede publicar.
 *
 * Sale de sus afiliaciones (`GET /practitioners/me/role-assignments`). El
 * consultorio propio se reconoce con la sede propia (`isOwnSite` de
 * `GET /practitioners/:profileId/sites`), porque una afiliación no dice si la
 * práctica es la personal del médico o la de otra organización.
 */
export interface PractitionerOrganization {
  /** La práctica: lo que el backend llama organización. */
  readonly practiceId: string;
  /** La sede de la afiliación, o `null` si la afiliación no declara ninguna. */
  readonly practiceSiteId: string | null;
  /** Lo que lee el médico. */
  readonly name: string;
  /** Es su consultorio propio y no una organización a la que se afilió. */
  readonly isOwnOffice: boolean;
}

/** La clave de «Mi consultorio». Es el valor elegido por omisión. */
export const OWN_OFFICE_KEY = 'own-office';

/** El texto de la primera opción, la del consultorio propio. */
export const OWN_OFFICE_LABEL = 'Mi consultorio';

/** El texto de la última opción, la que pide afiliarse a otra organización. */
export const AFFILIATE_LABEL = 'Afiliarme a otra organización…';

/** Lo que entrega el selector cuando el médico elige una opción. */
export interface OrganizationChoice {
  /**
   * {@link OWN_OFFICE_KEY} o el `practiceId` elegido. Es lo que la pantalla
   * vuelve a pasar por `value`.
   */
  readonly key: string;
  /**
   * La organización elegida. Es `null` solo en «Mi consultorio» cuando el
   * médico todavía no registró uno: no hay práctica que mandar, y la pantalla
   * sigue con la organización de la sesión, como hasta ahora.
   */
  readonly organization: PractitionerOrganization | null;
}
