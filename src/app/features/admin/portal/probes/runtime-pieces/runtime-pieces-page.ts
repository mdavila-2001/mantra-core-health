import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import type { Subscription } from 'rxjs';

import { RuntimePiecesClient } from '../../../../../core/data-access/admin-portal/runtime-pieces.client';
import type { InstanceState } from '../../../../../core/data-access/admin-portal/ops-liveness.types';
import {
  PIECE_KINDS,
  PIECE_STATES,
  type EvidenceLevel,
  type FindingRule,
  type FindingSeverity,
  type PieceKind,
  type PieceState,
  type RuntimeFinding,
  type RuntimeInstance,
  type RuntimePiece,
  type RuntimePiecesPage as Respuesta,
} from '../../../../../core/data-access/admin-portal/runtime-pieces.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { empty, loading, ready, stale } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  ESTADOS_DE_INSTANCIA,
  haceCuanto,
  segundosEntre,
} from '../../../instances/instances-labels';
import { FilterForm, type FilterField } from '../../governance/filter-form';
import { portalUrl } from '../../portal-nav';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import {
  CLAVES_DE_FILTRO,
  CLAVES_URL,
  ESTADOS_DE_PIEZA,
  GRAVEDADES,
  NIVELES_DE_EVIDENCIA,
  PESTANAS,
  REGLAS_DE_HALLAZGO,
  TIPOS_DE_PIEZA,
  causaDePieza,
  consultaDe,
  fallaDeDescubrimiento,
  hayFiltros,
  paginaDe,
  pestanaDe,
  textoDeCadencia,
  textoDeInforme,
  textoDeLatido,
  textoDeNoMedido,
} from './runtime-pieces-labels';

/** Cada cuánto se vuelve a pedir, salvo que la persona prefiera movimiento reducido. */
export const INTERVALO_DE_REFRESCO_MS = 30_000;
/** Pasado esto desde `evaluatedAt`, el dato se declara atrasado (S7). */
const ATRASADO_TRAS_MS = 2 * INTERVALO_DE_REFRESCO_MS;
const PANTALLA = portalUrl('systems/runtime-pieces');

interface Aviso {
  readonly tono: 'success' | 'info' | 'error';
  readonly texto: string;
}

/**
 * Piezas en ejecución: todo lo que el código puede tener corriendo (procesos,
 * tareas programadas, consumidores de cola, endpoints internos, comprobaciones
 * de salud y conectores), contrastado por el servidor con el registro de
 * herramientas y con los latidos. El estado lo decide la API; acá se muestra
 * con su antigüedad, y lo que no se mide se declara, nunca se pinta como viva.
 *
 * La pestaña, los filtros y la página viven en la URL. Descubrir escribe en el
 * registro (idempotente): pide confirmación, se bloquea mientras corre y su
 * resultado se cuenta con lo que cambió y lo que no.
 */
