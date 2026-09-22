import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { QaLabClient } from '../../../core/data-access/admin-portal/platform.client';
import type {
  PlanDetail,
  PlanSummary,
  QaDefect,
  QaEnvironment,
  QaRunDetail,
  QaRunSummary,
  QaSuite,
  QaTarget,
} from '../../../core/data-access/admin-portal/platform.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { conceptStatus, planStatus } from '../platform/platform-labels';
import { NewPlanDialog } from './new-plan-dialog';

/**
 * QA Lab: planes de ejecución en el servidor, suites, corridas con veredicto
 * por aserción, defectos y destinos aprobados. Ninguna prueba corre en el
 * navegador.
 */
@Component({
  selector: 'app-qa-lab',
  imports: [
    DatePipe,
    RouterLink,
    AppButton,
    Badge,
    Card,
    Tabs,
    Tab,
    ContentDialog,
    PageHeader,
    ViewStateHost,
    NewPlanDialog,
  ],
  templateUrl: './qa-lab.html',
  styleUrl: './qa-lab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QaLab {
  private readonly qa = inject(QaLabClient);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly planStatus = planStatus;
  protected readonly conceptStatus = conceptStatus;

  protected readonly pestana = signal(0);
  protected readonly planes = signal<ViewState<readonly PlanSummary[]>>(loading());
  protected readonly suites = signal<ViewState<readonly QaSuite[]>>(loading());
  protected readonly corridas = signal<ViewState<readonly QaRunSummary[]>>(loading());
  protected readonly defectos = signal<ViewState<readonly QaDefect[]>>(loading());
  protected readonly destinos = signal<ViewState<readonly QaTarget[]>>(loading());
  protected readonly entornos = signal<readonly QaEnvironment[]>([]);
  protected readonly corridaAbierta = signal<ViewState<QaRunDetail> | null>(null);
  protected readonly pidiendoPlan = signal(false);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    const vacio = <T>(lista: readonly T[], mensaje: string, accion: string): ViewState<readonly T[]> =>
      lista.length === 0 ? empty({ label: accion }, mensaje) : ready(lista);
    this.qa.plans().subscribe({
      next: (p) => this.planes.set(vacio(p, 'Todavía no se pidió ningún plan.', 'Usá «Pedir ejecución» arriba.')),
      error: (e: unknown) => this.planes.set(errorToViewState<readonly PlanSummary[]>(e)),
    });
    this.qa.suites().subscribe({
      next: (s) => this.suites.set(vacio(s, 'No hay suites definidas.', 'Las suites se definen en el laboratorio de pruebas.')),
      error: (e: unknown) => this.suites.set(errorToViewState<readonly QaSuite[]>(e)),
    });
    this.qa.runs().subscribe({
      next: (r) => this.corridas.set(vacio(r, 'No hay corridas.', 'Pedí una ejecución.')),
      error: (e: unknown) => this.corridas.set(errorToViewState<readonly QaRunSummary[]>(e)),
    });
    this.qa.defects().subscribe({
      next: (d) => this.defectos.set(vacio(d, 'No hay defectos registrados.', 'Aparecen cuando un caso falla.')),
      error: (e: unknown) => this.defectos.set(errorToViewState<readonly QaDefect[]>(e)),
    });
    this.qa.targets().subscribe({
      next: (t) => this.destinos.set(vacio(t, 'Ningún entorno tiene destino aprobado: el runner no puede llamar a nada.', 'Los registra QA_ADMIN o SECURITY_ADMIN.')),
      error: (e: unknown) => this.destinos.set(errorToViewState<readonly QaTarget[]>(e)),
    });
    this.qa.environments().subscribe({ next: (e) => this.entornos.set(e), error: () => this.entornos.set([]) });
  }

  protected listaDe<T>(estado: ViewState<readonly T[]>): readonly T[] {
    return estado.status === 'ready' ? estado.data : [];
  }

  protected planCreado(plan: PlanDetail): void {
    this.pidiendoPlan.set(false);
    void this.router.navigate(['/administration/qa-lab/plans', plan.id]);
  }

  protected abrirCorrida(id: string): void {
    this.corridaAbierta.set(loading());
    this.qa.run(id).subscribe({
      next: (r) => this.corridaAbierta.set(ready(r)),
      error: (e: unknown) => this.corridaAbierta.set(errorToViewState<QaRunDetail>(e)),
    });
  }

  protected entornoDe(id: string): string {
    return this.entornos().find((e) => e.id === id)?.code ?? id.slice(0, 8);
  }
}
