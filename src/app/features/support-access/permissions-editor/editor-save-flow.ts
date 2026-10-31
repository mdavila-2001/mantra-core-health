import {
  DestroyRef,
  Injectable,
  InjectionToken,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Subject,
  catchError,
  debounce,
  firstValueFrom,
  map,
  of,
  startWith,
  switchMap,
  timer,
  type Observable,
} from 'rxjs';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { readApiError } from '../../../core/http/api-error';
import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import type {
  SimulateAccessRequest,
  SimulateAccessResponse,
} from '../../../core/data-access/access-governance/access-explain.types';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import {
  isGrantChangePending,
  type GrantChangePending,
} from '../../../core/data-access/support-access/support-atom-grants.types';
import type { SupportGrant } from '../../../core/data-access/support-access/support-access.types';
import {
  buildChangeSet,
  type ChangeSet,
  type EditorGrant,
  type PendingWrite,
} from './editor-grant';
import { issueFromFailure, placeIssues, type PlacedIssue } from './issue-placement';

/* ============================================================================
    Vista previa obligatoria y guardado del editor de permisos (CONTRATO-GOBIERNO §9.4, §5.3).

    - Cada cambio del borrador pide `simulate` (con 400 ms de espera y cancelando la petición anterior).
    - Guardar solo se habilita con la vista previa **de este mismo borrador** y `valid = true`.
    - La huella (`simulationToken`) del servidor es del borrador de **un solo permiso** con `removeGrantIds: []`:
      con un único permiso se reusa la de la vista previa; con varios, antes de guardar se simula cada permiso solo
      (el MISMO objeto que luego se guarda) y cada uno viaja con la suya.
    - 409 `SIMULATION_STALE` no pierde el borrador: se avisa, se vuelve a simular y se espera la confirmación.
   ========================================================================== */

/** Espera antes de simular (ms). Las pruebas la bajan a 0. */
export const PREVIEW_DEBOUNCE_MS = new InjectionToken<number>('PREVIEW_DEBOUNCE_MS', {
  providedIn: 'root',
  factory: () => 400,
});

export type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly response: SimulateAccessResponse;
      readonly fingerprint: string;
    }
  | { readonly status: 'error'; readonly message: string; readonly fingerprint: string };

export interface SaveFailure {
  readonly message: string;
  readonly reason?: string;
  readonly requestId?: string;
}

/**
 * Lo que ya se aplicó antes de un fallo, para no perderlo ni repetirlo.
 *
 * `changed` y `created` incluyen lo que la API dejó **esperando aprobación** (202): no se vuelve a mandar (crearía otra
 * solicitud), pero tampoco rige todavía. `awaiting` dice cuáles son (por clave del borrador).
 */
export interface AppliedOps {
  readonly revoked: readonly string[];
  readonly changed: readonly string[];
  readonly created: readonly string[];
  readonly awaiting: readonly string[];
}

/** «1 permiso retirado, 2 permisos nuevos»: lo aplicado (o lo que falta) en palabras; «nada» si no hay nada. */
export function describeOps(ops: AppliedOps): string {
  const cuenta = (n: number, uno: string, varios: string): string | null =>
    n === 0 ? null : n === 1 ? `1 ${uno}` : `${n} ${varios}`;
  const esperando = new Set(ops.awaiting);
  const partes = [
    cuenta(ops.revoked.length, 'permiso retirado', 'permisos retirados'),
    cuenta(ops.changed.filter((k) => !esperando.has(k)).length, 'permiso cambiado', 'permisos cambiados'),
    cuenta(ops.created.filter((k) => !esperando.has(k)).length, 'permiso nuevo', 'permisos nuevos'),
  ].filter((p): p is string => p !== null);
  return partes.length === 0 ? 'nada' : partes.join(', ');
}

export type SaveResult =
  | {
      readonly status: 'saved';
      readonly pendingApproval: boolean;
      /** Los 202: por qué quedaron esperando a otra persona (para explicarlo en lenguaje simple). */
      readonly pending: readonly GrantChangePending[];
    }
  | { readonly status: 'failed'; readonly applied: AppliedOps; readonly cancelled: boolean }
  | { readonly status: 'blocked' };

