import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { SessionStore } from '../../../../../core/auth/session.store';
import { InfrastructureCatalogStore } from '../../../../../core/data-access/infrastructure/infrastructure-catalog.store';
import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState, readInfrastructureError } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import type {
  CareSpaceDetail,
  CareSpaceNode,
  InfrastructureCatalog,
  LifecycleAction,
  RetireBlocker,
  SiteStructure,
  SpaceHistory,
  SpaceUnitAssignment,
} from '../../../../../core/data-access/infrastructure/infrastructure.types';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader, type PageHeaderAction } from '../../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import type { BreadcrumbItem } from '../../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { BulkCreateDialog } from '../bulk-create-dialog/bulk-create-dialog';
import { fechaCorta, fechaYHora, permisosDe, rutaDeEspacio, varianteDeEstado } from '../infrastructure.view';
import { InfraIssueAlert } from '../issue-alert';
import { RetireBlockersDialog } from '../retire-blockers-dialog/retire-blockers-dialog';
import { SpaceFormDialog } from '../space-form-dialog/space-form-dialog';
import { UnitLinkDialog } from '../unit-link-dialog/unit-link-dialog';

interface Ficha {
  readonly detail: CareSpaceDetail;
  readonly structure: SiteStructure;
  readonly catalog: InfrastructureCatalog;
}

/** Las pestañas de la ficha, en el orden del contrato. */
export const PESTANAS_DE_LA_FICHA = ['General', 'Atributos técnicos', 'Unidades', 'Hijos', 'Historial'] as const;
const PESTANA_HISTORIAL = 4;
/** El lápiz abre el formulario en la página que corresponde a la pestaña que se miraba. */
const PAGINA_POR_PESTANA: readonly number[] = [0, 2, 1, 0, 0];

const ETIQUETA_DE_ACCION: Readonly<Record<LifecycleAction, string>> = {
  activate: 'Activar',
  suspend: 'Suspender',
  reactivate: 'Reactivar',
  retire: 'Clausurar',
};

/**
 * **Ficha de un espacio** — `administration/medical-organization/spaces/:id`.
 *
 * Regla del cliente del 09/09/2026: la ficha es **lo único de su pantalla**, así
 * que va centrada, a lo ancho del área de contenido y en **una tarjeta con
 * pestañas** (General · Atributos técnicos · Unidades · Hijos · Historial). Sin
 * columna lateral reservada y sin tarjetas apiladas.
 *
 * ## Qué carga
 *
 * El espacio (`GET /care-spaces/:id`), la estructura de su establecimiento —de
 * ahí salen los nombres de las unidades, la tipología y qué puede hacer quien
 * mira— y el catálogo. Las tres a la vez; si cualquiera falla, la ficha dice
 * cuál de los nueve estados es (S5 prohibido, S6 no encontrado sin revelar nada,
 * S8 sin conexión, S9 con código de soporte). El historial se pide al abrir su
 * pestaña, con su propio estado.
 *
 * ## Qué cambia y cómo
 *
 * - **Editar**: `SpaceFormDialog`, con `If-Match` del `rowVersion` mostrado.
 * - **Activar / reactivar**: confirmación; si el padre no está activo la API
 *   responde `PARENT_NOT_ACTIVE` y la ficha ofrece abrir al padre.
 * - **Suspender**: `confirmWithReason`, motivo obligatorio.
 * - **Clausurar**: primero `retire-check`. Con bloqueos, el diálogo los lista con
 *   la próxima acción de cada uno y no deja confirmar; sin bloqueos,
 *   `confirmWithReason`. La API revalida al clausurar: si aparece un bloqueo
 *   nuevo, el diálogo se abre con la lista actualizada.
 *
 * Los botones sólo reflejan lo que el servidor dice que se puede
 * (`SiteSummary.viewer`); ocultar no es seguridad y la API responde 403 igual.
 */
