import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { forkJoin, map, switchMap, type Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ChartDocumentsClient } from '../../../../core/data-access/chart-documents/chart-documents.client';
import type { NewDocumentFile } from '../../../../core/data-access/chart-documents/chart-documents.types';
import { ChartNotesClient } from '../../../../core/data-access/chart-notes/chart-notes.client';
import type { MedicalNoteEntry } from '../../../../core/data-access/clinical/clinical.types';
import { FilesClient } from '../../../../core/data-access/files/files.client';
import {
  categoryForFile,
  CLINICAL_UPLOAD_SENSITIVITY,
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPT_LABEL,
  UPLOAD_MAX_BYTES,
} from '../../../../core/data-access/files/upload-policy';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import {
  FileInput,
  type RejectedFile,
} from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/** Hasta cuántas filas admite la sección. Más que eso ya es otra plantilla. */
export const TOPE_DE_FILAS_ADICIONALES = 40;
const TOPE_DEL_ROTULO = 60;
const TOPE_DEL_VALOR = 500;
/** Hasta cuántos archivos por fila. */
export const TOPE_DE_ARCHIVOS_POR_FILA = 10;

/**
 * Un alta que se corre al completar el formulario. La misma forma que los
 * pasos del cierre del formulario médico, para que corran en la misma fila.
 */
export interface PasoDeRegistro {
  /** Con artículo: «No se registró <nombre>». */
  readonly nombre: string;
  readonly titulo: string;
  readonly exito: string;
  readonly ejecutar: () => Observable<unknown>;
}

/** Una fila a medio escribir. */
export interface FilaAdicional {
  readonly clave: number;
  readonly rotulo: string;
  readonly valor: string;
  readonly archivos: readonly File[];
}

