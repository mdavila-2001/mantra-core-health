import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { forkJoin, of, type Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { ChartDocumentsClient } from '../../../../core/data-access/chart-documents/chart-documents.client';
import type { NewDocumentFile } from '../../../../core/data-access/chart-documents/chart-documents.types';
import { FilesClient } from '../../../../core/data-access/files/files.client';
import {
  categoryForFile,
  CLINICAL_UPLOAD_SENSITIVITY,
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPT_LABEL,
  UPLOAD_MAX_BYTES,
} from '../../../../core/data-access/files/upload-policy';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import {
  FileInput,
  type RejectedFile,
} from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { mensajeDeEscritura } from '../../mensaje-de-escritura';

/** Qué clase de papel es: informe, laboratorio, consentimiento, certificado. */
export const TARGET_CATEGORIA_DOCUMENTAL = 'chart.document_records.category_concept_id';

/**
 * **Registrar un documento** en el expediente — UC-15-09.
 *
 * ```html
 * <app-document-block [patientProfileId]="id" [citas]="citas()" (cambio)="recargar()" />
 * ```
 *
 * ## Por qué existe
 *
 * La pestaña «Documentos» del expediente sabía listar y nada más: el papel que
 * la persona trae en la mano —un laboratorio de la esquina, una placa de otro
 * centro— no tenía por dónde entrar a la historia. `POST /charts/documents`
 * estaba publicado desde UC-15-09 y ninguna pantalla lo usaba.
 *
 * ## Los archivos se suben ANTES de registrar el documento
 *
 * Y no después, que es como funciona el resto de los adjuntos de la aplicación.
 * La diferencia es del contrato: `CreateDocumentDto.files` recibe los `fileId`
 * en el propio alta y **no existe una ruta para colgarle un archivo a un
 * documento ya creado**. Así que el orden es subir → registrar, y por eso este
 * bloque no usa `app-attachment-uploader`: aquél sube y vincula, y acá el
 * vínculo lo hace el alta.
 *
 * Si la subida de alguno falla, **no se registra nada**: un documento titulado
 * «Laboratorio completo» sin el laboratorio adentro es peor que no tenerlo, y
 * arreglarlo después exigiría una ruta que no existe.
 *
 * ## Un documento sin archivo es legítimo
 *
 * Se registra igual: el contrato declara `files` opcional y hay papeles que se
 * asientan antes de digitalizarse. Lo que no se hace es fingir que hay archivo.
 *
 * ## El custodio sale de la sesión
 *
 * `tenantId` es obligatorio en el DTO y no se deduce del paciente: es quién
 * responde por el documento. Sin organización activa el formulario lo dice
 * antes de pedir nada.
 */
@Component({
  selector: 'app-document-block',
  imports: [
    Alert,
    AppInput,
    Card,
    ConceptSelect,
    FileInput,
    FormActions,
    FormField,
    Select,
    Switch,
  ],
  templateUrl: './document-block.html',
  styleUrl: './document-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentBlock {
  private readonly documents = inject(ChartDocumentsClient);
  private readonly files = inject(FilesClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, cuando el bloque vive dentro de la atención. */
  readonly encounterId = input<string | null>(null);

  /** Las citas de la persona, para atar el papel a la consulta que lo trajo. */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /** El documento quedó registrado y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  protected readonly targetCategoria = TARGET_CATEGORIA_DOCUMENTAL;

  /** Lo que el almacenamiento acepta de verdad, no lo que suena razonable. */
  protected readonly formatosAceptados = UPLOAD_ACCEPT;
  protected readonly formatosEnPalabras = UPLOAD_ACCEPT_LABEL;
  protected readonly tamanoMaximo = UPLOAD_MAX_BYTES;

  protected readonly organizacion = this.auth.activeTenantId;
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /* -- El formulario ------------------------------------------------------- */

  protected readonly titulo = signal<string | number | null>('');
  protected readonly categoria = signal<string | null>(null);
  protected readonly autor = signal<string | number | null>('');
  protected readonly esExterno = signal(false);
  protected readonly citaElegida = signal<string | null>(null);
  protected readonly archivos = signal<readonly File[]>([]);

  protected readonly registrando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));

  protected readonly opcionesDeCita = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Sin cita asociada' },
    ...this.citas().map((cita) => ({
      value: cita.id,
      label: cita.enCurso ? `${cita.etiqueta} · en curso` : cita.etiqueta,
    })),
  ]);

  /** El título es lo único que el DTO exige además de paciente y custodio. */
  protected readonly puedeRegistrar = computed(
    () =>
      !this.sinOrganizacion() &&
      String(this.titulo() ?? '').trim() !== '' &&
      !this.registrando(),
  );

  /** Cuántos archivos van con el documento, para decirlo en el botón. */
  protected readonly cuantosArchivos = computed(() => this.archivos().length);

  protected readonly rotuloDeEnvio = computed(() => {
    const cuantos = this.cuantosArchivos();
    if (cuantos === 0) {
      return 'Registrar documento';
    }
    return cuantos === 1 ? 'Registrar con 1 archivo' : `Registrar con ${cuantos} archivos`;
  });

  /**
   * El fallo, en palabras y para los cinco estados en los que una escritura
   * puede terminar mal. La regla vive en `mensajeDeEscritura`, una sola vez:
   * cada bloque con su propia versión dejaba fuera `offline`, y una petición
   * que no llega desbloqueaba el formulario sin decir nada.
   */
  protected readonly errorDelDocumento = computed<string | null>(() =>
    mensajeDeEscritura(this.registro(), { accion: 'registrar el documento' }),
  );

  /** Lo que el selector descartó por formato o tamaño, para poder explicarlo. */
  protected readonly descartados = signal<readonly string[]>([]);

  protected alDescartar(rechazados: readonly RejectedFile[]): void {
    this.descartados.set(rechazados.map(({ file }) => file.name));
  }

  protected registrar(): void {
    const tenantId = this.organizacion();
    const title = String(this.titulo() ?? '').trim();
    if (tenantId === null || title === '' || this.registrando()) {
      return;
    }

    const categoria = this.categoria();
    const autor = String(this.autor() ?? '').trim();
    const encuentro = this.citaElegida() ?? this.encounterId();
    const externo = this.esExterno();

    this.registrando.set(true);
    this.registro.set(loading());
    this.descartados.set([]);

    this.subirArchivos()
      .pipe(
        switchMap((files) =>
          this.documents.createDocument({
            patientProfileId: this.patientProfileId(),
            tenantId,
            title,
            // Los opcionales sin elegir se **omiten**: el backend valida con
            // `forbidNonWhitelisted`, y una clave en null no es «sin especificar».
            ...(categoria === null ? {} : { categoryConceptId: categoria }),
            ...(autor === '' ? {} : { authorText: autor }),
            ...(encuentro === null ? {} : { encounterId: encuentro }),
            ...(externo ? { isExternal: true } : {}),
            ...(files.length === 0 ? {} : { files }),
          }),
        ),
      )
      .subscribe({
        next: (registrado) => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
          this.toasts.success(
            registrado.fileCount === 0
              ? 'Queda en la pestaña «Documentos» del expediente.'
              : `Queda en el expediente con ${registrado.fileCount} archivo${registrado.fileCount === 1 ? '' : 's'}.`,
            'Documento registrado',
          );
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Sube la selección y devuelve los archivos gobernados del alta.
   *
   * El primero es el `PRIMARY` —el documento en sí— y el resto lo acompaña; el
   * orden es el de la lista, que es el que quien los eligió puede ver. Sin
   * selección, devuelve una lista vacía sin tocar la red.
   *
   * `POST /common/files/upload` declara `limits: { files: 1 }`: un lote son
   * varias peticiones. Van en `forkJoin` —y no en serie como el subidor de
   * adjuntos— porque acá **no hay fallo parcial que conservar**: si alguna se
   * cae, no se registra el documento y no queda nada a medias que reintentar.
   */
  private subirArchivos(): Observable<readonly NewDocumentFile[]> {
    const elegidos = this.archivos();
    if (elegidos.length === 0) {
      return of([]);
    }
    return forkJoin(
      elegidos.map((file) =>
        this.files
          .upload(file, categoryForFile(file), CLINICAL_UPLOAD_SENSITIVITY)
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

  private limpiar(): void {
    this.titulo.set('');
    this.categoria.set(null);
    this.autor.set('');
    this.esExterno.set(false);
    this.citaElegida.set(null);
    this.archivos.set([]);
    this.descartados.set([]);
  }
}
