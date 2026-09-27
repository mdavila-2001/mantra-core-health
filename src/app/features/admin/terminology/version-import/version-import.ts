import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { blobToDataUrl } from '../../../../core/data-access/files/blob-to-data-url';
import { FileDownloader } from '../../../../core/data-access/files/file-downloader';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type {
  CodeSystemListItem,
  CodeSystemVersionListItem,
  ConceptImportResult,
  ImportFileIssue,
  ImportPreviewRow,
  ImportProfile,
  ImportTemplateFormat,
} from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import {
  FileInput,
  type RejectedFile,
} from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CsvExportService, type CsvColumn } from '../../../../shared/utils/csv-export/csv-export';

/**
 * Tope de tamaño, **el mismo que aplica el servidor**.
 *
 * No es un número elegido acá: es `FILE_STORAGE_MAX_SIZE_BYTES` (10 MiB por
 * defecto), que el importador pasa a `limits.fileSize` de multer. Ponerlo más
 * alto —estuvo en 25 MiB— hacía que un archivo de 20 MB pasara la validación de
 * la pantalla, viajara entero por la red y muriera del otro lado con un fallo de
 * multer que no dice su causa. Rechazarlo acá cuesta cero y explica por qué.
 */
const MAX_BYTES = 10 * 1024 * 1024;

/** El tope, dicho en las unidades en las que la gente mira sus archivos. */
const MAX_MIB = MAX_BYTES / (1024 * 1024);

/**
 * Lo que el selector de archivos ofrece.
 *
 * Los tres formatos del contrato con sus extensiones **y** sus tipos MIME: el
 * diálogo del sistema filtra por lo que reconozca, y en Windows un `.csv`
 * llega a veces como `application/vnd.ms-excel`. Es un filtro de comodidad, no
 * una validación: quien decide de verdad es el servidor, que mira los bytes.
 */
const ACCEPT =
  '.csv,.xlsx,.ndjson,.jsonl,.json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,text/plain';

/** Cuántos problemas y cuántas filas de ejemplo manda el servidor (§2). */
const TOPE_DE_MUESTRA = 20;

/** Los perfiles que la pantalla ofrece hoy. Ver la nota de `opcionesDePerfil`. */
const PERFILES: readonly SelectOption<ImportProfile>[] = [
  { value: 'conceptos', label: 'Conceptos' },
];

/**
 * Importación de conceptos por archivo — `/administration/terminology/import`.
 *
 * ## Los tres pasos, y por qué son tres
 *
 * 1. **Qué vas a cargar.** El perfil fija qué columnas se esperan, el sistema y
 *    la versión fijan a dónde van. Sólo se ofrecen versiones que admiten
 *    conceptos: una publicada no los acepta, y ofrecerla sería preparar un 422
 *    que la persona descubre recién al enviar. Acá también se baja la
 *    plantilla, que es lo que evita el modo de fallo más común de una carga
 *    masiva —un encabezado que el importador no reconoce—.
 * 2. **El archivo.** Se arrastra o se elige. Nada se manda todavía.
 * 3. **El resultado.** Primero **validar sin guardar**: el servidor lee el
 *    archivo entero, devuelve cuántas filas leyó, la vista previa y los
 *    problemas con su fila y su columna, y **no escribe nada**. Recién con 0
 *    errores se habilita «Importar» (Q-8). Es todo o nada (Q-2): un archivo de
 *    catálogo que entra a medias no se deshace con un botón.
 *
 * Publicar la versión sigue siendo un paso propio y aparte: mientras sea
 * borrador, toda expansión de conjunto de valores sale vacía *sin error*,
 * que es el modo de fallo más callado de todo el catálogo.
 *
 * ## Qué **no** hace esta pantalla
 *
 * No parsea el archivo (Q-5). La vista previa la devuelve el servidor en el
 * dry-run: leer un XLSX en el navegador exigiría una dependencia nueva y, peor,
 * daría una vista previa que puede no coincidir con lo que el importador va a
 * leer de verdad. Lo único que se arma acá es el CSV de los errores, que son
 * datos que ya están en pantalla.
 */
