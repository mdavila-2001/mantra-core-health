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
import { EMPTY, catchError, exhaustMap, timer, type Observable, type Subscription } from 'rxjs';

import { ClinicalImportsClient } from '../../../core/data-access/admin-portal/clinical-imports.client';
import type {
  ClinicalImportBatch,
  ClinicalImportCatalog,
  ClinicalImportDownload,
  ClinicalImportFormat,
  ClinicalImportKind,
  ClinicalImportLoaded,
  ClinicalImportReport,
  ClinicalImportReportRow,
  ClinicalImportRowIssue,
} from '../../../core/data-access/admin-portal/clinical-imports.types';
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
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import {
  FileInput,
  type RejectedFile,
} from '../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import type { MetricTone } from '../../../shared/components/molecules/metric-card/metric-card.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { FileDownloadService } from '../../../shared/utils/file-download/file-download.service';
import {
  FILAS_DE_VISTA_PREVIA,
  REGLAS_DE_LA_CARGA,
  RESULTADOS_DE_FILA,
  avisosDelMotorClinico,
  estaEnCurso,
  estadoDeLote,
  falloDeCarga,
  frasePorLimites,
  motivoClinico,
  nombreDeLote,
  notasDelMotor,
  resultadoDeFila,
  resumenDelInformeClinico,
  tamano,
  type FalloDeCarga,
  type Rotulo,
} from './clinical-imports-labels';

/** Cada cuánto se vuelve a pedir un lote que sigue en cola o procesándose. */
export const INTERVALO_DE_AVANCE_MS = 2_000;
/** Cuántas filas del informe y de lo cargado se dibujan; el resto se descarga. */
const FILAS_DE_INFORME = 100;
type CampoDeDeclaracion = 'sourceOrganization' | 'legalBasis' | 'loadedAt';

interface FilaDeLote {
  readonly id: string;
  readonly tipo: string;
  readonly estado: Rotulo;
  readonly filas: string;
  readonly creado: string;
  readonly nombre: string;
  readonly lote: ClinicalImportBatch;
}

interface FilaDePlantilla {
  readonly kind: string;
  readonly title: string;
  readonly destino: string;
  readonly columnas: number;
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
  readonly columna: string;
  readonly mensaje: string;
}

interface FilaDeCargado {
  readonly id: string;
  readonly fila: number;
  readonly entidad: string;
  readonly destino: string;
}

const comoTexto = (valor: string | number | null): string => (valor === null ? '' : String(valor));

/**
 * Historias clínicas masivas: carga especial de registros clínicos de pacientes
 * que YA existen. Una sola tarjeta con pestañas —«Nueva carga», «Lotes» y
 * «Plantillas»— a lo ancho del área.
 *
 * Flujo: elegir el tipo de registro y bajar su plantilla (CSV o JSON, siempre a
 * la vista) → declarar origen, base legal y fecha (sin las tres no se revisa) →
 * subir el archivo → vista previa con los problemas por fila y columna (nunca el
 * valor de una celda) → confirmar, con una clave de idempotencia por lote →
 * seguir el avance → leer y bajar el informe y ver qué se agregó.
 *
 * Reglas de honestidad: «confirmado» no es «agregado» —lo dice el informe—; lo que
 * el motor no hace en esta instalación lo dice `engine`, arriba de todo; y la
 * pantalla no muestra ni pide datos clínicos de nadie. La autoridad sobre quién
 * puede cargar es la API: sin permiso responde 403 y la pantalla lo dice.
 */
