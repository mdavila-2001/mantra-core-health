import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { Observable } from 'rxjs';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import type { OwnerType } from '../../../../core/data-access/files/files.types';
import {
  categoryForFile,
  CLINICAL_UPLOAD_SENSITIVITY,
  formatearTamano,
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPT_LABEL,
  UPLOAD_MAX_BYTES,
} from '../../../../core/data-access/files/upload-policy';
import { AppButton } from '../../atoms/button/button';
import { Alert } from '../../molecules/alert/alert';
import { FileInput } from '../../molecules/file-input/file-input';
import { FormField } from '../../molecules/form-field/form-field';

/** En qué punto está cada archivo de la cola. */
export type EstadoDeAdjunto = 'pendiente' | 'subiendo' | 'adjuntado' | 'error';

/** Un archivo de la cola, con su resultado propio. */
export interface ArchivoEnCola {
  readonly file: File;
  /** Identidad del archivo para el navegador: no hay id hasta que se sube. */
  readonly clave: string;
  readonly estado: EstadoDeAdjunto;
  /** El motivo, cuando `estado` es `error`. Vacío en los demás. */
  readonly error: string;
  /**
   * El `fileId` que devolvió la subida.
   *
   * Se guarda aunque el vínculo haya fallado: reintentar ese archivo **no**
   * vuelve a subirlo, sólo vuelve a vincularlo. Sin esto, un reintento dejaba
   * dos copias del mismo estudio en el sistema.
   */
  readonly fileId: string;
}

/** Lo que se guarda por archivo mientras el lote avanza. */
interface ResultadoDeArchivo {
  readonly estado: EstadoDeAdjunto;
  readonly error: string;
  readonly fileId: string;
}

/** Un par rótulo/valor de los que se muestran como contexto heredado. */
export interface ContextoDelAdjunto {
  readonly rotulo: string;
  readonly valor: string;
}

