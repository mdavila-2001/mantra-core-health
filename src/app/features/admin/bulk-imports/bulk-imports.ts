import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { EMPTY, exhaustMap, timer, type Subscription, catchError } from 'rxjs';

import { BulkImportsClient } from '../../../core/data-access/admin-portal/bulk-imports.client';
import type {
  BulkImportBatch,
  BulkImportCatalog,
  BulkImportDeclaration,
  BulkImportDownload,
  BulkImportFormat,
  BulkImportGroup,
  BulkImportReport,
  BulkImportReportRow,
  BulkImportRowIssue,
  BulkImportTemplate,
} from '../../../core/data-access/admin-portal/bulk-imports.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Progress } from '../../../shared/components/atoms/progress/progress';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FileInput, type RejectedFile } from '../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import type { MetricTone } from '../../../shared/components/molecules/metric-card/metric-card.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { FileDownloadService } from '../../../shared/utils/file-download/file-download.service';
import {
  FILAS_DE_VISTA_PREVIA,
  GRUPOS_DE_CARGA,
  RESULTADOS_DE_FILA,
  avisosDelMotor,
  escritorDesconectado,
  estaEnCurso,
  estadoDeLote,
  falloDeCarga,
  frasePorLimites,
  motivoLegible,
  nombreDeLote,
  resultadoDeFila,
  resumenDelInforme,
  tamano,
  type FalloDeCarga,
  type Rotulo,
} from './bulk-imports-labels';

/** Cada cuánto se vuelve a pedir un lote que sigue en cola o procesándose. */
export const INTERVALO_DE_AVANCE_MS = 2_000;
/** Cuántas filas del informe se dibujan; el resto está en el archivo descargable. */
const FILAS_DE_INFORME = 100;
type CampoDeDeclaracion = 'reason' | 'sourceOrganization' | 'legalBasis' | 'loadedAt';

interface FilaDeLote {
  readonly id: string;
  readonly tipo: string;
  readonly estado: Rotulo;
  readonly filas: string;
  readonly creado: string;
  readonly nombre: string;
  readonly lote: BulkImportBatch;
}

interface FilaDePlantilla {
  readonly kind: string;
  readonly title: string;
  readonly grupo: string;
  readonly columnas: number;
  readonly permiso: string;
  readonly plantilla: BulkImportTemplate;
}

interface FilaDeHallazgo {
  readonly id: string;
  readonly fila: number;
  readonly columna: string;
  readonly motivo: string;
  readonly mensaje: string;
}

interface FilaDeInforme {
  readonly id: string;
  readonly fila: number;
  readonly resultado: Rotulo;
  readonly motivo: string;
  readonly codigo: string | null;
  readonly columna: string;
  readonly mensaje: string;
}

const comoTexto = (valor: string | number | null): string => (valor === null ? '' : String(valor));

/**
 * Cargas masivas: altas de usuarios y carga especial de historias clínicas.
 * Una sola tarjeta con pestañas —«Nueva carga», «Lotes» y «Plantillas»— a lo
 * ancho del área.
 *
 * Flujo: elegir el tipo y bajar su plantilla (CSV o JSON, siempre a la vista) →
 * declarar el origen y el motivo → subir el archivo → vista previa con los
 * problemas por fila y columna (nunca el valor de una celda) → confirmar, con
 * una clave de idempotencia por lote → seguir el avance → leer y bajar el
 * informe.
 *
 * Regla de honestidad: «confirmado» no es «creado». Lo que el motor no hace en
 * esta instalación lo dice `engine` (arriba de todo), y qué se creó lo dice el
 * informe, fila por fila. La autoridad sobre quién puede cargar es la API.
 */
