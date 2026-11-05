import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  AccessGovernanceClient,
  attentionItems,
  tileViews,
  type AttentionItem,
  type GovernanceSummary,
  type GovernanceTileView,
  type TileTone,
} from '../../../core/data-access/access-governance';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDateTime } from '../../support-access/support-labels';

/** Lo que pinta el tablero: los diez mosaicos, hasta cinco acciones y el instante del cálculo. */
export interface GovernanceHomeData {
  readonly generatedAt: string;
  readonly tiles: readonly GovernanceTileView[];
  readonly attention: readonly AttentionItem[];
}

/** Un enlace a otra pantalla del gobierno de accesos. */
interface ToolLink {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly route: string;
}

/** Pasado este tiempo, el cálculo se muestra como «atrasado» (S7) con su antigüedad. */
export const SUMMARY_STALE_AFTER_MS = 15 * 60_000;

const BASE = '/administration/access-governance';

/** Las demás pantallas del gobierno de accesos, para llegar sin pasar por el menú. */
export const TOOL_LINKS: readonly ToolLink[] = [
  {
    id: 'matrix',
    label: 'Matriz de accesos',
    hint: 'Quién tiene qué y quién puede actuar sobre un doctor, servicio o espacio.',
    route: `${BASE}/matrix`,
  },
  {
    id: 'anomalies',
    label: 'Anomalías',
    hint: 'Actividad inusual que conviene revisar.',
    route: `${BASE}/anomalies`,
  },
  {
    id: 'campaigns',
    label: 'Campañas de certificación',
    hint: 'Revisión periódica de quién conserva cada acceso.',
    route: `${BASE}/campaigns`,
  },
  {
    id: 'approvals',
    label: 'Aprobaciones',
    hint: 'Solicitudes que esperan la decisión de una segunda persona.',
    route: `${BASE}/approvals`,
  },
  {
    id: 'sod',
    label: 'Separación de funciones',
    hint: 'Combinaciones de permisos que no deberían coincidir en una persona.',
    route: `${BASE}/sod`,
  },
  {
    id: 'rules',
    label: 'Reglas de la organización',
    hint: 'Barandillas, techos por rol y ajustes de gobierno.',
    route: `${BASE}/rules`,
  },
  {
    id: 'lifecycle',
    label: 'Ingresos, cambios y bajas',
    hint: 'Casos abiertos y su lista de verificación.',
    route: `${BASE}/lifecycle`,
  },
  {
    id: 'simulator',
    label: 'Simulador y «¿por qué?»',
    hint: 'Compruebe qué puede hacer una persona antes de cambiar algo.',
    route: `${BASE}/simulator`,
  },
];

const TONE_BADGE: Readonly<Record<TileTone, BadgeVariant>> = {
  ok: 'success',
  info: 'info',
  warn: 'warning',
  risk: 'error',
};
const TONE_GLYPH: Readonly<Record<TileTone, string>> = { ok: '✓', info: 'i', warn: '!', risk: '▲' };

/**
 * **Gobierno de accesos** — el tablero: diez mosaicos, «lo que necesita su atención hoy» y enlaces a cada herramienta
 * (CONTRATO-GOBIERNO §9.3 fila 2).
 *
 * Los números los calcula la API (`GET /org/governance/summary`); la pantalla solo los pinta con
 * `tileViews`/`attentionItems`. Cada mosaico es un enlace a su lista filtrada y dice su estado con palabras, no solo con color.
 */
@Component({
  selector: 'app-governance-home',
  imports: [AppButton, Badge, Card, Link, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './governance-home.html',
  styleUrl: './governance-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GovernanceHome implements OnInit {
  private readonly client = inject(AccessGovernanceClient);

  protected readonly state = signal<ViewState<GovernanceHomeData>>(loading());
  protected readonly data = computed(() => dataOf(this.state()));
  protected readonly tools = TOOL_LINKS;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.client.getSummary().subscribe({
      next: (summary) => this.state.set(this.stateOf(summary)),
      error: (failure: unknown) => this.state.set(errorToViewState<GovernanceHomeData>(failure)),
    });
  }

  protected badgeOf(tone: TileTone): BadgeVariant {
    return TONE_BADGE[tone];
  }

  protected glyphOf(tone: TileTone): string {
    return TONE_GLYPH[tone];
  }

  protected attentionLabel(item: AttentionItem): string {
    return item.tone === 'risk' ? 'Requiere atención' : 'Revise pronto';
  }

  protected tileLabel(tile: GovernanceTileView): string {
    return `${tile.label}: ${tile.value}. ${tile.statusText}. ${tile.description}`;
  }

  protected generatedText(data: GovernanceHomeData): string {
    return formatDateTime(data.generatedAt);
  }

  private stateOf(summary: GovernanceSummary): ViewState<GovernanceHomeData> {
    const data: GovernanceHomeData = {
      generatedAt: summary.generatedAt,
      tiles: tileViews(summary.tiles),
      attention: attentionItems(summary.tiles),
    };
    // Nadie con acceso y nada que revisar: todavía no hay nada que gobernar. La próxima acción es sumar a alguien.
    if (data.tiles.every((tile) => tile.value === 0)) {
      return empty(
        {
          label: 'Emita una invitación para sumar a alguien',
          route: '/administration/support-invitations',
        },
        'Todavía no hay personas con acceso que gobernar.',
      );
    }
    const asOf = new Date(summary.generatedAt);
    return Number.isNaN(asOf.getTime()) || Date.now() - asOf.getTime() <= SUMMARY_STALE_AFTER_MS
      ? ready(data)
      : stale(data, asOf);
  }
}
