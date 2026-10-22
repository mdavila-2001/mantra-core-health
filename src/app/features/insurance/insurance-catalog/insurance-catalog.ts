import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  CarrierDetail,
  CarrierSummary,
  Plan,
  PlanBenefit,
  Product,
  UpdatePlanBenefitInput,
  UpdatePlanBenefitRulesInput,
} from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Card } from '../../../shared/components/molecules/card/card';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ApprovalRulesDialog } from './approval-rules-dialog';
import { BenefitFormDialog } from './benefit-form-dialog';
import { PlanFormDialog } from './plan-form-dialog';
import { PlanPremiumDialog } from './plan-premium-dialog';

/** Una página del catálogo: un producto seguro y el ramo al que pertenece. */
interface CatalogEntry {
  readonly product: Product;
  readonly plan: Plan | null;
}

/**
 * Catálogo de la aseguradora del tenant activo: productos, planes, coberturas y
 * red de prestadores.
 *
 * Carga en dos pasos por una razón de contrato, no de comodidad: el listado
 * (`GET /insurance-carriers`) dice **qué** aseguradora administra esta
 * organización, y sólo la ficha (`/:id`) trae el catálogo. Pedir la ficha
 * primero exigiría que la pantalla adivinara un identificador.
 *
 * Vocabulario de la pantalla: cada **plan** se presenta como un «producto
 * seguro» —datos generales más sus líneas de **cláusulas**— y el producto del
 * modelo queda como el ramo que los agrupa. Una cláusula es una cobertura del
 * plan (`insurance_plan_benefits`): declara el servicio, por su
 * `service_concept_id`, y el porcentaje que paga.
 *
 * Si la organización no tiene aseguradora —porque no es de tipo `PAYER`— la
 * pantalla lo dice y ofrece la salida, en vez de mostrar una tabla vacía que
 * parezca un catálogo sin cargar.
 */
