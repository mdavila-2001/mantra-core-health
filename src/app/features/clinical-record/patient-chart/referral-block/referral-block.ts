import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, Subject } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type { BranchListItem } from '../../../../core/data-access/directory/directory.types';
import {
  REFERRAL_TARGET_MIN_QUERY,
  ReferralsClient,
} from '../../../../core/data-access/referrals/referrals.client';
import { referralErrorDetail } from '../../../../core/data-access/referrals/referrals.errors';
import {
  REFERRAL_LIMITS,
  REFERRAL_TYPES_WITH_CONSENT,
  referralIssues,
  type NewReferral,
  type Referral,
  type ReferralIssue,
  type ReferralTarget,
  type ReferralTargetService,
  type ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Divider } from '../../../../shared/components/atoms/divider/divider';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { writeFailureMessage } from '../../write-message';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { InformedConsentBadge } from '../informed-consent/informed-consent-badge';
import { patientConsents } from '../informed-consent/patient-consents';
import {
  buildNewReferral,
  DEFAULT_REFERRAL_TYPE,
  REFERRAL_TYPE_OPTIONS,
  SERVICE_EXAMPLE,
  serviceOptions as toServiceOptions,
  TARGET_KIND_OPTIONS,
  toReferralRow,
  type ReferralDestinationKind,
  type ReferralRow,
} from './referral-block.model';
import { ReferralDetail } from './referral-detail';
import { referralDetailState } from './referral-detail-state';

/** El motivo cabe en el aviso de la persona: el servidor lo corta a este largo. */
const REASON_MAX_LENGTH = 500;

