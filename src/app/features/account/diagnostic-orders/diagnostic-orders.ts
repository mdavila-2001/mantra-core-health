import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  type TemplateRef,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import type { PatientOrder } from '../../../core/data-access/diagnostics/diagnostics.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels, ValueSetOption } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { PatientInsuranceSettlement } from '../../../shared/components/molecules/patient-insurance-settlement/patient-insurance-settlement';
import {
  ANALYSIS_CATEGORIES,
  categoriaDeAnalisis,
  etiquetaDeCategoria,
  type AnalysisCategory,
  type PatientOrderRow,
} from './diagnostic-orders.types';

/** Tope de órdenes que se traen. Nadie arrastra cien pedidos abiertos. */
const TOPE_DE_ORDENES = 50;

/** Las cuatro pestañas, en el orden fijo del diseño (C9 §4). `null` es «Todas». */
const PESTANAS: readonly (AnalysisCategory | null)[] = [null, 'LAB', 'IMAGING', 'OTHER'];

const TAMANOS_DE_PAGINA = [10, 25, 50] as const;

/** Los cortes de período, en días. `null` es «Todo». */
const PERIODOS: readonly { readonly value: string; readonly label: string; readonly dias: number | null }[] = [
  { value: '30', label: '30 días', dias: 30 },
  { value: '90', label: '90 días', dias: 90 },
  { value: '365', label: '365 días', dias: 365 },
  { value: 'todo', label: 'Todo', dias: null },
];

/**
 * «Mis órdenes» del paciente — C9 (ADR-0015): clasificadas por tipo, con
 * buscador, filtros, tabla sin scroll lateral y paginación.
 *
 * ## Por qué ya no se agrupa por atención (a diferencia de la versión previa)
 *
 * El pedido explícito del propietario fue "clasificado por el tipo... y con
 * buscador y filtro con la disciplina de paginación que hemos documentado".
 * La consulta en que se pidió cada orden pasa a ser **una columna** (C9 §8):
 * sigue siendo información, pero ya no organiza la pantalla — el tipo la
 * organiza, en pestañas.
 */