/** «Presión Arterial» y «presion arterial» son el mismo campo. */
function normalizado(rotulo: string): string {
  return rotulo.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function filaVacia(clave: number): FilaAdicional {
  return { clave, rotulo: '', valor: '', archivos: [] };
}

function tieneContenido(fila: FilaAdicional): boolean {
  return fila.rotulo.trim() !== '' || fila.valor.trim() !== '' || fila.archivos.length > 0;
}

/**
 * Lo que se guarda como valor de la fila: el texto y, si hay archivos, sus
 * nombres. Una fila con sólo archivos es válida —«Análisis clínico con el que
 * vino» con la foto del informe—, y la nota la lee igual que cualquier otra.
 */
function valorDeLaFila(fila: FilaAdicional): string {
  const texto = fila.valor.trim();
  if (fila.archivos.length === 0) {
    return texto;
  }
  const adjuntos = `Adjunto: ${fila.archivos.map((archivo) => archivo.name).join(', ')}`;
  const completo = texto === '' ? adjuntos : `${texto} · ${adjuntos}`;
  return completo.length > TOPE_DEL_VALOR ? `${completo.slice(0, TOPE_DEL_VALOR - 1)}…` : completo;
}

/**
 * **Campos adicionales del doctor** — la nota médica, ahora al final del
 * formulario médico.
 *
 * Antes la nota médica y los documentos eran dos casillas propias de la cita.
 * Ahora viven dentro del formulario: después de los campos de la plantilla,
 * quien atiende puede sumar filas «campo: valor» propias y, en cada fila,
 * **texto, varios archivos o las dos cosas**. Todo es opcional.
 *
 * ## Qué se registra al completar el formulario
 *
 * Nada se escribe mientras se llena: esta sección no tiene botón propio. El
 * formulario corre sus {@link AdditionalFields.pasos} después de cerrar su
 * respuesta, y ahí:
 *
 * 1. las filas y el texto libre quedan como **una nota médica** del encuentro,
 *    con los nombres de los adjuntos en el valor de su fila;
 * 2. los archivos de cada fila se suben y quedan como **un documento del
 *    expediente por fila**, titulado con el campo y atado al encuentro —siguen
 *    apareciendo en la pestaña «Documentos»—.
 *
 * Un fallo en esta parte no deshace la respuesta del formulario, que ya quedó
 * guardada: vuelve como una lista de lo que faltó, igual que el resto del
 * cierre.
 */
@Component({
  selector: 'app-additional-fields',
  imports: [Alert, AppButton, AppInput, FileInput, FormField, Textarea],
  templateUrl: './additional-fields.html',
  styleUrl: './additional-fields.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdditionalFields {
  private readonly notes = inject(ChartNotesClient);
  private readonly documents = inject(ChartDocumentsClient);
  private readonly files = inject(FilesClient);
  private readonly auth = inject(AuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** El paciente de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** Bloquea la edición mientras el formulario se envía. */
  readonly disabled = input(false);

  protected readonly tope = TOPE_DE_FILAS_ADICIONALES;
  protected readonly topeDeArchivos = TOPE_DE_ARCHIVOS_POR_FILA;
  protected readonly formatosAceptados = UPLOAD_ACCEPT;
  protected readonly formatosEnPalabras = UPLOAD_ACCEPT_LABEL;
  protected readonly tamanoMaximo = UPLOAD_MAX_BYTES;

  private proximaClave = 1;

  /**
   * Arranca sin filas: la sección es opcional, y una fila vacía de entrada se
   * leería como algo que falta llenar.
   */
  protected readonly filas = signal<readonly FilaAdicional[]>([]);

  protected readonly textoLibre = signal('');

  /** Lo que el selector de archivos descartó, para poder explicarlo. */
  protected readonly descartados = signal<readonly string[]>([]);

  protected readonly filasConContenido = computed(() => this.filas().filter(tieneContenido));

  /** El problema de cada fila con contenido, o `null` si está bien. */
  protected readonly problemas = computed<ReadonlyMap<number, string | null>>(() => {
    const vistos = new Set<string>();
    const problemas = new Map<number, string | null>();
    for (const fila of this.filas()) {
      if (!tieneContenido(fila)) {
        problemas.set(fila.clave, null);
        continue;
      }
      const rotulo = fila.rotulo.trim();
      const clave = normalizado(rotulo);
      let problema: string | null = null;
      if (rotulo === '') {
        problema = 'Falta el campo.';
      } else if (rotulo.length > TOPE_DEL_ROTULO) {
        problema = `El campo admite hasta ${TOPE_DEL_ROTULO} caracteres.`;
      } else if (vistos.has(clave)) {
        problema = 'Ese campo ya está en otra fila.';
      } else if (fila.valor.trim() === '' && fila.archivos.length === 0) {
        problema = 'Escribí un valor o adjuntá un archivo.';
      } else if (fila.valor.trim().length > TOPE_DEL_VALOR) {
        problema = `El valor admite hasta ${TOPE_DEL_VALOR} caracteres.`;
      }
      if (clave !== '') {
        vistos.add(clave);
      }
      problemas.set(fila.clave, problema);
    }
    return problemas;
  });

  /** Si hay algo mal escrito: el formulario no se completa hasta corregirlo. */
  readonly hayProblemas = computed(() =>
    Array.from(this.problemas().values()).some((problema) => problema !== null),
  );

  /** Si hay algo que registrar al completar. */
  readonly tieneContenido = computed(
    () => this.filasConContenido().length > 0 || this.textoLibre().trim() !== '',
  );

  /** Las filas como las lee la nota y la IA del cierre. */
  readonly entradas = computed<readonly MedicalNoteEntry[]>(() =>
    this.filasConContenido().map((fila) => ({
      label: fila.rotulo.trim(),
      value: valorDeLaFila(fila),
    })),
  );

  /** Cuántos archivos van en total, para decirlo antes de enviar. */
  protected readonly totalDeArchivos = computed(() =>
    this.filas().reduce((total, fila) => total + fila.archivos.length, 0),
  );

  /* -- Filas ---------------------------------------------------------------- */

  protected problemaDe(clave: number): string {
    return this.problemas().get(clave) ?? '';
  }

  protected agregarFila(): void {
    if (this.filas().length >= TOPE_DE_FILAS_ADICIONALES) {
      return;
    }
    const clave = this.proximaClave++;
    this.filas.update((filas) => [...filas, filaVacia(clave)]);
    this.changeDetector.detectChanges();
    this.host.nativeElement
      .querySelector<HTMLInputElement>(`[data-fila="${clave}"] input`)
      ?.focus();
  }

  protected quitarFila(clave: number): void {
    this.filas.update((filas) => filas.filter((fila) => fila.clave !== clave));
  }

  protected fijarRotulo(clave: number, valor: string | number | null): void {
    const rotulo = valor === null ? '' : String(valor);
    this.cambiar(clave, { rotulo });
  }

  protected fijarValor(clave: number, valor: string): void {
    this.cambiar(clave, { valor });
  }

  protected fijarArchivos(clave: number, archivos: readonly File[]): void {
    this.cambiar(clave, { archivos });
  }

  protected alDescartar(rechazados: readonly RejectedFile[]): void {
    this.descartados.set(rechazados.map(({ file }) => file.name));
  }

  private cambiar(clave: number, cambio: Partial<FilaAdicional>): void {
    this.filas.update((filas) =>
      filas.map((fila) => (fila.clave === clave ? { ...fila, ...cambio } : fila)),
    );
  }

  /** Vuelve a la sección vacía, después de registrar. */
  limpiar(): void {
    this.filas.set([]);
    this.textoLibre.set('');
    this.descartados.set([]);
  }

  /* -- Registro ------------------------------------------------------------- */

  /**
   * Las altas que esta sección pide al completar el formulario, en orden:
   * primero la nota con las filas, después un documento por cada fila con
   * archivos. Vacía si no se escribió nada. El formulario las corre con el
   * resto de su cierre, así que un fallo acá se cuenta igual que uno del
   * diagnóstico o de la orden y no deshace la respuesta ya guardada.
   */
  pasos(encounterId: string): readonly PasoDeRegistro[] {
    if (!this.tieneContenido() || this.hayProblemas()) {
      return [];
    }
    const filas = this.filasConContenido();
    const entradas = this.entradas();
    const texto = this.textoLibre().trim();
    const patientProfileId = this.patientProfileId();
    // Los dos faltantes se validan antes (ver `impedimento`): acá sólo se leen.
    const autor = this.auth.practitionerProfileId() ?? '';
    const tenantId = this.auth.activeTenantId() ?? '';

    const nota: PasoDeRegistro = {
      nombre: 'la nota con los campos adicionales',
      titulo: 'Campos adicionales guardados',
      exito: 'Quedaron como nota médica de esta consulta.',
      ejecutar: () =>
        this.notes.createNote({
          patientProfileId,
          authorProfileId: autor,
          encounterId,
          ...(entradas.length === 0 ? {} : { entries: entradas }),
          ...(texto === '' ? {} : { subjectiveText: texto }),
        }),
    };

    const documentos = filas
      .filter((fila) => fila.archivos.length > 0)
      .map<PasoDeRegistro>((fila) => {
        const rotulo = fila.rotulo.trim();
        const cuantos = fila.archivos.length;
        return {
          nombre: `el documento con los archivos de «${rotulo}»`,
          titulo: 'Archivos adjuntados',
          exito: `«${rotulo}» quedó en «Documentos» con ${cuantos} archivo${cuantos === 1 ? '' : 's'}.`,
          ejecutar: () =>
            this.subir(fila.archivos).pipe(
              switchMap((files) =>
                this.documents.createDocument({
                  patientProfileId,
                  tenantId,
                  title: rotulo,
                  encounterId,
                  files,
                }),
              ),
            ),
        };
      });

    return [nota, ...documentos];
  }

  /**
   * Por qué esta sección no se puede registrar con la sesión actual, o `null`.
   * Se dice antes de enviar: la respuesta del formulario se guardaría igual y
   * lo escrito acá se perdería.
   */
  readonly impedimento = computed<string | null>(() => {
    if (!this.tieneContenido()) {
      return null;
    }
    if (this.auth.practitionerProfileId() === null) {
      return 'Los campos adicionales se guardan como nota médica, y tu perfil no es de profesional.';
    }
    if (this.totalDeArchivos() > 0 && this.auth.activeTenantId() === null) {
      return 'Para adjuntar archivos elegí una organización en el encabezado.';
    }
    return null;
  });

  /**
   * Sube los archivos de una fila. El primero es el documento en sí y el
   * resto lo acompaña, en el orden en que se eligieron. `POST
   * /common/files/upload` recibe uno por petición.
   */
  private subir(archivos: readonly File[]): Observable<readonly NewDocumentFile[]> {
    return forkJoin(
      archivos.map((archivo) =>
        this.files
          .upload(archivo, categoryForFile(archivo), CLINICAL_UPLOAD_SENSITIVITY)
          .pipe(map(({ id }) => id)),
      ),
    ).pipe(
      map((ids) =>
        ids.map((fileId, indice) => ({
          fileId,
          contentRole: indice === 0 ? ('PRIMARY' as const) : ('ATTACHMENT' as const),
          ordinal: indice,
        })),
      ),
    );
  }
}
