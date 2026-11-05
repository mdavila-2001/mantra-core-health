import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import type { PermissionCatalog } from '../../../core/data-access/access-governance/access-explain.types';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import {
  SUPPORT_ACTION_CODES,
  SUPPORT_ACTION_LABELS,
  SUPPORT_TEMPLATE_DEFAULT_ACTIONS,
  type SupportActionCode,
  type SupportCatalog,
  type SupportEngagement,
  type SupportGrant,
} from '../../../core/data-access/support-access/support-access.types';
import { previewCoverage } from '../../../core/data-access/support-access/support-coverage';
import { shortTargetLabel } from '../../../core/data-access/support-access/support-grant-draft';
import { atomMeta, type SupportAtom } from '../../../core/data-access/support-access/support-atoms';
import { pendingApprovalExplanation } from '../../../core/data-access/support-access/grant-change-reasons';
import { summarizeGrants } from '../../../core/data-access/support-access/support-summary';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Select } from '../../../shared/components/atoms/select/select';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ACTION_GROUPS } from '../support-action-picker/support-action-picker';
import { formatDay, templateLabel } from '../support-labels';
import { AdvancedPanel } from './advanced-panel/advanced-panel';
import { ChangePreview, type PreviewView } from './change-preview/change-preview';
import { describeOps, EditorSaveFlow, type AppliedOps } from './editor-save-flow';
import {
  coveredAliases,
  hasChanges,
  rowAtoms,
  rowHasAlias,
  rowHasAtom,
  setEffect,
  toEditorGrant,
  toggleAtom,
  withGrantSummary,
  type EditorGrant,
} from './editor-grant';
import type { PlacedIssue } from './issue-placement';
import { localPermissionCatalog } from './local-catalog';
import { applyPackage, removeRow, setMode, toggleAction } from './permissions-draft';
import { PermissionsTargets } from './permissions-targets';

interface Carga {
  readonly engagement: SupportEngagement;
  readonly catalog: SupportCatalog;
  /** Los 73 permisos precisos, de `GET /org/permission-catalog` (o los del front si no responde). */
  readonly permissions: PermissionCatalog;
}

type EditorView = 'basic' | 'advanced';

const VIEWS: readonly SegmentedOption<EditorView>[] = [
  { value: 'basic', label: 'Básico' },
  { value: 'advanced', label: 'Avanzado' },
];

/** Además de los 15 paquetes, dos permisos que se piden seguido: se marcan como permisos precisos. */
const BASIC_EXTRAS: readonly { readonly atom: SupportAtom; readonly label: string }[] = [
  { atom: 'agenda.appointment.view.reason', label: 'Ver el motivo de consulta' },
  { atom: 'patients.search.exact', label: 'Búsqueda de pacientes' },
];

/**
 * **Editor de permisos** de una persona de apoyo.
 *
 * Los permisos son filas con un **objetivo**: un doctor, un servicio, una
 * ubicación, o un cruce de dos (doctor × servicio, doctor × ubicación, servicio ×
 * ubicación). Varias filas **se suman**; una fila cruzada **restringe**. Cada fila
 * tiene sus propias acciones, que se marcan en la matriz.
 *
 * A la derecha, el **resumen en lenguaje simple** y la **vista previa** de qué
 * doctores y servicios quedan cubiertos se recalculan con cada cambio, antes de
 * guardar. La vista previa es informativa: la que decide es la API
 * (`SupportAccessPolicy`) en cada petición.
 */