export interface FlowSource {
  readonly engagementId: () => string;
  readonly saved: Signal<readonly SupportGrant[]>;
  readonly rows: Signal<readonly EditorGrant[]>;
}

/** La petición de vista previa del borrador completo: todos los cambios y los permisos que se retiran. */
export function buildPreviewRequest(
  engagementId: string,
  set: ChangeSet,
): SimulateAccessRequest | null {
  if (set.writes.length + set.revokeIds.length === 0) return null;
  return {
    engagementId,
    draft: {
      mode: 'PATCH',
      grants: set.writes.map((w) => w.draftGrant),
      removeGrantIds: [...set.revokeIds],
    },
    autoScenarios: true,
  };
}

/** La petición de un solo permiso: el borrador que firma la huella que el servidor comprueba al guardar. */
export function buildSingleRequest(
  engagementId: string,
  write: PendingWrite,
): SimulateAccessRequest {
  return {
    engagementId,
    draft: { mode: 'PATCH', grants: [write.draftGrant], removeGrantIds: [] },
    autoScenarios: false,
  };
}

class InvalidDraftError extends Error {}

/** Motivos cuyo texto de la tabla (`ACCESS_ERROR_TEXTS`) se prefiere al del servidor, que es técnico. */
const LOCAL_TEXT_REASONS: ReadonlySet<string> = new Set([
  'CONDITION_TOO_LARGE',
  'CONDITION_NOT_APPLICABLE_TO_ATOM',
]);

const RATE_LIMITED_TEXT =
  'Pidió muchas vistas previas seguidas. Espere un momento y vuelva a calcularla.';
const PREVIEW_FAILED_TEXT = 'No pudimos calcular la vista previa. Intente de nuevo.';
const OFFLINE_TEXT = 'No hay conexión. Cuando vuelva, calcule de nuevo la vista previa.';

function previewError(error: unknown, fingerprint: string): PreviewState {
  const failure = accessFailureOf(error);
  if (error instanceof HttpErrorResponse && error.status === 0)
    return { status: 'error', message: OFFLINE_TEXT, fingerprint };
  if (error instanceof HttpErrorResponse && error.status === 429)
    return { status: 'error', message: RATE_LIMITED_TEXT, fingerprint };
  return { status: 'error', message: failure?.message ?? PREVIEW_FAILED_TEXT, fingerprint };
}

@Injectable()
export class EditorSaveFlow {
  private readonly explain = inject(AccessExplainClient);
  private readonly client = inject(SupportAccessClient);
  private readonly debounceMs = inject(PREVIEW_DEBOUNCE_MS);

  private readonly source = signal<FlowSource | null>(null);
  private readonly requests = new Subject<{
    readonly request: SimulateAccessRequest | null;
    readonly fingerprint: string;
    readonly immediate: boolean;
  }>();

  readonly preview = signal<PreviewState>({ status: 'idle' });
  readonly saving = signal(false);
  readonly failure = signal<SaveFailure | null>(null);
  /** «Algo cambió mientras editaba»: el servidor no reconoció la huella; se vuelve a simular. */
  readonly staleNotice = signal(false);
  private readonly saveIssues = signal<readonly PlacedIssue[]>([]);

  readonly changeSet = computed<ChangeSet>(() => {
    const source = this.source();
    return source === null
      ? { writes: [], revokeIds: [] }
      : buildChangeSet(source.saved(), source.rows());
  });
  readonly request = computed<SimulateAccessRequest | null>(() => {
    const source = this.source();
    return source === null ? null : buildPreviewRequest(source.engagementId(), this.changeSet());
  });
  readonly fingerprint = computed(() => JSON.stringify(this.request()));

