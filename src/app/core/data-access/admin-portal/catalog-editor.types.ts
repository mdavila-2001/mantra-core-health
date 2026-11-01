/* ============================================================================
    Editor de catálogos globales (`/admin/catalogs/*`). H3 del plan
    «Perfil admin: medición y gobierno».

    Contrato: `docs/trabajo/2026-10-30-perfil-admin-medicion-gobierno/contratos/H3-catalogos.md`
    (más su adenda §7, que declara `GET /admin/catalogs/services/scopes`).

    Reglas del contrato que el front respeta:
    - `defaultPrice` es un **decimal exacto como cadena** (`"100.00"`); nunca `number`.
    - Toda edición manda `expectedRowVersion` (versión optimista). Si otra persona
      cambió el registro antes, la API responde 409 y NADA se pisa.
    - No existe `DELETE`: «desactivar» conserva el registro y su historia.
    - `rowVersion` es la versión visible; la auditoría vive en `/audit/log`.
    ========================================================================== */

/** Página con cursor opaco, igual para servicios y glosario. */
export interface AdminCatalogPage<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/* -- Servicios ---------------------------------------------------------- */

/** Tipo de organización dueña del catálogo (conceptos `PR_TYPE_*`): el «tipo de usuario» de Servicios. */
export interface ServiceOwnerType {
  readonly conceptId: string;
  readonly code: string;
  readonly display: string;
}

/** Práctica (consultorio, clínica, laboratorio…) de la organización activa. */
export interface ServicePracticeRef {
  readonly id: string;
  readonly name: string;
  readonly typeConceptId: string;
}

/** Moneda admitida para el precio. */
export interface ServiceCurrencyRef {
  readonly conceptId: string;
  readonly code: string;
}

/** Con qué se arma la pantalla: tipos, prácticas y monedas. Lo declara la API, no el front. */
export interface ServiceScopes {
  readonly types: readonly ServiceOwnerType[];
  readonly practices: readonly ServicePracticeRef[];
  readonly currencies: readonly ServiceCurrencyRef[];
}

export interface AdminServiceItem {
  readonly id: string;
  readonly practiceId: string;
  readonly practiceTypeConceptId: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionText?: string | null;
  readonly termsText?: string | null;
  readonly serviceConceptId?: string | null;
  /** Decimal exacto como cadena. */
  readonly defaultPrice: string;
  readonly currencyConceptId?: string | null;
  readonly currencyCode?: string | null;
  readonly isActive: boolean;
  readonly rowVersion: number;
  readonly updatedAt: string;
  readonly updatedByUserId?: string | null;
}

export interface ServiceListQuery {
  readonly practiceTypeConceptId?: string;
  readonly practiceId?: string;
  readonly isActive?: boolean;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface CreateServiceInput {
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly defaultPrice: string;
  readonly descriptionText?: string;
  readonly serviceConceptId?: string;
  readonly currencyConceptId?: string;
  readonly isActive?: boolean;
}

/** `null` limpia un texto; `code` y `practiceId` no se editan. */
export interface UpdateServiceInput {
  readonly expectedRowVersion: number;
  readonly name?: string;
  readonly descriptionText?: string | null;
  readonly termsText?: string | null;
  readonly serviceConceptId?: string;
  readonly defaultPrice?: string;
  /** Sólo viaja junto con `defaultPrice`. */
  readonly currencyConceptId?: string;
}

/* -- Glosario ----------------------------------------------------------- */

/** `patient` = resumen en lenguaje llano; `professional` = definición clínica. */
export type GlossaryAudience = 'patient' | 'professional';

export type GlossaryState = 'active' | 'retired';

export interface GlossaryText {
  readonly es: string;
  readonly en?: string;
}

export interface AdminGlossaryTerm {
  readonly conceptId: string;
  readonly slug: string;
  readonly code: string;
  readonly display: string;
  readonly nameEs: string;
  readonly state: GlossaryState;
  readonly audience: GlossaryAudience;
  /** El texto de la audiencia pedida; `null` si todavía no tiene (no se inventa). */
  readonly text: GlossaryText | null;
  readonly rowVersion: number;
  readonly updatedAt: string;
  readonly updatedByUserId?: string | null;
}

export interface GlossaryListQuery {
  readonly audience: GlossaryAudience;
  readonly state?: GlossaryState;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface CreateGlossaryTermInput {
  readonly slug: string;
  readonly display: string;
  readonly nameEs: string;
  readonly audience: GlossaryAudience;
  readonly text: GlossaryText;
}

export interface UpdateGlossaryTermInput {
  readonly expectedRowVersion: number;
  readonly audience: GlossaryAudience;
  readonly text?: GlossaryText;
  readonly nameEs?: string;
}

/** Cuerpo de `deactivate` / `reactivate`: el glosario también pide la audiencia. */
export interface GlossaryToggleInput {
  readonly expectedRowVersion: number;
  readonly audience: GlossaryAudience;
}