@Component({
  selector: 'app-portal-runtime-pieces-page',
  imports: [
    DatePipe,
    AppButton,
    Badge,
    Alert,
    Card,
    Tab,
    Tabs,
    DataTable,
    PageHeader,
    ViewStateHost,
    FilterForm,
  ],
  templateUrl: './runtime-pieces-page.html',
  styleUrl: './runtime-pieces-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuntimePiecesPage {
  private readonly client = inject(RuntimePiecesClient);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly valores = queryFilters(queryParamsSignal(this.route), CLAVES_URL);
  protected readonly pestana = computed(() => pestanaDe(this.valores()));
  protected readonly indicePestana = computed(() => PESTANAS.indexOf(this.pestana()));
  protected readonly pagina = computed(() => paginaDe(this.valores()));
  /** Lo que se le pide a la API: cambiar de pestaña no cambia la consulta, así que no vuelve a pedir. */
  private readonly consulta = computed(() => consultaDe(this.valores()), {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  /** Reloj de la última carga: contra él se mide la antigüedad de cada dato. */
  protected readonly ahora = signal(Date.now());
  protected readonly estado = signal<ViewState<Respuesta>>(loading());
  protected readonly aviso = signal<Aviso | null>(null);
  /** Una recarga con datos a la vista: no se tira todo a «cargando» (se perdería el borrador del filtro). */
  protected readonly refrescando = signal(false);
  /** Descubrir en curso: ambos botones quedan apagados (no hay doble envío). */
  protected readonly descubriendo = signal(false);
  private pendiente: Subscription | null = null;

  protected readonly campos = computed<readonly FilterField[]>(() => [
    {
      key: 'state',
      label: 'Estado',
      kind: 'select',
      options: [
        { value: '', label: 'Todos' },
        ...PIECE_STATES.map((s) => ({ value: s, label: ESTADOS_DE_PIEZA[s].texto })),
      ],
    },
    {
      key: 'kind',
      label: 'Tipo',
      kind: 'select',
      options: [
        { value: '', label: 'Todos' },
        ...PIECE_KINDS.map((k) => ({ value: k, label: TIPOS_DE_PIEZA[k] })),
      ],
    },
    {
      key: 'host',
      label: 'Proceso',
      kind: 'text',
      placeholder: 'api, worker-messaging…',
      hint: 'Nombre exacto del proceso que la aloja.',
    },
    { key: 'q', label: 'Buscar', kind: 'text', placeholder: 'Nombre, código o archivo' },
    {
      key: 'withFindings',
      label: 'Hallazgos',
      kind: 'select',
      options: [
        { value: '', label: 'Todas las piezas' },
        { value: 'true', label: 'Sólo las que tienen algún hallazgo' },
      ],
    },
  ]);

  /** Siempre `ready`/`stale` con datos, o el estado sin datos tal cual: la antigüedad (S7) la anuncia el anfitrión. */
  protected readonly vista = computed<ViewState<Respuesta>>(() => {
    const e = this.estado();
    if (e.status !== 'ready') return e;
    const t = new Date(e.data.evaluatedAt).getTime();
    return !Number.isNaN(t) && this.ahora() - t > ATRASADO_TRAS_MS ? stale(e.data, new Date(t)) : e;
  });

  protected readonly filasDePiezas = computed<ViewState<readonly RuntimePiece[]>>(() => {
    const e = this.vista();
    if (e.status !== 'ready' && e.status !== 'stale') return e;
    if (e.data.data.length > 0) return ready(e.data.data);
    if (hayFiltros(this.valores())) {
      return empty(
        { label: 'Quitar los filtros', route: PANTALLA },
        'Ninguna pieza coincide con los filtros elegidos.',
      );
    }
    return e.data.scan.available
      ? empty(
          { label: 'Descubrir las piezas del código', route: PANTALLA },
          'El escáner no encontró ninguna pieza en el código.',
        )
      : empty(
          { label: 'Actualizar', route: PANTALLA },
          'Este despliegue no trae el código fuente, así que no hay piezas que descubrir aquí.',
        );
  });

  protected readonly cursor = computed<CursorState>(() => {
    const e = this.estado();
    const paginas = e.status === 'ready' ? e.data.meta.totalPages : 1;
    const actual = this.pagina();
    return {
      prevCursor: actual > 1 ? String(actual - 1) : null,
      nextCursor: actual < paginas ? String(actual + 1) : null,
    };
  });

  protected readonly filasDeInstancias = computed<ViewState<readonly RuntimeInstance[]>>(() => {
    const e = this.vista();
    if (e.status !== 'ready' && e.status !== 'stale') return e;
    return e.data.instances.length > 0
      ? ready(e.data.instances)
      : empty(
          { label: 'Actualizar', route: PANTALLA },
          'La sonda de vida no tiene instancias registradas que vigilar.',
        );
  });

  protected readonly filasDeHallazgos = computed<ViewState<readonly RuntimeFinding[]>>(() => {
    const e = this.vista();
    if (e.status !== 'ready' && e.status !== 'stale') return e;
    return e.data.findings.length > 0
      ? ready(e.data.findings)
      : empty(
          { label: 'Ver las piezas', route: PANTALLA },
          'Sin hallazgos: el código, el registro y los latidos coinciden en lo que se mide. Eso no cubre lo que figura en «No se mide».',
        );
  });

  private readonly piezaCell = viewChild<TemplateRef<{ $implicit: RuntimePiece }>>('piezaCell');
  private readonly estadoCell = viewChild<TemplateRef<{ $implicit: RuntimePiece }>>('estadoCell');
  private readonly comoCell = viewChild<TemplateRef<{ $implicit: RuntimePiece }>>('comoCell');
  private readonly instanciaCell =
    viewChild<TemplateRef<{ $implicit: RuntimeInstance }>>('instanciaCell');
  private readonly estadoInstanciaCell =
    viewChild<TemplateRef<{ $implicit: RuntimeInstance }>>('estadoInstanciaCell');
  private readonly aloja = viewChild<TemplateRef<{ $implicit: RuntimeInstance }>>('alojaCell');
  private readonly hallazgoCell =
    viewChild<TemplateRef<{ $implicit: RuntimeFinding }>>('hallazgoCell');
  private readonly gravedadCell =
    viewChild<TemplateRef<{ $implicit: RuntimeFinding }>>('gravedadCell');

  protected readonly columnasDePiezas = computed<readonly ColumnDef<RuntimePiece>[]>(() => [
    { key: 'pieza', header: 'Pieza', priority: 1, cell: this.piezaCell() },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.estadoCell() },
    { key: 'como', header: 'Cómo corre', priority: 2, cell: this.comoCell() },
  ]);
  protected readonly columnasDeInstancias = computed<readonly ColumnDef<RuntimeInstance>[]>(() => [
    { key: 'instancia', header: 'Instancia', priority: 1, cell: this.instanciaCell() },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.estadoInstanciaCell() },
    { key: 'aloja', header: 'Qué aloja', priority: 2, cell: this.aloja() },
  ]);
  protected readonly columnasDeHallazgos = computed<readonly ColumnDef<RuntimeFinding>[]>(() => [
    { key: 'gravedad', header: 'Gravedad', priority: 1, cell: this.gravedadCell() },
    { key: 'hallazgo', header: 'Hallazgo', priority: 1, cell: this.hallazgoCell() },
  ]);

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  protected readonly nombreDePieza = (p: RuntimePiece): string => p.name;
  protected readonly nombreDeInstancia = (i: RuntimeInstance): string => i.label;
  protected readonly nombreDeHallazgo = (f: RuntimeFinding): string => REGLAS_DE_HALLAZGO[f.rule];

  protected readonly estadoDePieza = ESTADOS_DE_PIEZA;
  // Las celdas de las tablas reciben `any` (el contexto del <ng-template> no se tipa): se traduce con funciones, no indexando.
  protected readonly chipDe = (estado: PieceState) => ESTADOS_DE_PIEZA[estado];
  protected readonly chipInstancia = (estado: InstanceState) => ESTADOS_DE_INSTANCIA[estado];
  protected readonly chipGravedad = (gravedad: FindingSeverity) => GRAVEDADES[gravedad];
  protected readonly tipoDe = (tipo: PieceKind) => TIPOS_DE_PIEZA[tipo];
  protected readonly nivelDe = (nivel: EvidenceLevel) => NIVELES_DE_EVIDENCIA[nivel];
  protected readonly reglaDe = (regla: FindingRule) => REGLAS_DE_HALLAZGO[regla];
  protected readonly causa = causaDePieza;
  protected readonly cadencia = textoDeCadencia;
  protected readonly latido = textoDeLatido;
  protected readonly estados = PIECE_STATES;
  protected readonly noMedido = textoDeNoMedido;

  constructor() {
    this.destroyRef.onDestroy(() => this.pendiente?.unsubscribe());
    effect(() => {
      this.consulta();
      untracked(() => this.cargar());
    });
    this.programarRefresco();
  }

  protected cargar(): void {
    this.pendiente?.unsubscribe();
    // Con datos a la vista se conservan mientras llegan los nuevos; sin datos, S2.
    if (this.estado().status !== 'ready') this.estado.set(loading());
    this.refrescando.set(true);
    this.pendiente = this.client.list(this.consulta()).subscribe({
      next: (r) => {
        this.ahora.set(Date.now());
        this.refrescando.set(false);
        this.estado.set(ready(r));
      },
      error: (e: unknown) => {
        this.refrescando.set(false);
        this.estado.set(errorToViewState<Respuesta>(e));
      },
    });
  }

  /** Qué aloja una instancia, por tipo y en el orden del contrato. */
  protected alojadas(
    i: RuntimeInstance,
  ): readonly { readonly tipo: string; readonly cantidad: number }[] {
    return PIECE_KINDS.flatMap((k) => {
      const cantidad = i.piecesByKind[k] ?? 0;
      return cantidad > 0 ? [{ tipo: TIPOS_DE_PIEZA[k], cantidad }] : [];
    });
  }

  protected antiguedadDe(evaluatedAt: string): string {
    return haceCuanto(segundosEntre(evaluatedAt, this.ahora()));
  }

  protected elegirPestana(indice: number): void {
    void patchQuery(this.router, this.route, { vista: indice === 0 ? null : PESTANAS[indice] });
  }

  protected aplicar(filtros: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, { ...filtros, page: null });
  }

  protected quitarFiltros(): void {
    void patchQuery(this.router, this.route, {
      ...Object.fromEntries(CLAVES_DE_FILTRO.map((k) => [k, null])),
      page: null,
    });
  }

  protected irAPagina(cursor: string): void {
    void patchQuery(this.router, this.route, { page: cursor === '1' ? null : cursor });
  }

  /** Lleva a la pestaña de piezas filtrada por una pieza: el hallazgo y la fila son lo mismo visto de dos lados. */
  protected verPieza(id: string): void {
    void patchQuery(this.router, this.route, {
      vista: null,
      q: id,
      state: null,
      kind: null,
      host: null,
      withFindings: null,
      page: null,
    });
  }

  protected simular(): void {
    if (this.descubriendo()) return;
    this.ejecutar(true);
  }

  protected async descubrir(): Promise<void> {
    if (this.descubriendo()) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Descubrir y registrar las piezas',
      message:
        'Se lee el código y se registran en el registro de herramientas las piezas que falten, con su procedencia. ' +
        'No se borra nada. Repetirlo sin cambios en el código no modifica nada.',
      confirmLabel: 'Descubrir y registrar',
      cancelLabel: 'Volver',
    });
    if (!confirmado) return;
    this.ejecutar(false);
  }

  private ejecutar(dryRun: boolean): void {
    this.descubriendo.set(true);
    this.aviso.set(null);
    this.client.discover({ dryRun }).subscribe({
      next: (informe) => {
        this.descubriendo.set(false);
        this.aviso.set({
          tono: informe.dryRun ? 'info' : 'success',
          texto: textoDeInforme(informe),
        });
        if (!informe.dryRun) this.cargar();
      },
      error: (e: unknown) => {
        this.descubriendo.set(false);
        this.aviso.set({ tono: 'error', texto: fallaDeDescubrimiento(e) });
      },
    });
  }

  /**
   * Refresco periódico cada 30 s, salvo con `prefers-reduced-motion` (la
   * persona pidió quietud: queda el botón «Actualizar») y en el servidor.
   */
  private programarRefresco(): void {
    const ventana = this.documento.defaultView;
    if (!ventana || typeof ventana.setInterval !== 'function') return;
    if (ventana.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = ventana.setInterval(() => this.recargarEnSegundoPlano(), INTERVALO_DE_REFRESCO_MS);
    this.destroyRef.onDestroy(() => ventana.clearInterval(id));
  }

  /** Sin tirar los datos a «cargando»: un refresco no parpadea; si falla, se queda lo último con su antigüedad. */
  private recargarEnSegundoPlano(): void {
    if (this.estado().status !== 'ready') return;
    this.pendiente?.unsubscribe();
    this.pendiente = this.client.list(this.consulta()).subscribe({
      next: (r) => {
        this.ahora.set(Date.now());
        this.estado.set(ready(r));
      },
    });
  }
}