/**
 * **Derivar** — el médico recomienda a la persona que consulte con otro
 * profesional (pedido del propietario, 24/10/2026), o la deriva a una
 * organización médica, por **un servicio concreto** de su catálogo («tipo
 * tratamiento», pedido del cliente, 28/10/2026).
 *
 * ```html
 * <app-referral-block
 *   [patientProfileId]="id"
 *   [encounterId]="encuentroActual()"
 *   [referrals]="referrals.state()"
 *   (cambio)="referrals.reload()"
 *   (retry)="referrals.reload()"
 * />
 * ```
 *
 * ## El recorrido
 *
 * Profesional u organización → buscar por nombre en la API → (opcional) uno
 * de sus servicios, con el arancel a la vista → tipo (Tratamiento por defecto)
 * → motivo y vigencia. La API le avisa a la persona en su campana. **No
 * reserva nada**.
 *
 * ## Sin encuentro no hay derivación con aviso
 *
 * El encuentro es lo que demuestra que quien deriva atendió a esa persona; sin
 * él la API guarda la derivación pero no avisa, y un formulario que parece
 * funcionar y no avisa a nadie es peor que uno que dice qué falta. Sin
 * encuentro abierto el bloque lo dice y no ofrece el formulario; la lista de
 * lo ya derivado se sigue viendo.
 *
 * ## La lista la lee quien monta el bloque
 *
 * Igual que las recetas: la consulta la necesita para el contador de la
 * casilla, y dos lecturas de la misma lista pueden discrepar. Sin `referrals`
 * el bloque no dibuja la lista.
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
 * ## Por qué pasa de 300 líneas
 *
 * Es un solo flujo —buscar, elegir servicio, derivar, ver lo derivado— y lo
 * traducible ya vive aparte (`referral-block.model.ts`). Partirlo en piezas
 * obligaría a pasar entre ellas el destino elegido y el estado del envío, que
 * es justamente lo que el bloque coordina. Un tercio son comentarios.
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
    StatusSeal,
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
  private readonly auth = inject(AuthService);
  private readonly directory = inject(DirectoryClient);
  private readonly destroyRef = inject(DestroyRef);

  /** La persona que se deriva. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, o `null` si no hay uno abierto. */
  readonly encounterId = input<string | null>(null);

  /** Las derivaciones de la persona, leídas por quien monta el bloque; `null` no dibuja la lista. */
  readonly referrals = input<ViewState<readonly Referral[]> | null>(null);

  /** Avisa que se emitió una derivación, para que quien monta el bloque relea. */
  readonly cambio = output<void>();

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
  protected readonly searching = signal(false);
  private readonly results = signal<readonly ReferralTarget[]>([]);
  protected readonly searchError = signal<string | null>(null);
  private readonly searches = new Subject<{ q: string; kind: 'PRACTITIONER' | 'ORGANIZATION' }>();

  /**
   * Alterna en cada derivación para volver a montar el buscador. El combobox
   * guarda su propio texto y no lo borra cuando el valor vuelve a `null`; sin
   * esto quedaría escrito el nombre de alguien que ya no está elegido.
   */
  protected readonly remountToggle = signal(true);

  protected readonly targetOptions = computed<readonly ReferenceOption[]>(() =>
    this.results().map((r) => ({
      value: r.id,
      label: r.displayName,
      ...(r.subtitle === null ? {} : { hint: r.subtitle }),
    })),
  );

  /* -- La sede (organización) o el destino externo ----------------------- */

  /** Las sedes de la organización elegida; vacía si no tiene o no se pudieron leer. */
  private readonly branches = signal<readonly BranchListItem[]>([]);
  protected readonly selectedBranch = signal<string | null>(null);
  protected readonly branchOptions = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Cualquier sede (la organización decide)' },
    ...this.branches().map((b) => ({ value: b.id, label: b.name })),
  ]);
  protected readonly hasBranches = computed(() => this.branches().length > 0);

  protected readonly externalName = signal<string | number | null>('');
  protected readonly externalContact = signal<string | number | null>('');

  /* -- Los servicios del destino ------------------------------------------ */

  protected readonly services = signal<ViewState<readonly ReferralTargetService[]>>(loading());
  protected readonly selectedService = signal<string | null>(null);

  protected readonly serviceOptions = computed(() => toServiceOptions(dataOf(this.services()) ?? []));

  /** La descripción del servicio elegido, para no elegir a ciegas por el nombre. */
  protected readonly serviceHint = computed(() => {
    const chosen = (dataOf(this.services()) ?? []).find((s) => s.id === this.selectedService());
    if (chosen === undefined) {
      return 'Opcional. Uno de los servicios que ofrece el destino, con su arancel.';
    }
    return chosen.description ?? 'El servicio que se le pide al destino.';
  });

  /* -- El resto del formulario -------------------------------------------- */

  protected readonly referralType = signal<ReferralType | null>(DEFAULT_REFERRAL_TYPE);
  protected readonly reason = signal('');
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

  /** Se intentó enviar: desde ahí los errores se muestran junto a cada campo. */
  protected readonly attempted = signal(false);
  protected readonly issues = computed<readonly ReferralIssue[]>(() => referralIssues(this.body() ?? {}));
  protected issueFor(field: ReferralIssue['field']): string {
    if (!this.attempted()) return '';
    return this.issues().find((issue) => issue.field === field)?.message ?? '';
  }

  protected readonly sending = signal(false);
  protected readonly submission = signal<ViewState<null>>(ready(null));
  protected readonly referredTo = signal<string | null>(null);
  protected readonly duplicate = signal(false);

  /** Hay destino: uno de la plataforma elegido, o el nombre del externo escrito. */
  protected readonly hasTarget = computed(() =>
    this.kind() === 'EXTERNAL' ? String(this.externalName() ?? '').trim() !== '' : this.target() !== null,
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
        });
  });

  protected readonly submissionError = computed<string | null>(() => {
    const state = this.submission();
    if (state.status === 'validation') {
      // El sub-código de la API dice qué falta; si no lo trae, el mensaje tal cual.
      return this.serverReason() ?? (state.issues.map((issue) => issue.message).join(' ') || null);
    }
    return writeFailureMessage(state, {
      accion: 'derivar',
      sinPermiso: 'Sólo puede derivar a quien atiende desde su propia organización.',
      yaNoExiste:
        'No encontramos este encuentro entre los de esta persona. Vuelva a abrirlo y pruebe de nuevo.',
    });
  });

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
    if (state.data.length === 0) {
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
    return ready(state.data.map((r) => toReferralRow(r, labels)));
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

  constructor() {
    this.searches
      .pipe(
        switchMap(({ q, kind }) =>
          this.referralsClient.searchTargets(q, kind).pipe(
            map((items) => ({ items, failure: null })),
            catchError((error: unknown) =>
              of({
                items: [] as readonly ReferralTarget[],
                failure:
                  writeFailureMessage(errorToViewState<null>(error), {
                    accion: 'buscar destinos',
                  }) ?? 'No pudimos buscar. Pruebe de nuevo.',
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ items, failure }) => {
        // Quien deriva no se ofrece a sí mismo, aunque la API lo devuelva.
        const self = this.auth.practitionerProfileId();
        this.searching.set(false);
        this.results.set(items.filter((r) => !(r.kind === 'PRACTITIONER' && r.id === self)));
        this.searchError.set(failure);
      });

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
    const q = text.trim();
    const kind = this.kind();
    if (q.length < REFERRAL_TARGET_MIN_QUERY || kind === 'EXTERNAL') {
      this.results.set([]);
      return;
    }
    this.searching.set(true);
    this.searches.next({ q, kind });
  }

  protected choose(option: ReferenceOption | null): void {
    this.referredTo.set(null);
    this.duplicate.set(false);
    const target = option === null ? undefined : this.results().find((r) => r.id === option.value);
    if (target === undefined) {
      this.forgetTarget();
      return;
    }
    this.target.set(target);
    this.loadServices();
    this.loadBranches(target);
  }

  /** Las sedes de una organización. Si no se pueden leer, se deriva a «cualquier sede». */
  private loadBranches(target: ReferralTarget): void {
    this.selectedBranch.set(null);
    this.branches.set([]);
    if (target.kind !== 'ORGANIZATION') return;
    this.directory
      .listBranches(target.id)
      .pipe(catchError(() => of({ items: [] as readonly BranchListItem[], count: 0 })))
      .subscribe((list) => {
        if (this.target()?.id === target.id) this.branches.set(list.items);
      });
  }

  protected loadServices(): void {
    const target = this.target();
    if (target === null) return;
    this.selectedService.set(null);
    this.services.set(loading());
    this.referralsClient
      .listTargetServices(
        target.kind === 'PRACTITIONER' ? { targetProfileId: target.id } : { targetTenantId: target.id },
      )
      .subscribe({
        next: (items) => {
          // Una respuesta tardía de un destino ya descartado no pisa al nuevo.
          if (this.target()?.id !== target.id) return;
          this.services.set(
            items.length === 0
              ? empty(
                  { label: 'Derive sin un servicio en particular o busque otro destino' },
                  `${target.displayName} no tiene servicios publicados para recibir derivaciones.`,
                )
              : ready(items),
          );
        },
        error: (error: unknown) => {
          if (this.target()?.id === target.id) {
            this.services.set(errorToViewState(error));
          }
        },
      });
  }

  protected submit(): void {
    const body = this.body();
    if (!this.canSubmit() || body === null) return;
    this.attempted.set(true);
    if (this.issues().length > 0) {
      // Los errores ya están junto a cada campo; el resumen va arriba.
      return;
    }
    const targetName =
      this.kind() === 'EXTERNAL' ? String(this.externalName() ?? '').trim() : (this.target()?.displayName ?? '');
    const offersConsent = body.referralType !== undefined && REFERRAL_TYPES_WITH_CONSENT.has(body.referralType);

    this.sending.set(true);
    this.submission.set(loading());
    this.duplicate.set(false);
    this.serverReason.set(null);

    this.referralsClient.create(body).subscribe({
      next: (created) => {
        this.sending.set(false);
        this.submission.set(ready(null));
        this.referredTo.set(targetName);
        this.reset();
        this.cambio.emit();
        // Próximo paso de una derivación que lo pide: su consentimiento.
        if (offersConsent) this.detail.open(created.id, true);
      },
      error: (error: unknown) => {
        this.sending.set(false);
        // 409: la misma derivación ya existe. No es un error del médico:
        // es un aviso, y se dice con palabras de aviso.
        if (isConflict(error)) {
          this.submission.set(ready(null));
          this.duplicate.set(true);
          return;
        }
        this.serverReason.set(referralErrorDetail(error)?.message ?? null);
        this.submission.set(errorToViewState<null>(error));
      },
    });
  }

  private forgetTarget(): void {
    this.target.set(null);
    this.results.set([]);
    this.selectedService.set(null);
    this.services.set(loading());
    this.searchError.set(null);
    this.branches.set([]);
    this.selectedBranch.set(null);
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
    this.attempted.set(false);
  }
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 409
  );
}