@Component({
  selector: 'app-clinical-imports',
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
    Select,
    Tab,
    Tabs,
    Textarea,
    DataTable,
    PageHeader,
    ViewStateHost,
  ],
  templateUrl: './clinical-imports.html',
  styleUrl: './clinical-imports.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicalImports {
  private readonly client = inject(ClinicalImportsClient);
  private readonly descargas = inject(FileDownloadService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly estadoDeLote = estadoDeLote;
  protected readonly motivoClinico = motivoClinico;
  protected readonly frasePorLimites = frasePorLimites;
  protected readonly resumenDelInforme = resumenDelInformeClinico;
  protected readonly tamano = tamano;
  protected readonly reglas = REGLAS_DE_LA_CARGA;
  protected readonly filasDeInforme = FILAS_DE_INFORME;
  protected readonly filasDeVistaPrevia = FILAS_DE_VISTA_PREVIA;

  protected readonly pestana = signal(0);

  /* -- Datos del servidor --------------------------------------------------- */
  protected readonly catalogo = signal<ViewState<ClinicalImportCatalog>>(loading());
  protected readonly lotes = signal<ViewState<readonly ClinicalImportBatch[]>>(loading());

  /* -- Qué se carga ---------------------------------------------------------- */
  protected readonly tipoElegido = signal<string | null>(null);

  /* -- Declaración: viven en señales porque la pestaña cerrada no dibuja sus controles. */
  protected readonly origen = signal('');
  protected readonly baseLegal = signal('');
  protected readonly fechaDeCarga = signal('');
  protected readonly archivos = signal<readonly File[]>([]);
  protected readonly errorDeArchivo = signal<string | null>(null);
  /** Se prende al primer intento de revisar: recién ahí los campos muestran sus errores. */
  protected readonly intento = signal(false);
  /** Lo que el servidor objetó de la declaración; se apaga al editar ese campo. */
  protected readonly objecion = signal<{ readonly campo: string; readonly texto: string } | null>(
    null,
  );

  protected readonly revisando = signal(false);
  protected readonly falloAlRevisar = signal<FalloDeCarga | null>(null);

  /* -- El lote en pantalla ----------------------------------------------------- */
  protected readonly lote = signal<ClinicalImportBatch | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly falloDelLote = signal<FalloDeCarga | null>(null);
  protected readonly informe = signal<ViewState<ClinicalImportReport> | null>(null);
  protected readonly cargado = signal<ViewState<ClinicalImportLoaded> | null>(null);

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

  protected readonly opcionesDeTipo = computed<readonly SelectOption<string | null>[]>(() =>
    (this.datosDelCatalogo()?.kinds ?? []).map((t) => ({ value: t.kind, label: t.title })),
  );

  protected readonly tipo = computed<ClinicalImportKind | null>(() => {
    const tipos = this.datosDelCatalogo()?.kinds ?? [];
    return tipos.find((t) => t.kind === this.tipoElegido()) ?? tipos[0] ?? null;
  });

  protected readonly avisos = computed(() => {
    const datos = this.datosDelCatalogo();
    return datos === null ? [] : avisosDelMotorClinico(datos.engine);
  });

  protected readonly notas = computed(() => {
    const datos = this.datosDelCatalogo();
    return datos === null ? [] : notasDelMotor(datos.engine);
  });

  /** Hoy en UTC, como lo compara la API. */
  private readonly hoy = (): string => new Date().toISOString().slice(0, 10);
  protected readonly fechaMaxima = this.hoy();

  /** Errores de cada campo según lo que se escribió; `null` si está bien. */
  private readonly erroresLocales = computed<Readonly<Record<CampoDeDeclaracion, string | null>>>(
    () => {
      const largo = (
        valor: string,
        min: number,
        max: number,
        vacio: string,
        largoMax: string,
      ): string | null => {
        const n = valor.trim().length;
        if (n === 0) return vacio;
        if (n < min) return `Escriba al menos ${min} caracteres.`;
        return n > max ? largoMax : null;
      };
      const fecha = this.fechaDeCarga().trim();
      const fechaReal =
        /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
        new Date(`${fecha}T00:00:00Z`).toISOString().startsWith(fecha);
      return {
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
    },
  );

  /** Lo anterior más lo que el servidor objetó de la declaración. Se muestra tras el primer intento. */
  protected readonly erroresDeDeclaracion = computed<
    Readonly<Record<CampoDeDeclaracion, string | null>>
  >(() => {
    const locales = this.erroresLocales();
    const objecion = this.objecion();
    const con = (campo: CampoDeDeclaracion): string | null =>
      locales[campo] ?? (objecion?.campo === campo ? objecion.texto : null);
    return {
      sourceOrganization: con('sourceOrganization'),
      legalBasis: con('legalBasis'),
      loadedAt: con('loadedAt'),
    };
  });

  /** La declaración completa: sin ella no se revisa ni se confirma. */
  protected readonly declaracionLista = computed(() =>
    (['sourceOrganization', 'legalBasis', 'loadedAt'] as const).every(
      (c) => this.erroresLocales()[c] === null,
    ),
  );

  protected errorDe(campo: CampoDeDeclaracion): string | null {
    return this.intento() ? this.erroresDeDeclaracion()[campo] : null;
  }

  /* -- Tabla de lotes -------------------------------------------------------------- */
  private readonly celdaEstadoLote =
    viewChild<TemplateRef<{ $implicit: FilaDeLote }>>('estadoLoteCell');
  private readonly celdaAccionLote =
    viewChild<TemplateRef<{ $implicit: FilaDeLote }>>('accionLoteCell');
  private readonly celdaCreado = viewChild<TemplateRef<{ $implicit: FilaDeLote }>>('creadoCell');

  protected readonly filasDeLotes = computed<ViewState<readonly FilaDeLote[]>>(() => {
    const e = this.lotes();
    if (e.status !== 'ready') return e as ViewState<readonly FilaDeLote[]>;
    if (e.data.length === 0) {
      return empty(
        {
          label:
            'Vaya a «Nueva carga», elija un tipo de registro, baje su plantilla y suba el archivo.',
        },
        'Esta organización todavía no tiene lotes de historia clínica. Un lote aparece acá apenas se revisa un archivo.',
      );
    }
    const titulos = new Map((this.datosDelCatalogo()?.kinds ?? []).map((t) => [t.kind, t.title]));
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
    { key: 'tipo', header: 'Tipo de registro', priority: 1 },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstadoLote() },
    { key: 'filas', header: 'Filas válidas', priority: 2, align: 'end' },
    { key: 'creado', header: 'Revisado', priority: 3, cell: this.celdaCreado() },
    { key: 'accion', header: 'Acción', priority: 1, accion: true, cell: this.celdaAccionLote() },
  ]);
  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  protected readonly nombreDeFilaDeLote = (fila: FilaDeLote): string =>
    `${fila.nombre}: ${fila.estado.label}`;

  /* -- Tabla de plantillas ---------------------------------------------------------- */
  private readonly celdaDescargas =
    viewChild<TemplateRef<{ $implicit: FilaDePlantilla }>>('descargasCell');

  protected readonly filasDePlantillas = computed<ViewState<readonly FilaDePlantilla[]>>(() => {
    const e = this.catalogo();
    if (e.status !== 'ready') return e as ViewState<readonly FilaDePlantilla[]>;
    if (e.data.kinds.length === 0) {
      return empty(
        { label: 'Pida a quien opera la API que revise el catálogo de la carga clínica.' },
        'La API no declara ningún tipo de registro: no hay plantillas para bajar.',
      );
    }
    return ready(
      e.data.kinds.map((t) => ({
        kind: t.kind,
        title: t.title,
        destino: t.target,
        columnas: t.columnCount,
      })),
    );
  });

  protected readonly columnasDePlantillas = computed<readonly ColumnDef<FilaDePlantilla>[]>(() => [
    { key: 'title', header: 'Tipo de registro', priority: 1 },
    { key: 'destino', header: 'Entidad de destino', priority: 3 },
    { key: 'columnas', header: 'Columnas', priority: 3, align: 'end' },
    {
      key: 'descargas',
      header: 'Plantilla',
      priority: 1,
      accion: true,
      cell: this.celdaDescargas(),
    },
  ]);
  protected readonly porKind = (fila: FilaDePlantilla): string => fila.kind;
  protected readonly nombreDeFilaDePlantilla = (fila: FilaDePlantilla): string => fila.title;

  /* -- Vista previa ------------------------------------------------------------------ */
  protected readonly hallazgos = computed<ViewState<readonly FilaDeHallazgo[]>>(() => {
    const items: readonly ClinicalImportRowIssue[] = this.lote()?.issues.items ?? [];
    if (items.length === 0) {
      return empty({ label: 'Siga con la confirmación.' }, 'Ninguna fila tiene problemas.');
    }
    return ready(
      items.slice(0, FILAS_DE_VISTA_PREVIA).map((h, i) => ({
        id: `${h.row}-${h.field}-${i}`,
        fila: h.row,
        columna: h.field === '*' ? 'Toda la fila' : h.field,
        motivo: motivoClinico(h.code),
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
  protected readonly nombreDeHallazgo = (fila: FilaDeHallazgo): string =>
    `Fila ${fila.fila}, columna ${fila.columna}`;

  protected readonly hallazgosSinMostrar = computed(() => {
    const lote = this.lote();
    return lote === null
      ? 0
      : Math.max(0, lote.issues.total - Math.min(lote.issues.items.length, FILAS_DE_VISTA_PREVIA));
  });

  protected readonly porcentajeDeAvance = computed(() => {
    const lote = this.lote();
    if (lote === null || lote.progress.total === 0) return 0;
    return Math.round((lote.progress.processed / lote.progress.total) * 100);
  });

  /* -- Informe y lo cargado --------------------------------------------------------------- */
  protected readonly tarjetasDelInforme = computed(() => {
    const e = this.informe();
    if (e === null || e.status !== 'ready') return [];
    const totales = e.data.totals;
    return RESULTADOS_DE_FILA.filter((r) => r === 'CREADA' || (totales[r] ?? 0) > 0).map((r) => {
      const rotulo = resultadoDeFila(r);
      const valor = totales[r] ?? 0;
      const tono: MetricTone =
        r === 'CREADA'
          ? valor > 0
            ? 'success'
            : 'warning'
          : rotulo.tone === 'secondary'
            ? 'neutral'
            : (rotulo.tone as MetricTone);
      return { clave: r, etiqueta: rotulo.plural, valor, tono };
    });
  });

  protected readonly filasDelInforme = computed<ViewState<readonly FilaDeInforme[]>>(() => {
    const e = this.informe();
    if (e === null || e.status !== 'ready')
      return (e ?? loading()) as ViewState<readonly FilaDeInforme[]>;
    if (e.data.rows.length === 0) {
      return empty({ label: 'Descargue el informe para guardarlo.' }, 'El informe no trae filas.');
    }
    return ready(e.data.rows.slice(0, FILAS_DE_INFORME).map((f) => this.filaDeInforme(f)));
  });

  private readonly celdaResultado =
    viewChild<TemplateRef<{ $implicit: FilaDeInforme }>>('resultadoCell');

  protected readonly columnasDelInforme = computed<readonly ColumnDef<FilaDeInforme>[]>(() => [
    { key: 'fila', header: 'Fila', priority: 1, align: 'end' },
    { key: 'resultado', header: 'Resultado', priority: 1, cell: this.celdaResultado() },
    { key: 'motivo', header: 'Motivo', priority: 1 },
    { key: 'columna', header: 'Columna', priority: 2 },
    { key: 'mensaje', header: 'Detalle', priority: 3 },
  ]);
  protected readonly nombreDeFilaDeInforme = (fila: FilaDeInforme): string =>
    `Fila ${fila.fila}: ${fila.resultado.label}`;

  protected readonly informeCompleto = computed(() => {
    const e = this.informe();
    return e !== null && e.status === 'ready' ? e.data : null;
  });

  protected readonly nadaSeAgrego = computed(() => {
    const informe = this.informeCompleto();
    return (
      informe !== null &&
      (informe.totals['total'] ?? 0) > 0 &&
      (informe.totals['CREADA'] ?? 0) === 0
    );
  });

  protected readonly filasDeCargado = computed<ViewState<readonly FilaDeCargado[]>>(() => {
    const e = this.cargado();
    if (e === null || e.status !== 'ready')
      return (e ?? loading()) as ViewState<readonly FilaDeCargado[]>;
    if (e.data.records.length === 0) {
      return empty(
        { label: 'Revise el informe para ver por qué.' },
        'Este lote no agregó ningún registro.',
      );
    }
    return ready(
      e.data.records.slice(0, FILAS_DE_INFORME).map((r) => ({
        id: `${r.row}-${r.targetId}`,
        fila: r.row,
        entidad: r.entity,
        destino: r.targetId,
      })),
    );
  });

  protected readonly columnasDeCargado: readonly ColumnDef<FilaDeCargado>[] = [
    { key: 'fila', header: 'Fila', priority: 1, align: 'end' },
    { key: 'entidad', header: 'Entidad', priority: 1 },
    { key: 'destino', header: 'Identificador del registro', priority: 2 },
  ];
  protected readonly nombreDeFilaDeCargado = (fila: FilaDeCargado): string =>
    `Fila ${fila.fila}: ${fila.entidad}`;

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
        if (this.tipoElegido() === null) this.tipoElegido.set(c.kinds[0]?.kind ?? null);
      },
      error: (e: unknown) => this.catalogo.set(errorToViewState<ClinicalImportCatalog>(e)),
    });
  }

  protected cargarLotes(): void {
    this.lotes.set(loading());
    this.client.list().subscribe({
      next: (l) => this.lotes.set(ready(l)),
      error: (e: unknown) => this.lotes.set(errorToViewState<readonly ClinicalImportBatch[]>(e)),
    });
  }

  /** Recarga la lista sin dejarla en «cargando»: se usa al terminar una acción. */
  private refrescarLotes(): void {
    this.client.list().subscribe({
      next: (l) => this.lotes.set(ready(l)),
      error: () => undefined,
    });
  }

  /* -- Elección del tipo ------------------------------------------------------------------------- */
  protected elegirTipo(kind: string | null): void {
    this.tipoElegido.set(kind);
    this.falloAlRevisar.set(null);
  }

  /* -- Edición de la declaración -------------------------------------------------------------------- */
  protected escribir(campo: CampoDeDeclaracion, valor: string | number | null): void {
    const texto = comoTexto(valor);
    switch (campo) {
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

  /* -- Revisar (crear el lote y ver la vista previa) ------------------------------------------------- */
  protected revisar(): void {
    if (this.revisando()) return;
    const tipo = this.tipo();
    const archivo = this.archivos()[0];
    this.intento.set(true);
    this.falloAlRevisar.set(null);
    if (tipo === null) return;
    if (archivo === undefined) {
      this.errorDeArchivo.set('Elija el archivo que quiere cargar.');
      return;
    }
    // Sin la declaración completa no se manda nada: tampoco el archivo.
    if (!this.declaracionLista()) return;

    this.revisando.set(true);
    this.client
      .create({
        kind: tipo.kind,
        declaration: {
          sourceOrganization: this.origen().trim(),
          legalBasis: this.baseLegal().trim(),
          loadedAt: this.fechaDeCarga().trim(),
        },
        file: archivo,
      })
      .subscribe({
        next: (lote) => {
          this.revisando.set(false);
          this.mostrarLote(lote);
          this.refrescarLotes();
        },
        error: (e: unknown) => {
          this.revisando.set(false);
          const fallo = falloDeCarga(e, this.limites() ?? undefined);
          this.falloAlRevisar.set(fallo);
          if (fallo.campo !== undefined)
            this.objecion.set({ campo: fallo.campo, texto: fallo.texto });
        },
      });
  }

  /** Deja la pantalla lista para otro archivo; la declaración y el tipo se conservan. */
  protected cargarOtro(): void {
    this.detenerSeguimiento();
    this.lote.set(null);
    this.informe.set(null);
    this.cargado.set(null);
    this.archivos.set([]);
    this.errorDeArchivo.set(null);
    this.falloDelLote.set(null);
    this.falloAlRevisar.set(null);
    this.intento.set(false);
  }

  /* -- El lote en pantalla -------------------------------------------------------------------------------- */
  protected abrirLote(lote: ClinicalImportBatch): void {
    this.pestana.set(0);
    this.mostrarLote(lote);
    this.actualizarLote();
  }

  private mostrarLote(lote: ClinicalImportBatch): void {
    this.lote.set(lote);
    this.informe.set(null);
    this.cargado.set(null);
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

  private alCambiarDeEstado(lote: ClinicalImportBatch): void {
    this.refrescarLotes();
    if (lote.status === 'COMPLETADO' || lote.status === 'FALLIDO') {
      this.cargarInforme(lote.id);
      this.cargarCargado(lote.id);
    } else if (lote.status === 'RECHAZADO') {
      this.cargarInforme(lote.id);
    }
  }

  /* -- Confirmar --------------------------------------------------------------------------------------------- */
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

  /* -- Informe y lo cargado ------------------------------------------------------------------------------------- */
  protected cargarInforme(id?: string): void {
    const lote = id ?? this.lote()?.id;
    if (lote === undefined) return;
    this.informe.set(loading());
    this.client.report(lote).subscribe({
      next: (r) => this.informe.set(ready(r)),
      error: (e: unknown) => this.informe.set(errorToViewState<ClinicalImportReport>(e)),
    });
  }

  protected cargarCargado(id?: string): void {
    const lote = id ?? this.lote()?.id;
    if (lote === undefined) return;
    this.cargado.set(loading());
    this.client.loaded(lote).subscribe({
      next: (r) => this.cargado.set(ready(r)),
      error: (e: unknown) => this.cargado.set(errorToViewState<ClinicalImportLoaded>(e)),
    });
  }

  private filaDeInforme(f: ClinicalImportReportRow): FilaDeInforme {
    return {
      id: `${f.row}`,
      fila: f.row,
      resultado: resultadoDeFila(f.outcome),
      motivo: f.reason ? motivoClinico(f.reason) : '—',
      columna: f.field ?? '—',
      mensaje: f.message ?? '—',
    };
  }

  /* -- Descargas ------------------------------------------------------------------------------------------------------ */
  protected descargarPlantilla(kind: string, formato: ClinicalImportFormat): void {
    this.descargar(
      this.claveDeDescarga(kind, formato),
      this.client.downloadTemplate(kind, formato),
    );
  }

  protected descargarInforme(formato: ClinicalImportFormat): void {
    const lote = this.lote();
    if (lote === null) return;
    this.descargar(`informe-${lote.id}-${formato}`, this.client.downloadReport(lote.id, formato));
  }

  protected estaDescargando(clave: string): boolean {
    return this.descargando() === clave;
  }

  protected claveDeDescarga(kind: string, formato: ClinicalImportFormat): string {
    return `plantilla-${kind}-${formato}`;
  }

  private descargar(clave: string, descarga$: Observable<ClinicalImportDownload>): void {
    if (this.descargando() !== null) return;
    this.descargando.set(clave);
    this.falloDeDescarga.set(null);
    descarga$.subscribe({
      next: (archivo) => {
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
    return this.datosDelCatalogo()?.kinds.find((t) => t.kind === kind)?.title ?? kind;
  }
}