@Component({
  selector: 'app-diagnostic-orders',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    ContentDialog,
    DataTable,
    DatePipe,
    FilterBar,
    PageHeader,
    Pagination,
    PatientInsuranceSettlement,
    RowActions,
    Skeleton,
    StatusSeal,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './diagnostic-orders.html',
  styleUrl: './diagnostic-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosticOrders {
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Sin perfil de paciente no hay órdenes que leer: la API respondería 412. */
  protected readonly sinPerfilDePaciente = this.auth.patientProfileId() === null;

  /** El estado de la lista completa (S1/S2/S3/S9 del M34). */
  protected readonly estado = signal<ViewState<readonly PatientOrderRow[]>>(loading());

  /** `true` cuando la API avisó que recortó a `TOPE_DE_ORDENES` (S7). */
  protected readonly truncado = signal(false);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /* ---- filtros, en señales sincronizadas con la URL ------------------------ */

  private readonly parametrosIniciales = toSignal(
    this.route.queryParamMap.pipe(map((params) => params)),
    { initialValue: this.route.snapshot.queryParamMap },
  );

  protected readonly tab = signal<AnalysisCategory | null>(
    this.parametroTabDeUrl(this.parametrosIniciales()),
  );
  protected readonly q = signal(this.parametrosIniciales().get('q') ?? '');
  protected readonly filtroEstado = signal(this.parametrosIniciales().get('estado'));
  protected readonly filtroResultado = signal(this.parametrosIniciales().get('resultado'));
  protected readonly filtroPeriodo = signal(this.parametrosIniciales().get('periodo'));
  protected readonly pagina = signal(Number(this.parametrosIniciales().get('pagina') ?? '1') || 1);
  protected readonly tamano = signal(
    (TAMANOS_DE_PAGINA as readonly number[]).includes(Number(this.parametrosIniciales().get('tamano')))
      ? Number(this.parametrosIniciales().get('tamano'))
      : 10,
  );

  private parametroTabDeUrl(params: { get(name: string): string | null }): AnalysisCategory | null {
    const valor = params.get('tab');
    return (ANALYSIS_CATEGORIES as readonly string[]).includes(valor ?? '')
      ? (valor as AnalysisCategory)
      : null;
  }

  constructor() {
    if (!this.sinPerfilDePaciente) {
      this.cargar();
    }

    // Publica el estado del filtro en la URL en cada cambio (`replaceUrl`: no
    // se acumula un paso de historial por cada tecla). `page.reload()` lo
    // restaura leyendo `parametrosIniciales` de nuevo, arriba.
    effect(() => {
      const queryParams: Record<string, string> = {};
      const tab = this.tab();
      if (tab !== null) queryParams['tab'] = tab;
      const q = this.q();
      if (q !== '') queryParams['q'] = q;
      const estado = this.filtroEstado();
      if (estado !== null && estado !== undefined) queryParams['estado'] = estado;
      const resultado = this.filtroResultado();
      if (resultado !== null && resultado !== undefined) queryParams['resultado'] = resultado;
      const periodo = this.filtroPeriodo();
      if (periodo !== null && periodo !== undefined) queryParams['periodo'] = periodo;
      if (this.pagina() !== 1) queryParams['pagina'] = String(this.pagina());
      if (this.tamano() !== 10) queryParams['tamano'] = String(this.tamano());

      untracked(() =>
        void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true }),
      );
    });
  }

  /* ---- lectura --------------------------------------------------------------- */

  /**
   * Trae las órdenes y **después** sus etiquetas, en dos pasos y no en
   * paralelo: los ids a resolver salen de la propia respuesta de órdenes, así
   * que no hay otra forma de pedirlas antes. La fila se arma una sola vez,
   * ya con todo resuelto — así `PatientOrderRow` nunca necesita cargar un
   * uuid "por si hay que reetiquetar después" (C9: "ningún uuid llega a la
   * fila", también vale para el modelo, no sólo para lo que se pinta).
   */
  protected cargar(): void {
    this.estado.set(loading());
    this.diagnostics.getOwnOrders(TOPE_DE_ORDENES).subscribe({
      next: (pagina) => {
        this.truncado.set(pagina.truncated);
        if (pagina.items.length === 0) {
          this.estado.set(
            empty(
              { label: 'Ver mis turnos', route: '/my-account/appointments' },
              'No tenés órdenes de laboratorio ni de imagen. Cuando un médico te pida un estudio en una consulta, aparece acá con las indicaciones para hacértelo.',
            ),
          );
          return;
        }
        this.resolverEtiquetasYArmar(pagina.items);
      },
      error: (error: unknown) => this.estado.set(errorToViewState<readonly PatientOrderRow[]>(error)),
    });
  }

  private resolverEtiquetasYArmar(items: readonly PatientOrder[]): void {
    const ids = [
      ...new Set(
        items.flatMap((item) =>
          [item.codeConceptId, item.categoryConceptId, item.statusConceptId].filter(
            (id): id is string => id !== undefined,
          ),
        ),
      ),
    ];
    this.terminology
      .readConceptLabels(ids)
      // Si el catálogo no responde, las órdenes igual se muestran con su
      // texto neutro: perder la etiqueta no justifica perder la lista.
      .pipe(catchError(() => of(new Map<string, ValueSetOption>())))
      .subscribe((etiquetas) => {
        this.etiquetas.set(etiquetas);
        this.estado.set(ready(items.map((item) => this.aFila(item, etiquetas))));
      });
  }

  private aFila(item: PatientOrder, etiquetas: ConceptLabels): PatientOrderRow {
    const categoriaOpcion = item.categoryConceptId ? etiquetas.get(item.categoryConceptId) : undefined;
    const categoria = categoriaDeAnalisis(categoriaOpcion?.code);
    const estadoOpcion = etiquetas.get(item.statusConceptId);
    return {
      id: item.id,
      insuranceSettlement: item.insuranceSettlement,
      insuranceSettlementAvailability: item.insuranceSettlementAvailability,
      type: categoria,
      typeLabel: etiquetaDeCategoria(categoria),
      studyLabel: etiquetas.get(item.codeConceptId)?.display ?? 'Estudio',
      // Nunca el uuid crudo, ni siquiera si el catálogo no respondió (C9:
      // "ningún uuid llega a la fila" no tiene excepción por fallo externo).
      stateCode: estadoOpcion?.code ?? 'sin-resolver',
      stateLabel: estadoOpcion?.display ?? 'Pendiente',
      hasResult: item.hasReleasedResult,
      reportId: item.reportId ?? null,
      consultationLabel:
        item.encounterId === undefined || item.encounterId === ''
          ? 'Sin consulta'
          : `Consulta del ${this.fechaCorta(item.createdAt)}`,
      requestedAt: item.createdAt,
      preparation: item.preparationInstructions ?? null,
    };
  }

  private fechaCorta(fecha: Date): string {
    return fecha.toLocaleDateString('es', { day: 'numeric', month: 'numeric' });
  }

  /* ---- filtrado y paginado, todo en cliente (mismo criterio que work-history) */

  private readonly filasListas = computed<readonly PatientOrderRow[]>(() => {
    const estado = this.estado();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** Conteo por pestaña, sobre el total sin filtrar (Todas = suma de las tres). */
  protected readonly conteos = computed(() => {
    const filas = this.filasListas();
    const porTipo = (tipo: AnalysisCategory) => filas.filter((f) => f.type === tipo).length;
    return {
      TODAS: filas.length,
      LAB: porTipo('LAB'),
      IMAGING: porTipo('IMAGING'),
      OTHER: porTipo('OTHER'),
    };
  });

  /** Las filas de la pestaña activa, antes de buscador/filtros. */
  private readonly filasDeLaPestana = computed<readonly PatientOrderRow[]>(() => {
    const tab = this.tab();
    const filas = this.filasListas();
    return tab === null ? filas : filas.filter((f) => f.type === tab);
  });

  /** Los estados presentes en la pestaña activa, para el filtro «Estado» (C9 §4: sólo los que existen). */
  protected readonly opcionesDeEstado = computed(() => {
    const vistos = new Map<string, string>();
    for (const fila of this.filasDeLaPestana()) {
      vistos.set(fila.stateCode, fila.stateLabel);
    }
    return [...vistos].map(([value, label]) => ({ value, label }));
  });

  protected readonly filtros = computed<readonly FilterDef[]>(() => [
    { key: 'estado', label: 'Estado', options: this.opcionesDeEstado() },
    {
      key: 'resultado',
      label: 'Resultado',
      options: [
        { value: 'con', label: 'Con resultado' },
        { value: 'sin', label: 'Sin resultado' },
      ],
    },
    {
      key: 'periodo',
      label: 'Período',
      options: PERIODOS.map((p) => ({ value: p.value, label: p.label })),
    },
  ]);

  protected onFiltrosCambiaron(activos: Readonly<Record<string, string>>): void {
    this.q.set(activos['q'] ?? '');
    this.filtroEstado.set(activos['estado'] ?? null);
    this.filtroResultado.set(activos['resultado'] ?? null);
    this.filtroPeriodo.set(activos['periodo'] ?? null);
    this.pagina.set(1);
  }

  protected cambiarPestana(indice: number): void {
    this.tab.set(PESTANAS[indice] ?? null);
    this.pagina.set(1);
  }

  protected readonly indiceDePestana = computed(() => PESTANAS.indexOf(this.tab()));

  /** Buscador multicampo, normalizado por acentos y mayúsculas (C9 §3.8). */
  protected readonly filasFiltradas = computed<readonly PatientOrderRow[]>(() => {
    const termino = normalizarTexto(this.q());
    const estado = this.filtroEstado();
    const resultado = this.filtroResultado();
    const periodo = this.filtroPeriodo();
    const corteDeDias = PERIODOS.find((p) => p.value === periodo)?.dias ?? null;
    const ahora = Date.now();

    return this.filasDeLaPestana().filter((fila) => {
      if (estado !== null && estado !== undefined && fila.stateCode !== estado) return false;
      if (resultado === 'con' && !fila.hasResult) return false;
      if (resultado === 'sin' && fila.hasResult) return false;
      if (corteDeDias !== null) {
        const diasTranscurridos = (ahora - fila.requestedAt.getTime()) / 86_400_000;
        if (diasTranscurridos > corteDeDias) return false;
      }
      if (termino === '') return true;
      const campos = [fila.studyLabel, fila.stateLabel, fila.consultationLabel, fila.preparation ?? ''];
      return campos.some((campo) => normalizarTexto(campo).includes(termino));
    });
  });

  protected readonly filasPaginadas = computed<readonly PatientOrderRow[]>(() => {
    const inicio = (this.pagina() - 1) * this.tamano();
    return this.filasFiltradas().slice(inicio, inicio + this.tamano());
  });

  protected readonly totalFiltrado = computed(() => this.filasFiltradas().length);

  /**
   * Lo que la tabla pinta.
   *
   * `estado()` trae **todas** las filas, sin pestaña ni buscador ni página:
   * lo que la tabla tiene que mostrar es `filasPaginadas()`. Bug real
   * encontrado en la verificación de navegador (C7, pase consolidado de
   * Playwright del 2026-09-25): la plantilla ataba `<app-data-table>`
   * directo a `estado()`, así que el resumen «N órdenes» sí contaba bien
   * (leía `filasFiltradas()`) pero la tabla seguía mostrando las filas sin
   * filtrar. Se conservan `loading`/`empty`/`error` de `estado()` tal cual;
   * sólo se sustituye el `data` de la rama `ready`.
   */
  protected readonly filasDeTabla = computed<ViewState<readonly PatientOrderRow[]>>(() => {
    const actual = this.estado();
    return actual.status === 'ready' ? ready(this.filasPaginadas()) : actual;
  });

  protected limpiarFiltros(): void {
    this.q.set('');
    this.filtroEstado.set(null);
    this.filtroResultado.set(null);
    this.filtroPeriodo.set(null);
    this.pagina.set(1);
  }

  protected readonly hayFiltrosActivos = computed(
    () =>
      this.q() !== '' ||
      this.filtroEstado() !== null ||
      this.filtroResultado() !== null ||
      this.filtroPeriodo() !== null,
  );

  /* ---- columnas ---------------------------------------------------------------- */

  private readonly celdaPedida =
    viewChild.required<TemplateRef<{ $implicit: PatientOrderRow }>>('celdaPedida');
  private readonly celdaEstudio =
    viewChild.required<TemplateRef<{ $implicit: PatientOrderRow }>>('celdaEstudio');
  private readonly celdaTipo =
    viewChild.required<TemplateRef<{ $implicit: PatientOrderRow }>>('celdaTipo');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: PatientOrderRow }>>('celdaEstado');
  private readonly celdaResultado =
    viewChild.required<TemplateRef<{ $implicit: PatientOrderRow }>>('celdaResultado');
  private readonly celdaConsulta =
    viewChild.required<TemplateRef<{ $implicit: PatientOrderRow }>>('celdaConsulta');
  private readonly celdaAcciones =
    viewChild.required<TemplateRef<{ $implicit: PatientOrderRow }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<PatientOrderRow>[]>(() => [
    { key: 'requestedAt', header: 'Pedida', priority: 1, cell: this.celdaPedida() },
    { key: 'studyLabel', header: 'Estudio', priority: 1, cell: this.celdaEstudio() },
    { key: 'type', header: 'Tipo', priority: 1, cell: this.celdaTipo() },
    { key: 'stateLabel', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'hasResult', header: 'Resultado', priority: 1, cell: this.celdaResultado() },
    { key: 'consultationLabel', header: 'Consulta', priority: 2, cell: this.celdaConsulta() },
    { key: 'acciones', header: 'Acciones', priority: 1, sticky: 'end', cell: this.celdaAcciones() },
  ]);

  protected readonly porId = (fila: PatientOrderRow): string => fila.id;
  protected readonly nombreDeFila = (fila: PatientOrderRow): string => fila.studyLabel;

  /**
   * `app-status-seal` es del vocabulario de un trámite adjudicado
   * (pending/in-review/approved/rejected/expired), y el de una orden es otro
   * (`VS_RECORD_STATUS`: pendiente/en curso/completado/…). Sólo se traducen
   * los dos casos donde el significado coincide sin forzarlo; el resto queda
   * en `unknown` (el propio fallback neutro del componente), con el texto
   * real igual visible — nunca se inventa una correspondencia que no es cierta.
   */
  protected varianteDeEstado(fila: PatientOrderRow): 'pending' | 'approved' | 'unknown' {
    if (fila.stateCode.includes('PENDING')) return 'pending';
    if (fila.stateCode.includes('COMPLETED')) return 'approved';
    return 'unknown';
  }

  /* ---- acciones de fila (C9 §4) ------------------------------------------------ */

  protected accionesDe(fila: PatientOrderRow): readonly RowAction[] {
    const acciones: RowAction[] = [];
    if (fila.hasResult) {
      acciones.push({ code: 'ver-resultado', label: 'Ver resultado', icon: 'eye' });
    }
    if (fila.preparation !== null) {
      acciones.push({ code: 'ver-preparacion', label: 'Ver preparación', icon: 'clipboard' });
    }
    if (fila.insuranceSettlement) {
      acciones.push({ code: 'ver-liquidacion', label: 'Ver liquidación', icon: 'billing' });
    }
    // Conservada del refactor UX previo (2026-09-13): no la retira el pedido
    // de esta noche, y quitarla sería perder una capacidad ya entregada sin
    // que nadie lo haya pedido (ver ambigüedad registrada en PLAN.md).
    acciones.push({ code: 'reservar', label: 'Reservar hora en un laboratorio', icon: 'calendar' });
    return acciones;
  }

  /** La orden cuya preparación está abierta en el diálogo, o `null`. */
  protected readonly preparacionAbierta = signal<PatientOrderRow | null>(null);
  /** La orden cuya liquidación está abierta en el diálogo, o `null`. */
  protected readonly liquidacionAbierta = signal<PatientOrderRow | null>(null);

  /**
   * `app-row-actions` emite un código, no un `routerLink`: `RowAction` no
   * tiene campo de ruta (no lo tenía ya en `work-history`/`my-agenda`, los
   * dos consumidores existentes). Se pierde el clic-medio / "abrir en pestaña
   * nueva" que sí tenía el `<a app-link>` de la versión anterior — es la
   * contrapartida de estandarizar en `app-row-actions` que pide C9 §4; se
   * anota como riesgo residual en el `REPORTE.md`, no se inventa un campo
   * nuevo en el componente compartido (regla 00 §3: no tocar piezas de la casa).
   */
  protected ejecutarAccion(codigo: string, fila: PatientOrderRow): void {
    switch (codigo) {
      case 'ver-preparacion':
        this.preparacionAbierta.set(fila);
        return;
      case 'ver-liquidacion':
        this.liquidacionAbierta.set(fila);
        return;
      case 'ver-resultado':
        if (fila.reportId !== null) {
          void this.router.navigate(['/my-account/diagnostic-results'], {
            fragment: fila.reportId,
          });
        }
        return;
      case 'reservar':
        void this.router.navigate(['/my-account/appointments'], {
          queryParams: { resource: 'lab' },
        });
        return;
    }
  }
}

/** Normaliza acentos y mayúsculas para el buscador, igual que `work-history`. */
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
