import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, type Subscription } from 'rxjs';

import { PriorAuthorizationClient } from '../../../core/data-access/insurance/prior-authorization.client';
import type {
  PriorAuthorizationDetail,
  PriorAuthorizationItem,
  PriorAuthorizationItemDecisionInput,
} from '../../../core/data-access/insurance/prior-authorization.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { apiErrorMessage } from '../insurance-catalog/insurance-form.helpers';
import { amountText, originLabel, patientName, statusBadge } from '../prior-authorization-labels';
import { DenyItemDialog, type DenyItemReason } from './deny-item-dialog';

/** Lo que la aseguradora ya eligió para un ítem y todavía no envió. */
type Borrador =
  | { readonly decision: 'APPROVED' }
  | ({ readonly decision: 'DENIED' } & DenyItemReason);

const APROBAR: RowAction = { code: 'approve', label: 'Aprobar', icon: 'check' };
const NO_APROBAR: RowAction = {
  code: 'deny',
  label: 'No aprobar',
  icon: 'close',
  destructive: true,
};

/**
 * Detalle de una solicitud de aprobación, del lado de la aseguradora —
 * `administration/insurance-approvals/:requestId`.
 *
 * Registro de procesos · MÓDULO ASEGURADORA · «Recepción de solicitudes de
 * órdenes de Aprobación» · 3: responder «APROBADO y NO APROBADO indicando por
 * qué no está APROBADO según la cláusula del contrato». Es lo que el paciente
 * recibe después: «de los 5 medicamentos aprueban 3 y 2 no, con el motivo
 * según póliza».
 *
 * ## Se decide ítem por ítem y se envía todo junto
 *
 * Cada fila tiene «Aprobar» y «No aprobar»; lo elegido queda como
 * **borrador** en pantalla hasta que se envía la respuesta. Se envía todo
 * junto porque la API lo exige así —cada ítem se decide exactamente una vez,
 * en una sola determinación— y porque una respuesta a medias no le sirve al
 * paciente. «No aprobar» abre un modal que pide la cláusula
 * (`composition-rules.md` §6: la fila no despliega formularios).
 *
 * ## La decisión global la calcula el servidor
 *
 * Aprobada, parcial o no aprobada sale de los ítems. La pantalla muestra el
 * resumen que va a resultar, pero lo que queda registrado es lo que devuelve
 * la API al recargar —un toast no prueba nada—.
 */
