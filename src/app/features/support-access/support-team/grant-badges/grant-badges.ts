import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  ATOM_SENSITIVITY_LABELS,
  expandSupportAction,
  SUPPORT_ATOMS,
  type AtomSensitivity,
} from '../../../../core/data-access/support-access/support-atoms';
import type { SupportGrant } from '../../../../core/data-access/support-access/support-access.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';

const RANK: readonly AtomSensitivity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export interface GrantBadgeSummary {
  /** Cuántos permisos vigentes permiten y cuántos deniegan (un permiso sin `effect` es de antes de la fase 5: permite). */
  readonly allow: number;
  readonly deny: number;
  readonly conditioned: number;
  readonly conditionTexts: readonly string[];
  /** De dónde salen: códigos antiguos (alias), átomos escritos como tales, o ambos. `null` si no hay permisos. */
  readonly origin: 'LEGACY' | 'ATOM' | 'MIXED' | null;
  /** La sensibilidad más alta de lo que se **permite**; una prohibición no suma privilegio. */
  readonly topSensitivity: AtomSensitivity | null;
}

/** El resumen de los permisos vigentes de una persona para las insignias de la lista (CONTRATO-GOBIERNO §9.3 fila 15). */
export function summarizeGrantBadges(grants: readonly SupportGrant[]): GrantBadgeSummary {
  const live = grants.filter((g) => g.status === 'ACTIVE');
  const allowed = live.filter((g) => g.effect !== 'DENY');
  const origins = new Set(live.map((g) => (g.origin === 'ATOM' ? 'ATOM' : 'LEGACY')));
  const atoms = allowed.flatMap((g) => g.atoms ?? g.actions.flatMap((a) => expandSupportAction(a)));
  const top = Math.max(
    -1,
    ...atoms.map((a) =>
      RANK.indexOf(SUPPORT_ATOMS.find((m) => m.code === a)?.sensitivity ?? 'LOW'),
    ),
  );
  const withConditions = live.filter(
    (g) =>
      g.condition !== undefined ||
      g.actionConditions !== undefined ||
      g.conditionsSummary !== undefined,
  );
  return {
    allow: allowed.length,
    deny: live.length - allowed.length,
    conditioned: withConditions.length,
    conditionTexts: [
      ...new Set(
        withConditions.flatMap((g) =>
          g.conditionsSummary === undefined ? [] : [g.conditionsSummary],
        ),
      ),
    ],
    origin:
      live.length === 0
        ? null
        : origins.size === 2
          ? 'MIXED'
          : origins.has('ATOM')
            ? 'ATOM'
            : 'LEGACY',
    topSensitivity: top < 0 ? null : RANK[top]!,
  };
}

const ORIGIN_LABELS = {
  LEGACY: 'Permisos antiguos',
  ATOM: 'Permisos por átomo',
  MIXED: 'Antiguos y por átomo',
} as const;

/**
 * **Insignias de los permisos de una persona** en la lista del equipo: Permitir/Denegar, condiciones, origen (códigos
 * antiguos o átomos) y sensibilidad. Todo con texto (y la sensibilidad con símbolo): el estado nunca depende solo del color.
 */
@Component({
  selector: 'app-grant-badges',
  imports: [Badge],
  templateUrl: './grant-badges.html',
  styleUrl: './grant-badges.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantBadges {
  readonly grants = input.required<readonly SupportGrant[]>();
  readonly personName = input('la persona');

  protected readonly summary = computed(() => summarizeGrantBadges(this.grants()));
  protected readonly originLabel = computed(() =>
    this.summary().origin === null ? '' : ORIGIN_LABELS[this.summary().origin!],
  );
  protected readonly sensitivity = computed(() => {
    const top = this.summary().topSensitivity;
    if (top === null) return null;
    return {
      label: ATOM_SENSITIVITY_LABELS[top],
      icon: top === 'CRITICAL' || top === 'HIGH' ? '▲' : '●',
      tone:
        top === 'CRITICAL'
          ? ('error' as const)
          : top === 'HIGH'
            ? ('warning' as const)
            : ('secondary' as const),
    };
  });
}