@Component({
  selector: 'app-insurance-catalog',
  imports: [
    Card,
    Chip,
    Pagination,
    DatePipe,
    AppButton,
    PageHeader,
    ViewStateHost,
    ApprovalRulesDialog,
    BenefitFormDialog,
    PlanFormDialog,
    PlanPremiumDialog,
  ],
  templateUrl: './insurance-catalog.html',
  styleUrl: './insurance-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceCatalog {
  private readonly insurance = inject(InsuranceClient);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  protected readonly state = signal<ViewState<CarrierDetail>>(loading());
  protected readonly carrier = computed(() => dataOf(this.state()));

  /** Página pedida (1-based). Un producto seguro por página. */
  protected readonly pagina = signal(1);

  /**
   * Lo que se pagina: cada producto seguro (plan) con el ramo que lo agrupa. Un
   * ramo sin planes ocupa su propia página, para que «Añadir producto seguro»
   * siga al alcance en él.
   */
  protected readonly entradas = computed<readonly CatalogEntry[]>(() =>
    (this.carrier()?.products ?? []).flatMap((product): CatalogEntry[] =>
      product.plans.length === 0
        ? [{ product, plan: null }]
        : product.plans.map((plan) => ({ product, plan })),
    ),
  );

  /** La página pedida recortada al rango real: borrar el último plan no deja una página vacía. */
  protected readonly paginaActual = computed(() =>
    Math.min(Math.max(1, this.pagina()), Math.max(1, this.entradas().length)),
  );
  protected readonly entradaActual = computed(
    () => this.entradas()[this.paginaActual() - 1] ?? null,
  );
  protected readonly planEditor = signal<{
    readonly product: Product;
    readonly plan: Plan | null;
  } | null>(null);
  protected readonly benefitEditor = signal<{
    readonly plan: Plan;
    readonly benefit: PlanBenefit | null;
  } | null>(null);
  protected readonly rulesEditor = signal<{
    readonly plan: Plan;
    readonly benefit: PlanBenefit;
  } | null>(null);
  protected readonly premiumEditor = signal<Plan | null>(null);

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected planSaved(): void {
    const editor = this.planEditor();
    this.toasts.success(
      editor?.plan === null
        ? 'El producto seguro se creó correctamente.'
        : 'Los datos del producto seguro se actualizaron.',
    );
    this.reloadCarrier();
  }

  protected async deletePlan(plan: Plan): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: `Eliminar ${plan.name}`,
      message:
        plan.benefits.length === 0
          ? 'El producto seguro deja de ofrecerse.'
          : `El producto seguro deja de ofrecerse junto con sus ${plan.benefits.length} cláusulas.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) return;
    this.insurance.deletePlan(plan.id).subscribe({
      next: () => {
        this.toasts.success('El producto seguro se eliminó.');
        this.reloadCarrier();
      },
      error: () => this.toasts.error('No se pudo eliminar el producto seguro. Intente de nuevo.'),
    });
  }

  protected benefitSaved(update: UpdatePlanBenefitInput | null): void {
    const editor = this.benefitEditor();
    if (editor === null) return;
    if (update === null || editor.benefit === null) {
      this.toasts.success('La cláusula se añadió correctamente.');
      this.reloadCarrier();
      return;
    }
    this.patchBenefit(editor.plan.id, editor.benefit.id, update);
    this.toasts.success('La cláusula se actualizó correctamente.');
  }

  protected premiumSaved(monthlyPremiumAmount: string | null): void {
    const plan = this.premiumEditor();
    if (plan === null) return;
    this.patchPlan(plan.id, { monthlyPremiumAmount });
    this.toasts.success('La prima de lista se actualizó correctamente.');
  }

  protected rulesSaved(update: UpdatePlanBenefitRulesInput): void {
    const editor = this.rulesEditor();
    if (editor === null) return;
    this.patchBenefit(editor.plan.id, editor.benefit.id, {
      requiresPriorAuthorization: update.requiresPriorAuthorization,
      approvalRules: {
        requiredDocuments: update.requiredDocuments,
        exclusionNotes: update.exclusionNotes,
      },
    });
    this.toasts.success('Las reglas de aprobación se actualizaron.');
  }

  private load(): void {
    this.state.set(loading());
    this.insurance.listCarriers().subscribe({
      next: (directory) => {
        const first = directory.items[0];
        if (first === undefined) {
          this.state.set(
            empty(
              { label: 'Ver organizaciones', route: '/administration/organizations' },
              'Esta organización no tiene una aseguradora registrada. Se crea al dar de alta una organización de tipo aseguradora.',
            ),
          );
          return;
        }
        this.loadDetail(first);
      },
      error: (error: unknown) => this.state.set(errorToViewState<CarrierDetail>(error)),
    });
  }

  private loadDetail(carrier: CarrierSummary): void {
    this.insurance.getCarrier(carrier.id).subscribe({
      next: (detail) => this.state.set(ready(detail)),
      error: (error: unknown) => this.state.set(errorToViewState<CarrierDetail>(error)),
    });
  }

  private reloadCarrier(): void {
    const current = this.carrier();
    if (current === null) return;
    this.insurance.getCarrier(current.id).subscribe({
      next: (detail) => this.state.set(ready(detail)),
      error: (error: unknown) => this.state.set(errorToViewState<CarrierDetail>(error)),
    });
  }

  private patchPlan(planId: string, patch: Partial<Plan>): void {
    const current = this.carrier();
    if (current === null) return;
    this.state.set(
      ready({
        ...current,
        products: current.products.map((product) => ({
          ...product,
          plans: product.plans.map((plan) => (plan.id === planId ? { ...plan, ...patch } : plan)),
        })),
      }),
    );
  }

  private patchBenefit(planId: string, benefitId: string, patch: Partial<PlanBenefit>): void {
    const current = this.carrier();
    if (current === null) return;
    this.state.set(
      ready({
        ...current,
        products: current.products.map((product) => ({
          ...product,
          plans: product.plans.map((plan) =>
            plan.id !== planId
              ? plan
              : {
                  ...plan,
                  benefits: plan.benefits.map((benefit) =>
                    benefit.id === benefitId ? { ...benefit, ...patch } : benefit,
                  ),
                },
          ),
        })),
      }),
    );
  }
}
