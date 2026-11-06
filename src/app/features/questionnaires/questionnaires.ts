import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../core/navigation/navigation.service';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { SurveysInbox } from './inbox/surveys-inbox';
import { ServiceSurveys } from './service-surveys/service-surveys';
import { SURVEYS_SUBTAB_PARAM, SURVEYS_SUBTABS } from './questionnaires.routes';

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

  protected readonly selectedIndex = computed(() => {
    const name = this.params()?.get(SURVEYS_SUBTAB_PARAM) ?? '';
    const index = (SURVEYS_SUBTABS as readonly string[]).indexOf(name);
    return index < 0 ? 0 : index;
  });

  protected select(index: number): void {
    if (index === this.selectedIndex()) return;
    const name = SURVEYS_SUBTABS[index] ?? SURVEYS_SUBTABS[0];
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [SURVEYS_SUBTAB_PARAM]: index === 0 ? null : name },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
