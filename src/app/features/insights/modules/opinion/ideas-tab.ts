import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Panel } from '../../components/panel';
import { campaignName } from '../../domain/campaigns.data';
import { ENVIRONMENT } from '../../domain/environment';
import { ideas, type IdeaPriority } from '../../domain/ideas';
import type { OpinionFilter } from '../../domain/opinion';
import { INSIGHTS_BASE } from '../../insights-nav';

const MARK: Readonly<Record<IdeaPriority, string>> = { 'Hacer ya': '●', 'Probar en chico': '◆', 'Validar antes': '▲', Vigilar: '○' };

/** Ideas de campaña que se pueden hacer hoy: cada una con su evidencia, su límite y cómo se mediría. */
@Component({
  selector: 'app-ins-ideas',
  imports: [Panel, RouterLink],
  templateUrl: './ideas-tab.html',
  styleUrl: './ideas-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdeasTab {
  readonly filter = input.required<OpinionFilter>();
  protected readonly list = computed(() => ideas(this.filter()));
  protected readonly mark = MARK;
  protected readonly campaignsLink = [INSIGHTS_BASE, 'campaigns'];
  protected campaign(id: string | null): string | null { return id ? campaignName(id) : null; }
  protected env(ids: readonly string[]): string[] { return ids.map((id) => ENVIRONMENT.find((e) => e.id === id)?.title ?? id); }
}
