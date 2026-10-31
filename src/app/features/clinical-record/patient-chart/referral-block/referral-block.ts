import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  REFERRAL_TARGET_MIN_QUERY,
  ReferralsClient,
} from '../../../../core/data-access/referrals/referrals.client';
import { referralErrorDetail } from '../../../../core/data-access/referrals/referrals.errors';
import { transferIssues } from '../../../../core/data-access/referrals/referral-transfer.types';
import {
  REFERRAL_LIMITS,
  REFERRAL_TYPES_WITH_CONSENT,
  referralIssues,
  type NewReferral,
  type Referral,
  type ReferralIssue,
  type ReferralTarget,
  type ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Divider } from '../../../../shared/components/atoms/divider/divider';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { revealAfterRender } from '../../reveal';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { InformedConsentBadge } from '../informed-consent/informed-consent-badge';
import { patientConsents } from '../informed-consent/patient-consents';
import {
  buildNewReferral,
  DEFAULT_REFERRAL_TYPE,
  reasonHintFor,
  referralTabLabels,
  REFERRAL_TYPE_OPTIONS,
  SERVICE_EXAMPLE,
  inFormOrder,
  requestedServiceMessage,
  submissionMessage,
  submitBlocker,
  TARGET_KIND_OPTIONS,
  toReferralRow,
  type IssuedReferral,
  type ReferralDestinationKind,
  type ReferralRow,
} from './referral-block.model';
import { ReferralDetail } from './referral-detail';
import { referralDetailState } from './referral-detail-state';
import { ReferralTargetBranches } from './referral-target-branches';
import { ReferralTargetSearch } from './referral-target-search';
import { ReferralTargetServices } from './referral-target-services';
import { ReferralTransferForm } from './referral-transfer-form';
import { emptyTransferDraft, transferFromDraft, type TransferDraft } from './referral-transfer.model';

/** El motivo cabe en el aviso de la persona: el servidor lo corta a este largo. */
const REASON_MAX_LENGTH = 500;

/**
 * **Derivar** — el médico recomienda a la persona que consulte con otro
 * profesional (pedido del propietario, 24/10/2026), o la deriva a una
 * organización médica, por **un servicio concreto** de su catálogo («tipo
 * tratamiento», pedido del cliente, 28/10/2026).
 *
 * Uso: `<app-referral-block [patientProfileId] [encounterId] [referrals]
 * [offersOpenEncounter] (cambio) (retry) (openEncounter) />`.
 *
 * ## El recorrido
 *
 * Profesional u organización → buscar por nombre en la API → (opcional) uno
 * de sus servicios, con el arancel a la vista → tipo (Tratamiento por defecto)
 * → motivo y vigencia. Con un profesional o una organización de la plataforma
 * la API puede avisarle a la persona (si tiene cuenta de portal; la respuesta
 * no dice si salió, y los textos no lo prometen); a un externo no. **No
 * reserva nada**.
 *
 * ## Sin encuentro no hay derivación con aviso
 *
 * El encuentro es lo que demuestra que quien deriva atendió a esa persona; sin
 * él la API guarda la derivación pero no avisa, y un formulario que parece
 * funcionar y no avisa a nadie es peor que uno que dice qué falta. Sin
 * encuentro abierto el bloque lo dice y no ofrece el formulario; la lista de
 * lo ya derivado se sigue viendo. Si quien lo monta sabe abrir el encuentro
 * (`offersOpenEncounter`), el aviso ofrece ir a hacerlo (`openEncounter`).
 *
 * ## La lista la lee quien monta el bloque
 *
 * Igual que las recetas: la consulta la necesita para el contador de la
 * casilla, y dos lecturas de la misma lista pueden discrepar. Sin `referrals`
 * el bloque no dibuja la lista. Tras **emitir**, la relectura no depende de
 * este bloque: `ConsultationReferrals` escucha `ReferralsClient.issued`, que
 * llega aunque el modal se haya cerrado con el envío en vuelo.
 *
 * ## v4266: sede, externo, lo clínico, detalle y consentimiento
 *
 * Con una organización se ofrecen sus sedes (`targetBranchId`); «Externo» no
 * se busca, se escribe (`targetExternalName`/`Contact`) y no recibe aviso. Sin
 * un servicio del catálogo, la API exige el servicio en texto y el resumen
 * clínico (`referralIssues`, al enviar, con el error junto al campo). Cada
 * fila abre su detalle en modal (`app-referral-detail`): responder, contra-
 * rreferir y anular. Emitida una que lo pide, el detalle se abre solo con el
 * consentimiento dirigido; el vínculo lo escribe la API (`informedConsentId`).
 *
 * ## v4274: traslado
 *
 * UNA tarjeta con dos pestañas: «Derivación» y «Traslado»
 * (`app-referral-transfer-form`). El borrador del traslado vive acá porque
 * `app-tab` no dibuja el panel cerrado. Lo traducible vive aparte
 * (`referral-block.model.ts`, `referral-transfer.model.ts`), igual que la
 * búsqueda de destinos (`referral-target-search.ts`), los servicios y las
 * sedes del destino (`referral-target-services.ts`, `-branches.ts`). El resultado del envío va junto
 * al botón, con el foco: a 390 px un aviso arriba quedaba fuera de vista.
 */
