import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';

import { CenterScheduleClient } from '../../../core/data-access/diagnostic-units/center-schedule.client';
import type { CenterScheduleView } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { EquipmentTab } from './equipment-tab/equipment-tab';
import { OccupancyTab } from './occupancy-tab/occupancy-tab';
import { ScheduleTab } from './schedule-tab/schedule-tab';

/* ============================================================================
    Horarios y equipos de un centro de diagnóstico.

    Cada equipo que da turnos es una línea de producción: atiende en su
    horario propio o en el general del centro, y los turnos que ve el paciente
    son la suma de los equipos operativos de cada modalidad. La página carga el
    centro una vez y cada pestaña le devuelve la vista que contesta el
    servidor tras cada cambio:

      - «Horarios»: el horario general, el de modalidades sin equipos y las
        excepciones por estudio;
      - «Equipos»: alta desde el catálogo, estado, horario propio y baja;
      - «Ocupación»: el día de cada equipo.
    ========================================================================== */

@Component({
  selector: 'app-center-schedule',
  imports: [PageHeader, ViewStateHost, Card, Tabs, Tab, ScheduleTab, EquipmentTab, OccupancyTab],
  templateUrl: './center-schedule.html',
  styleUrl: './center-schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenterSchedulePage implements OnInit {
  private readonly client = inject(CenterScheduleClient);
  private readonly navigation = inject(NavigationService);

  protected readonly state = signal<ViewState<CenterScheduleView>>(loading());
  protected readonly tab = signal(0);

  protected readonly center = computed<CenterScheduleView | null>(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  /** The Glossary belongs to whoever attends; without it, the data map reads without links. */
  protected readonly linkGlossary = computed(() => this.navigation.visibleSections().some((s) => s.path === 'glossary'));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.client.getMySchedule().subscribe({
      next: (view) => this.state.set(ready(view)),
      error: (error: unknown) => this.state.set(errorToViewState(error)),
    });
  }

  protected apply(view: CenterScheduleView): void {
    this.state.set(ready(view));
  }
}
