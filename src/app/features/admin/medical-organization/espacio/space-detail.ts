import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type UrlTree } from '@angular/router';
import { catchError, firstValueFrom, map, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import {
  ACCIONES_POR_ESTADO,
  bloqueosDelError,
  ETIQUETA_DE_BLOQUEO,
  formasHijasPermitidas,
  ofrecerEscritura,
  perfilDe,
} from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type {
  CareSpaceDetail,
  CareSpaceHistoryEntry,
  CareSpaceNode,
  LifecycleAction,
  RetireBlocker,
  SiteStructure,
  SpaceUnitAssignment,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, empty, loading, mapData, ready, routeAuthPending } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Link } from '../../../../shared/components/atoms/link/link';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CatalogoDeInfraestructuraStore } from '../infraestructura/catalogo-de-infraestructura.store';
import {
  RUTA_DE_ALTA,
  RUTA_DE_ALTA_MASIVA,
  RUTA_DE_CONSOLA,
  rutaDeEdicion,
  rutaDeEspacio,
  varianteDe,
  volverALaConsola,
} from '../infraestructura/infraestructura.presentacion';
import { PESTANAS_DE_LA_FICHA, TEXTO_DE_ACCION, type PestanaDeLaFicha } from './ciclo-de-vida';
import { MoverDialog } from './mover-dialog';
import { VincularUnidadDialog } from './vincular-unidad-dialog';

/**
 * **Ficha de un espacio** — `administration/medical-organization/spaces/:id`.
 *
 * UNA tarjeta centrada, a lo ancho, con las cinco pestañas del contrato §4
 * (regla del cliente del 09/09/2026): General · Atributos técnicos · Unidades ·
 * Hijos · Historial. La pestaña viaja en `?tab=`.
 *
 * ## Las mutaciones se releen
 *
 * Activar, suspender, retirar, mover, vincular: cada una manda la petición
 * (con `If-Match` donde corresponde) y **vuelve a pedir la ficha**. Lo que se
 * ve después es lo que respondió la API, nunca lo que se supone que cambió.
 *
 * ## Retirar
 *
 * Antes de pedir el motivo se consulta `retire-check`: si hay bloqueos se
 * muestran con su próxima acción (S3) y no se ofrece confirmar. Si igual llega
 * un 409 `SPACE_RETIRE_BLOCKED` —alguien agendó algo en el medio— se muestra
 * la misma lista.
 *
 * Supera las 300 líneas porque orquesta cinco pestañas y cinco mutaciones de
 * un mismo agregado; los modales con formulario viven aparte (`MoverDialog`,
 * `VincularUnidadDialog`) y los textos en `ciclo-de-vida.ts`.
 */