@Component({
  selector: 'app-permissions-editor',
  providers: [EditorSaveFlow],
  imports: [
    AdvancedPanel,
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    ChangePreview,
    Checkbox,
    FormField,
    NgTemplateOutlet,
    PageHeader,
    RouterLink,
    SegmentedControl,
    Select,
    Switch,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './permissions-editor.html',
  styleUrl: './permissions-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionsEditor extends PermissionsTargets implements OnInit {
  private readonly route = inject(ActivatedRoute);
  /** El identificador del vínculo, de la ruta `administration/support-team/:engagementId`. */
  private readonly engagementId = (): string =>
    this.route.snapshot.paramMap.get('engagementId') ?? '';

  private readonly client = inject(SupportAccessClient);
  private readonly explain = inject(AccessExplainClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly injector = inject(Injector);
  /** Vista previa obligatoria y guardado: el simulador, las huellas y los errores del servidor. */
  protected readonly flow = inject(EditorSaveFlow);
  private readonly advanced = viewChild(AdvancedPanel);

  protected readonly state = signal<ViewState<Carga>>(loading());
  protected readonly guardado = signal<readonly SupportGrant[]>([]);
  protected readonly borrador = signal<readonly EditorGrant[]>([]);
  /** «Básico» (los paquetes de siempre) por omisión; «Avanzado» muestra los 73 permisos y las condiciones. */
  protected readonly view = signal<EditorView>('basic');
  protected readonly views = VIEWS;
  protected readonly basicExtras = BASIC_EXTRAS;
  /** Si algo se guardó antes de un fallo, lo dice (y lo que falta sigue en el borrador). */
  protected readonly partialNotice = signal<string | null>(null);
  /** Se intentó borrar un vencimiento ya guardado (la API no sabe quitarlo): se explica. */
  protected readonly vigenciaNotice = signal<string | null>(null);
  protected readonly pestana = signal(0);
  protected readonly intentoDeGuardar = signal(false);

  protected readonly grupos = ACTION_GROUPS;
  protected readonly etiquetaDeAccion = (accion: SupportActionCode): string =>
    SUPPORT_ACTION_LABELS[accion];

  private readonly carga = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });
  protected readonly catalogo = computed(() => this.carga()?.catalog ?? null);
  protected readonly permissionCatalog = computed(() => this.carga()?.permissions ?? null);
  protected readonly atomNames = computed<Readonly<Record<string, string>>>(() =>
    Object.fromEntries((this.permissionCatalog()?.atoms ?? []).map((a) => [a.code, a.name])),
  );
  protected readonly vinculo = computed(() => this.carga()?.engagement ?? null);

  /** Lo que el rol da por defecto: lo que se marca al elegir un objetivo nuevo. */
  protected readonly paquete = computed<readonly SupportActionCode[]>(() => {
    const v = this.vinculo();
    return v === null ? [] : SUPPORT_TEMPLATE_DEFAULT_ACTIONS[v.roleTemplate];
  });
  protected readonly sucio = computed(() => hasChanges(this.guardado(), this.borrador()));
  /**
   * Los átomos de sensibilidad CRÍTICA que el borrador SUMA a lo guardado. Guardarlos no los aplica: la API (`GRANT_CHANGE`) responde
   * 202 `PENDING_APPROVAL` y los deja esperando a otra persona. Es lo único que manda a aprobar un permiso (no el puntaje de la vista
   * previa), así que es lo único que el botón anuncia.
   */
  protected readonly criticosNuevos = computed<readonly string[]>(() => {
    const antes = new Set(
      this.guardado().flatMap((g) => (g.effect === 'DENY' ? [] : [...(g.atoms ?? [])])),
    );
    const nuevos = this.borrador().flatMap((fila) =>
      fila.effect === 'DENY' ? [] : [...rowAtoms(fila)],
    );
    return [...new Set(nuevos)].filter(
      (a) => !antes.has(a as SupportAtom) && atomMeta(a)?.sensitivity === 'CRITICAL',
    );
  });
  protected readonly filasSinAcciones = computed(() =>
    this.borrador().filter((fila) => fila.actions.length === 0),
  );

  /**
   * Lo que los resúmenes locales entienden: solo permisos que **permiten** y sus paquetes de siempre. Lo demás
   * (permisos precisos, condiciones, denegaciones) lo cuenta el servidor en la vista previa de los cambios.
   */
  private readonly filasParaResumen = computed(() =>
    this.borrador()
      .filter(
        (fila) =>
          fila.effect !== 'DENY' && (fila.actions.length === 0 || coveredAliases(fila).length > 0),
      )
      .map((fila) => ({ ...fila, actions: coveredAliases(fila) })),
  );

  /** El resumen en lenguaje simple, recalculado con cada cambio del borrador. */
  protected readonly resumen = computed<readonly string[]>(() => {
    const catalogo = this.catalogo();
    return catalogo === null ? [] : summarizeGrants(this.filasParaResumen(), catalogo);
  });

  /** La vista previa: qué doctores y servicios quedan cubiertos. */
  protected readonly vistaPrevia = computed(() => {
    const catalogo = this.catalogo();
    return catalogo === null
      ? { doctors: [], services: [] }
      : previewCoverage(this.filasParaResumen(), catalogo);
  });

  /** Lo que la vista previa de los cambios muestra: la del **mismo** borrador que se va a guardar. */
  protected readonly previewView = computed<PreviewView>(() => {
    if (this.flow.request() === null) return { kind: 'idle' };
    const response = this.flow.current();
    if (response !== null) return { kind: 'ready', response };
    const state = this.flow.preview();
    return state.status === 'error'
      ? { kind: 'error', message: state.message }
      : { kind: 'loading' };
  });
  protected readonly writeKeys = computed(() => this.flow.changeSet().writes.map((w) => w.key));
  /** Las filas que el servidor marcó con errores, para listarlas junto a la matriz del modo Básico. */
  protected readonly basicIssues = computed(() =>
    this.flow
      .issues()
      .filter((i) => i.severity === 'error' && i.writeIndex !== null)
      .map((i) => ({
        issue: i,
        label: this.etiquetaDeFilaPorClave(this.writeKeys()[i.writeIndex!]),
      })),
  );
  protected readonly rowLabel = (fila: EditorGrant): string => this.etiquetaDeFila(fila);

  ngOnInit(): void {
    this.flow.attach({
      engagementId: this.engagementId,
      saved: this.guardado,
      rows: this.borrador,
    });
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    forkJoin({
      lista: this.client.listEngagements(),
      catalogo: this.client.getCatalog(),
      permissions: this.explain
        .getPermissionCatalog()
        .pipe(catchError(() => of(localPermissionCatalog()))),
      resumen: this.explain
        .getEngagementSummary(this.engagementId())
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ lista, catalogo, permissions, resumen }) => {
        const encontrado = lista.items.find((item) => item.id === this.engagementId());
        const engagement =
          encontrado === undefined
            ? undefined
            : { ...encontrado, grants: withGrantSummary(encontrado.grants, resumen) };
        if (engagement === undefined) {
          this.state.set(
            notFound({ label: 'Volver al equipo de apoyo', route: '/administration/support-team' }),
          );
          return;
        }
        const vigentes = engagement.grants.filter((grant) => grant.status === 'ACTIVE');
        this.guardado.set(vigentes);
        this.borrador.set(vigentes.map(toEditorGrant));
        this.partialNotice.set(null);
        this.vigenciaNotice.set(null);
        this.flow.reset();
        // Un árbol recién abierto muestra las sedes y los edificios.
        this.abiertos.set(
          new Set(
            catalogo.locations
              .filter((n) => n.kind === 'SITE' || n.kind === 'BUILDING')
              .map((n) => n.id),
          ),
        );
        this.state.set(ready({ engagement, catalog: catalogo, permissions }));
      },
      error: (failure: unknown) => this.state.set(errorToViewState<Carga>(failure)),
    });
  }

  /* ---- textos ------------------------------------------------------------- */

  protected rol(v: SupportEngagement): string {
    return templateLabel(v.roleTemplate);
  }
  protected dia = formatDay;

  protected etiquetaDeFila(fila: EditorGrant): string {
    const catalogo = this.catalogo();
    return catalogo === null ? '' : shortTargetLabel(fila, catalogo);
  }
  private etiquetaDeFilaPorClave(key: string | undefined): string {
    const fila = this.borrador().find((f) => f.key === key);
    return fila === undefined ? 'Un permiso' : this.etiquetaDeFila(fila);
  }

  /* ---- la matriz ----------------------------------------------------------- */

  protected tieneAccion(fila: EditorGrant, accion: SupportActionCode): boolean {
    return rowHasAlias(fila, accion);
  }
  protected alternarAccion(fila: EditorGrant, accion: SupportActionCode, marcada: boolean): void {
    this.cambiar(toggleAction(this.borrador(), fila.key, accion, marcada));
  }
  protected tieneAtomo(fila: EditorGrant, atomo: SupportAtom): boolean {
    return rowHasAtom(fila, atomo);
  }
  protected alternarAtomo(fila: EditorGrant, atomo: SupportAtom, marcada: boolean): void {
    this.cambiar(toggleAtom(this.borrador(), fila.key, atomo, marcada));
  }
  /** Cuántos permisos precisos trae la fila además de los paquetes (se quitan en «Avanzado»). */
  protected personalizados(fila: EditorGrant): number {
    return fila.actions.filter(
      (code) => !(SUPPORT_ACTION_CODES as readonly string[]).includes(code),
    ).length;
  }
  protected alternarEfecto(fila: EditorGrant, denegar: boolean): void {
    this.cambiar(setEffect(this.borrador(), fila.key, denegar ? 'DENY' : 'ALLOW'));
  }
  protected quitarFila(fila: EditorGrant): void {
    this.cambiar(removeRow(this.borrador(), fila.key));
  }
  protected cambiarModo(fila: EditorGrant, automatico: boolean): void {
    this.cambiar(setMode(this.borrador(), fila.key, automatico ? 'DYNAMIC' : 'FIXED'));
  }
  protected restablecerPaquete(): void {
    this.cambiar(applyPackage(this.borrador(), this.paquete()));
  }
  protected admiteModo(fila: EditorGrant): boolean {
    return (
      fila.targetKind === 'LOCATION' ||
      fila.targetKind.startsWith('ALL') ||
      fila.targetKind === 'SERVICE_LOCATION' ||
      fila.targetKind === 'PRACTITIONER_LOCATION'
    );
  }

  protected cambiar(nuevo: readonly EditorGrant[]): void {
    // La API no sabe «quitar» una fecha de vencimiento ya puesta (`UpdateSupportGrantDto.validTo` no admite vacío: lo ignora): se
    // puede cambiar por otra, no borrar. Dejar que el borrador la muestre vacía haría creer que se quitó cuando seguirá vigente.
    const guardados = new Map(this.guardado().map((grant) => [grant.id, grant]));
    let quitada = false;
    const ajustado = nuevo.map((fila) => {
      const original = fila.id === undefined ? undefined : guardados.get(fila.id);
      if (original?.validTo === undefined || fila.validTo !== undefined) return fila;
      quitada = true;
      return { ...fila, validTo: original.validTo };
    });
    this.vigenciaNotice.set(
      quitada
        ? 'No se puede quitar la fecha de vencimiento de un permiso ya guardado: puede cambiarla por otra. Si tiene que quedar sin fecha, quite el permiso y vuelva a darlo.'
        : null,
    );
    this.borrador.set(ajustado);
    this.partialNotice.set(null);
    this.flow.schedule();
  }

  /** El simulador no se puede dejar sin respuesta: se vuelve a pedir ya. */
  protected recalcular(): void {
    this.flow.refreshNow();
  }

  /** Lleva a la casilla, la sección o la fila del error de la vista previa. */
  protected irAlError(issue: PlacedIssue): void {
    const key = issue.writeIndex === null ? undefined : this.writeKeys()[issue.writeIndex];
    const fila = this.borrador().find((f) => f.key === key);
    const code = issue.actionIndex === undefined ? undefined : fila?.actions[issue.actionIndex];
    const esAlias =
      code !== undefined && (SUPPORT_ACTION_CODES as readonly string[]).includes(code);
    if (
      this.view() === 'basic' &&
      (issue.section !== undefined || issue.atom !== undefined || (code !== undefined && !esAlias))
    )
      this.view.set('advanced');
    if (this.view() === 'advanced') {
      afterNextRender(() => this.advanced()?.focusIssue(issue), { injector: this.injector });
      return;
    }
    if (fila !== undefined && esAlias) {
      afterNextRender(() => this.hostCell(fila.key, code as SupportActionCode)?.focus(), {
        injector: this.injector,
      });
    }
  }
  private hostCell(key: string, action: SupportActionCode): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="celda-${key}-${action}"] input`);
  }

  /* ---- guardar ------------------------------------------------------------------------------- */

  protected descartar(): void {
    this.borrador.set(this.guardado().map(toEditorGrant));
    this.intentoDeGuardar.set(false);
    this.partialNotice.set(null);
    this.vigenciaNotice.set(null);
    this.flow.schedule();
  }

  protected async guardar(): Promise<void> {
    if (this.flow.saving()) return;
    this.intentoDeGuardar.set(true);
    if (this.filasSinAcciones().length > 0) return;
    const vinculo = this.vinculo();
    if (vinculo === null) return;
    const { writes, revokeIds } = this.flow.changeSet();
    if (writes.length + revokeIds.length === 0) return;

    if (revokeIds.length > 0) {
      const confirmado = await this.dialogs.confirm({
        title: 'Retirar permisos',
        message: `Va a retirar ${revokeIds.length === 1 ? 'un permiso' : `${revokeIds.length} permisos`} a ${vinculo.personName}. Deja de regir ahora mismo.`,
        confirmLabel: 'Guardar y retirar',
        destructive: true,
      });
      if (!confirmado) return;
    }

    const result = await this.flow.save();
    if (result.status === 'saved') {
      this.intentoDeGuardar.set(false);
      if (result.pendingApproval)
        this.toasts.info('Queda pendiente de aprobación.', pendingApprovalExplanation(result.pending));
      else
        this.toasts.success(
          'Permisos guardados.',
          'Los cambios rigen ahora. Si nombró a un doctor nuevo, tiene que aceptar a la persona una vez.',
        );
      this.cargar();
    } else if (result.status === 'failed') {
      const aplicados =
        result.applied.revoked.length +
        result.applied.changed.length +
        result.applied.created.length;
      if (aplicados > 0) this.rebase(result.applied);
    }
  }

  /**
   * Algo se guardó y algo falló: se vuelve a leer lo guardado **sin perder** lo que falta del borrador (ni repetir
   * lo ya aplicado).
   */
  private rebase(applied: AppliedOps): void {
    const vinculo = this.vinculo();
    if (vinculo === null) return;
    // `cambiar` (que reabre el borrador) borra el aviso de fallo: se guarda para volver a ponerlo, que es lo que dice por qué se cortó.
    const falloPrevio = this.flow.failure();
    const { writes, revokeIds } = this.flow.changeSet();
    const filas = new Map(this.borrador().map((fila) => [fila.key, fila]));
    const pendingRevoke = new Set(revokeIds.filter((id) => !applied.revoked.includes(id)));
    const pendingChange = new Map(
      writes
        .filter((w) => w.kind === 'change' && !applied.changed.includes(w.key))
        .flatMap((w) =>
          filas.get(w.key)?.id === undefined
            ? []
            : [[filas.get(w.key)!.id!, filas.get(w.key)!] as const],
        ),
    );
    const pendingCreate = writes
      .filter((w) => w.kind === 'create' && !applied.created.includes(w.key))
      .flatMap((w) => (filas.has(w.key) ? [filas.get(w.key)!] : []));
    forkJoin({
      lista: this.client.listEngagements(),
      resumen: this.explain.getEngagementSummary(vinculo.id).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ lista, resumen }) => {
        const encontrado = lista.items.find((item) => item.id === vinculo.id);
        if (encontrado === undefined) return;
        const engagement = { ...encontrado, grants: withGrantSummary(encontrado.grants, resumen) };
        const vigentes = engagement.grants.filter((grant) => grant.status === 'ACTIVE');
        this.guardado.set(vigentes);
        const filasNuevas = vigentes
          .filter((g) => !pendingRevoke.has(g.id))
          .map((g) => pendingChange.get(g.id) ?? toEditorGrant(g));
        this.cambiar([...filasNuevas, ...pendingCreate]);
        this.flow.failure.set(falloPrevio);
        const falta = {
          revoked: [...pendingRevoke],
          changed: [...pendingChange.keys()],
          created: pendingCreate.map((fila) => fila.key),
          awaiting: [] as string[],
        };
        this.partialNotice.set(
          `Ya quedó guardado: ${describeOps(applied)}.${
            applied.awaiting.length > 0
              ? ` Esperando aprobación de otra persona: ${applied.awaiting.length === 1 ? 'un cambio' : `${applied.awaiting.length} cambios`}.`
              : ''
          } Falta guardar: ${describeOps(falta)}. Lo que falta sigue en la pantalla: revise y vuelva a guardar.`,
        );
      },
    });
  }
}