@Component({
  selector: 'app-bulk-imports',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    AppButton,
    Badge,
    Alert,
    Card,
    FileInput,
    FormField,
    Input,
    MetricCard,
    Progress,
    SegmentedControl,
    Select,
    Tab,
    Tabs,
    Textarea,
    DataTable,
    PageHeader,
    ViewStateHost,
  ],
  templateUrl: './bulk-imports.html',
  styleUrl: './bulk-imports.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkImports {
  private readonly client = inject(BulkImportsClient);
  private readonly descargas = inject(FileDownloadService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly estadoDeLote = estadoDeLote;
  protected readonly motivoLegible = motivoLegible;
  protected readonly resultadoDeFila = resultadoDeFila;
  protected readonly frasePorLimites = frasePorLimites;
  protected readonly avisosDelMotor = avisosDelMotor;
  protected readonly resumenDelInforme = resumenDelInforme;
  protected readonly tamano = tamano;
  protected readonly grupos = GRUPOS_DE_CARGA;
  protected readonly filasDeInforme = FILAS_DE_INFORME;
  protected readonly filasDeVistaPrevia = FILAS_DE_VISTA_PREVIA;

  protected readonly pestana = signal(0);

  /* -- Datos del servidor --------------------------------------------------- */
  protected readonly catalogo = signal<ViewState<BulkImportCatalog>>(loading());
  protected readonly lotes = signal<ViewState<readonly BulkImportBatch[]>>(loading());

  /* -- Qué se carga ---------------------------------------------------------- */
  protected readonly grupo = signal<BulkImportGroup>('USERS');
  protected readonly tipoElegido = signal<string | null>(null);

  /* -- Declaración: viven en señales porque la pestaña cerrada no dibuja sus controles. */
  protected readonly motivo = signal('');
  protected readonly origen = signal('');
  protected readonly baseLegal = signal('');
  protected readonly fechaDeCarga = signal('');
  protected readonly archivos = signal<readonly File[]>([]);
  protected readonly errorDeArchivo = signal<string | null>(null);
  /** Se prende al primer intento de revisar: recién ahí los campos muestran sus errores. */
  protected readonly intento = signal(false);
  /** Lo que el servidor objetó de la declaración; se apaga al editar ese campo. */
  protected readonly objecion = signal<{ readonly campo: string; readonly texto: string } | null>(null);

  protected readonly revisando = signal(false);
  protected readonly falloAlRevisar = signal<FalloDeCarga | null>(null);

  /* -- El lote en pantalla ----------------------------------------------------- */
  protected readonly lote = signal<BulkImportBatch | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly falloDelLote = signal<FalloDeCarga | null>(null);
  protected readonly informe = signal<ViewState<BulkImportReport> | null>(null);

  protected readonly descargando = signal<string | null>(null);
  protected readonly falloDeDescarga = signal<FalloDeCarga | null>(null);

  private seguimiento: Subscription | null = null;

  /* -- Derivados ------------------------------------------------------------------ */
  private readonly datosDelCatalogo = computed(() => {
    const e = this.catalogo();
    return e.status === 'ready' ? e.data : null;
  });

  protected readonly limites = computed(() => this.datosDelCatalogo()?.limits ?? null);
  protected readonly maximoDeBytes = computed(() => this.limites()?.maxBytes ?? null);

  protected readonly plantillasDelGrupo = computed(
    () => this.datosDelCatalogo()?.templates.filter((t) => t.group === this.grupo()) ?? [],
  );

  protected readonly opcionesDeGrupo = GRUPOS_DE_CARGA.map((g) => ({ value: g.value, label: g.label }));
  protected readonly ayudaDelGrupo = computed(
    () => GRUPOS_DE_CARGA.find((g) => g.value === this.grupo())?.ayuda ?? '',
  );

  protected readonly opcionesDeTipo = computed<readonly SelectOption<string | null>[]>(() =>
    this.plantillasDelGrupo().map((t) => ({ value: t.kind, label: t.title })),
  );

  protected readonly plantilla = computed<BulkImportTemplate | null>(
    () => this.plantillasDelGrupo().find((t) => t.kind === this.tipoElegido()) ?? this.plantillasDelGrupo()[0] ?? null,
  );

  protected readonly avisos = computed(() => {
    const datos = this.datosDelCatalogo();
    return datos === null ? [] : avisosDelMotor(datos.engine);
  });

  protected readonly escritorNoConectado = computed(() => {
    const datos = this.datosDelCatalogo();
    const lote = this.lote();
    if (datos === null || lote === null) return false;
    return escritorDesconectado(datos.engine, lote.group);
  });

  /** Hoy en UTC, como lo compara la API. */
  private readonly hoy = (): string => new Date().toISOString().slice(0, 10);
  protected readonly fechaMaxima = this.hoy();

  /** Errores de cada campo según lo que se escribió; `null` si está bien. */
  private readonly erroresLocales = computed<Readonly<Record<CampoDeDeclaracion, string | null>>>(() => {
    const largo = (valor: string, min: number, max: number, vacio: string, largoMax: string): string | null => {
      const n = valor.trim().length;
      if (n === 0) return vacio;
      if (n < min) return `Escriba al menos ${min} caracteres.`;
      return n > max ? largoMax : null;
    };
    const fecha = this.fechaDeCarga().trim();
    const fechaReal = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && new Date(`${fecha}T00:00:00Z`).toISOString().startsWith(fecha);
    return {
      reason: largo(this.motivo(), 1, 500, 'Escriba el motivo del alta.', 'El motivo admite hasta 500 caracteres.'),
      sourceOrganization: largo(
        this.origen(),
        1,
        200,
        'Escriba la organización de origen de los datos.',
        'Admite hasta 200 caracteres.',
      ),
      legalBasis: largo(
        this.baseLegal(),
        3,
        500,
        'Escriba la base legal que habilita la carga.',
        'La base legal admite hasta 500 caracteres.',
      ),
      loadedAt:
        fecha === ''
          ? 'Elija la fecha de la carga.'
          : !fechaReal
            ? 'Escriba una fecha real.'
            : fecha > this.hoy()
              ? 'La fecha no puede ser futura.'
              : null,
    };
  });

  /** Lo anterior más lo que el servidor objetó de la declaración. Se muestra tras el primer intento. */
  protected readonly erroresDeDeclaracion = computed<Readonly<Record<CampoDeDeclaracion, string | null>>>(() => {
    const locales = this.erroresLocales();
    const objecion = this.objecion();
    const con = (campo: CampoDeDeclaracion): string | null =>
      locales[campo] ?? (objecion?.campo === campo ? objecion.texto : null);
    return {
      reason: con('reason'),
      sourceOrganization: con('sourceOrganization'),
      legalBasis: con('legalBasis'),
      loadedAt: con('loadedAt'),
    };
  });

  /** Los campos de la declaración que el grupo elegido exige. */
  private readonly camposDelGrupo = computed<readonly CampoDeDeclaracion[]>(() =>
    this.grupo() === 'USERS' ? ['reason'] : ['sourceOrganization', 'legalBasis', 'loadedAt'],
  );

  /** Lista para mandar: la parte local, sin esperar al servidor. */
  protected readonly declaracionLista = computed(() => this.camposDelGrupo().every((c) => this.erroresLocales()[c] === null));

  protected errorDe(campo: CampoDeDeclaracion): string | null {
    return this.intento() ? this.erroresDeDeclaracion()[campo] : null;
  }

  /* -- Tabla de lotes -------------------------------------------------------------- */
  private readonly celdaEstadoLote = viewChild<TemplateRef<{ $implicit: FilaDeLote }>>('estadoLoteCell');
  private readonly celdaAccionLote = viewChild<TemplateRef<{ $implicit: FilaDeLote }>>('accionLoteCell');
  private readonly celdaCreado = viewChild<TemplateRef<{ $implicit: FilaDeLote }>>('creadoCell');

  protected readonly filasDeLotes = computed<ViewState<readonly FilaDeLote[]>>(() => {
    const e = this.lotes();
    if (e.status !== 'ready') return e as ViewState<readonly FilaDeLote[]>;
    if (e.data.length === 0) {
      return empty(
        { label: 'Vaya a «Nueva carga», elija un tipo, baje su plantilla y suba el archivo.' },
        'Esta organización todavía no tiene lotes. Un lote aparece acá apenas se revisa un archivo.',
      );
    }
    const titulos = new Map(this.datosDelCatalogo()?.templates.map((t) => [t.kind, t.title]));
    return ready(
      e.data.map((l) => ({
        id: l.id,
        tipo: titulos.get(l.kind) ?? l.kind,
        estado: estadoDeLote(l.status),
        filas: `${l.counts.valid} de ${l.counts.total}`,
        creado: l.createdAt,
        nombre: nombreDeLote(l, titulos.get(l.kind)),
        lote: l,
      })),
    );
  });

  protected readonly columnasDeLotes = computed<readonly ColumnDef<FilaDeLote>[]>(() => [
    { key: 'tipo', header: 'Tipo de carga', priority: 1 },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstadoLote() },
    { key: 'filas', header: 'Filas válidas', priority: 2, align: 'end' },
    { key: 'creado', header: 'Revisado', priority: 3, cell: this.celdaCreado() },
    { key: 'accion', header: 'Acción', priority: 1, accion: true, cell: this.celdaAccionLote() },
  ]);
  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  protected readonly nombreDeFilaDeLote = (fila: FilaDeLote): string => `${fila.nombre}: ${fila.estado.label}`;

  /* -- Tabla de plantillas ---------------------------------------------------------- */
  private readonly celdaDescargas = viewChild<TemplateRef<{ $implicit: FilaDePlantilla }>>('descargasCell');

  protected readonly filasDePlantillas = computed<ViewState<readonly FilaDePlantilla[]>>(() => {
    const e = this.catalogo();
    if (e.status !== 'ready') return e as ViewState<readonly FilaDePlantilla[]>;
    if (e.data.templates.length === 0) {
      return empty(
        { label: 'Pida a quien opera la API que revise el catálogo de cargas.' },
        'La API no declara ningún tipo de carga: no hay plantillas para bajar.',
      );
    }
    return ready(
      e.data.templates.map((t) => ({
        kind: t.kind,
        title: t.title,
        grupo: t.group === 'USERS' ? 'Altas de usuarios' : 'Historia clínica',
        columnas: t.columnCount,
        permiso: t.permission,
        plantilla: t,
      })),
    );
  });

  protected readonly columnasDePlantillas = computed<readonly ColumnDef<FilaDePlantilla>[]>(() => [
    { key: 'title', header: 'Tipo de carga', priority: 1 },
    { key: 'grupo', header: 'Familia', priority: 3 },
    { key: 'columnas', header: 'Columnas', priority: 3, align: 'end' },
    { key: 'permiso', header: 'Permiso que exige', priority: 2 },
    { key: 'descargas', header: 'Plantilla', priority: 1, accion: true, cell: this.celdaDescargas() },
  ]);
  protected readonly porKind = (fila: FilaDePlantilla): string => fila.kind;
  protected readonly nombreDeFilaDePlantilla = (fila: FilaDePlantilla): string => fila.title;

  /* -- Vista previa ------------------------------------------------------------------ */
  protected readonly hallazgos = computed<ViewState<readonly FilaDeHallazgo[]>>(() => {
    const lote = this.lote();
    const items: readonly BulkImportRowIssue[] = lote?.issues.items ?? [];
    if (items.length === 0) {
      return empty({ label: 'Siga con la confirmación.' }, 'Ninguna fila tiene problemas.');
    }
    return ready(
      items.slice(0, FILAS_DE_VISTA_PREVIA).map((h, i) => ({
        id: `${h.row}-${h.field}-${i}`,
        fila: h.row,
        columna: h.field === '*' ? 'Toda la fila' : h.field,
        motivo: motivoLegible(h.code),
        mensaje: h.message,
      })),
    );
  });

  protected readonly columnasDeHallazgos: readonly ColumnDef<FilaDeHallazgo>[] = [
    { key: 'fila', header: 'Fila', priority: 1, align: 'end' },
    { key: 'columna', header: 'Columna', priority: 1 },
    { key: 'motivo', header: 'Problema', priority: 1 },
    { key: 'mensaje', header: 'Qué se espera', priority: 2 },
  ];
  protected readonly nombreDeHallazgo = (fila: FilaDeHallazgo): string => `Fila ${fila.fila}, columna ${fila.columna}`;

  protected readonly hallazgosSinMostrar = computed(() => {
    const lote = this.lote();
    return lote === null ? 0 : Math.max(0, lote.issues.total - Math.min(lote.issues.items.length, FILAS_DE_VISTA_PREVIA));
  });

  protected readonly porcentajeDeAvance = computed(() => {
    const lote = this.lote();
    if (lote === null || lote.progress.total === 0) return 0;
    return Math.round((lote.progress.processed / lote.progress.total) * 100);
  });

  /* -- Informe ---------------------------------------------------------------------------- */
  protected readonly tarjetasDelInforme = computed(() => {
    const e = this.informe();
    if (e === null || e.status !== 'ready') return [];
    const totales = e.data.totals;
    return RESULTADOS_DE_FILA.filter((r) => r === 'CREADA' || (totales[r] ?? 0) > 0).map((r) => ({
      clave: r,
      etiqueta: resultadoDeFila(r).plural,
      valor: totales[r] ?? 0,
      tono: (r === 'CREADA' ? ((totales[r] ?? 0) > 0 ? 'success' : 'warning') : resultadoDeFila(r).tone === 'secondary' ? 'neutral' : resultadoDeFila(r).tone) as MetricTone,
    }));
  });

  protected readonly filasDelInforme = computed<ViewState<readonly FilaDeInforme[]>>(() => {
    const e = this.informe();
    if (e === null || e.status !== 'ready') return (e ?? loading()) as ViewState<readonly FilaDeInforme[]>;
    if (e.data.rows.length === 0) {
      return empty({ label: 'Descargue el informe para guardarlo.' }, 'El informe no trae filas.');
    }
    return ready(e.data.rows.slice(0, FILAS_DE_INFORME).map((f) => this.filaDeInforme(f)));
  });

  private readonly celdaResultado = viewChild<TemplateRef<{ $implicit: FilaDeInforme }>>('resultadoCell');

  protected readonly columnasDelInforme = computed<readonly ColumnDef<FilaDeInforme>[]>(() => [
    { key: 'fila', header: 'Fila', priority: 1, align: 'end' },
    { key: 'resultado', header: 'Resultado', priority: 1, cell: this.celdaResultado() },
    { key: 'motivo', header: 'Motivo', priority: 1 },
    { key: 'columna', header: 'Columna', priority: 2 },
    { key: 'mensaje', header: 'Detalle', priority: 3 },
  ]);
  protected readonly nombreDeFilaDeInforme = (fila: FilaDeInforme): string => `Fila ${fila.fila}: ${fila.resultado.label}`;

  protected readonly informeCompleto = computed(() => {
    const e = this.informe();
    return e !== null && e.status === 'ready' ? e.data : null;
  });

  protected readonly todoRechazadoPorEscritor = computed(() => {
    const informe = this.informeCompleto();
    if (informe === null) return false;
    const valores = informe.rows.filter((f) => f.reason === 'EXECUTOR_NOT_CONNECTED' || f.reason === 'RESOLUTION_UNAVAILABLE');
    return valores.length > 0 && (informe.totals['CREADA'] ?? 0) === 0;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.detenerSeguimiento());
    this.cargar();
  }

  /* -- Carga de datos ---------------------------------------------------------------------------- */
  protected cargar(): void {
    this.cargarCatalogo();
    this.cargarLotes();
  }

  protected cargarCatalogo(): void {
    this.catalogo.set(loading());
    this.client.catalog().subscribe({
      next: (c) => {
        this.catalogo.set(ready(c));
        if (this.tipoElegido() === null) this.tipoElegido.set(c.templates.find((t) => t.group === this.grupo())?.kind ?? null);
      },
      error: (e: unknown) => this.catalogo.set(errorToViewState<BulkImportCatalog>(e)),
    });
  }

  protected cargarLotes(): void {
    this.lotes.set(loading());
    this.client.list().subscribe({
      next: (l) => this.lotes.set(ready(l)),
      error: (e: unknown) => this.lotes.set(errorToViewState<readonly BulkImportBatch[]>(e)),
    });
  }

  /** Recarga la lista sin dejarla en «cargando»: se usa al terminar una acción. */
  private refrescarLotes(): void {
    this.client.list().subscribe({
      next: (l) => this.lotes.set(ready(l)),
      error: () => undefined,
    });
  }

  /* -- Elección del tipo -------------------------------------------------------------------------------- */
  protected elegirGrupo(grupo: BulkImportGroup): void {
    this.grupo.set(grupo);
    this.tipoElegido.set(this.plantillasDelGrupo()[0]?.kind ?? null);
    this.objecion.set(null);
    this.falloAlRevisar.set(null);
  }

  protected elegirTipo(kind: string | null): void {
    this.tipoElegido.set(kind);
  }

  /* -- Edición de la declaración ------------------------------------------------------------------------------ */
  protected escribir(campo: CampoDeDeclaracion, valor: string | number | null): void {
    const texto = comoTexto(valor);
    switch (campo) {
      case 'reason':
        this.motivo.set(texto);
        break;
      case 'sourceOrganization':
        this.origen.set(texto);
        break;
      case 'legalBasis':
        this.baseLegal.set(texto);
        break;
      case 'loadedAt':
        this.fechaDeCarga.set(texto);
        break;
    }
    if (this.objecion()?.campo === campo) this.objecion.set(null);
  }

  protected elegirArchivo(elegidos: readonly File[]): void {
    this.archivos.set(elegidos);
    this.errorDeArchivo.set(null);
    this.falloAlRevisar.set(null);
  }

  protected rechazarArchivo(rechazados: readonly RejectedFile[]): void {
    const limites = this.limites();
    this.errorDeArchivo.set(
      rechazados.length === 0
        ? null
        : `Ese archivo no sirve: elija un CSV o un JSON${limites ? ` de hasta ${tamano(limites.maxBytes)}` : ''}.`,
    );
  }

  /* -- Revisar (crear el lote y ver la vista previa) ------------------------------------------------------------ */
  protected revisar(): void {
    if (this.revisando()) return;
    const plantilla = this.plantilla();
    const archivo = this.archivos()[0];
    this.intento.set(true);
    this.falloAlRevisar.set(null);
    if (plantilla === null) return;
    if (archivo === undefined) {
      this.errorDeArchivo.set('Elija el archivo que quiere cargar.');
      return;
    }
    if (!this.declaracionLista()) return;

    this.revisando.set(true);
    this.client.create({ kind: plantilla.kind, declaration: this.declaracion(), file: archivo }).subscribe({
      next: (lote) => {
        this.revisando.set(false);
        this.mostrarLote(lote);
        this.refrescarLotes();
      },
      error: (e: unknown) => {
        this.revisando.set(false);
        const fallo = falloDeCarga(e, this.limites() ?? undefined);
        this.falloAlRevisar.set(fallo);
        if (fallo.campo !== undefined) this.objecion.set({ campo: fallo.campo, texto: fallo.texto });
      },
    });
  }

  /** Sólo los campos que corresponden al tipo: la API rechaza los que sobran. */
  private declaracion(): BulkImportDeclaration {
    if (this.grupo() === 'USERS') return { reason: this.motivo().trim() };
    return {
      sourceOrganization: this.origen().trim(),
      legalBasis: this.baseLegal().trim(),
      loadedAt: this.fechaDeCarga().trim(),
    };
  }

  /** Deja la pantalla lista para otro archivo; la declaración y el tipo se conservan. */
  protected cargarOtro(): void {
    this.detenerSeguimiento();
    this.lote.set(null);
    this.informe.set(null);
    this.archivos.set([]);
    this.errorDeArchivo.set(null);
    this.falloDelLote.set(null);
    this.falloAlRevisar.set(null);
    this.intento.set(false);
  }

  /* -- El lote en pantalla ----------------------------------------------------------------------------------------- */
  protected abrirLote(lote: BulkImportBatch): void {
    this.pestana.set(0);
    this.mostrarLote(lote);
    this.actualizarLote();
  }

  private mostrarLote(lote: BulkImportBatch): void {
    this.lote.set(lote);
    this.informe.set(null);
    this.falloDelLote.set(null);
    if (estaEnCurso(lote.status)) this.seguir(lote.id);
    else this.alCambiarDeEstado(lote);
  }

  /** Vuelve a pedir el lote en pantalla (botón «Actualizar estado» y reintento tras un fallo). */
  protected actualizarLote(): void {
    const actual = this.lote();
    if (actual === null) return;
    this.client.get(actual.id).subscribe({
      next: (l) => {
        this.lote.set(l);
        this.falloDelLote.set(null);
        if (estaEnCurso(l.status)) this.seguir(l.id);
        else this.alCambiarDeEstado(l);
      },
      error: (e: unknown) => this.falloDelLote.set(falloDeCarga(e)),
    });
  }

  private seguir(id: string): void {
    this.detenerSeguimiento();
    this.seguimiento = timer(INTERVALO_DE_AVANCE_MS, INTERVALO_DE_AVANCE_MS)
      .pipe(
        exhaustMap(() =>
          this.client.get(id).pipe(
            catchError((e: unknown) => {
              this.detenerSeguimiento();
              this.falloDelLote.set(falloDeCarga(e));
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe((l) => {
        this.lote.set(l);
        if (!estaEnCurso(l.status)) {
          this.detenerSeguimiento();
          this.alCambiarDeEstado(l);
        }
      });
  }

  private detenerSeguimiento(): void {
    this.seguimiento?.unsubscribe();
    this.seguimiento = null;
  }

  private alCambiarDeEstado(lote: BulkImportBatch): void {
    this.refrescarLotes();
    if (lote.status === 'COMPLETADO' || lote.status === 'FALLIDO') this.cargarInforme(lote.id);
  }

  /* -- Confirmar --------------------------------------------------------------------------------------------------------- */
  protected confirmar(): void {
    const lote = this.lote();
    if (lote === null || lote.status !== 'VALIDADO' || this.confirmando()) return;
    this.confirmando.set(true);
    this.falloDelLote.set(null);
    this.client.confirm(lote.id).subscribe({
      next: (confirmado) => {
        this.confirmando.set(false);
        this.mostrarLote(confirmado);
        this.refrescarLotes();
      },
      error: (e: unknown) => {
        this.confirmando.set(false);
        this.falloDelLote.set(falloDeCarga(e));
      },
    });
  }

  /* -- Informe ------------------------------------------------------------------------------------------------------------- */
  protected cargarInforme(id?: string): void {
    const lote = id ?? this.lote()?.id;
    if (lote === undefined) return;
    this.informe.set(loading());
    this.client.report(lote).subscribe({
      next: (r) => this.informe.set(ready(r)),
      error: (e: unknown) => this.informe.set(errorToViewState<BulkImportReport>(e)),
    });
  }

  private filaDeInforme(f: BulkImportReportRow): FilaDeInforme {
    return {
      id: `${f.row}`,
      fila: f.row,
      resultado: resultadoDeFila(f.outcome),
      motivo: f.reason ? motivoLegible(f.reason) : '—',
      codigo: f.reason ?? null,
      columna: f.field ?? '—',
      mensaje: f.message ?? '—',
    };
  }

  /* -- Descargas -------------------------------------------------------------------------------------------------------------- */
  protected descargarPlantilla(kind: string, formato: BulkImportFormat): void {
    this.descargar(`plantilla-${kind}-${formato}`, this.client.downloadTemplate(kind, formato));
  }

  protected descargarInforme(formato: BulkImportFormat): void {
    const lote = this.lote();
    if (lote === null) return;
    this.descargar(`informe-${lote.id}-${formato}`, this.client.downloadReport(lote.id, formato));
  }

  protected estaDescargando(clave: string): boolean {
    return this.descargando() === clave;
  }

  protected claveDeDescarga(kind: string, formato: BulkImportFormat): string {
    return `plantilla-${kind}-${formato}`;
  }

  private descargar(clave: string, descarga$: ReturnType<BulkImportsClient['downloadTemplate']>): void {
    if (this.descargando() !== null) return;
    this.descargando.set(clave);
    this.falloDeDescarga.set(null);
    descarga$.subscribe({
      next: (archivo: BulkImportDownload) => {
        this.descargando.set(null);
        this.descargas.save(archivo.blob, archivo.fileName);
      },
      error: (e: unknown) => {
        this.descargando.set(null);
        this.falloDeDescarga.set(falloDeCarga(e));
      },
    });
  }

  protected tituloDelTipo(kind: string): string {
    return this.datosDelCatalogo()?.templates.find((t) => t.kind === kind)?.title ?? kind;
  }
}