@Component({
  selector: 'app-version-import',
  imports: [
    Alert,
    AppButton,
    Card,
    DataTable,
    FileInput,
    FormField,
    PageHeader,
    Select,
    ViewStateHost,
  ],
  templateUrl: './version-import.html',
  styleUrl: './version-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionImport {
  private readonly terminology = inject(TerminologyClient);
  private readonly toast = inject(ToastService);
  private readonly csv = inject(CsvExportService);
  private readonly downloader = inject(FileDownloader);

  protected readonly maxBytes = MAX_BYTES;
  protected readonly maxMib = MAX_MIB;
  protected readonly accept = ACCEPT;
  protected readonly topeDeMuestra = TOPE_DE_MUESTRA;

  /** Para llevar el foco al resultado apenas hay algo que leer (H4.S3.M2). */
  private readonly informeRef = viewChild<ElementRef<HTMLElement>>('informeAncla');
  private readonly resumenRef = viewChild<ElementRef<HTMLElement>>('resumenAncla');

  protected readonly estado = signal<ViewState<readonly CodeSystemListItem[]>>(loading());

  /* -- Paso 1 · qué se carga ----------------------------------------------- */

  protected readonly perfil = signal<ImportProfile | null>('conceptos');
  protected readonly sistema = signal<string | null>(null);
  protected readonly versiones = signal<readonly CodeSystemVersionListItem[]>([]);
  protected readonly version = signal<string | null>(null);
  protected readonly cargandoVersiones = signal(false);
  protected readonly descargandoPlantilla = signal(false);

  /* -- Paso 2 · el archivo -------------------------------------------------- */

  protected readonly archivos = signal<readonly File[]>([]);

  /* -- Paso 3 · el resultado ------------------------------------------------ */

  protected readonly validando = signal(false);
  protected readonly importando = signal(false);
  protected readonly publicando = signal(false);

  /** El informe del dry-run: lo que se valida, no lo que se guardó. */
  protected readonly informe = signal<ConceptImportResult | null>(null);

  /** Lo que dejó la importación de verdad. Sólo existe después de importar. */
  protected readonly resumen = signal<ConceptImportResult | null>(null);

  /** El fallo de la última llamada, ya traducido al M34. */
  protected readonly fallo = signal<ViewState<null> | null>(null);

  /**
   * Los perfiles del select.
   *
   * Hoy uno solo: `designaciones` existe en el contrato (§1) pero depende de
   * que la API tenga su entidad, su DTO y su repositorio (Q-9), y ofrecer una
   * opción que el servidor va a rechazar es peor que no ofrecerla. El select
   * existe igual porque la pregunta «qué vas a cargar» es la primera que hay
   * que contestar, y esconderla mientras haya una sola respuesta obliga a
   * rehacer la pantalla el día que haya dos.
   */
  protected readonly opcionesDePerfil = PERFILES;

  protected readonly opcionesDeSistema = computed<readonly SelectOption<string>[]>(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') return [];
    return actual.data.map((sistema) => ({
      value: sistema.id,
      label: `${sistema.name} · ${sistema.internalCode}`,
    }));
  });

  /**
   * Sólo las versiones que admiten conceptos.
   *
   * Una publicada no los acepta: ofrecerla sería preparar un 422 que la persona
   * descubre recién al enviar.
   */
  protected readonly opcionesDeVersion = computed<readonly SelectOption<string>[]>(() =>
    this.versiones()
      .filter((version) => version.acceptsConcepts)
      .map((version) => ({
        value: version.id,
        label: `${version.version} · ${this.rotuloDeEstado(version.state)}`,
      })),
  );

  /** El sistema tiene versiones, pero ninguna admite conceptos. */
  protected readonly sinVersionesAbiertas = computed(
    () =>
      this.sistema() !== null &&
      !this.cargandoVersiones() &&
      this.versiones().length > 0 &&
      this.opcionesDeVersion().length === 0,
  );

  /** Alguna llamada del paso 3 está en curso. */
  protected readonly cargando = computed(() => this.validando() || this.importando());

  protected readonly archivo = computed<File | null>(() => this.archivos()[0] ?? null);

  protected readonly puedeValidar = computed(
    () => this.version() !== null && this.archivo() !== null && !this.cargando(),
  );

  /**
   * «Importar» se habilita **sólo** tras una validación con 0 errores (Q-8).
   *
   * Es un `computed` sobre el informe y no un booleano que alguien recuerda
   * apagar: cualquier cosa que borre el informe —cambiar el archivo, cambiar la
   * versión, pulsar «Cargar otro»— deshabilita el botón sola, sin una línea más.
   */
  protected readonly puedeImportar = computed(() => {
    const validacion = this.informe();
    return (
      validacion !== null &&
      validacion.errors === 0 &&
      !validacion.aborted &&
      this.version() !== null &&
      this.archivo() !== null &&
      !this.cargando()
    );
  });

  /** «Importar 50 conceptos»: el número sale de lo que el servidor leyó. */
  protected readonly textoDeImportar = computed(() => {
    const validacion = this.informe();
    if (validacion === null || validacion.totalRead === 0) return 'Importar';
    return `Importar ${validacion.totalRead} conceptos`;
  });

  /** Las columnas que el archivo tiene que traer, según el perfil elegido. */
  protected readonly ayudaDeColumnas = computed(() => {
    if (this.perfil() === 'designaciones') {
      return 'Columnas: code (obligatoria), language (obligatoria), use (opcional), value (obligatoria).';
    }
    return 'Columnas: code (obligatoria), display (obligatoria), definition (opcional). También acepta código/nombre/definición.';
  });

  /* -- Las dos tablas del paso 3 -------------------------------------------- */

  protected readonly columnasDeVistaPrevia: readonly ColumnDef<ImportPreviewRow>[] = [
    { key: 'line', header: 'Fila', priority: 1, align: 'end' },
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'display', header: 'Nombre', priority: 1 },
    { key: 'definition', header: 'Definición', priority: 3 },
  ];

  protected readonly columnasDeErrores: readonly ColumnDef<ImportFileIssue>[] = [
    { key: 'line', header: 'Fila', priority: 1, align: 'end' },
    { key: 'column', header: 'Columna', priority: 1 },
    { key: 'message', header: 'Motivo', priority: 1 },
  ];

  protected readonly filaDeVistaPrevia = (fila: ImportPreviewRow): string => String(fila.line);
  protected readonly filaDeError = (problema: ImportFileIssue): string =>
    `${problema.line}-${problema.column ?? 'fila'}`;

  /**
   * Estado de la vista previa. Vacío **que orienta** (S3 del M34): un archivo
   * sin ninguna fila válida no es un error del sistema, es un archivo que hay
   * que corregir, y el vacío tiene que decirlo.
   */
  protected readonly estadoDeVistaPrevia = computed<ViewState<readonly ImportPreviewRow[]>>(() => {
    const validacion = this.informe();
    if (validacion === null) return loading();
    const filas = validacion.preview ?? [];
    if (filas.length === 0) {
      return empty(
        { label: 'Elegí otro archivo' },
        'El archivo no trajo ninguna fila que se pueda importar.',
      );
    }
    return ready(filas);
  });

  protected readonly estadoDeErrores = computed<ViewState<readonly ImportFileIssue[]>>(() =>
    ready(this.informe()?.errorSamples ?? []),
  );

  /** «Primeros 20 errores de 137.» Vacío cuando los 137 entran en la muestra. */
  protected readonly leyendaDeErrores = computed(() => {
    const validacion = this.informe();
    if (validacion === null || validacion.errors <= validacion.errorSamples.length) return '';
    return `Se muestran los primeros ${validacion.errorSamples.length} de ${validacion.errors} errores.`;
  });

  /**
   * A qué bloque hay que llevar el foco en cuanto exista en el DOM.
   *
   * Hace falta el intermediario porque el bloque **todavía no está** cuando
   * llega la respuesta: la señal se escribe, y el `@if` que dibuja el informe
   * se resuelve en el render siguiente. Enfocar ahí mismo era enfocar
   * `undefined`, en silencio. El `effect` de abajo vuelve a correr cuando la
   * consulta de vista encuentra el elemento, y recién entonces mueve el foco.
   */
  private readonly pendienteDeFoco = signal<'informe' | 'resumen' | null>(null);

  constructor() {
    effect(() => {
      const destino = this.pendienteDeFoco();
      if (destino === null) return;
      const ancla = destino === 'informe' ? this.informeRef() : this.resumenRef();
      if (ancla === undefined) return;
      ancla.nativeElement.focus();
      this.pendienteDeFoco.set(null);
    });

    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.terminology.listCodeSystems().subscribe({
      next: (items) => this.estado.set(ready(items)),
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly CodeSystemListItem[]>(error)),
    });
  }

  protected cambiarPerfil(perfil: ImportProfile | null): void {
    this.perfil.set(perfil);
    this.limpiarResultado();
  }

  /**
   * Cambia el sistema y trae sus versiones.
   *
   * @param sistemaId - El sistema elegido.
   */
  protected cambiarSistema(sistemaId: string | null): void {
    this.sistema.set(sistemaId);
    this.version.set(null);
    this.versiones.set([]);
    this.limpiarResultado();
    this.recargarVersiones(sistemaId);
  }

  /**
   * Relee las versiones del sistema elegido, sin tocar nada más.
   *
   * @param sistemaId - El sistema cuyas versiones se releen; por defecto, el actual.
   */
  private recargarVersiones(sistemaId = this.sistema()): void {
    if (sistemaId === null) return;

    this.cargandoVersiones.set(true);
    this.terminology.listVersions(sistemaId).subscribe({
      next: (items) => {
        this.versiones.set(items);
        this.cargandoVersiones.set(false);
      },
      error: () => {
        this.versiones.set([]);
        this.cargandoVersiones.set(false);
        this.toast.error('No pudimos leer las versiones de este sistema.', 'Error');
      },
    });
  }

  protected cambiarVersion(versionId: string | null): void {
    this.version.set(versionId);
    this.limpiarResultado();
  }

  /**
   * Cambiar el archivo invalida todo lo que se sabía del anterior.
   *
   * Sin esto, validar `ok-50.csv`, cambiar a `con-errores.csv` y pulsar
   * «Importar» mandaría el archivo nuevo amparado por la validación del viejo —
   * el botón seguiría habilitado porque el informe anterior decía 0 errores—.
   */
  protected cambiarArchivo(archivos: readonly File[]): void {
    this.archivos.set(archivos);
    this.limpiarResultado();
  }

  /** Borra todo lo que el paso 3 sabía. El paso 1 no se toca. */
  private limpiarResultado(): void {
    this.informe.set(null);
    this.resumen.set(null);
    this.fallo.set(null);
  }

  /**
   * Vuelve al paso 2 conservando el paso 1.
   *
   * Cargar dos catálogos seguidos en la misma versión es el caso corriente:
   * hacer que la persona vuelva a elegir perfil, sistema y versión cada vez es
   * pedirle que repita la parte que no cambió.
   */
  protected cargarOtro(): void {
    this.archivos.set([]);
    this.limpiarResultado();
  }

  /**
   * Dice en voz alta qué archivo no entró y por qué.
   *
   * El átomo descarta en silencio lo que no cumple: sin esto, arrastrar un
   * archivo de 30 MB no producía **ningún** cambio visible —ni el archivo en la
   * lista, ni un aviso— y se leía como que la pantalla está rota.
   *
   * @param rechazados - Lo que el átomo dejó afuera.
   */
  protected avisarRechazos(rechazados: readonly RejectedFile[]): void {
    if (rechazados.length === 0) return;

    const detalle = rechazados
      .map((rechazado) => `«${rechazado.file.name}» (${this.motivoDe(rechazado.reason)})`)
      .join('; ');
    const mensaje = `No se pudo tomar ${detalle}.`;
    // Anclado en la sección 3 y además como aviso: un toast se va solo, y el
    // motivo de un rechazo es justo lo que hay que poder releer para corregir.
    this.fallo.set({ status: 'validation', issues: [{ message: mensaje }] });
    this.toast.warning(mensaje, 'Archivo no aceptado');
  }

  /**
   * El motivo del rechazo, en palabras y con el dato que hace falta para actuar.
   *
   * @param reason - El motivo que informó el átomo.
   */
  private motivoDe(reason: RejectedFile['reason']): string {
    if (reason === 'tamaño') return `pasa los ${MAX_MIB} MB que acepta el servidor`;
    if (reason === 'tipo') return 'no es un archivo CSV, XLSX ni NDJSON';
    if (reason === 'cupo') return 'se importa de a un archivo por vez';
    return 'ya estaba elegido';
  }

  /**
   * Lee y valida el archivo **sin escribir nada**.
   *
   * Es el único camino de entrada: desde la pantalla no se importa sin validar
   * antes (Q-8). Un `dryRun` cuesta lo mismo que la importación —el servidor
   * lee el archivo entero igual— y evita el caso que no tiene vuelta atrás.
   */
  protected validar(): void {
    this.enviar({ dryRun: true });
  }

  /** Manda el mismo archivo otra vez, ahora de verdad. */
  protected importar(): void {
    if (!this.puedeImportar()) return;
    this.enviar({ dryRun: false });
  }

  /**
   * La única llamada al importador, en sus dos modos.
   *
   * @param opciones - `dryRun: true` valida sin guardar; `false` importa.
   */
  private enviar({ dryRun }: { dryRun: boolean }): void {
    const versionId = this.version();
    const archivo = this.archivo();
    const perfil = this.perfil();
    // El bloqueo de doble envío: dos clics rápidos entran acá dos veces, y el
    // segundo se va por esta puerta porque el primero ya encendió la señal.
    if (versionId === null || archivo === null || perfil === null || this.cargando()) return;

    const enCurso = dryRun ? this.validando : this.importando;
    enCurso.set(true);
    this.fallo.set(null);
    if (dryRun) this.resumen.set(null);

    this.terminology.importConceptsFile(versionId, archivo, { dryRun, profile: perfil }).subscribe({
      next: (resultado) => {
        enCurso.set(false);
        if (dryRun) {
          this.informe.set(resultado);
          this.pendienteDeFoco.set('informe');
        } else {
          this.resumen.set(resultado);
          this.pendienteDeFoco.set('resumen');
          this.avisar(resultado);
        }
      },
      error: (error: unknown) => {
        enCurso.set(false);
        // Lo que la persona eligió NO se toca: el archivo, el perfil, el
        // sistema y la versión siguen donde estaban. Un fallo de red que
        // además borra el formulario obliga a rehacer todo el trabajo.
        this.fallo.set(this.falloDe(error));
      },
    });
  }

  /**
   * Baja la plantilla del perfil, en el formato pedido.
   *
   * @param format - `csv` o `xlsx`.
   */
  protected descargarPlantilla(format: ImportTemplateFormat): void {
    const perfil = this.perfil();
    if (perfil === null || this.descargandoPlantilla()) return;

    this.descargandoPlantilla.set(true);
    this.terminology.downloadImportTemplate(perfil, format).subscribe({
      next: ({ blob, fileName }) => {
        this.descargandoPlantilla.set(false);
        // El nombre lo decide el servidor por `Content-Disposition`; la reserva
        // es sólo para cuando la cabecera no viene.
        this.guardar(blob, fileName ?? `plantilla-${perfil}.${format}`);
      },
      error: () => {
        this.descargandoPlantilla.set(false);
        this.toast.error('No pudimos preparar la plantilla. Reintentá en un momento.', 'Error');
      },
    });
  }

  /**
   * Guarda unos bytes como archivo del disco.
   *
   * Pasa por `data:` URL y no por `URL.createObjectURL`: es lo que ya hace el
   * repo para descargar el certificado de portabilidad, y la razón es la
   * política de contenido —un `blob:` se bloquea en algunas superficies—.
   */
  private guardar(blob: Blob, nombre: string): void {
    blobToDataUrl(blob).subscribe({
      next: (dataUrl) => this.downloader.trigger(dataUrl, nombre),
      error: () => this.toast.error('No se pudo preparar la descarga.', 'Error'),
    });
  }

  /**
   * Baja los problemas como CSV, armado en el navegador.
   *
   * Son datos que ya están en pantalla: no hace falta pedírselos otra vez al
   * servidor. Lo arma `CsvExportService`, que ya neutraliza la inyección de
   * fórmulas —una celda que empieza con `=`, `+`, `-` o `@` se prefija con un
   * apóstrofo— y escapa según RFC 4180. Un motivo de error puede venir con el
   * texto de la celda que lo causó, así que ese riesgo es real y no teórico.
   */
  protected descargarErrores(): void {
    const validacion = this.informe();
    if (validacion === null || validacion.errorSamples.length === 0) return;

    const columnas: readonly CsvColumn<ImportFileIssue>[] = [
      { header: 'fila', value: (problema) => String(problema.line) },
      { header: 'columna', value: (problema) => problema.column ?? '' },
      { header: 'motivo', value: (problema) => problema.message },
    ];

    this.csv.download(validacion.errorSamples, columnas, this.nombreDelCsvDeErrores(validacion));
  }

  /** `errores-<lote>.csv`, o con la fecha cuando no hay lote (dry-run, Q-4). */
  private nombreDelCsvDeErrores(validacion: ConceptImportResult): string {
    if (validacion.batchId !== null) return `errores-${validacion.batchId}.csv`;
    return `errores-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  /**
   * Publica la versión, que es lo que hace visibles a los conceptos.
   *
   * Sin esto la importación queda invisible: la expansión de un conjunto de
   * valores sólo selecciona conceptos activos, así que sale vacía sin error.
   */
  protected publicar(): void {
    const versionId = this.version();
    if (versionId === null || this.publicando()) return;

    this.publicando.set(true);
    this.terminology.publishVersion(versionId).subscribe({
      next: () => {
        this.publicando.set(false);
        this.toast.success(
          'La versión quedó publicada: sus conceptos ya se pueden usar.',
          'Versión publicada',
        );
        // Las versiones cambiaron de estado: releerlas evita ofrecer publicar
        // dos veces la misma. Se releen a solas y NO por `cambiarSistema`, que
        // además limpia el informe — y el informe es la única constancia de qué
        // entró, borrarla justo al publicar es perder el recibo.
        this.recargarVersiones();
      },
      error: (error: unknown) => {
        this.publicando.set(false);
        this.toast.error(this.mensajeDe(errorToViewState<null>(error)), 'No se pudo publicar');
      },
    });
  }

  /**
   * Avisa qué dejó la importación.
   *
   * @param resultado - Lo que devolvió el importador.
   */
  private avisar(resultado: ConceptImportResult): void {
    if (resultado.inserted === 0 && resultado.errors === 0) {
      this.toast.info('Todos los conceptos del archivo ya estaban.', 'Sin cambios');
      return;
    }
    if (resultado.errors > 0) {
      this.toast.warning(
        `No se guardó nada: ${resultado.errors} filas quedaron afuera.`,
        'Importación con errores',
      );
      return;
    }
    this.toast.success(`Entraron ${resultado.inserted} conceptos.`, 'Importación terminada');
  }

  /** El estado de una versión, en palabras. */
  protected rotuloDeEstado(state: CodeSystemVersionListItem['state']): string {
    if (state === 'DRAFT') return 'borrador';
    if (state === 'ACTIVE') return 'publicada';
    if (state === 'RETIRED') return 'retirada';
    if (state === 'DEPRECATED') return 'obsoleta';
    // Es el caso real de las versiones que dejaron los importadores externos:
    // no es un error y admiten conceptos igual.
    return 'sin estado';
  }

  /** El formato detectado, dicho como lo escribe la gente. */
  protected rotuloDeFormato(formato: ConceptImportResult['format']): string {
    if (formato === 'csv') return 'CSV';
    if (formato === 'xlsx') return 'XLSX';
    if (formato === 'ndjson') return 'NDJSON';
    return 'sin determinar';
  }

  /**
   * Traduce el fallo del importador a un estado del M34, con su mensaje.
   *
   * Los códigos `IMPORT_*` del contrato **no están** en `API_ERROR_CODES`
   * (`core/http/api-error.ts`), así que `errorToViewState` los devuelve como el
   * error genérico S9: el `code` se lee del cuerpo crudo, que es el único lugar
   * donde está. El día que Itzan publique esos códigos y alguien los agregue a
   * la lista, este método sigue funcionando igual — no es un reemplazo de
   * `errorToViewState`, es una capa encima que sólo mira los suyos.
   */
  private falloDe(error: unknown): ViewState<null> {
    const codigo = this.codigoDeImportacion(error);
    if (codigo !== null) {
      return { status: 'validation', issues: [{ message: this.mensajeDeImportacion(codigo), code: codigo }] };
    }
    return errorToViewState<null>(error);
  }

  /** El `code` del cuerpo, si es uno de los del importador. */
  private codigoDeImportacion(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const cuerpo: unknown = error.error;
    if (typeof cuerpo !== 'object' || cuerpo === null) return null;
    const codigo = (cuerpo as { code?: unknown }).code;
    return typeof codigo === 'string' && codigo.startsWith('IMPORT_') ? codigo : null;
  }

  /** Qué hacer ante cada código, no qué salió mal por dentro. */
  private mensajeDeImportacion(codigo: string): string {
    if (codigo === 'IMPORT_FORMAT_UNSUPPORTED') {
      return 'Ese archivo no es CSV, XLSX ni NDJSON. Bajá la plantilla y volvé a intentar.';
    }
    if (codigo === 'IMPORT_EMPTY_FILE') {
      return 'El archivo no tiene filas: sólo trae el encabezado.';
    }
    if (codigo === 'IMPORT_PROFILE_UNKNOWN') {
      return 'Elegí qué vas a cargar antes de mandar el archivo.';
    }
    return 'El importador no pudo leer el archivo.';
  }

  /**
   * Traduce el fallo a una frase.
   *
   * @param estado - El estado de vista que produjo el error.
   */
  protected mensajeDe(estado: ViewState<null>): string {
    if (estado.status === 'validation') {
      return estado.issues.map((issue) => issue.message).join(' ');
    }
    if (estado.status === 'forbidden') {
      return estado.message || 'Hace falta administración de seguridad para importar terminología.';
    }
    if (estado.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá: tu archivo y tus selecciones siguen acá.';
    }
    if (estado.status === 'error') {
      return `${estado.message || 'Ocurrió un error inesperado.'} (${estado.requestId})`;
    }
    return 'No se pudo completar la operación.';
  }
}
