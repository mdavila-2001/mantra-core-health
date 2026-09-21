import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { QaLabClient } from '../../../core/data-access/admin-portal/platform.client';
import type {
  PlanDetail,
  Preflight,
  QaEnvironment,
  QaSuite,
} from '../../../core/data-access/admin-portal/platform.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { claveIdempotente, errorDeApi } from '../platform/platform-labels';

const RAZONES: Readonly<Record<string, string>> = {
  ENVIRONMENT_PRODUCTION: 'el destino es producción',
  MUTATING_REQUESTS: 'el plan modifica datos',
  PRIVATE_NETWORK_TARGET: 'el destino está en una red interna',
};

/**
 * Pedir un plan de ejecución en dos pasos: primero el preflight —el servidor
 * resuelve URLs, recorta límites y dice si hace falta aprobación, sin llamar
 * a nada—, después el pedido. El navegador no ejecuta ninguna prueba.
 */
@Component({
  selector: 'app-new-plan-dialog',
  imports: [AppButton, Badge, Select, Alert, FormField, ContentDialog],
  template: `
    <app-content-dialog
      heading="Pedir una ejecución"
      description="El servidor ejecuta la suite contra el destino aprobado del entorno. Acá sólo se pide y se revisa."
      size="lg"
      [dismissible]="!ocupado()"
      (closed)="closed.emit()"
    >
      @if (error(); as mensaje) {
        <app-alert tone="error">{{ mensaje }}</app-alert>
      }
      <div class="plan-form">
        <app-form-field label="Suite" [required]="true">
          <app-select ariaLabel="Suite" [options]="opcionesSuite()" [value]="suiteId()" (valueChange)="elegir('suite', $event)" />
        </app-form-field>
        <app-form-field label="Entorno" [required]="true">
          <app-select ariaLabel="Entorno" [options]="opcionesEntorno()" [value]="entornoId()" (valueChange)="elegir('entorno', $event)" />
        </app-form-field>
      </div>

      @if (preflight(); as p) {
        <section class="plan-preflight" data-testid="qa-preflight">
          @if (p.violations.length > 0) {
            <app-alert tone="error" title="El plan no es ejecutable">
              <ul>
                @for (v of p.violations; track $index) {
                  <li>@if (v.caseCode) { <code>{{ v.caseCode }}</code>: } {{ v.message }}</li>
                }
              </ul>
            </app-alert>
          } @else if (p.requiresApproval) {
            <app-alert tone="warning" title="Necesita aprobación de otra persona">
              Porque {{ razones(p.approvalReasons) }}.
            </app-alert>
          } @else {
            <app-alert tone="success">Listo para pedir: no necesita aprobación.</app-alert>
          }
          <p class="plan-preflight__nota">
            {{ p.steps.length }} peticiones · máx. {{ p.limits.maxRequests }} · {{ p.limits.maxDurationSeconds }} s ·
            timeout {{ p.limits.requestTimeoutMs }} ms · concurrencia 1
          </p>
          <ol class="plan-preflight__pasos">
            @for (paso of p.steps; track paso.caseId) {
              <li>
                <app-badge [variant]="paso.mutating ? 'warning' : 'secondary'">{{ paso.method }}</app-badge>
                <code>{{ paso.url }}</code>
              </li>
            }
          </ol>
          <p class="plan-preflight__nota">{{ p.loadTesting }}</p>
        </section>
      }

      <div dialog-actions class="plan-form__acciones">
        <button app-button variant="ghost" [disabled]="ocupado()" (clicked)="closed.emit()">Cancelar</button>
        <button
          app-button
          variant="outline"
          data-testid="qa-preflight-button"
          [disabled]="!suiteId() || !entornoId()"
          [isLoading]="ocupado() && !preflight()"
          (clicked)="revisar()"
        >
          Revisar el plan
        </button>
        <button
          app-button
          variant="primary"
          data-testid="qa-create-plan"
          [disabled]="!preflight()?.executable"
          [isLoading]="ocupado() && !!preflight()"
          (clicked)="pedir()"
        >
          Pedir ejecución
        </button>
      </div>
    </app-content-dialog>
  `,
  styles: `
    .plan-form { display: grid; grid-template-columns: 1fr; gap: var(--e3); }
    @media (min-width: 780px) { .plan-form { grid-template-columns: 1fr 1fr; } }
    .plan-form__acciones { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--e2); }
    .plan-preflight { display: flex; flex-direction: column; gap: var(--e2); margin-block-start: var(--e4); }
    .plan-preflight__pasos { display: flex; flex-direction: column; gap: var(--e2); margin: 0; padding-inline-start: var(--e4); }
    .plan-preflight__nota { margin: 0; font-size: var(--fs-caption); color: var(--text-secondary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewPlanDialog {
  private readonly qa = inject(QaLabClient);

  readonly suites = input.required<readonly QaSuite[]>();
  readonly environments = input.required<readonly QaEnvironment[]>();
  readonly created = output<PlanDetail>();
  readonly closed = output<void>();

  protected readonly suiteId = signal<string | null>(null);
  protected readonly entornoId = signal<string | null>(null);
  protected readonly preflight = signal<Preflight | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Una clave por plan revisado: un doble clic en «Pedir» no crea dos planes. */
  private clave = claveIdempotente('plan');

  protected readonly opcionesSuite = computed(() => [
    { value: null, label: 'Elegí una suite' },
    ...this.suites().map((s) => ({ value: s.id as string | null, label: `${s.code} · ${s.name} (${s.activeCases} casos)` })),
  ]);
  protected readonly opcionesEntorno = computed(() => [
    { value: null, label: 'Elegí un entorno' },
    ...this.environments().map((e) => ({ value: e.id as string | null, label: `${e.code} · ${e.name}` })),
  ]);

  protected razones(codigos: readonly string[]): string {
    return codigos.map((c) => RAZONES[c] ?? c).join(' y ');
  }

  protected elegir(campo: 'suite' | 'entorno', valor: string | null): void {
    if (campo === 'suite') this.suiteId.set(valor);
    else this.entornoId.set(valor);
    // Cambiar la elección invalida lo revisado: hay que volver a revisar.
    this.preflight.set(null);
    this.clave = claveIdempotente('plan');
  }

  protected revisar(): void {
    const suite = this.suiteId();
    const entorno = this.entornoId();
    if (!suite || !entorno) return;
    this.ocupado.set(true);
    this.error.set(null);
    this.qa.preflight(suite, entorno).subscribe({
      next: (p) => {
        this.ocupado.set(false);
        this.preflight.set(p);
      },
      error: (e: unknown) => {
        this.ocupado.set(false);
        this.error.set(errorDeApi(e).message ?? 'No se pudo revisar el plan.');
      },
    });
  }

  protected pedir(): void {
    const suite = this.suiteId();
    const entorno = this.entornoId();
    if (!suite || !entorno || !this.preflight()?.executable) return;
    this.ocupado.set(true);
    this.qa.createPlan(suite, entorno, this.clave).subscribe({
      next: (plan) => {
        this.ocupado.set(false);
        this.created.emit(plan);
      },
      error: (e: unknown) => {
        this.ocupado.set(false);
        this.error.set(errorDeApi(e).message ?? 'No se pudo pedir la ejecución.');
      },
    });
  }
}
