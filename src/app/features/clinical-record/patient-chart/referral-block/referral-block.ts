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
import {
  REFERRAL_TARGET_MIN_QUERY,
  ReferralsClient,
} from '../../../../core/data-access/referrals/referrals.client';
import type {
  Referral,
  ReferralTarget,
  ReferralTargetKind,
  ReferralTargetService,
  ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Divider } from '../../../../shared/components/atoms/divider/divider';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { writeFailureMessage } from '../../write-message';
import {
  DEFAULT_REFERRAL_TYPE,
  REFERRAL_TYPE_OPTIONS,
  serviceOptions as toServiceOptions,
  TARGET_KIND_OPTIONS,
  toReferralRow,
  type ReferralRow,
} from './referral-block.model';

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
    Card,
    DatePicker,
    DatePipe,
    Divider,
    FormField,
    NgTemplateOutlet,
    ReferenceCombobox,
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

  protected readonly targetKindOptions = TARGET_KIND_OPTIONS;
  protected readonly typeOptions = REFERRAL_TYPE_OPTIONS;
  protected readonly minQueryLength = REFERRAL_TARGET_MIN_QUERY;
  protected readonly reasonMaxLength = REASON_MAX_LENGTH;
  protected readonly today = new Date();

  protected readonly noEncounter = computed(() => this.encounterId() === null);

  /* -- El destino ---------------------------------------------------------- */

  protected readonly kind = signal<ReferralTargetKind>('PRACTITIONER');
  protected readonly target = signal<ReferralTarget | null>(null);
  protected readonly searching = signal(false);
  private readonly results = signal<readonly ReferralTarget[]>([]);
  protected readonly searchError = signal<string | null>(null);
  private readonly searches = new Subject<{ q: string; kind: ReferralTargetKind }>();

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

  protected readonly sending = signal(false);
  protected readonly submission = signal<ViewState<null>>(ready(null));
  protected readonly referredTo = signal<string | null>(null);
  protected readonly duplicate = signal(false);

  protected readonly canSubmit = computed(
    () =>
      !this.noEncounter() &&
      this.target() !== null &&
      !this.sending() &&
      this.reason().length <= REASON_MAX_LENGTH,
  );

  protected readonly submissionError = computed<string | null>(() => {
    const state = this.submission();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    return writeFailureMessage(state, {
      accion: 'derivar',
      sinPermiso: 'Sólo puede derivar a quien atiende desde su propia organización.',
      yaNoExiste:
        'No encontramos este encuentro entre los de esta persona. Vuelva a abrirlo y pruebe de nuevo.',
    });
  });

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

  protected chooseKind(kind: ReferralTargetKind): void {
    if (kind === this.kind()) return;
    this.kind.set(kind);
    this.forgetTarget();
  }

  protected search(text: string): void {
    const q = text.trim();
    if (q.length < REFERRAL_TARGET_MIN_QUERY) {
      this.results.set([]);
      return;
    }
    this.searching.set(true);
    this.searches.next({ q, kind: this.kind() });
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
    const encounter = this.encounterId();
    const target = this.target();
    if (!this.canSubmit() || encounter === null || target === null) return;

    const service = this.selectedService();
    const referralType = this.referralType();
    const reason = this.reason().trim();
    const validUntil = this.validUntil();

    this.sending.set(true);
    this.submission.set(loading());
    this.duplicate.set(false);

    this.referralsClient
      .create({
        patientProfileId: this.patientProfileId(),
        sourceEncounterId: encounter,
        // Los opcionales sin elegir se omiten: `forbidNonWhitelisted`.
        ...(target.kind === 'PRACTITIONER'
          ? { targetProfileId: target.id }
          : { targetTenantId: target.id }),
        ...(service === null ? {} : { targetServiceCatalogId: service }),
        ...(referralType === null ? {} : { referralType }),
        ...(reason === '' ? {} : { reasonText: reason }),
        ...(validUntil === null ? {} : { validUntil }),
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.submission.set(ready(null));
          this.referredTo.set(target.displayName);
          this.reset();
          this.cambio.emit();
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
  }

  private reset(): void {
    this.forgetTarget();
    this.remountToggle.update((value) => !value);
    this.referralType.set(DEFAULT_REFERRAL_TYPE);
    this.reason.set('');
    this.validUntil.set(null);
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