@Component({
  selector: 'app-referral-block',
  imports: [
    Alert,
    AppButton,
    AppInput,
    Card,
    ContentDialog,
    DatePicker,
    DatePipe,
    Divider,
    FormField,
    InformedConsentBadge,
    NgTemplateOutlet,
    ReferenceCombobox,
    ReferralDetail,
    SegmentedControl,
    Select,
    ReferralTransferForm,
    StatusSeal,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './referral-block.html',
  styleUrl: './referral-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralBlock {
  private readonly referralsClient = inject(ReferralsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** La persona que se deriva. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, o `null` si no hay uno abierto. */
  readonly encounterId = input<string | null>(null);

  /** Las derivaciones de la persona, leídas por quien monta el bloque; `null` no dibuja la lista. */
  readonly referrals = input<ViewState<readonly Referral[]> | null>(null);

  /**
   * Avisa que una derivación cambió desde su detalle (respuesta,
   * contrarreferencia, anulación, consentimiento), para que quien monta el
   * bloque relea. La emisión no pasa por acá: ver `ReferralsClient.issued`.
   */
  readonly cambio = output<void>();

  /** Sin encuentro: quien monta el bloque sabe abrirlo y lo ofrece. */
  readonly offersOpenEncounter = input(false);

  /** La persona pidió ir a abrir el encuentro. */
  readonly openEncounter = output<void>();

  /** Falló una relectura con la lista ya a la vista (`ConsultationReferrals.refreshError`). */
  readonly refreshError = input<string | null>(null);

  /** La lista falló y la persona pidió reintentar. */
  readonly retry = output<void>();

  /**
   * Si esta sesión puede escribir en la historia. En la consulta, siempre; en
   * el expediente lo dice el anfitrión. La API vuelve a decidir.
   */
  readonly canWrite = input(true);

  /** Las citas de la persona: el consentimiento de una derivación se ata a una atención. */
  readonly appointments = input<readonly CitaDelPaciente[]>([]);

  protected readonly targetKindOptions = TARGET_KIND_OPTIONS;
  protected readonly typeOptions = REFERRAL_TYPE_OPTIONS;
  protected readonly minQueryLength = REFERRAL_TARGET_MIN_QUERY;
  protected readonly reasonMaxLength = REASON_MAX_LENGTH;
  protected readonly limits = REFERRAL_LIMITS;
  protected readonly today = new Date();

  protected readonly noEncounter = computed(() => this.encounterId() === null);

  /* -- El destino ---------------------------------------------------------- */

  protected readonly kind = signal<ReferralDestinationKind>('PRACTITIONER');
  protected readonly target = signal<ReferralTarget | null>(null);

  /** La búsqueda de destinos: una respuesta vieja nunca repuebla las opciones. */
  private readonly targetSearch = new ReferralTargetSearch(() => this.kind());
  protected readonly searching = this.targetSearch.searching;
  protected readonly searchError = this.targetSearch.error;
  protected readonly targetOptions = this.targetSearch.options;

  /**
   * Alterna en cada derivación para volver a montar el buscador. El combobox
   * guarda su propio texto y no lo borra cuando el valor vuelve a `null`; sin
   * esto quedaría escrito el nombre de alguien que ya no está elegido.
   */
  protected readonly remountToggle = signal(true);

  /* -- La sede (organización) o el destino externo ----------------------- */

  /** Las sedes de la organización elegida (sólo si pertenece a ella). */
  private readonly targetBranches = new ReferralTargetBranches(() => this.target());
  protected readonly selectedBranch = this.targetBranches.selected;
  protected readonly branchOptions = this.targetBranches.options;
  protected readonly hasBranches = this.targetBranches.any;

  protected readonly externalName = signal<string | number | null>('');
  protected readonly externalContact = signal<string | number | null>('');

  /* -- Los servicios del destino ------------------------------------------ */

  /**
   * Los del destino elegido; una respuesta tardía de otro no pisa al nuevo.
   * Sin servicios se dice en línea, dentro del campo, con sus dos salidas: un
   * S3 de página en medio del formulario empujaba el resto 290 px.
   */
  private readonly targetServices = new ReferralTargetServices(() => this.target());
  protected readonly services = this.targetServices.state;
  protected readonly selectedService = this.targetServices.selected;
  protected readonly noServices = this.targetServices.none;
  protected readonly serviceOptions = this.targetServices.options;
  protected readonly serviceHint = this.targetServices.hint;
  protected readonly serviceFailure = this.targetServices.failure;

  /* -- El resto del formulario -------------------------------------------- */

  protected readonly referralType = signal<ReferralType | null>(DEFAULT_REFERRAL_TYPE);
  protected readonly reason = signal('');

  /** Dónde ve la persona el motivo, según la clase de destino. */
  protected readonly reasonHint = computed(() => reasonHintFor(this.kind()));
  protected readonly validUntil = signal<Date | null>(null);

  /* -- Lo clínico (norma de referencia) ------------------------------------ */

  protected readonly requestedService = signal('');
  protected readonly clinicalSummary = signal('');
  protected readonly diagnosis = signal('');
  protected readonly treatmentGiven = signal('');

  /** El ejemplo del servicio, según el tipo elegido. */
  protected readonly serviceExample = computed(() => SERVICE_EXAMPLE[this.referralType() ?? DEFAULT_REFERRAL_TYPE]);

  /** Sin un servicio del catálogo, el texto y el resumen son obligatorios (regla de la API). */
  protected readonly describedByHand = computed(
    () => this.referralType() !== null && this.selectedService() === null,
  );

  /* -- El traslado (pestaña 2) -------------------------------------------- */

  protected readonly tab = signal(0);
  protected readonly transferDraft = signal<TransferDraft>(emptyTransferDraft());
  /** En el orden de la pestaña, para que el resumen se lea como el formulario. */
  protected readonly transferProblems = computed(() =>
    inFormOrder(transferIssues(transferFromDraft(this.transferDraft()))),
  );

  /** El rótulo de cada pestaña, con «falta algo» después de intentar derivar. */
  protected readonly tabLabels = computed(() =>
    referralTabLabels(this.attempted(), this.issues().length === 0, this.transferProblems().length === 0),
  );

  /** Se intentó enviar: desde ahí los errores se muestran junto a cada campo. */
  protected readonly attempted = signal(false);
  protected readonly issues = computed<readonly ReferralIssue[]>(() =>
    // Falta el servicio pedido: el texto depende de si hay catálogo que elegir.
    referralIssues(this.body() ?? {}).map((issue) =>
      issue.field === 'requestedServiceText' && this.requestedService().trim() === ''
        ? { ...issue, message: requestedServiceMessage(this.kind(), this.noServices()) }
        : issue,
    ),
  );
  protected issueFor(field: ReferralIssue['field']): string {
    if (!this.attempted()) return '';
    return this.issues().find((issue) => issue.field === field)?.message ?? '';
  }

  protected readonly sending = signal(false);
  protected readonly submission = signal<ViewState<null>>(ready(null));
  protected readonly issued = signal<IssuedReferral | null>(null);
  protected readonly duplicate = signal(false);

  /** El lugar del resultado, junto al botón: recibe el foco al llegar. */
  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');

  /** Hay destino: uno de la plataforma elegido, o el nombre del externo escrito. */
  protected readonly hasTarget = computed(() =>
    this.kind() === 'EXTERNAL' ? String(this.externalName() ?? '').trim() !== '' : this.target() !== null,
  );

  /** Por qué el botón está apagado, junto a él; `null` si no lo está. */
  protected readonly submitHint = computed(() =>
    this.sending() ? null : submitBlocker(this.kind(), this.hasTarget(), this.reason().length > REASON_MAX_LENGTH),
  );

  protected readonly canSubmit = computed(
    () =>
      this.canWrite() &&
      !this.noEncounter() &&
      this.hasTarget() &&
      !this.sending() &&
      this.reason().length <= REASON_MAX_LENGTH,
  );

  /**
   * El cuerpo de `POST /referrals`, ya recortado. Los opcionales sin elegir se
   * **omiten**: el backend valida con `forbidNonWhitelisted`.
   */
  private readonly body = computed<NewReferral | null>(() => {
    const encounter = this.encounterId();
    return encounter === null
      ? null
      : buildNewReferral({
          patientProfileId: this.patientProfileId(),
          sourceEncounterId: encounter,
          kind: this.kind(),
          target: this.target(),
          branchId: this.selectedBranch(),
          serviceId: this.selectedService(),
          referralType: this.referralType(),
          externalName: this.externalName(),
          externalContact: this.externalContact(),
          requestedService: this.requestedService(),
          clinicalSummary: this.clinicalSummary(),
          diagnosis: this.diagnosis(),
          treatmentGiven: this.treatmentGiven(),
          reason: this.reason(),
          validUntil: this.validUntil(),
          transfer: this.transferDraft().required ? transferFromDraft(this.transferDraft()) : null,
        });
  });

  protected readonly submissionError = computed(() => submissionMessage(this.submission(), this.serverReason()));

  /** El `reason` del último 400/404/422 de la API, ya en palabras. */
  private readonly serverReason = signal<string | null>(null);

  /* -- La lista ------------------------------------------------------------ */

  private readonly labels = signal<ConceptLabels>(new Map());

  /** Los estados ya consultados, con respuesta o sin ella: no se espera dos veces. */
  private readonly lookedUp = signal<ReadonlySet<string>>(new Set());

  /** S3 con su próxima acción cuando no hay ninguna; el resto, tal cual llega. */
  protected readonly list = computed<ViewState<readonly ReferralRow[]> | null>(() => {
    const state = this.referrals();
    if (state === null || (state.status !== 'ready' && state.status !== 'stale')) {
      return state;
    }
    // Una relectura fallida no se disfraza de «no tiene derivaciones».
    if (state.data.length === 0 && !(state.status === 'stale' && this.refreshError() !== null)) {
      return empty(
        {
          label: this.noEncounter()
            ? 'Abra el encuentro y derive desde el formulario'
            : 'Derive desde el formulario de arriba',
        },
        'Esta persona todavía no tiene derivaciones.',
      );
    }
    // S2 hasta saber cómo se llama cada estado: un «Sin registrar» que al
    // instante pasa a «Solicitada» es un dato falso, aunque dure poco.
    const lookedUp = this.lookedUp();
    if (state.data.some((r) => !lookedUp.has(r.statusConceptId))) {
      return loading();
    }
    const labels = this.labels();
    const rows = state.data.map((r) => toReferralRow(r, labels));
    // S7 se conserva: la plantilla dice la antigüedad junto al título.
    return state.status === 'stale' ? stale(rows, state.asOf) : ready(rows);
  });

  protected readonly rows = computed(() => {
    const list = this.list();
    return list === null ? [] : (dataOf(list) ?? []);
  });

  /* -- El consentimiento y el detalle ------------------------------------- */

  /** Los consentimientos de la persona, para la insignia de cada fila. */
  protected readonly consents = patientConsents(() => this.patientProfileId());

  /** El detalle abierto, con la respuesta, la contrarreferencia y su consentimiento. */
  protected readonly detail = referralDetailState(this.consents, () => this.cambio.emit());

  /** El bloque ya se desmontó: la respuesta de un envío puede llegar después. */
  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => (this.destroyed = true));

    // El estado se traduce por código: la lista trae el uuid del concepto.
    // Sólo se piden los que faltan y se suman a los ya conocidos: al releer,
    // la lista pasa por `loading`, y vaciar las etiquetas ahí pintaba
    // «Sin registrar» en cada fila hasta que volvía la traducción.
    effect(() => {
      const state = this.referrals();
      const known = untracked(() => this.lookedUp());
      const missing = [
        ...new Set((state === null ? [] : (dataOf(state) ?? [])).map((r) => r.statusConceptId)),
      ].filter((id) => !known.has(id));
      if (missing.length === 0) return;
      untracked(() =>
        this.terminology
          .readConceptLabels(missing)
          // Sin catálogo la lista igual se muestra, con «Sin registrar».
          .pipe(catchError(() => of<ConceptLabels>(new Map())))
          .subscribe((incoming) => {
            this.labels.update((previous) => new Map([...previous, ...incoming]));
            this.lookedUp.update((previous) => new Set([...previous, ...missing]));
          }),
      );
    });
  }

  protected chooseKind(kind: ReferralDestinationKind): void {
    if (kind === this.kind()) return;
    this.kind.set(kind);
    this.forgetTarget();
  }

  protected search(text: string): void {
    this.targetSearch.search(text);
  }

  /** Se borró lo escrito: la búsqueda en vuelo ya no es de nadie. */
  protected clearSearch(): void {
    this.targetSearch.reset();
  }

  /**
   * Reintentar la lista. El botón que se tocó desaparece al releer: el foco va
   * al título de la lista, dentro del diálogo, y no cae en `<body>`.
   */
  protected retryList(): void {
    this.retry.emit();
    this.focusInside('#referral-list-title');
  }

  protected choose(option: ReferenceOption | null): void {
    this.issued.set(null);
    this.duplicate.set(false);
    const target = option === null ? undefined : this.targetSearch.find(String(option.value));
    if (target === undefined) {
      this.forgetTarget();
      return;
    }
    this.target.set(target);
    this.loadServices();
    this.targetBranches.load(target);
  }

  protected loadServices(): void {
    this.targetServices.load();
  }

  protected submit(): void {
    const body = this.body();
    if (!this.canSubmit() || body === null) return;
    this.attempted.set(true);
    if (this.issues().length > 0 || this.transferProblems().length > 0) {
      // Los errores ya están junto a cada campo; el resumen, junto al botón,
      // y se abre la primera pestaña que tiene algo que corregir.
      this.tab.set(this.issues().length > 0 ? 0 : 1);
      this.revealOutcome();
      return;
    }
    const kind = this.kind();
    const targetName =
      kind === 'EXTERNAL' ? String(this.externalName() ?? '').trim() : (this.target()?.displayName ?? '');
    const offersConsent = body.referralType !== undefined && REFERRAL_TYPES_WITH_CONSENT.has(body.referralType);

    this.sending.set(true);
    this.submission.set(loading());
    this.duplicate.set(false);
    this.issued.set(null);
    this.serverReason.set(null);

    // Sin `takeUntilDestroyed` a propósito: la derivación ya salió, y la
    // relectura de la lista no depende de este bloque (`issued` del cliente).
    this.referralsClient.create(body).subscribe({
      next: (created) => {
        this.sending.set(false);
        this.submission.set(ready(null));
        // Con el modal ya cerrado no hay a quién mostrarle nada: la lista se
        // relee igual por `issued`.
        if (this.destroyed) return;
        this.issued.set({ name: targetName, kind });
        this.reset();
        this.revealOutcome();
        // Próximo paso de una derivación que lo pide: su consentimiento.
        if (offersConsent) this.detail.open(created.id, true);
      },
      error: (error: unknown) => {
        if (this.destroyed) return;
        this.sending.set(false);
        const detail = referralErrorDetail(error);
        // 409 `REFERRAL_ALREADY_EXISTS`: la misma derivación ya existe. No es
        // un error del médico: es un aviso, y se dice con palabras de aviso.
        // Otro 409 (sin ese sub-código) es un conflicto de verdad y va como error.
        if (detail?.reason === 'REFERRAL_ALREADY_EXISTS') {
          this.submission.set(ready(null));
          this.duplicate.set(true);
        } else {
          this.serverReason.set(detail?.message ?? null);
          this.submission.set(errorToViewState<null>(error));
        }
        this.revealOutcome();
      },
    });
  }

  /** «Derivar sin un servicio»: al campo que lo describe a mano. */
  protected deriveWithoutService(): void {
    this.focusInside('[data-testid="referral-requested-service"] textarea');
  }

  /** «Buscar otro destino»: se olvida el elegido y se vuelve al buscador. */
  protected searchAnotherTarget(): void {
    this.forgetTarget();
    this.remountToggle.update((value) => !value);
    this.focusInside(
      `[data-testid="${this.kind() === 'ORGANIZATION' ? 'referral-organization' : 'referral-practitioner'}"] input`,
    );
  }

  /** El resultado del envío, a la vista y con el foco: a 390 px el botón queda abajo. */
  private revealOutcome(): void {
    revealAfterRender(this.injector, () => {
      const element = this.outcome()?.nativeElement;
      return element === undefined || element.childElementCount === 0 ? null : element;
    });
  }

  private focusInside(selector: string): void {
    revealAfterRender(this.injector, () => this.host.nativeElement.querySelector<HTMLElement>(selector));
  }

  private forgetTarget(): void {
    // La búsqueda en vuelo, si la hay, ya no es de nadie.
    this.targetSearch.reset();
    this.target.set(null);
    this.targetServices.reset();
    this.targetBranches.reset();
  }

  private reset(): void {
    this.forgetTarget();
    this.remountToggle.update((value) => !value);
    this.referralType.set(DEFAULT_REFERRAL_TYPE);
    this.reason.set('');
    this.validUntil.set(null);
    this.externalName.set('');
    this.externalContact.set('');
    this.requestedService.set('');
    this.clinicalSummary.set('');
    this.diagnosis.set('');
    this.treatmentGiven.set('');
    this.transferDraft.set(emptyTransferDraft());
    this.tab.set(0);
    this.attempted.set(false);
  }
}