@Component({
  selector: 'app-space-detail',
  imports: [
    AppButton,
    Badge,
    BulkCreateDialog,
    Card,
    InfraIssueAlert,
    PageHeader,
    RetireBlockersDialog,
    RouterLink,
    SpaceFormDialog,
    Tab,
    Tabs,
    UnitLinkDialog,
    ViewStateHost,
  ],
  templateUrl: './space-detail.html',
  styleUrl: './space-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceDetail {
  private readonly client = inject(InfrastructureClient);
  private readonly catalogStore = inject(InfrastructureCatalogStore);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);

  private readonly spaceId = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly id = computed(() => this.spaceId().get('id') ?? '');

  protected readonly pestanas = PESTANAS_DE_LA_FICHA;
  protected readonly pestana = signal(0);

  protected readonly state = signal<ViewState<Ficha>>(loading());
  protected readonly ficha = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });
  protected readonly detail = computed(() => this.ficha()?.detail ?? null);
  protected readonly permisos = computed(() => permisosDe(this.ficha()?.structure.site ?? null, this.session.roles()));

  // ─ historial (pestaña propia, pide al abrirse)
  protected readonly historial = signal<ViewState<SpaceHistory>>(loading());
  protected readonly entradas = computed(() => {
    const h = this.historial();
    return h.status === 'ready' || h.status === 'stale' ? h.data.entries : [];
  });
  private historialDe: string | null = null;

  // ─ acciones
  protected readonly accionError = signal<ViewState<unknown> | null>(null);
  protected readonly accionEnCurso = signal<LifecycleAction | null>(null);
  protected readonly reasonDelError = signal<string | null>(null);

  protected readonly edicion = signal<{ paso: number } | null>(null);
  protected readonly agregando = signal<'uno' | 'varios' | null>(null);
  protected readonly vinculando = signal(false);
  protected readonly bloqueos = signal<{ blockers: readonly RetireBlocker[]; asOf: string | null } | null>(null);
  protected readonly comprobando = signal(false);

  protected readonly rutaDeEspacio = rutaDeEspacio;
  protected readonly varianteDeEstado = varianteDeEstado;
  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaYHora = fechaYHora;

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const d = this.detail();
    return [
      { label: 'Mis organizaciones', routerLink: '/administration/medical-organization' },
      ...(d?.path ?? []).map((p) => ({ label: p.name, routerLink: rutaDeEspacio(p.id) })),
      { label: d?.name ?? 'Espacio' },
    ];
  });

  protected readonly unidadesPorId = computed(
    () => new Map((this.ficha()?.structure.units ?? []).map((u) => [u.id, u])),
  );

  protected readonly propietaria = computed(() => {
    const d = this.detail();
    const vinculo = d?.assignments.find((a) => a.role.code === 'SPACE_UNIT_ROLE_OWNER');
    return vinculo === undefined ? null : (this.unidadesPorId().get(vinculo.clinicalUnitId)?.name ?? null);
  });

  /** Acciones del encabezado según el estado y los permisos: sólo las que se pueden pedir. */
  protected readonly acciones = computed<readonly PageHeaderAction[]>(() => {
    const d = this.detail();
    if (d === null || !this.permisos().canWriteStructure || d.status.code === 'SPACE_RETIRED') return [];
    const lista: PageHeaderAction[] = [{ code: 'edit', label: 'Editar', icon: 'edit' }];
    switch (d.status.code) {
      case 'SPACE_PLANNED':
        lista.push({ code: 'activate', label: 'Activar', icon: 'check-circle' });
        break;
      case 'SPACE_ACTIVE':
        lista.push({ code: 'suspend', label: 'Suspender', icon: 'clock' });
        break;
      case 'SPACE_SUSPENDED':
        lista.push({ code: 'reactivate', label: 'Reactivar', icon: 'refresh' });
        break;
    }
    lista.push({ code: 'retire', label: 'Clausurar', icon: 'remove' });
    return lista;
  });

  protected readonly hijosEditables = computed(() => {
    const d = this.detail();
    return this.permisos().canWriteStructure && d !== null && d.status.code !== 'SPACE_RETIRED';
  });

  protected readonly puedeAgregarHijos = computed(() => {
    const d = this.detail();
    const c = this.ficha()?.catalog;
    if (d === null || c === undefined) return false;
    return c.parentRules.some((r) => r.parent === d.form.code);
  });

  protected readonly puedeAgregarVarios = computed(() => {
    const d = this.detail();
    const c = this.ficha()?.catalog;
    return d !== null && c !== undefined && c.parentRules.some((r) => r.parent === d.form.code && r.child === 'LOC_FORM_BED');
  });

  protected readonly codigosUsados = computed(() => new Set((this.ficha()?.structure.spaces ?? []).map((s) => s.code)));

  protected readonly unidadesVinculadas = computed(
    () => new Set((this.detail()?.assignments ?? []).map((a) => a.clinicalUnitId)),
  );

  protected readonly nodoPadre = computed<CareSpaceNode | null>(() => {
    const d = this.detail();
    return d === null ? null : (this.ficha()?.structure.spaces.find((s) => s.id === d.id) ?? null);
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.cargar(id));
    });
    // El historial se pide al abrir su pestaña, una vez por espacio.
    effect(() => {
      const abierta = this.pestana() === PESTANA_HISTORIAL;
      const id = this.id();
      untracked(() => {
        if (abierta && this.historialDe !== id && this.permisos().canSeeHistory) this.cargarHistorial(id);
      });
    });
  }

  protected recargar(): void {
    this.cargar(this.id());
  }

  private cargar(id: string): void {
    if (id === '') return;
    this.state.set(loading());
    this.historialDe = null;
    this.accionError.set(null);
    this.client
      .getCareSpace(id)
      .pipe(
        switchMap((detail) =>
          forkJoin({
            detail: of(detail),
            structure: this.client.getStructure(detail.siteId),
            catalog: this.catalogStore.catalog(),
          }),
        ),
      )
      .subscribe({
        next: (ficha) => this.state.set(ready(ficha)),
        error: (error: unknown) => this.state.set(infrastructureErrorToViewState<Ficha>(error)),
      });
  }

  protected cargarHistorial(id: string = this.id()): void {
    this.historialDe = id;
    this.historial.set(loading());
    this.client.getHistory(id).subscribe({
      next: (h) => this.historial.set(ready(h)),
      error: (error: unknown) => this.historial.set(infrastructureErrorToViewState<SpaceHistory>(error)),
    });
  }

  /** Cambia el detalle mostrado sin volver a pedir todo: la respuesta de una mutación es la ficha nueva. */
  private conDetalle(detail: CareSpaceDetail): void {
    const f = this.ficha();
    if (f === null) return;
    this.state.set(ready({ ...f, detail }));
    // La estructura (hijos, estado en el árbol) y el historial quedaron viejos.
    this.client.getStructure(detail.siteId).subscribe({ next: (structure) => this.state.set(ready({ ...f, detail, structure })) });
    this.historialDe = null;
    if (this.pestana() === PESTANA_HISTORIAL) this.cargarHistorial(detail.id);
  }

  protected alElegirAccion(code: string): void {
    switch (code) {
      case 'edit':
        this.edicion.set({ paso: PAGINA_POR_PESTANA[this.pestana()] ?? 0 });
        break;
      case 'activate':
      case 'reactivate':
        void this.cambiarCiclo(code);
        break;
      case 'suspend':
        void this.suspender();
        break;
      case 'retire':
        void this.clausurar();
        break;
    }
  }

  private async cambiarCiclo(action: 'activate' | 'reactivate'): Promise<void> {
    const d = this.detail();
    if (d === null) return;
    const ok = await this.dialogs.confirm({
      title: `${ETIQUETA_DE_ACCION[action]} «${d.name}»`,
      message: action === 'activate'
        ? 'El espacio pasa a estar activo: desde ahí su código y su forma ya no se pueden cambiar.'
        : 'El espacio vuelve a ofrecerse con normalidad.',
      confirmLabel: ETIQUETA_DE_ACCION[action],
    });
    if (ok) this.ejecutar(action);
  }

  private async suspender(): Promise<void> {
    const d = this.detail();
    if (d === null) return;
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: `Suspender «${d.name}»`,
        message: 'Deja de poder reservarse u ocuparse hasta que se reactive. No se pierde nada.',
        confirmLabel: 'Suspender',
      },
      { label: 'Motivo de la suspensión', hint: 'Queda en el historial del espacio.' },
    );
    if (motivo !== null) this.ejecutar('suspend', motivo);
  }

  private async clausurar(): Promise<void> {
    const d = this.detail();
    if (d === null || this.comprobando()) return;
    this.comprobando.set(true);
    this.client.retireCheck(d.id).subscribe({
      next: async (r) => {
        this.comprobando.set(false);
        if (r.blockers.length > 0) {
          this.bloqueos.set({ blockers: r.blockers, asOf: r.asOf ?? null });
          return;
        }
        const motivo = await this.dialogs.confirmWithReason(
          {
            title: `Clausurar «${d.name}»`,
            message: 'Se cierra con la fecha de hoy. No se borra nada: la historia sigue apuntando a este espacio y su código no se reutiliza.',
            confirmLabel: 'Clausurar',
            destructive: true,
          },
          { label: 'Motivo de la clausura', hint: 'Queda en el historial del espacio.' },
        );
        if (motivo !== null) this.ejecutar('retire', motivo);
      },
      error: (error: unknown) => {
        this.comprobando.set(false);
        this.accionError.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }

  protected recomprobar(): void {
    const d = this.detail();
    if (d === null) return;
    this.comprobando.set(true);
    this.client.retireCheck(d.id).subscribe({
      next: (r) => {
        this.comprobando.set(false);
        // Sin bloqueos ya no hay nada que mostrar: se cierra y se vuelve a clausurar.
        if (r.blockers.length === 0) {
          this.bloqueos.set(null);
          void this.clausurar();
        } else {
          this.bloqueos.set({ blockers: r.blockers, asOf: r.asOf ?? null });
        }
      },
      error: (error: unknown) => {
        this.comprobando.set(false);
        this.bloqueos.set(null);
        this.accionError.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }

  private ejecutar(action: LifecycleAction, reason?: string): void {
    const d = this.detail();
    if (d === null) return;
    this.accionEnCurso.set(action);
    this.accionError.set(null);
    this.reasonDelError.set(null);
    this.client.changeLifecycle(d.id, d.rowVersion, { action, ...(reason === undefined ? {} : { reason }) }).subscribe({
      next: (detail) => {
        this.accionEnCurso.set(null);
        this.conDetalle(detail);
      },
      error: (error: unknown) => {
        this.accionEnCurso.set(null);
        const detalle = readInfrastructureError(error);
        if (detalle?.reason === 'SPACE_RETIRE_BLOCKED') {
          this.bloqueos.set({ blockers: detalle.blockers, asOf: null });
          return;
        }
        this.reasonDelError.set(detalle?.reason ?? null);
        this.accionError.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }

  protected alGuardar(detail: CareSpaceDetail): void {
    this.edicion.set(null);
    this.agregando.set(null);
    this.conDetalle(detail);
  }

  protected alAgregarHijos(): void {
    this.agregando.set(null);
    this.recargar();
  }

  protected alVincular(_vinculo: SpaceUnitAssignment): void {
    this.vinculando.set(false);
    this.recargar();
  }

  protected async cerrarVinculo(vinculo: SpaceUnitAssignment): Promise<void> {
    const d = this.detail();
    if (d === null) return;
    const unidad = this.unidadesPorId().get(vinculo.clinicalUnitId)?.name ?? 'la unidad';
    const ok = await this.dialogs.confirm({
      title: 'Cerrar el vínculo',
      message: `«${d.name}» deja de estar vinculado con ${unidad}. El vínculo queda cerrado con la fecha de hoy en el historial; no se borra.`,
      confirmLabel: 'Cerrar vínculo',
    });
    if (!ok) return;
    this.client.closeUnitAssignment(d.id, vinculo.id).subscribe({
      next: () => this.recargar(),
      error: (error: unknown) => this.accionError.set(infrastructureErrorToViewState<unknown>(error)),
    });
  }

  protected nombreDeUnidad(id: string): string {
    return this.unidadesPorId().get(id)?.name ?? 'Unidad';
  }

  protected readonly etiquetasDeAccion = ETIQUETA_DE_ACCION;
}