@Component({
  selector: 'app-space-detail',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Link,
    Badge,
    Card,
    ContentDialog,
    DataTable,
    FactList,
    MoverDialog,
    PageHeader,
    RouterLink,
    Tab,
    Tabs,
    VincularUnidadDialog,
    ViewStateHost,
  ],
  templateUrl: './space-detail.html',
  styleUrl: './space-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceDetail {
  private readonly client = inject(InfrastructureClient);
  private readonly catalogoStore = inject(CatalogoDeInfraestructuraStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly varianteDe = varianteDe;
  protected readonly rutaDeEspacio = rutaDeEspacio;
  protected readonly rutaDeConsola = RUTA_DE_CONSOLA;
  protected readonly rutaDeAlta = RUTA_DE_ALTA;
  protected readonly rutaDeAltaMasiva = RUTA_DE_ALTA_MASIVA;
  protected readonly textoDeAccion = TEXTO_DE_ACCION;
  protected readonly etiquetaDeBloqueo = ETIQUETA_DE_BLOQUEO;

  private readonly parametros = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly id = computed(() => this.parametros().get('id') ?? '');

  protected readonly pestana = linkedSignal<number>(() => {
    const i = PESTANAS_DE_LA_FICHA.indexOf(this.query().get('tab') as PestanaDeLaFicha);
    return i === -1 ? 0 : i;
  });

  /** S1 hasta que se sabe a quién se le piden los datos (el guard ya corrió). */
  protected readonly ficha = signal<ViewState<CareSpaceDetail>>(routeAuthPending());
  private readonly historialInterno = signal<ViewState<readonly CareSpaceHistoryEntry[]>>(loading());
  private readonly estructura = signal<SiteStructure | null>(null);

  /** El fallo de la última mutación (S4/S5/S6/S8/S9), una sola vez arriba de la tarjeta. */
  protected readonly falloDeAccion = signal<ViewState<never> | null>(null);
  protected readonly bloqueos = signal<readonly RetireBlocker[] | null>(null);
  protected readonly dialogo = signal<'mover' | 'vincular' | null>(null);
  protected readonly trabajando = signal(false);

  protected readonly espacio = computed(() => dataOf(this.ficha()));
  protected readonly catalogo = computed(() => dataOf(this.catalogoStore.estado()));

  protected readonly puedeEscribir = computed(
    () =>
      // Sin organización propia: `dev` retiró `ownTenantId` (la API no lo
      // firma, TX-11). Se ofrece a la plataforma; la API decide igual.
      ofrecerEscritura(this.session.roles(), this.session.activeTenantId(), null) &&
      this.espacio()?.status.code !== 'SPACE_RETIRED',
  );

  protected readonly acciones = computed<readonly LifecycleAction[]>(() => {
    const e = this.espacio();
    return e === null ? [] : (ACCIONES_POR_ESTADO[e.status.code] ?? []);
  });

  protected readonly titulo = computed(() => this.espacio()?.name ?? 'Espacio');
  protected readonly subtitulo = computed(() => {
    const e = this.espacio();
    return e === null ? 'Ficha del espacio' : e.path.map((p) => p.name).join(' › ');
  });

  protected readonly volver = computed(() => volverALaConsola(this.espacio()?.siteId ?? null, this.espacio()?.id ?? null));

  private readonly unidades = computed(() => new Map((this.estructura()?.units ?? []).map((u) => [u.id, u])));
  protected readonly perfil = computed(() => {
    const catalogo = this.catalogo();
    const e = this.espacio();
    return catalogo === null || e === null ? null : perfilDe(catalogo, e.function.code);
  });

  protected readonly hechosGenerales = computed<readonly Hecho[]>(() => {
    const e = this.espacio();
    if (e === null) return [];
    const esCama = e.form.code === 'LOC_FORM_BED';
    return [
      { etiqueta: 'Código', valor: e.code },
      { etiqueta: 'Forma', valor: e.form.display },
      { etiqueta: 'Función', valor: e.function.display },
      { etiqueta: 'Ciclo de vida', valor: e.status.display, tono: e.status.code === 'SPACE_ACTIVE' ? 'ok' : 'aviso' },
      { etiqueta: 'Disponibilidad', valor: e.operationalStatus?.display ?? null },
      { etiqueta: 'Unidad propietaria', valor: e.clinicalUnitId === null ? 'Sin unidad' : (this.unidades().get(e.clinicalUnitId)?.name ?? 'Cargando…') },
      { etiqueta: 'Capacidad', valor: e.capacity === null ? null : String(e.capacity) },
      { etiqueta: 'Camas activas', valor: esCama ? null : String(e.derived.beds) },
      { etiqueta: 'Camas censables', valor: esCama ? null : String(e.derived.censableBeds) },
      { etiqueta: 'Hijos activos', valor: esCama ? null : String(e.derived.activeChildren) },
      { etiqueta: 'Vigente desde', valor: soloFecha(e.validFrom) },
      { etiqueta: 'Retirado el', valor: soloFecha(e.validTo) },
      { etiqueta: 'Descripción', valor: e.description },
    ];
  });

  protected readonly hechosTecnicos = computed<readonly Hecho[]>(() => {
    const e = this.espacio();
    if (e === null) return [];
    const n = (v: number | null, sufijo = '') => (v === null ? null : `${v.toLocaleString('es-BO')}${sufijo}`);
    return [
      { etiqueta: 'Superficie útil', valor: n(e.areaM2, ' m²') },
      { etiqueta: 'Piso', valor: n(e.floorNumber) },
      { etiqueta: 'Asepsia', valor: e.asepsis?.display ?? null },
      { etiqueta: 'Presión', valor: e.pressure?.display ?? null },
      { etiqueta: 'Renovaciones de aire por hora', valor: n(e.airChangesPerHour) },
      { etiqueta: 'Validación de climatización', valor: e.hvacValidatedOn },
      { etiqueta: 'Restricción por sexo', valor: e.sexRestriction?.display ?? null },
      { etiqueta: 'Grupo de edad', valor: e.ageGroup?.display ?? null },
      { etiqueta: 'Categoría de cama', valor: e.bedCategory?.display ?? null },
      { etiqueta: 'Censable', valor: e.censable === null ? null : e.censable ? 'Sí' : 'No' },
      { etiqueta: 'Preparación', valor: n(e.prepMinutes, ' min') },
      { etiqueta: 'Limpieza', valor: n(e.cleanupMinutes, ' min') },
      { etiqueta: 'GLN', valor: e.gln },
    ];
  });

  /** Lo que la función hace con el espacio, del perfil del catálogo. */
  protected readonly comportamiento = computed(() => {
    const p = this.perfil();
    if (p === null) return [];
    const banderas: readonly [boolean, string][] = [
      [p.schedulable, 'Agendable'],
      [p.inpatient, 'Internación'],
      [p.billable, 'Facturable'],
      [p.isolationCapable, 'Apto para aislamiento'],
      [p.stockPoint, 'Punto de stock'],
      [p.hostsEquipment, 'Aloja equipos'],
      [p.requiresTerminalCleaning, 'Limpieza terminal'],
    ];
    return banderas.filter(([activa]) => activa).map(([, texto]) => texto);
  });

  /** Plan §2.3: un local de aislamiento sin validación de climatización no es apto. */
  protected readonly aislamientoSinValidar = computed(
    () => this.perfil()?.isolationCapable === true && !this.espacio()?.hvacValidatedOn,
  );

  protected readonly hijos = computed<ViewState<readonly CareSpaceNode[]>>(() => {
    const estado = mapData(this.ficha(), (e) => e.children);
    const e = this.espacio();
    if (estado.status === 'ready' && estado.data.length === 0 && e !== null) {
      const catalogo = this.catalogo();
      const admite = catalogo === null || formasHijasPermitidas(catalogo, e.form.code).length > 0;
      return empty(
        admite
          ? { label: 'Agregar un espacio adentro', route: `${RUTA_DE_ALTA}?site=${e.siteId}&parent=${e.id}` }
          : { label: 'Volver a la infraestructura', route: `${RUTA_DE_CONSOLA}?tab=infrastructure&site=${e.siteId}&space=${e.id}` },
        admite ? 'Este espacio todavía no tiene nada adentro.' : `Un espacio de forma «${e.form.display}» no admite espacios adentro.`,
      );
    }
    return estado;
  });

  protected readonly vinculos = computed<ViewState<readonly SpaceUnitAssignment[]>>(() => {
    const estado = mapData(this.ficha(), (e) => e.assignments);
    return estado.status === 'ready' && estado.data.length === 0
      ? empty({ label: 'Vinculalo con «Vincular unidad»' }, 'El espacio no está vinculado a ninguna unidad: nadie lo tiene a cargo.')
      : estado;
  });

  protected readonly historial = computed<ViewState<readonly CareSpaceHistoryEntry[]>>(() => {
    const estado = this.historialInterno();
    return estado.status === 'ready' && estado.data.length === 0
      ? empty({ label: 'Volver a la ficha', route: rutaDeEspacio(this.id()) }, 'Todavía no hay cambios registrados.')
      : estado;
  });

  private readonly celdaHijo = viewChild.required<TemplateRef<{ $implicit: CareSpaceNode }>>('celdaHijo');
  private readonly celdaFuncionHijo = viewChild.required<TemplateRef<{ $implicit: CareSpaceNode }>>('celdaFuncionHijo');
  private readonly celdaEstadoHijo = viewChild.required<TemplateRef<{ $implicit: CareSpaceNode }>>('celdaEstadoHijo');
  private readonly celdaUnidad = viewChild.required<TemplateRef<{ $implicit: SpaceUnitAssignment }>>('celdaUnidad');
  private readonly celdaRol = viewChild.required<TemplateRef<{ $implicit: SpaceUnitAssignment }>>('celdaRol');
  private readonly celdaAccionVinculo = viewChild.required<TemplateRef<{ $implicit: SpaceUnitAssignment }>>('celdaAccionVinculo');

  protected readonly columnasDeHijos = computed<readonly ColumnDef<CareSpaceNode>[]>(() => [
    { key: 'name', header: 'Espacio', priority: 1, cell: this.celdaHijo() },
    { key: 'function', header: 'Función', priority: 2, cell: this.celdaFuncionHijo() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoHijo() },
  ]);

  protected readonly columnasDeVinculos = computed<readonly ColumnDef<SpaceUnitAssignment>[]>(() => [
    { key: 'clinicalUnitId', header: 'Unidad', priority: 1, cell: this.celdaUnidad() },
    { key: 'role', header: 'Rol', priority: 1, cell: this.celdaRol() },
    { key: 'validFrom', header: 'Desde', priority: 2 },
    ...(this.puedeEscribir() ? [{ key: 'id', header: 'Acciones', priority: 1, cell: this.celdaAccionVinculo(), align: 'end' as const }] : []),
  ]);

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;

  constructor() {
    this.catalogoStore.asegurar();
    effect(() => {
      const id = this.id();
      untracked(() => this.cargar(id));
    });
  }

  protected cambiarPestana(indice: number): void {
    this.pestana.set(indice);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: PESTANAS_DE_LA_FICHA[indice] ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected recargar(): void {
    this.cargar(this.id());
  }

  /** Una próxima acción con query (`?tab=children`) como `UrlTree`, no como segmento. */
  protected enlace(ruta: string): UrlTree {
    return this.router.parseUrl(ruta);
  }

  protected rutaDeEdicion(): string {
    return rutaDeEdicion(this.id());
  }

  protected nombreDeUnidad(id: string): string {
    return this.unidades().get(id)?.name ?? 'Unidad';
  }

  protected funcionDe(nodo: CareSpaceNode): string {
    return nodo.function.display;
  }

  protected abrirDialogo(cual: 'mover' | 'vincular'): void {
    this.falloDeAccion.set(null);
    this.dialogo.set(cual);
  }

  /** Después de una mutación en un modal: cerrar y releer. */
  protected alGuardarEnDialogo(): void {
    this.dialogo.set(null);
    this.recargar();
  }

  protected async cambiarCiclo(accion: LifecycleAction): Promise<void> {
    const e = this.espacio();
    if (e === null || this.trabajando()) return;
    this.falloDeAccion.set(null);
    this.bloqueos.set(null);
    const texto = TEXTO_DE_ACCION[accion];

    if (accion === 'retire') {
      this.trabajando.set(true);
      const chequeo = await firstValueFrom(
        this.client.retireCheck(e.id).pipe(catchError((error: unknown) => of({ error }))),
      );
      this.trabajando.set(false);
      if ('error' in chequeo) {
        this.falloDeAccion.set(errorToViewState<never>(chequeo.error));
        return;
      }
      if (chequeo.blockers.length > 0) {
        this.bloqueos.set(chequeo.blockers);
        return;
      }
    }

    let motivo: string | undefined;
    if (texto.pideMotivo) {
      const escrito = await this.dialogs.confirmWithReason(
        { title: texto.titulo, message: texto.mensaje(e.name), confirmLabel: texto.confirmar, destructive: texto.destructiva },
        { label: 'Motivo', hint: 'Queda en el historial del espacio.', minLength: 5, maxLength: 500 },
      );
      if (escrito === null) return;
      motivo = escrito;
    } else {
      const confirmado = await this.dialogs.confirm({ title: texto.titulo, message: texto.mensaje(e.name), confirmLabel: texto.confirmar });
      if (!confirmado) return;
    }

    this.trabajando.set(true);
    this.client.changeLifecycle(e.id, e.rowVersion, { action: accion, ...(motivo === undefined ? {} : { reason: motivo }) }).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.recargar();
      },
      error: (error: unknown) => {
        this.trabajando.set(false);
        const bloqueos = bloqueosDelError(error);
        if (bloqueos !== null) this.bloqueos.set(bloqueos);
        else this.falloDeAccion.set(errorToViewState<never>(error));
      },
    });
  }

  protected async desvincular(vinculo: SpaceUnitAssignment): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Desvincular la unidad',
      message: `${this.nombreDeUnidad(vinculo.clinicalUnitId)} deja de tener este espacio como ${vinculo.role.display.toLowerCase()}. El vínculo queda en el historial con su fecha de fin.`,
      confirmLabel: 'Desvincular',
      destructive: true,
    });
    if (!confirmado) return;
    this.client.unassignUnit(this.id(), vinculo.id).subscribe({
      next: () => this.recargar(),
      error: (error: unknown) => this.falloDeAccion.set(errorToViewState<never>(error)),
    });
  }

  private cargar(id: string): void {
    this.ficha.set(loading());
    this.client
      .getCareSpace(id)
      .pipe(
        map((d) => ready(d) as ViewState<CareSpaceDetail>),
        catchError((error: unknown) => of(errorToViewState<CareSpaceDetail>(error))),
      )
      .subscribe((estado) => {
        this.ficha.set(
          estado.status === 'not-found'
            ? { status: 'not-found', nextAction: { label: 'Volver a la infraestructura', route: `${RUTA_DE_CONSOLA}?tab=infrastructure` } }
            : estado,
        );
        if (estado.status === 'ready') this.cargarContexto(estado.data);
      });
  }

  /** Lo que la ficha necesita además del espacio: el historial y el árbol del establecimiento. */
  private cargarContexto(espacio: CareSpaceDetail): void {
    this.historialInterno.set(loading());
    this.client
      .getCareSpaceHistory(espacio.id)
      .pipe(
        map((h) => ready(h) as ViewState<readonly CareSpaceHistoryEntry[]>),
        catchError((error: unknown) => of(errorToViewState<readonly CareSpaceHistoryEntry[]>(error))),
      )
      .subscribe((estado) => this.historialInterno.set(estado));
    this.client
      .getStructure(espacio.siteId)
      .pipe(catchError(() => of(null)))
      .subscribe((estructura) => this.estructura.set(estructura));
  }

  protected estructuraCargada(): SiteStructure | null {
    return this.estructura();
  }
}

function soloFecha(iso: string | null): string | null {
  return iso === null ? null : iso.slice(0, 10);
}
