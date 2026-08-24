import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type {
  CodeSystemListItem,
  CodeSystemVersionListItem,
  ConceptImportResult,
} from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import {
  FileInput,
  type RejectedFile,
} from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

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
 * Importación de conceptos por archivo — `/administration/terminology/import`.
 *
 * ## Los tres pasos, y por qué son tres
 *
 * 1. **Elegir la versión.** Sólo las que admiten conceptos: una versión ya
 *    publicada no los acepta, y ofrecerla sería preparar un 422.
 * 2. **Subir el archivo.** Va como multipart al propio importador, no por
 *    `common/files`: aquella subida valida el tipo por bytes mágicos y sólo
 *    admite PDF e imágenes —existe para evidencia clínica—, así que un archivo
 *    de texto se rechaza. Acá el tipo se comprueba por parseo, que para NDJSON
 *    prueba más que cualquier firma. El contenido no se almacena.
 * 3. **Publicar.** Es un paso aparte y **hace falta**: mientras la versión sea
 *    borrador, toda expansión de conjunto de valores sale vacía *sin error*,
 *    porque sólo selecciona conceptos activos. Es el modo de fallo más callado
 *    de todo el catálogo.
 *
 * ## El formato es NDJSON
 *
 * Un objeto JSON por línea, `{"code":"A00","display":"Cólera"}`. Se eligió sobre
 * CSV porque se trocea por línea sin analizador y porque permite decir «la línea
 * 4 812 está mal» sin ambigüedad.
 */
@Component({
  selector: 'app-version-import',
  imports: [
    Alert,
    AppButton,
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

  protected readonly maxBytes = MAX_BYTES;
  protected readonly maxMib = MAX_MIB;

  protected readonly estado = signal<ViewState<readonly CodeSystemListItem[]>>(loading());

  protected readonly sistema = signal<string | null>(null);
  protected readonly versiones = signal<readonly CodeSystemVersionListItem[]>([]);
  protected readonly version = signal<string | null>(null);
  protected readonly cargandoVersiones = signal(false);

  protected readonly archivos = signal<readonly File[]>([]);
  protected readonly importando = signal(false);
  protected readonly publicando = signal(false);
  protected readonly resultado = signal<ConceptImportResult | null>(null);

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

  protected readonly puedeImportar = computed(
    () =>
      this.version() !== null &&
      this.archivos().length === 1 &&
      !this.importando() &&
      !this.publicando(),
  );

  constructor() {
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

  /**
   * Cambia el sistema y trae sus versiones.
   *
   * @param sistemaId - El sistema elegido.
   */
  protected cambiarSistema(sistemaId: string | null): void {
    this.sistema.set(sistemaId);
    this.version.set(null);
    this.versiones.set([]);
    this.resultado.set(null);
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
    this.resultado.set(null);
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
    this.toast.warning(`No se pudo tomar ${detalle}.`, 'Archivo no aceptado');
  }

  /**
   * El motivo del rechazo, en palabras y con el dato que hace falta para actuar.
   *
   * @param reason - El motivo que informó el átomo.
   */
  private motivoDe(reason: RejectedFile['reason']): string {
    if (reason === 'tamaño') return `pasa los ${MAX_MIB} MB que acepta el servidor`;
    if (reason === 'tipo') return 'no es un archivo de texto NDJSON';
    if (reason === 'cupo') return 'se importa de a un archivo por vez';
    return 'ya estaba elegido';
  }

  /**
   * Manda el archivo al importador.
   *
   * Una sola llamada: el archivo viaja como multipart y el importador lo parsea
   * en el acto. No se guarda en ningún lado — lo que queda es el lote con la
   * huella del contenido y los contadores.
   */
  protected importar(): void {
    const versionId = this.version();
    const archivo = this.archivos()[0];
    if (versionId === null || archivo === undefined || !this.puedeImportar()) return;

    this.importando.set(true);
    this.resultado.set(null);

    this.terminology
      .importConceptsFile(versionId, archivo)
      .subscribe({
        next: (resultado) => {
          this.importando.set(false);
          this.resultado.set(resultado);
          this.avisar(resultado);
        },
        error: (error: unknown) => {
          this.importando.set(false);
          this.toast.error(this.mensajeDe(errorToViewState<null>(error)), 'No se pudo importar');
        },
      });
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
        `Entraron ${resultado.inserted}, pero ${resultado.errors} líneas quedaron afuera.`,
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

  /**
   * Traduce el fallo a una frase.
   *
   * @param estado - El estado de vista que produjo el error.
   */
  private mensajeDe(estado: ViewState<null>): string {
    if (estado.status === 'validation') {
      return estado.issues.map((issue) => issue.message).join(' ');
    }
    if (estado.status === 'forbidden') {
      return estado.message || 'Hace falta administración de seguridad para importar terminología.';
    }
    if (estado.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (estado.status === 'error') {
      return `${estado.message || 'Ocurrió un error inesperado.'} (${estado.requestId})`;
    }
    return 'No se pudo completar la operación.';
  }
}
