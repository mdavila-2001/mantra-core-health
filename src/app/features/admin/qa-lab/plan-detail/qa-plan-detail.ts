import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { QaLabClient } from '../../../../core/data-access/admin-portal/platform.client';
import type { PlanDetail } from '../../../../core/data-access/admin-portal/platform.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { errorDeApi, planStatus } from '../../platform/platform-labels';

/** Mientras el plan está vivo, se relee cada tanto. El trabajo lo hace el servidor. */
const REFRESCO_MS = 3000;
const VIVOS = ['PENDING_APPROVAL', 'QUEUED', 'RUNNING'];

const EVENTOS: Readonly<Record<string, string>> = {
  PLAN_CREATED: 'Plan pedido',
  PLAN_APPROVED: 'Aprobado',
  PLAN_REJECTED: 'Rechazado',
  PLAN_STARTED: 'Empezó la ejecución',
  CASE_PASSED: 'Caso aprobado',
  CASE_FAILED: 'Caso fallido',
  CASE_BLOCKED: 'Bloqueado por la guarda de destinos',
  CASE_TRANSPORT_ERROR: 'Error de transporte',
  CASE_RECORDING_FAILED: 'No se pudo registrar la evidencia',
  CANCEL_REQUESTED: 'Cancelación pedida',
  CANCEL_ACKNOWLEDGED: 'Cancelación confirmada por el runner',
  BUDGET_EXHAUSTED: 'Presupuesto agotado',
  APPROVAL_REQUIRED_AGAIN: 'La aprobación dejó de valer',
  PLAN_FINISHED: 'Plan terminado',
};

/**
 * Detalle de un plan: qué se va a llamar (o se llamó), su aprobación ligada al
 * hash y la bitácora que escribe el runner. Aprobar o cancelar se pide acá; la
 * regla (quien pidió no aprueba, el hash tiene que coincidir) la aplica el
 * servidor.
 */
@Component({
  selector: 'app-qa-plan-detail',
  imports: [DatePipe, AppButton, Badge, Alert, Card, Tabs, Tab, PageHeader, ViewStateHost],
  templateUrl: './qa-plan-detail.html',
  styleUrl: './qa-plan-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QaPlanDetail {
  private readonly qa = inject(QaLabClient);
  private readonly dialogs = inject(DialogService);
  protected readonly planId = inject(ActivatedRoute).snapshot.paramMap.get('planId') ?? '';
  protected readonly planStatus = planStatus;
  protected readonly evento = (k: string) => EVENTOS[k] ?? k;

  protected readonly pestana = signal(0);
  protected readonly plan = signal<ViewState<PlanDetail>>(loading());
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  protected readonly datos = computed(() => {
    const p = this.plan();
    return p.status === 'ready' ? p.data : null;
  });
  protected readonly vivo = computed(() => VIVOS.includes(this.datos()?.status ?? ''));
  protected readonly breadcrumbs = [
    { label: 'QA Lab', routerLink: '/administration/qa-lab' },
    { label: 'Plan de ejecución' },
  ];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detener());
    this.cargar();
  }

  protected cargar(): void {
    this.detener();
    this.qa.plan(this.planId).subscribe({
      next: (p) => {
        this.plan.set(ready(p));
        if (VIVOS.includes(p.status)) this.temporizador = setTimeout(() => this.cargar(), REFRESCO_MS);
      },
      error: (e: unknown) => this.plan.set(errorToViewState<PlanDetail>(e)),
    });
  }

  private detener(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  protected async decidir(decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    const p = this.datos();
    if (!p) return;
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: decision === 'APPROVED' ? 'Aprobar el plan' : 'Rechazar el plan',
        message:
          decision === 'APPROVED'
            ? `Vas a aprobar exactamente este plan (hash ${p.planHash.slice(0, 12)}…). Si cambia la suite o el destino, la aprobación deja de valer.`
            : 'El plan no se va a ejecutar.',
        confirmLabel: decision === 'APPROVED' ? 'Aprobar' : 'Rechazar',
        cancelLabel: 'Volver',
        destructive: decision === 'REJECTED',
      },
      { label: 'Motivo', minLength: 10, maxLength: 1000 },
    );
    if (motivo === null) return;
    this.error.set(null);
    this.aviso.set(null);
    this.qa.approve(p.id, { decision, planHash: p.planHash, reason: motivo }).subscribe({
      next: () => {
        this.aviso.set(decision === 'APPROVED' ? 'Plan aprobado: queda en cola para el runner.' : 'Plan rechazado.');
        this.cargar();
      },
      error: (e: unknown) => {
        const api = errorDeApi(e);
        this.error.set(
          api.status === 403
            ? ((api.details?.['violations'] as { reason?: string }[] | undefined) ?? []).some(
                (v) => v.reason === 'SELF_APPROVAL',
              )
              ? 'Quien pidió el plan no puede aprobarlo: tiene que hacerlo otra persona.'
              : 'Tu rol no permite aprobar planes de ejecución.'
            : api.status === 409
              ? 'El plan cambió o ya no está esperando aprobación. Recargá.'
              : (api.message ?? 'No se pudo registrar la decisión.'),
        );
      },
    });
  }

  protected async cancelar(): Promise<void> {
    const p = this.datos();
    if (!p) return;
    const ok = await this.dialogs.confirm({
      title: 'Cancelar el plan',
      message:
        p.status === 'RUNNING'
          ? 'El runner termina el caso en curso y no ejecuta los siguientes.'
          : 'El plan no se va a ejecutar.',
      confirmLabel: 'Cancelar el plan',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!ok) return;
    this.qa.cancel(p.id).subscribe({
      next: () => {
        this.aviso.set('Cancelación pedida.');
        this.cargar();
      },
      error: (e: unknown) => this.error.set(errorDeApi(e).message ?? 'No se pudo cancelar.'),
    });
  }

  protected detalle(d: Readonly<Record<string, unknown>> | null): string {
    if (!d) return '';
    return Object.entries(d)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(' · ');
  }
}
