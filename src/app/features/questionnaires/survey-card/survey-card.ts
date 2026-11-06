import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../shared/components/molecules/card/card';
import type { SurveyCatalogEntry } from '../../../core/data-access/surveys/surveys-catalog.client';

/** The card as the inbox needs it: the entry plus how it is painted. */
export interface SurveyCardData extends SurveyCatalogEntry {
  /** «Se envía» or «Encuesta anterior (ya no se envía)». */
  readonly label: string;
  readonly tone: BadgeVariant;
  /** The survey sheet, where its responses are read. */
  readonly route: string;
  /** Sent today: a system base survey or a catalog survey imported for a service. */
  readonly current: boolean;
}

/** What each base survey is issued for, in words. */
const SYSTEM_SCOPE = {
  CONSULTATION: 'Toda cita médica',
  SERVICE: 'Servicios sin encuesta propia',
} as const;

/**
 * Read-only card of one survey in the «Buzón»: where it is sent and a way to
 * read its responses. Nothing here edits a survey: the standard survey of each
 * service is chosen in «Encuestas por servicio».
 */
@Component({
  selector: 'app-survey-card',
  imports: [AppButtonLink, Badge, Card, NavIcon, RouterLink],
  templateUrl: './survey-card.html',
  styleUrl: './survey-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyCard {
  readonly survey = input.required<SurveyCardData>();

  protected readonly isBase = computed(() => this.survey().origin === 'SYSTEM');

  /** Names of what a current survey is sent for; never a UUID. Past surveys list none. */
  protected readonly targets = computed<readonly string[]>(() => {
    const { scope, assignments, current } = this.survey();
    if (scope) return [SYSTEM_SCOPE[scope]];
    if (!current) return [];
    return assignments
      .filter((a) => a.targetType === 'SERVICE')
      .map((a) => a.targetName ?? 'Un servicio que ya no figura');
  });

  /** Base surveys show their aggregated summary; the others open their responses in the sheet. */
  protected readonly responsesRoute = computed(() => (this.isBase() ? '/questionnaires' : this.survey().route));
  protected readonly responsesFragment = computed(() => (this.isBase() ? 'resumen' : 'respuestas'));
}
