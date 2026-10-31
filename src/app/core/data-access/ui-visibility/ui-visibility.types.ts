/**
 * Contrato de visibilidad de la interfaz (docs/trabajo/2026-10-31-visibilidad-rbac/CONTRATO.md).
 * La visibilidad NO autoriza: la API decide cada petición.
 */

export type UiElementKind =
  | 'MODULE'
  | 'MENU_SECTION'
  | 'SCREEN'
  | 'SECTION'
  | 'WIDGET'
  | 'FIELD'
  | 'ACTION';

export type UiElementSource = 'CODE' | 'ADMIN';
export type UiElementStatus = 'ACTIVE' | 'RETIRED';

export type UiRuleEffect = 'SHOW' | 'HIDE';
export type UiRuleSubjectType = 'USER' | 'TENANT' | 'ROLE' | 'ORG_TYPE' | 'ALL';

/** Lo que el front declara en su registro y envía a `elements/sync`. */
export interface UiElementDraft {
  readonly key: string;
  readonly kind: UiElementKind;
  readonly moduleCode: string;
  readonly parentKey: string | null;
  readonly label: string;
  readonly description: string | null;
  readonly defaultVisible: boolean;
}

export interface UiElement extends UiElementDraft {
  readonly id: string;
  readonly source: UiElementSource;
  readonly status: UiElementStatus;
  /** Reglas vigentes sobre este elemento (informativo para el catálogo). */
  readonly activeRuleCount: number;
}

export interface UiVisibilityRule {
  readonly id: string;
  readonly elementKey: string;
  readonly effect: UiRuleEffect;
  readonly subjectType: UiRuleSubjectType;
  /** `null` sólo cuando `subjectType === 'ALL'`. */
  readonly subjectId: string | null;
  readonly subjectLabel: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly reason: string;
  readonly version: number;
  readonly createdAt: string;
  readonly createdByLabel: string | null;
}

export interface UiRuleCreate {
  readonly elementKey: string;
  readonly effect: UiRuleEffect;
  readonly subjectType: UiRuleSubjectType;
  readonly subjectId: string | null;
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
  readonly reason: string;
}

export interface UiRuleUpdate {
  readonly effect?: UiRuleEffect;
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
  readonly reason?: string;
}

export interface UiVisibilityPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total: number | null;
}

/** `GET /me/ui-visibility`: sólo lo oculto; lo demás es visible. */
export interface MyUiVisibility {
  readonly hiddenKeys: readonly string[];
  readonly version: string;
  readonly generatedAt: string;
}

export interface UiPreviewEntry {
  readonly elementKey: string;
  readonly hidden: boolean;
  /** Regla ganadora; `null` si lo decide `defaultVisible` o la cascada de un ancestro. */
  readonly winningRuleId: string | null;
  readonly reason: 'RULE' | 'DEFAULT' | 'ANCESTOR_HIDDEN';
  readonly ancestorKey: string | null;
}

export interface UiPreview {
  readonly subject: { readonly type: 'USER' | 'ROLE'; readonly id: string; readonly label: string };
  readonly entries: readonly UiPreviewEntry[];
}

export interface UiElementSyncResult {
  readonly created: number;
  readonly updated: number;
  readonly retired: number;
  readonly unchanged: number;
}
