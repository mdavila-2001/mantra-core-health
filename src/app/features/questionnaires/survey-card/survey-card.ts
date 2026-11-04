import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../shared/components/molecules/card/card';
import type { SurveyCatalogEntry } from '../../../core/data-access/surveys/surveys-catalog.client';

/** The card as the list needs it: the entry plus how it is painted. */
export interface SurveyCardData extends SurveyCatalogEntry {
  readonly palabra: string;
  readonly tono: BadgeVariant;
  readonly ruta: string;
}

/** What each base survey is issued for, in words. */
const ALCANCE_SISTEMA = {
  CONSULTATION: 'Consultas sin servicio',
  SERVICE: 'Todos los servicios',
} as const;

/** Presentational card of one survey: services it applies to and its response inbox. */
@Component({
  selector: 'app-survey-card',
  imports: [AppButtonLink, Badge, Card, NavIcon, RouterLink],
  templateUrl: './survey-card.html',
  styleUrl: './survey-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyCard {
  readonly encuesta = input.required<SurveyCardData>();

  protected readonly esBase = computed(() => this.encuesta().origin === 'SYSTEM');

  /** Names of what the survey is attached to; never a UUID. */
  protected readonly servicios = computed<readonly string[]>(() => {
    const { scope, assignments } = this.encuesta();
    if (scope) return [ALCANCE_SISTEMA[scope]];
    return assignments.map((a) =>
      a.targetType === 'SERVICE' ? (a.targetName ?? 'Un servicio que ya no figura') : 'Todas mis consultas',
    );
  });

  /** Base surveys show their aggregated summary; own ones open the inbox in the sheet. */
  protected readonly destinoRespuestas = computed(() => (this.esBase() ? '/questionnaires' : this.encuesta().ruta));
  protected readonly fragmento = computed(() => (this.esBase() ? 'resumen' : 'respuestas'));
}
