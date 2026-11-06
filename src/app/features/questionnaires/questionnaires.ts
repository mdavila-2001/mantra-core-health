import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../core/navigation/navigation.service';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { SurveysInbox } from './inbox/surveys-inbox';
import { ServiceSurveys } from './service-surveys/service-surveys';

/** URL query param holding the open sub-tab. */
export const PARAM_SUBPESTANA = 'encuestas';

/** Sub-tabs in order. The first is the default and is kept out of the URL. */
export const SUBPESTANAS = ['buzon', 'servicios'] as const;
export type Subpestana = (typeof SUBPESTANAS)[number];

/**
 * The practitioner's «Encuestas» (06/11/2026): two sub-tabs, full width.
 * «Buzón» is what the screen already did (responses and «Cómo le va») without
 * free creation; «Encuestas por servicio» chooses the standard survey each
 * service sends. The sub-tab lives in the URL (`?encuestas=servicios`) and
 * switching replaces the history entry instead of stacking it.
 */
@Component({
  selector: 'app-surveys-home',
  imports: [PageHeader, ServiceSurveys, SurveysInbox, Tab, Tabs],
  templateUrl: './questionnaires.html',
  styleUrl: './questionnaires.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveysHome {
  /** Inside the «Formularios | Encuestas» hub the hub draws the header. */
  readonly embedded = input(false);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

  protected readonly index = computed(() => {
    const name = this.params()?.get(PARAM_SUBPESTANA) ?? '';
    const index = (SUBPESTANAS as readonly string[]).indexOf(name);
    return index < 0 ? 0 : index;
  });

  protected elegir(index: number): void {
    if (index === this.index()) return;
    const name = SUBPESTANAS[index] ?? SUBPESTANAS[0];
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [PARAM_SUBPESTANA]: index === 0 ? null : name },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
