import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import { AdmissionsClient } from '@core/data-access/admissions/admissions.client';
import type {
  AdmissionActionCode,
  AdmissionDetail as AdmissionDetailData,
  RequirementDecision,
} from '@core/data-access/admissions/admissions.types';
import { SessionStore } from '@core/auth/session.store';
import { errorToViewState } from '@core/http/error-to-view-state';
import { NavigationService } from '@core/navigation/navigation.service';
import { forbidden, loading, notFound, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { readAdmissionError } from '@shared/admissions/admission-error';
import {
  admissionStatusVariant,
  blockerText,
  isInReview,
  progressText,
  reasonCodeLabel,
} from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
import { Badge } from '@shared/components/atoms/badge/badge';
import { Alert } from '@shared/components/molecules/alert/alert';
import { Card } from '@shared/components/molecules/card/card';
import { Tab } from '@shared/components/molecules/tabs/tab/tab';
import { Tabs } from '@shared/components/molecules/tabs/tabs';
import { ToastService } from '@shared/components/molecules/toast/toast.service';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { ADMISSIONS_ROUTE } from '../admissions.routes';
import { AdmissionEvidenceGallery, type GalleryReviewRequest } from './admission-evidence-gallery';
import { AdmissionRequirements, type RequirementReviewRequest } from './admission-requirements';
import {
  AdmissionReviewDialog,
  type ReviewDialogConfig,
  type ReviewDialogResult,
} from './admission-review-dialog';
import { AdmissionSubmittedForm } from './admission-submitted-form';

/** Las pestañas, en orden. El orden es contrato de los enlaces entre ellas. */
export const TAB = { summary: 0, requirements: 1, documents: 2, form: 3, history: 4 } as const;

type DialogKind =
  | 'req-verify'
  | 'req-reject'
  | 'req-info'
  | 'request-info'
  | 'decide-verify'
  | 'decide-reject'
  | 'suspend'
  | 'reinstate'
  | 'reassign'
  | 'release';

interface ActiveDialog {
  readonly kind: DialogKind;
  readonly config: ReviewDialogConfig;
  /** La ficha que se revisa y el requisito al que pertenece. */
  readonly itemId?: string;
  readonly requirementCode?: string;
  /** La huella de la evidencia que se tenía en pantalla al abrir el diálogo. */
  readonly evidenceSha256?: string | null;
}

interface ActionButton {
  readonly key: string;
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  readonly disabled: boolean;
  readonly run: () => void;
}

const FOUR_EYES_NOTE =
  'La decisión final la toma una persona distinta de quienes revisaron los requisitos. La plataforma lo valida al confirmar.';

const ROLE_REVIEWER = 'ADMISSIONS_REVIEWER';
const ROLE_APPROVER = 'ADMISSIONS_APPROVER';

const EVENT_LABELS: Readonly<Record<string, string>> = {
  CREATED: 'Solicitud enviada',
  BACKFILLED: 'Solicitud migrada',
  SUBMITTED: 'Solicitud enviada',
  CLAIMED: 'Revisión tomada',
  RELEASED: 'Revisión liberada',
  REASSIGNED: 'Revisión reasignada',
  ITEM_VERIFIED: 'Requisito verificado',
  ITEM_REJECTED: 'Requisito rechazado',
  ITEM_INFO_REQUIRED: 'Información pedida sobre un requisito',
  INFO_REQUESTED: 'Información pedida al médico',
  VERIFIED: 'Admisión verificada',
  REJECTED: 'Admisión rechazada',
  SUSPENDED: 'Admisión suspendida',
  REINSTATED: 'Admisión repuesta',
  RESUBMITTED: 'Reenviada por el médico',
  EXPIRED: 'Verificación vencida',
  ABANDONED: 'Cerrada por falta de respuesta',
  WITHDRAWN: 'Retirada por el médico',
  DOCUMENT_VIEWED: 'Documento consultado',
};

/**
 * La ficha de una admisión: **una tarjeta, centrada y a lo ancho, con
 * pestañas** (resumen, requisitos, documentos, formulario llenado, historial).
 *
 * Lo principal es la verificación manual, requisito por requisito: cada uno
 * con sus documentos, su estado y las tres decisiones. La decisión final
 * («Verificar al profesional») se habilita solo cuando todos los obligatorios
 * están verificados, y dice por qué no cuando no lo está. La API valida igual.
 *
 * Toda escritura manda la versión que la persona vio (`expectedRowVersion`).
 * Si otra persona cambió la admisión (409), la pantalla no pierde lo que se
 * estaba escribiendo: ofrece «Ver cambios» y deja confirmar de nuevo.
 */
@Component({
  selector: 'app-admission-detail',
  imports: [
    Alert,
    AdmissionEvidenceGallery,
    AdmissionRequirements,
    AdmissionReviewDialog,
    AdmissionSubmittedForm,
    AppButton,
    Badge,
    Card,
    ContentDialog,
    DatePipe,
    PageHeader,
    RouterLink,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './admission-detail.html',
  styleUrl: './admission-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionDetail {
  private readonly client = inject(AdmissionsClient);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly listRoute = ADMISSIONS_ROUTE;
  protected readonly tab = signal<number>(TAB.summary);
  protected readonly TAB = TAB;

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly admissionId = computed(() => this.params().get('admissionId') ?? '');

  protected readonly state = signal<ViewState<AdmissionDetailData>>(loading());
  protected readonly detail = computed<AdmissionDetailData | null>(() => {
    const actual = this.state();
    return actual.status === 'ready' || actual.status === 'stale' ? actual.data : null;
  });

  protected readonly busy = signal(false);
  protected readonly dialog = signal<ActiveDialog | null>(null);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly dialogStale = signal(false);
  protected readonly notice = signal<{ tone: 'error' | 'warning' | 'info'; text: string } | null>(null);
  /** Región viva: lo que cambió, para quien no mira la pantalla. */
  protected readonly liveMessage = signal('');

  /** Estado de la galería, aquí para que no se pierda al ampliarla. */
  protected readonly galleryDoc = signal<string | null>(null);
  protected readonly galleryRequirement = signal('');
  protected readonly galleryState = signal('');
  protected readonly galleryAdvance = signal(0);
  protected readonly galleryExpanded = signal(false);
  protected readonly highlight = signal<string | null>(null);

  protected readonly statusVariant = computed(() => admissionStatusVariant(this.detail()?.status.code ?? ''));
  protected readonly progress = computed(() => {
    const d = this.detail();
    return d === null ? '' : progressText(d.requirementsSummary);
  });
  protected readonly missing = computed(() => (this.detail()?.requirements ?? []).filter((r) => r.mandatory && !r.satisfied));
  protected readonly inReview = computed(() => isInReview(this.detail()?.status.code ?? ''));
  protected readonly documentsTab = computed(() => `Documentos (${this.detail()?.documents.length ?? 0})`);

  protected readonly roles = this.session.roles;

  protected readonly overdueDays = computed(() => {
    const d = this.detail();
    if (d === null || !d.overdue || d.dueAt === null) return 0;
    return Math.max(1, Math.floor((Date.now() - d.dueAt.getTime()) / 86_400_000));
  });

  /** Si la admisión se puede revisar: el servidor lo dice; sin su respuesta, rol y estado. */
  protected readonly canReview = computed(() => this.allowed('REVIEW_REQUIREMENT'));

  constructor() {
    this.load();
  }

  /* ---- carga ---------------------------------------------------------------- */

  protected load(): void {
    this.state.set(loading());
    this.client.get(this.admissionId()).subscribe({
      next: (detalle) => this.state.set(ready(detalle)),
      error: (error: unknown) => this.state.set(this.loadFailure(error)),
    });
  }

  /**
   * Qué se muestra si la ficha no carga. El 403 se explica: quien tiene rol de
   * admisiones y es el propio profesional no revisa su solicitud, y a quien le
   * falta el rol se le dice cuál.
   */
  private loadFailure(error: unknown): ViewState<AdmissionDetailData> {
    const problema = readAdmissionError(error, ROLE_REVIEWER);
    if (problema.kind === 'self-access' || problema.kind === 'role') {
      return forbidden({
        message: problema.message,
        ...(problema.requestId === null ? {} : { requestId: problema.requestId }),
        nextAction: { label: 'Volver a las admisiones', route: ADMISSIONS_ROUTE },
      });
    }
    return errorToViewState<AdmissionDetailData>(error);
  }

  /** Relee la ficha sin parpadeo: se usa tras un 409 para mostrar lo que cambió. */
  protected refresh(announce = true): void {
    this.client.get(this.admissionId()).subscribe({
      next: (detalle) => {
        this.state.set(ready(detalle));
        this.dialogStale.set(false);
        if (announce) {
          this.dialogError.set('Cargamos la versión actual de la admisión. Revise los cambios y confirme de nuevo.');
          this.say('Se cargó la versión actual de la admisión.');
        }
      },
      error: (error: unknown) => this.state.set(this.loadFailure(error)),
    });
  }

  /* ---- qué se puede hacer ----------------------------------------------------- */

  /**
   * Qué se ofrece según el rol y el estado. La API no manda una lista de
   * acciones permitidas: autoriza cada petición (403/412 con su motivo), así
   * que esto solo decide qué botones se muestran, nunca qué se puede hacer.
   */
  protected action(code: AdmissionActionCode): { allowed: boolean; message?: string } {
    const d = this.detail();
    if (d === null) return { allowed: false };
    const status = d.status.code;
    const roles = this.roles();
    const wild = roles.includes('SUPERADMIN');
    // `SECURITY_ADMIN` hereda ambos roles solo si la API lo configura: se ofrece y la API decide.
    const security = roles.includes('SECURITY_ADMIN');
    const reviewer = wild || security || roles.includes(ROLE_REVIEWER);
    const approver = wild || security || roles.includes(ROLE_APPROVER);
    switch (code) {
      case 'CLAIM':
        return { allowed: reviewer && status === 'SUBMITTED' };
      case 'RELEASE':
        return { allowed: (reviewer || approver) && status === 'IN_REVIEW' };
      case 'REASSIGN':
        return { allowed: approver && status === 'IN_REVIEW' };
      case 'REQUEST_INFO':
      case 'REVIEW_REQUIREMENT':
        return { allowed: reviewer && status === 'IN_REVIEW' };
      case 'DECIDE':
        return {
          allowed: approver && status === 'IN_REVIEW',
          ...(d.fourEyesRequired ? { message: FOUR_EYES_NOTE } : {}),
        };
      case 'SUSPEND':
        return { allowed: approver && status === 'VERIFIED' };
      case 'REINSTATE':
        return { allowed: approver && status === 'SUSPENDED' };
    }
  }

  private allowed(code: AdmissionActionCode): boolean {
    return this.action(code).allowed;
  }

  /** Los botones de la barra de acciones según el estado. Un solo primario por estado. */
  protected readonly buttons = computed<readonly ActionButton[]>(() => {
    const d = this.detail();
    if (d === null) return [];
    const lista: ActionButton[] = [];
    const add = (b: ActionButton): void => void lista.push(b);
    switch (d.status.code) {
      case 'SUBMITTED':
        add({ key: 'claim', label: 'Tomar revisión', variant: 'primary', disabled: !this.allowed('CLAIM'), run: () => this.claim() });
        break;
      case 'IN_REVIEW': {
        const decide = this.action('DECIDE');
        add({ key: 'verify', label: 'Verificar al profesional', variant: 'primary', disabled: !decide.allowed || !d.canVerify, run: () => this.openDecision('VERIFIED') });
        if (decide.allowed) add({ key: 'reject', label: 'Rechazar admisión', variant: 'danger', disabled: false, run: () => this.openDecision('REJECTED') });
        if (this.allowed('REQUEST_INFO')) add({ key: 'info', label: 'Pedir información', variant: 'secondary', disabled: false, run: () => this.openRequestInfo() });
        if (this.allowed('RELEASE')) add({ key: 'release', label: 'Liberar', variant: 'ghost', disabled: false, run: () => this.openRelease() });
        if (this.allowed('REASSIGN')) add({ key: 'reassign', label: 'Reasignar', variant: 'ghost', disabled: false, run: () => this.openReassign() });
        break;
      }
      case 'VERIFIED':
        if (this.allowed('SUSPEND')) add({ key: 'suspend', label: 'Suspender', variant: 'danger', disabled: false, run: () => this.openSuspend() });
        break;
      case 'SUSPENDED':
        if (this.allowed('REINSTATE')) add({ key: 'reinstate', label: 'Reponer', variant: 'primary', disabled: false, run: () => this.openReinstate() });
        break;
    }
    return lista;
  });

  /** Por qué «Verificar al profesional» no está disponible, con las palabras de la API cuando las hay. */
  protected readonly verifyBlockers = computed<readonly string[]>(() => {
    const d = this.detail();
    if (d === null || d.status.code !== 'IN_REVIEW') return [];
    const razones: string[] = [];
    if (d.blockers.length > 0) razones.push(`Falta resolver: ${d.blockers.map(blockerText).join('; ')}.`);
    if (d.fourEyesRequired) razones.push(FOUR_EYES_NOTE);
    return razones;
  });

  protected readonly noActionsNote = computed(() => {
    const d = this.detail();
    if (d === null || this.buttons().length > 0) return null;
    const acciones = ['CLAIM', 'REQUEST_INFO', 'DECIDE', 'SUSPEND', 'REINSTATE'] as const;
    const con = acciones.map((a) => this.action(a)).find((a) => !a.allowed && a.message !== undefined);
    return con?.message ?? null;
  });

  /* ---- acciones ---------------------------------------------------------------- */

  protected claim(): void {
    const d = this.detail();
    if (d === null) return;
    this.execute(() => this.client.claim(d.id, { expectedRowVersion: d.rowVersion }), 'Tomó la revisión de esta admisión.', ROLE_REVIEWER);
  }

  protected openRelease(): void {
    this.openDialog({
      kind: 'release',
      config: {
        heading: 'Liberar la revisión',
        description: 'La admisión vuelve a la cola para que otra persona la tome.',
        confirmLabel: 'Liberar',
        warning: 'Lo que ya verificó o rechazó se conserva en el historial.',
      },
    });
  }

  protected openReassign(): void {
    this.openDialog({
      kind: 'reassign',
      config: {
        heading: 'Reasignar la revisión',
        description: 'Escriba el id de la cuenta del revisor que recibe la admisión.',
        confirmLabel: 'Reasignar',
        assigneeById: true,
      },
    });
  }

  protected openRequestInfo(): void {
    this.openDialog({
      kind: 'request-info',
      config: {
        heading: 'Pedir información al médico',
        description: 'El médico recibe el pedido y puede corregir y reenviar. El plazo de revisión se pausa.',
        confirmLabel: 'Pedir información',
        reason: { label: 'Qué debe completar o corregir (lo lee el médico)', withCode: true, note: true },
      },
    });
  }

  protected openDecision(decision: 'VERIFIED' | 'REJECTED'): void {
    const d = this.detail();
    if (d === null) return;
    if (decision === 'VERIFIED') {
      this.openDialog({
        kind: 'decide-verify',
        config: {
          heading: 'Verificar al profesional',
          description: d.practitioner.fullName,
          confirmLabel: 'Verificar al profesional',
          warning: 'Es la decisión final: el profesional pasa a figurar como verificado. Después solo se puede suspender.',
          summary: [this.progress(), ...(d.requirementsSummary.rejected > 0 ? [`${d.requirementsSummary.rejected} requisito(s) rechazado(s) quedan en el historial.`] : [])],
        },
      });
    } else {
      this.openDialog({
        kind: 'decide-reject',
        config: {
          heading: 'Rechazar la admisión',
          description: d.practitioner.fullName,
          confirmLabel: 'Rechazar admisión',
          destructive: true,
          warning: 'El médico recibe el motivo. Podrá corregir y reenviar, con un máximo de reenvíos.',
          summary: [this.progress()],
          reason: { label: 'Motivo del rechazo (lo lee el médico)', withCode: true, note: true },
        },
      });
    }
  }

  protected openSuspend(): void {
    this.openDialog({
      kind: 'suspend',
      config: {
        heading: 'Suspender la verificación',
        confirmLabel: 'Suspender',
        destructive: true,
        warning: 'El profesional deja de figurar como verificado hasta que se lo reponga.',
        reason: { label: 'Motivo de la suspensión', withCode: true, note: true },
      },
    });
  }

  protected openReinstate(): void {
    this.openDialog({
      kind: 'reinstate',
      config: {
        heading: 'Reponer la verificación',
        confirmLabel: 'Reponer',
        reason: { label: 'Motivo de la reposición', withCode: false, note: false },
      },
    });
  }

  protected openRequirementReview(request: RequirementReviewRequest): void {
    const requisito = this.detail()?.requirements.find((r) => r.code === request.requirementCode);
    const ficha = requisito?.items.find((i) => i.itemId === request.itemId);
    if (requisito === undefined || ficha === undefined) return;
    // La huella se toma AHORA, de lo que la persona tiene en pantalla: si el
    // médico cambia algo mientras escribe, la API lo detecta (409) y no se decide a ciegas.
    const comun = { itemId: ficha.itemId, requirementCode: requisito.code, evidenceSha256: ficha.evidenceSha256 } as const;
    if (request.decision === 'VERIFIED') {
      this.openDialog({
        kind: 'req-verify',
        ...comun,
        config: {
          heading: `Verificar: ${ficha.label}`,
          description: requisito.requiresSource
            ? 'Declare de dónde obtuvo el dato. Queda en el historial.'
            : 'Si consultó una fuente, decláquela; queda en el historial.',
          confirmLabel: 'Verificar',
          source: true,
          sourceOptional: !requisito.requiresSource,
        },
      });
    } else if (request.decision === 'REJECTED') {
      this.openDialog({
        kind: 'req-reject',
        ...comun,
        config: {
          heading: `Rechazar: ${ficha.label}`,
          confirmLabel: 'Rechazar',
          destructive: true,
          reason: { label: 'Qué está mal (lo lee el médico)', withCode: true, note: true },
        },
      });
    } else {
      this.openDialog({
        kind: 'req-info',
        ...comun,
        config: {
          heading: `Pedir información: ${ficha.label}`,
          confirmLabel: 'Pedir información',
          reason: { label: 'Qué falta (lo lee el médico)', withCode: true, note: true },
        },
      });
    }
  }

  protected onGalleryReview(request: GalleryReviewRequest): void {
    this.galleryExpanded.set(false);
    this.openRequirementReview(request);
  }

  private openDialog(dialog: ActiveDialog): void {
    this.dialogError.set(null);
    this.dialogStale.set(false);
    this.dialog.set(dialog);
  }

  protected closeDialog(): void {
    if (!this.busy()) this.dialog.set(null);
  }

  protected confirmDialog(result: ReviewDialogResult): void {
    const d = this.detail();
    const activo = this.dialog();
    if (d === null || activo === null) return;
    const v = d.rowVersion;
    const razon = {
      ...(result.reasonCode === undefined ? {} : { reasonCode: result.reasonCode }),
      ...(result.internalNote === undefined ? {} : { internalNote: result.internalNote }),
    };
    switch (activo.kind) {
      case 'req-verify':
      case 'req-reject':
      case 'req-info': {
        const decision: RequirementDecision = activo.kind === 'req-verify' ? 'VERIFIED' : activo.kind === 'req-reject' ? 'REJECTED' : 'INFO_REQUIRED';
        const mensajes = { VERIFIED: 'Requisito verificado.', REJECTED: 'Requisito rechazado.', INFO_REQUIRED: 'Se pidió información sobre el requisito.' };
        // La versión es la de la FICHA, leída de la ficha vigente (tras un «Ver cambios» es la nueva).
        const ficha = d.requirements
          .find((r) => r.code === activo.requirementCode)
          ?.items.find((i) => i.itemId === activo.itemId);
        if (ficha === undefined || ficha.id === null || ficha.rowVersion === null) {
          this.dialogError.set('Esa ficha todavía no se puede revisar: tome la revisión de la admisión primero.');
          return;
        }
        const itemVersion = ficha.rowVersion;
        const reviewId = ficha.id;
        this.execute(
          () => this.client.reviewRequirement(d.id, reviewId, {
            decision,
            ...(result.sourceType === undefined ? {} : { sourceType: result.sourceType }),
            ...(result.sourceRef === undefined ? {} : { sourceRef: result.sourceRef }),
            ...(result.sourceConsultedAt === undefined ? {} : { sourceConsultedAt: result.sourceConsultedAt }),
            ...(result.reason === undefined ? {} : { reason: result.reason }),
            ...razon,
            ...(activo.evidenceSha256 ? { evidenceSha256: activo.evidenceSha256 } : {}),
            expectedRowVersion: itemVersion,
          }),
          mensajes[decision],
          ROLE_REVIEWER,
          () => this.galleryAdvance.update((n) => n + 1),
        );
        break;
      }
      case 'request-info':
        this.execute(() => this.client.requestInfo(d.id, { reason: result.reason ?? '', ...razon, expectedRowVersion: v }), 'Se pidió información al médico.', ROLE_REVIEWER);
        break;
      case 'decide-verify':
        this.execute(() => this.client.decide(d.id, { decision: 'VERIFIED', expectedRowVersion: v }), 'El profesional quedó verificado.', ROLE_APPROVER);
        break;
      case 'decide-reject':
        this.execute(() => this.client.decide(d.id, { decision: 'REJECTED', reason: result.reason ?? '', ...razon, expectedRowVersion: v }), 'La admisión fue rechazada.', ROLE_APPROVER);
        break;
      case 'suspend':
        this.execute(() => this.client.suspend(d.id, { reason: result.reason ?? '', ...razon, expectedRowVersion: v }), 'La verificación quedó suspendida.', ROLE_APPROVER);
        break;
      case 'reinstate':
        this.execute(() => this.client.reinstate(d.id, { reason: result.reason ?? '', expectedRowVersion: v }), 'La verificación fue repuesta.', ROLE_APPROVER);
        break;
      case 'reassign':
        this.execute(() => this.client.reassign(d.id, { toUserId: result.assigneeId ?? '', expectedRowVersion: v }), 'La revisión fue reasignada.', ROLE_APPROVER);
        break;
      case 'release':
        this.execute(() => this.client.release(d.id, { expectedRowVersion: v }), 'La revisión volvió a la cola.', ROLE_REVIEWER);
        break;
    }
  }

  /**
   * Corre una escritura. Una sola a la vez: un segundo clic mientras viaja no
   * hace nada (`busy`). Si sale bien, la ficha se reemplaza por la respuesta;
   * si sale mal, se dice por qué sin cerrar lo que la persona estaba escribiendo.
   */
  private execute(
    call: () => Observable<AdmissionDetailData>,
    success: string,
    fallbackRole: string,
    afterOk?: () => void,
  ): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.dialogError.set(null);
    this.notice.set(null);
    call().subscribe({
      next: (detalle) => {
        this.state.set(ready(detalle));
        this.busy.set(false);
        this.dialog.set(null);
        this.dialogStale.set(false);
        this.toast.success(success);
        this.say(success);
        afterOk?.();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const problema = readAdmissionError(error, fallbackRole);
        if (problema.kind === 'not-found') {
          this.dialog.set(null);
          this.state.set(notFound({ label: 'Volver a las admisiones', route: ADMISSIONS_ROUTE }));
          return;
        }
        if (problema.kind === 'evidence-changed') {
          // El profesional reemplazó el documento mientras se lo miraba: no se
          // decide a ciegas. Se cierra el formulario y se muestra lo nuevo.
          this.dialog.set(null);
          this.notice.set({ tone: 'warning', text: problema.message });
          this.refresh(false);
        } else if (this.dialog() !== null) {
          if (problema.kind === 'stale') this.dialogStale.set(true);
          else this.dialogError.set(problema.message);
        } else if (problema.kind === 'stale') {
          this.notice.set({ tone: 'warning', text: problema.message });
          this.refresh();
        } else {
          this.notice.set({ tone: 'error', text: problema.message });
        }
        this.say(problema.message);
      },
    });
  }

  private say(texto: string): void {
    this.liveMessage.set(texto);
  }

  /* ---- navegación entre pestañas ---------------------------------------------- */

  protected showEvidence(requirementCode: string): void {
    this.galleryRequirement.set(requirementCode);
    this.galleryState.set('');
    const primero = this.detail()?.documents.find((x) => x.requirementCode === requirementCode);
    if (primero !== undefined) this.galleryDoc.set(primero.id);
    this.tab.set(TAB.documents);
  }

  protected showDocument(documentId: string): void {
    this.galleryRequirement.set('');
    this.galleryState.set('');
    this.galleryDoc.set(documentId);
    this.tab.set(TAB.documents);
  }

  protected showField(requirementCode: string): void {
    this.galleryExpanded.set(false);
    this.highlight.set(requirementCode);
    this.tab.set(TAB.form);
  }

  protected showRequirement(requirementCode: string): void {
    this.highlight.set(requirementCode);
    this.tab.set(TAB.requirements);
  }

  /* ---- presentación -------------------------------------------------------------- */

  protected eventLabel(type: string): string {
    return EVENT_LABELS[type] ?? type;
  }

  protected reasonLabel(code: string | null): string {
    return reasonCodeLabel(code);
  }

  protected requirementLabel(code: string | null): string | null {
    if (code === null) return null;
    return this.detail()?.requirements.find((r) => r.code === code)?.label ?? null;
  }
}