/** El nombre, el tamaño y la fecha: la terna que el navegador sí expone. */
function claveDe(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

/**
 * Adjunta **uno o varios** archivos a un recurso: los sube y los vincula.
 *
 * ## Qué cambió con la corrección del 10/09/2026
 *
 * Tres cosas, y ninguna es cosmética:
 *
 * 1. **Varios archivos, de formatos distintos, en la misma operación.** Antes
 *    el control estaba limitado a uno (`maxFiles=1`) y `subir()` mandaba
 *    `seleccionados()[0]`: la interfaz podía mostrar más de un nombre y el
 *    servicio recibía el primero.
 * 2. **Sin «Categoría» ni «Sensibilidad».** Eran dos decisiones del servidor
 *    disfrazadas de preguntas. Ver `categoryForFile` y
 *    `CLINICAL_UPLOAD_SENSITIVITY`: la categoría se deduce del tipo real y la
 *    sensibilidad la fija la política clínica en `PHI`. **No se rebajó nada**:
 *    `PHI` ya era el valor por omisión del formulario; lo que desapareció es la
 *    posibilidad de elegir `NORMAL` por descuido.
 * 3. **Resultado por archivo.** Cada uno lleva su estado —pendiente, subiendo,
 *    adjuntado, error— con su motivo, y el reintento toca sólo los que
 *    fallaron.
 *
 * ## Un archivo por petición, y eso lo manda el backend
 *
 * `POST /common/files/upload` declara `limits: { fileSize, files: 1 }`: el
 * endpoint acepta **un** archivo. Un lote son varias peticiones **en serie**, no
 * un arreglo en el cuerpo ni una ráfaga en paralelo. En serie a propósito: son
 * estudios clínicos sobre conexiones que no siempre dan, y doce peticiones
 * simultáneas es cómo se pierden seis.
 *
 * ## Son dos operaciones por archivo, no una
 *
 * `POST /common/files/upload` deja el archivo en el sistema; `POST
 * /common/files/:id/links` lo cuelga del recurso. Están separadas en el backend
 * porque el mismo archivo puede adjuntarse en varios lados. Acá se encadenan,
 * pero **si la segunda falla el archivo ya existe**: se dice con ese matiz y el
 * `fileId` queda guardado, así que reintentar vuelve a vincular en vez de
 * volver a subir.
 *
 * ## Genérico a propósito
 *
 * No sabe de fichas clínicas: recibe `ownerType`/`ownerId` y, si le importa,
 * las líneas de contexto que quiera mostrar arriba. Los carriles de
 * presupuestos, procedimientos y laboratorios adjuntan por acá sin
 * reconstruirlo. El modal que lo envuelve es `app-attachment-dialog`.
 */
@Component({
  selector: 'app-attachment-uploader',
  imports: [AppButton, Alert, FileInput, FormField],
  templateUrl: './attachment-uploader.html',
  styleUrl: './attachment-uploader.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentUploader {
  private readonly files = inject(FilesClient);

  /** A qué tipo de recurso se adjunta. */
  readonly ownerType = input.required<OwnerType>();
  /** El recurso concreto. */
  readonly ownerId = input.required<string>();

  /**
   * Los vínculos que el lote hereda, en pares rótulo/valor y de lectura.
   *
   * Es contexto, no un formulario: quien adjunta desde un diagnóstico ya tiene
   * paciente, encuentro y diagnóstico resueltos por el registro padre —el
   * vínculo lo da `attachFileToCondition`, no un campo de este modal— y lo que
   * necesita es **verlos** antes de confirmar. Vacío no dibuja nada.
   */
  readonly contexto = input<readonly ContextoDelAdjunto[]>([]);

  /**
   * Reemplaza el vínculo genérico (`POST /common/files/:id/links`) por uno
   * propio del dominio.
   *
   * `POST /common/files/:id/links` es infraestructura compartida y no exige
   * rol ni verifica que el propietario exista — es a propósito, sirve a
   * cualquier contexto. Un consumidor cuyo dominio SÍ tiene su propia regla de
   * quién puede adjuntar qué (p. ej. `clinical` con sus diagnósticos) manda
   * acá su propio endpoint en vez de confiar en que el genérico alcance.
   */
  readonly linkVia = input<((fileId: string, ownerId: string) => Observable<unknown>) | null>(
    null,
  );

  /**
   * Si dibuja su propio botón de confirmación.
   *
   * `false` cuando lo envuelve un modal: ahí la acción vive en el pie del
   * diálogo —fuera del cuerpo con scroll— y se dispara con {@link subir}. Dos
   * botones que envían lo mismo, uno en el formulario y otro en el pie, es la
   * clase de duda que termina en un envío duplicado.
   */
  readonly showActions = input(true);

  /** Se emite cuando **todo** el lote quedó subido y vinculado. */
  readonly attached = output<void>();

  /**
   * Se emite por cada archivo que quedó vinculado, mientras el lote avanza.
   *
   * Sirve para que la pantalla de atrás relea sin esperar al lote entero: en
   * una subida parcial, los que sí entraron ya son datos del expediente, y
   * esconderlos hasta el reintento sería mentir por omisión.
   */
  readonly progressed = output<void>();

  /** Lo que hay elegido. Lo acumula, deduplica y valida `app-file-input`. */
  protected readonly seleccionados = signal<readonly File[]>([]);

  /** El resultado de cada archivo, por {@link claveDe}. */
  private readonly resultados = signal<ReadonlyMap<string, ResultadoDeArchivo>>(new Map());

  readonly enviando = signal(false);

  /** Lo que el control descartó, con su motivo. */
  protected readonly rechazados = signal<readonly string[]>([]);

  protected readonly maxBytes = UPLOAD_MAX_BYTES;
  protected readonly accept = UPLOAD_ACCEPT;
  protected readonly formatosPermitidos = UPLOAD_ACCEPT_LABEL;
  protected readonly limiteEnPalabras = formatearTamano(UPLOAD_MAX_BYTES);

  /**
   * La cola: lo elegido, cada uno con su estado.
   *
   * Se deriva y no se guarda aparte para que no puedan discrepar: la lista de
   * archivos la manda el control —que es quien acumula, deduplica y valida— y
   * acá sólo se le pega el resultado.
   */
  protected readonly cola = computed<readonly ArchivoEnCola[]>(() => {
    const resultados = this.resultados();
    return this.seleccionados().map((file) => {
      const clave = claveDe(file);
      const resultado = resultados.get(clave);
      return {
        file,
        clave,
        estado: resultado?.estado ?? 'pendiente',
        error: resultado?.error ?? '',
        fileId: resultado?.fileId ?? '',
      };
    });
  });

  /** Los que todavía no están adjuntados: lo que un envío va a intentar. */
  private readonly porAdjuntar = computed(() =>
    this.cola().filter(({ estado }) => estado === 'pendiente' || estado === 'error'),
  );

  protected readonly cantidadPorAdjuntar = computed(() => this.porAdjuntar().length);
  protected readonly adjuntados = computed(
    () => this.cola().filter(({ estado }) => estado === 'adjuntado').length,
  );
  protected readonly conError = computed(
    () => this.cola().filter(({ estado }) => estado === 'error').length,
  );

  readonly puedeSubir = computed(
    () => this.cantidadPorAdjuntar() > 0 && !this.enviando(),
  );

  /** Cantidad y peso de lo elegido. No sale del globo del control nativo. */
  protected readonly resumen = computed(() => {
    const cola = this.cola();
    if (cola.length === 0) {
      return '';
    }
    const bytes = cola.reduce((total, { file }) => total + file.size, 0);
    const cuantos = cola.length === 1 ? '1 archivo' : `${cola.length} archivos`;
    return `${cuantos} · ${formatearTamano(bytes)}`;
  });

  /**
   * El rótulo de la acción, con la cantidad que va a mandar.
   *
   * Con la cantidad y no un «Adjuntar» pelado: el otro botón de la pantalla
   * —el del control nativo— también habla de archivos, y dos botones con el
   * mismo texto donde uno abre el explorador y el otro envía es una trampa.
   */
  readonly rotuloDeEnvio = computed(() => {
    const cuantos = this.cantidadPorAdjuntar();
    if (this.conError() > 0 && this.adjuntados() > 0) {
      return cuantos === 1 ? 'Reintentar 1 archivo' : `Reintentar ${cuantos} archivos`;
    }
    return cuantos <= 1 ? 'Adjuntar 1 archivo' : `Adjuntar ${cuantos} archivos`;
  });

  /** Si hay algo que se perdería al cerrar: elegido y todavía no adjuntado. */
  readonly tieneCambiosPendientes = computed(
    () => this.cantidadPorAdjuntar() > 0 || this.enviando(),
  );

  /** El estado, en palabras: el color no puede ser el único canal. */
  protected etiquetaDeEstado(estado: EstadoDeAdjunto): string {
    const etiquetas: Readonly<Record<EstadoDeAdjunto, string>> = {
      pendiente: 'Pendiente',
      subiendo: 'Subiendo…',
      adjuntado: 'Adjuntado',
      error: 'Error',
    };
    return etiquetas[estado];
  }

  protected tamano(file: File): string {
    return formatearTamano(file.size);
  }

  /**
   * Los archivos que el control rechazó, dichos con su motivo.
   *
   * Se muestran en vez de descartarse en silencio: alguien que arrastró un
   * archivo de 40 MB —o una hoja de cálculo, que el almacenamiento no
   * reconoce— tiene que enterarse de por qué no pasó nada.
   */
  protected alRechazar(rechazados: readonly { file: File; reason: string }[]): void {
    this.rechazados.set(
      rechazados.map(({ file, reason }) =>
        reason === 'tipo'
          ? `${file.name}: este formato no se puede guardar. Se aceptan ${UPLOAD_ACCEPT_LABEL}.`
          : `${file.name}: ${reason}`,
      ),
    );
  }

  /** Saca un archivo de la cola sin tocar los demás. */
  protected quitar(clave: string): void {
    if (this.enviando()) {
      return;
    }
    this.seleccionados.update((archivos) => archivos.filter((file) => claveDe(file) !== clave));
    this.resultados.update((previos) => {
      const copia = new Map(previos);
      copia.delete(clave);
      return copia;
    });
    this.rechazados.set([]);
  }

  /**
   * Manda la cola, un archivo por vez.
   *
   * Los ya adjuntados no se vuelven a mandar: un reintento después de un fallo
   * parcial toca sólo lo que falló, que es lo que evita duplicar lo que ya
   * quedó guardado.
   */
  subir(): void {
    if (!this.puedeSubir()) {
      return;
    }
    this.rechazados.set([]);
    this.enviando.set(true);
    this.siguiente(this.porAdjuntar().map(({ clave }) => clave));
  }

  private siguiente(pendientes: readonly string[]): void {
    const [clave, ...resto] = pendientes;
    if (clave === undefined) {
      this.enviando.set(false);
      // Sólo cuando el lote entero entró: con un fallo a medias, cerrar el
      // modal y decir «listo» dejaría fuera archivos que nadie volvió a mandar.
      if (this.cola().length > 0 && this.cola().every(({ estado }) => estado === 'adjuntado')) {
        this.attached.emit();
      }
      return;
    }

    const enCola = this.cola().find((archivo) => archivo.clave === clave);
    if (enCola === undefined) {
      // Lo quitaron mientras el lote avanzaba: se sigue con el resto.
      this.siguiente(resto);
      return;
    }

    this.marcar(clave, { estado: 'subiendo', error: '', fileId: enCola.fileId });

    // Ya subido y con el vínculo fallado: se retoma donde quedó.
    if (enCola.fileId !== '') {
      this.vincular(clave, enCola.fileId, resto);
      return;
    }

    this.files
      .upload(enCola.file, categoryForFile(enCola.file), CLINICAL_UPLOAD_SENSITIVITY)
      .subscribe({
        next: ({ id }) => this.vincular(clave, id, resto),
        error: () => {
          this.marcar(clave, {
            estado: 'error',
            error: 'No pudimos subir el archivo. Reintentá.',
            fileId: '',
          });
          this.siguiente(resto);
        },
      });
  }

  private vincular(clave: string, fileId: string, resto: readonly string[]): void {
    const enlazar = this.linkVia();
    const vinculo$ = enlazar
      ? enlazar(fileId, this.ownerId())
      : this.files.link(fileId, { ownerType: this.ownerType(), ownerId: this.ownerId() });

    vinculo$.subscribe({
      next: () => {
        this.marcar(clave, { estado: 'adjuntado', error: '', fileId });
        this.progressed.emit();
        this.siguiente(resto);
      },
      error: () => {
        // El archivo YA se subió: decirlo —y guardar su `fileId`— evita que el
        // reintento lo vuelva a subir y queden dos copias.
        this.marcar(clave, {
          estado: 'error',
          error: 'El archivo se subió pero no se pudo adjuntar. Reintentá: no se vuelve a subir.',
          fileId,
        });
        this.siguiente(resto);
      },
    });
  }

  private marcar(clave: string, resultado: ResultadoDeArchivo): void {
    this.resultados.update((previos) => new Map(previos).set(clave, resultado));
  }
}