@Component({
  selector: 'app-insurance-approval-detail',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    Badge,
    Card,
    DenyItemDialog,
    PageHeader,
    RouterLink,
    RowActions,
    ViewStateHost,
  ],
  templateUrl: './insurance-approval-detail.html',
  styleUrl: './insurance-approval-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceApprovalDetail {
  private readonly client = inject(PriorAuthorizationClient);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  /** La lectura en vuelo: otra solicitud (`:requestId` nuevo) la cancela. */
  private pedido: Subscription | null = null;

  private readonly requestId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('requestId') ?? '')),
    { initialValue: '' },
  );

  protected readonly state = signal<ViewState<PriorAuthorizationDetail>>(loading());
  protected readonly request = computed(() => dataOf(this.state()) ?? null);

  /** Se puede responder mientras no hay determinación. */
  protected readonly pending = computed(() => this.request()?.status !== 'DETERMINED');

  /** Borradores por id de ítem. Se pierden al recargar: no son una respuesta. */
  protected readonly drafts = signal<ReadonlyMap<string, Borrador>>(new Map());

  /** El ítem cuyo modal «No aprobar» está abierto. */
  protected readonly denying = signal<PriorAuthorizationItem | null>(null);

  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);

  protected readonly rowActions: readonly RowAction[] = [APROBAR, NO_APROBAR];

  protected readonly tally = computed(() => {
    const items = this.request()?.items ?? [];
    const drafts = this.drafts();
    const approved = items.filter((i) => drafts.get(i.id)?.decision === 'APPROVED').length;
    const denied = items.filter((i) => drafts.get(i.id)?.decision === 'DENIED').length;
    return { total: items.length, approved, denied, missing: items.length - approved - denied };
  });

  /** Cómo va a quedar la respuesta, en palabras, antes de enviarla. */
  protected readonly outcomeText = computed(() => {
    const { total, approved, denied, missing } = this.tally();
    if (missing > 0) {
      return `Faltan ${missing} de ${total} ${total === 1 ? 'ítem' : 'ítems'} por decidir.`;
    }
    if (denied === 0) return 'Aprobación completa: se aprueban todos los ítems.';
    if (approved === 0) return 'No aprobada: no se aprueba ningún ítem.';
    return `Aprobación parcial: ${approved} ${approved === 1 ? 'aprobado' : 'aprobados'} y ${denied} ${denied === 1 ? 'no aprobado' : 'no aprobados'}.`;
  });

  protected readonly patientName = patientName;
  protected readonly originLabel = originLabel;
  protected readonly statusBadge = statusBadge;
  protected readonly amountText = amountText;

  constructor() {
    // Con la ruta reutilizada (historial entre dos detalles), el componente no
    // se reconstruye: la carga sigue al parámetro, no al constructor.
    effect(() => {
      this.requestId();
      untracked(() => this.load());
    });
  }

  protected retry(): void {
    this.load();
  }

  protected draftOf(item: PriorAuthorizationItem): Borrador | null {
    return this.drafts().get(item.id) ?? null;
  }

  protected onRowAction(code: string, item: PriorAuthorizationItem): void {
    if (code === APROBAR.code) this.setDraft(item.id, { decision: 'APPROVED' });
    else if (code === NO_APROBAR.code) this.denying.set(item);
  }

  protected onDenied(item: PriorAuthorizationItem, reason: DenyItemReason): void {
    this.setDraft(item.id, { decision: 'DENIED', ...reason });
  }

  /** «Aprobar los que faltan»: no pisa lo que ya se marcó como no aprobado. */
  protected approveRemaining(): void {
    const items = this.request()?.items ?? [];
    const next = new Map(this.drafts());
    for (const item of items) {
      if (!next.has(item.id)) next.set(item.id, { decision: 'APPROVED' });
    }
    this.drafts.set(next);
  }

  protected rowName(item: PriorAuthorizationItem): string {
    return `el ítem ${item.sequence}, ${item.description}`;
  }

  protected async send(): Promise<void> {
    const detail = this.request();
    if (!detail || this.sending() || this.tally().missing > 0) return;

    const confirmed = await this.dialogs.confirm({
      title: 'Enviar la respuesta',
      message:
        `${this.outcomeText()} La respuesta llega al paciente y al prestador, ` +
        'y no se puede cambiar desde acá.',
      confirmLabel: 'Enviar respuesta',
    });
    if (!confirmed) return;

    const drafts = this.drafts();
    const items: PriorAuthorizationItemDecisionInput[] = detail.items.map((item) => {
      const draft = drafts.get(item.id)!;
      return draft.decision === 'APPROVED'
        ? { priorAuthorizationItemId: item.id, decision: 'APPROVED' }
        : {
            priorAuthorizationItemId: item.id,
            decision: 'DENIED',
            policyClauseReference: draft.policyClauseReference,
            ...(draft.denialRationale ? { denialRationale: draft.denialRationale } : {}),
          };
    });

    this.sending.set(true);
    this.sendError.set(null);
    this.client.decide(detail.id, items).subscribe({
      next: () => {
        this.sending.set(false);
        this.toast.show({ type: 'success', message: 'La respuesta quedó enviada.' });
        // Se relee: lo que queda registrado lo dice el servidor, no el borrador.
        this.load({ enfocar: true });
      },
      error: (error: unknown) => {
        this.sending.set(false);
        if (
          error instanceof HttpErrorResponse &&
          readApiError(error)?.code === 'PRECONDITION_FAILED'
        ) {
          // 422: la solicitud ya no admite respuesta —la respondió alguien
          // más—. Reintentar sólo repetiría el 422: se avisa y se muestra lo
          // que quedó registrado, que reemplaza al borrador.
          this.toast.show({ type: 'warning', message: apiErrorMessage(error) });
          this.load({ enfocar: true });
          return;
        }
        // Lo demás (red, 5xx, validación) se puede reintentar: el borrador se
        // conserva para no obligar a rehacer todo.
        this.sendError.set(apiErrorMessage(error));
      },
    });
  }

  private setDraft(itemId: string, draft: Borrador): void {
    const next = new Map(this.drafts());
    next.set(itemId, draft);
    this.drafts.set(next);
  }

  /**
   * @param opciones.enfocar - Tras enviar, la tarjeta se vuelve a montar y el
   *   botón que tenía el foco desaparece: el foco va al título de la ficha en
   *   vez de caer al `<body>`.
   */
  private load(opciones: { enfocar?: boolean } = {}): void {
    const id = this.requestId();
    if (id === '') return;
    this.state.set(loading());
    this.drafts.set(new Map());
    this.sendError.set(null);
    this.pedido?.unsubscribe();
    this.pedido = this.client.get(id).subscribe({
      next: (detail) => {
        this.state.set(ready(detail));
        if (opciones.enfocar) {
          afterNextRender(() => document.getElementById('approval-general')?.focus(), {
            injector: this.injector,
          });
        }
      },
      error: (error: unknown) => this.state.set(this.errorState(error)),
    });
  }

  /**
   * La API responde el mismo 403 para una solicitud ajena y para una que no
   * existe: la pantalla no puede afirmar que existe. Es S6 (no encontrado, sin
   * filtrar existencia) con salida a la bandeja, no el muro de S5.
   */
  private errorState(error: unknown): ViewState<PriorAuthorizationDetail> {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return notFound({ label: 'Volver a la bandeja', route: '/administration/insurance-approvals' });
    }
    return errorToViewState<PriorAuthorizationDetail>(error);
  }
}
