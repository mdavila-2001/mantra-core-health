import type {
  UiElement,
  UiPreviewEntry,
  UiRuleSubjectType,
  UiVisibilityRule,
} from '../../data-access/ui-visibility/ui-visibility.types';

/* ============================================================================
    El resolutor del simulador de visibilidad (`ui-visibility.handlers.ts`), el
    del contrato: especificidad USER > TENANT > ROLE > ORG_TYPE > ALL, HIDE gana
    el empate, sin regla manda `defaultVisible` y oculto un ancestro, oculto el
    descendiente (cascada). Funciones puras: sin estado ni rutas.
    ========================================================================== */

/** Mayor número = más específica. El contrato: USER > TENANT > ROLE > ORG_TYPE > ALL. */
const ESPECIFICIDAD: Readonly<Record<UiRuleSubjectType, number>> = {
  USER: 5,
  TENANT: 4,
  ROLE: 3,
  ORG_TYPE: 2,
  ALL: 1,
};

/* ---- el resolutor ---------------------------------------------------------- */

/** A quién se le resuelve: lo que la API sabe de la sesión (o de la persona elegida en «ver como»). */
export interface SujetoDeResolucion {
  readonly userId: string | null;
  readonly tenantIds: readonly string[];
  readonly roleCodes: readonly string[];
  readonly orgTypes: readonly string[];
}

/** ¿La regla rige en `ahora`? Una terminada (`validTo` pasado) o programada (`validFrom` futuro) no. */
export function reglaVigente(regla: UiVisibilityRule, ahora: Date): boolean {
  const desde = regla.validFrom === null ? null : new Date(regla.validFrom).getTime();
  const hasta = regla.validTo === null ? null : new Date(regla.validTo).getTime();
  return (desde === null || desde <= ahora.getTime()) && (hasta === null || hasta > ahora.getTime());
}

function aplicaAlSujeto(regla: UiVisibilityRule, s: SujetoDeResolucion): boolean {
  switch (regla.subjectType) {
    case 'ALL':
      return true;
    case 'USER':
      return regla.subjectId !== null && regla.subjectId === s.userId;
    case 'TENANT':
      return regla.subjectId !== null && s.tenantIds.includes(regla.subjectId);
    case 'ROLE':
      return regla.subjectId !== null && s.roleCodes.includes(regla.subjectId);
    case 'ORG_TYPE':
      return regla.subjectId !== null && s.orgTypes.includes(regla.subjectId);
  }
}

/**
 * Resuelve la visibilidad de **todo** el catálogo para un sujeto (contrato, «Resolución»).
 *
 * 1. Reglas vigentes que aplican al sujeto. 2. Gana la más específica. 3. En el empate de
 * especificidad gana HIDE (también entre varios ROLE). 4. Sin regla, `defaultVisible`.
 * 5. Cascada: un ancestro oculto por sí mismo oculta al descendiente aunque tenga SHOW propio.
 *
 * Devuelve una entrada por elemento `ACTIVE`; los `RETIRED` no se presentan en ninguna parte.
 */
export function resolverVisibilidad(
  elementos: readonly UiElement[],
  reglas: readonly UiVisibilityRule[],
  sujeto: SujetoDeResolucion,
  ahora: Date,
): readonly UiPreviewEntry[] {
  const porClave = new Map(elementos.map((e) => [e.key, e]));
  const aplicables = reglas.filter((r) => reglaVigente(r, ahora) && aplicaAlSujeto(r, sujeto));

  /** Resolución propia de cada elemento, sin mirar a sus ancestros. */
  const propia = new Map<string, { hidden: boolean; rule: UiVisibilityRule | null }>();
  for (const e of elementos) {
    const suyas = aplicables.filter((r) => r.elementKey === e.key);
    if (suyas.length === 0) {
      propia.set(e.key, { hidden: !e.defaultVisible, rule: null });
      continue;
    }
    const tope = Math.max(...suyas.map((r) => ESPECIFICIDAD[r.subjectType]));
    const empatadas = suyas
      .filter((r) => ESPECIFICIDAD[r.subjectType] === tope)
      .sort((a, b) => a.id.localeCompare(b.id));
    const ganadora = empatadas.find((r) => r.effect === 'HIDE') ?? empatadas[0]!;
    propia.set(e.key, { hidden: ganadora.effect === 'HIDE', rule: ganadora });
  }

  /** El ancestro más alto cuya resolución propia es «oculto»; protege contra ciclos de `parentKey`. */
  const ancestroOculto = (clave: string): string | null => {
    const vistos = new Set<string>([clave]);
    let causa: string | null = null;
    let actual = porClave.get(clave)?.parentKey ?? null;
    while (actual !== null && !vistos.has(actual)) {
      vistos.add(actual);
      if (propia.get(actual)?.hidden === true) causa = actual;
      actual = porClave.get(actual)?.parentKey ?? null;
    }
    return causa;
  };

  return elementos
    .filter((e) => e.status === 'ACTIVE')
    .map((e): UiPreviewEntry => {
      const causa = ancestroOculto(e.key);
      if (causa !== null) {
        return {
          elementKey: e.key,
          hidden: true,
          winningRuleId: null,
          reason: 'ANCESTOR_HIDDEN',
          ancestorKey: causa,
        };
      }
      const mia = propia.get(e.key)!;
      return {
        elementKey: e.key,
        hidden: mia.hidden,
        winningRuleId: mia.rule?.id ?? null,
        reason: mia.rule === null ? 'DEFAULT' : 'RULE',
        ancestorKey: null,
      };
    });
}