  /** La respuesta, solo si es la de **este** borrador. */
  readonly current = computed<SimulateAccessResponse | null>(() => {
    const state = this.preview();
    return state.status === 'ready' && state.fingerprint === this.fingerprint()
      ? state.response
      : null;
  });
  readonly isLoading = computed(
    () => this.request() !== null && this.current() === null && this.preview().status !== 'error',
  );
  readonly canSave = computed(() => this.current()?.valid === true && !this.saving());
  readonly needsFourEyes = computed(
    () => this.current()?.governance.needsFourEyes ?? { required: false, reasons: [] },
  );

  /** Errores y avisos ubicados en el editor: los del simulador y los de un intento de guardar. */
  readonly issues = computed<readonly PlacedIssue[]>(() => {
    const response = this.current();
    const rows = this.source()?.rows() ?? [];
    const writes = this.changeSet().writes;
    const isDenyAt = (index: number): boolean =>
      rows.find((r) => r.key === writes[index]?.key)?.effect === 'DENY';
    const fromPreview = response === null ? [] : placeIssues(response.validation, isDenyAt);
    return [...fromPreview, ...this.saveIssues()];
  });

  constructor() {
    this.requests
      .pipe(
        debounce((r) => (r.immediate || this.debounceMs === 0 ? of(0) : timer(this.debounceMs))),
        switchMap((r): Observable<PreviewState> => {
          if (r.request === null) return of({ status: 'idle' });
          return this.explain.simulate(r.request).pipe(
            map((response): PreviewState => ({
              status: 'ready',
              response,
              fingerprint: r.fingerprint,
            })),
            catchError((error: unknown) => of(previewError(error, r.fingerprint))),
            startWith<PreviewState>({ status: 'loading' }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((state) => this.preview.set(state));
  }

  attach(source: FlowSource): void {
    this.source.set(source);
  }

  /** El borrador cambió (o se cargó): pide la vista previa y descarta avisos del intento anterior. */
  schedule(): void {
    this.failure.set(null);
    this.staleNotice.set(false);
    this.saveIssues.set([]);
    this.requests.next({
      request: this.request(),
      fingerprint: this.fingerprint(),
      immediate: false,
    });
  }

  /** Vuelve a calcular ya, sin esperar (reintentar, o después de un `SIMULATION_STALE`). */
  refreshNow(): void {
    this.requests.next({
      request: this.request(),
      fingerprint: this.fingerprint(),
      immediate: true,
    });
  }

  /** Pone la vista previa en blanco (recién guardado). */
  reset(): void {
    this.failure.set(null);
    this.staleNotice.set(false);
    this.saveIssues.set([]);
    this.requests.next({ request: null, fingerprint: '', immediate: true });
  }

  /** Una huella por permiso que el servidor va a comprobar. */
  private async tokensFor(
    set: ChangeSet,
    response: SimulateAccessResponse,
    engagementId: string,
  ): Promise<ReadonlyMap<string, string>> {
    const verifiable = set.writes.filter((w) => w.needsToken);
    const tokens = new Map<string, string>();
    if (
      verifiable.length === 1 &&
      set.writes.length === 1 &&
      set.revokeIds.length === 0 &&
      response.simulationToken !== undefined
    ) {
      tokens.set(verifiable[0]!.key, response.simulationToken);
      return tokens;
    }
    for (const write of verifiable) {
      const single = await firstValueFrom(
        this.explain.simulate(buildSingleRequest(engagementId, write)),
      );
      if (!single.valid || single.simulationToken === undefined) throw new InvalidDraftError();
      tokens.set(write.key, single.simulationToken);
    }
    return tokens;
  }

  async save(): Promise<SaveResult> {
    const source = this.source();
    const response = this.current();
    if (source === null || response === null || !response.valid || this.saving())
      return { status: 'blocked' };
    const set = this.changeSet();
    const engagementId = source.engagementId();
    this.saving.set(true);
    this.failure.set(null);
    this.staleNotice.set(false);
    this.saveIssues.set([]);

    const revoked: string[] = [];
    const changed: string[] = [];
    const created: string[] = [];
    const awaiting: string[] = [];
    const pending: GrantChangePending[] = [];
    let writeIndex: number | null = null;
    let pendingApproval = false;
    try {
      const tokens = await this.tokensFor(set, response, engagementId);
      for (const grantId of set.revokeIds) {
        await firstValueFrom(this.client.changeGrant(engagementId, { grantId, revoke: true }));
        revoked.push(grantId);
      }
      for (const [index, write] of set.writes.entries()) {
        if (write.kind !== 'change') continue;
        writeIndex = index;
        const token = tokens.get(write.key);
        const cambiado = await firstValueFrom(
          this.client.changeGrant(engagementId, {
            ...write.change!,
            ...(token === undefined ? {} : { simulationToken: token }),
          }),
        );
        if (isGrantChangePending(cambiado)) {
          pendingApproval = true;
          pending.push(cambiado);
          awaiting.push(write.key);
        }
        changed.push(write.key);
      }
      for (const [index, write] of set.writes.entries()) {
        if (write.kind !== 'create') continue;
        writeIndex = index;
        const token = tokens.get(write.key);
        const result = await firstValueFrom(
          this.client.createGrant(engagementId, {
            ...write.create!,
            ...(token === undefined ? {} : { simulationToken: token }),
          }),
        );
        if (isGrantChangePending(result)) {
          pendingApproval = true;
          pending.push(result);
          awaiting.push(write.key);
        }
        created.push(write.key);
      }
      this.saving.set(false);
      return { status: 'saved', pendingApproval, pending };
    } catch (error) {
      this.saving.set(false);
      if (error instanceof InvalidDraftError) {
        this.failure.set({
          message:
            'Alguno de los permisos no pasó la verificación. Revise los errores de la vista previa.',
        });
        this.refreshNow();
      } else if (error instanceof AccessChallengeCancelledError) {
        // La persona cerró el diálogo de motivo, paso extra o aprobación: no es «sin conexión» ni un error de la API.
        // Lo ya aplicado se conserva (se retira primero, así que ante un corte la persona queda con menos acceso, nunca
        // con más) y el resto del borrador sigue en la pantalla.
        const aplicados = revoked.length + changed.length + created.length;
        this.failure.set({
          message:
            aplicados === 0
              ? 'Usted canceló la verificación. No se guardó ningún cambio.'
              : 'Usted canceló la verificación, así que el resto de los cambios no se guardó.',
        });
      } else {
        this.handleFailure(error, writeIndex);
      }
      return {
        status: 'failed',
        applied: { revoked, changed, created, awaiting },
        cancelled: error instanceof AccessChallengeCancelledError,
      };
    }
  }

  private handleFailure(error: unknown, writeIndex: number | null): void {
    const failure = accessFailureOf(error);
    if (failure?.reason === 'SIMULATION_STALE') {
      // El borrador se queda; se vuelve a simular y se espera a que lo confirme.
      this.staleNotice.set(true);
      this.refreshNow();
      return;
    }
    // Con un motivo de negocio el servidor ya dice, en lenguaje simple, qué falló y dónde: se prefiere su texto al genérico.
    // Salvo los de condiciones, cuyo mensaje cita claves y tamaños técnicos («8 KiB», «actionConditions»): ahí gana el de la tabla.
    const serverText =
      error instanceof HttpErrorResponse &&
      failure?.reason !== undefined &&
      !LOCAL_TEXT_REASONS.has(failure.reason)
        ? readApiError(error)?.message.trim()
        : undefined;
    const message =
      serverText !== undefined && serverText !== ''
        ? serverText
        : (failure?.message ?? 'No pudimos guardar los permisos.');
    this.failure.set({
      message,
      ...(failure?.reason === undefined ? {} : { reason: failure.reason }),
      ...(failure?.requestId === undefined ? {} : { requestId: failure.requestId }),
    });
    if (writeIndex !== null && failure?.reason !== undefined) {
      const issue = issueFromFailure(
        writeIndex,
        failure.reason,
        message,
        failure.details?.['path'],
      );
      this.saveIssues.set(placeIssues({ errors: [issue], warnings: [] }));
    }
  }
}
