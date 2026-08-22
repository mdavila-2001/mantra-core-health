import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ChartNotesClient } from '../../../../core/data-access/chart-notes/chart-notes.client';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { RichTextEditor } from '../../../../shared/components/molecules/rich-text-editor/rich-text-editor';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';

/**
 * La hoja en blanco: escribir la consulta sin completar campos.
 *
 * ```html
 * <app-free-note-block [patientProfileId]="id" [encounterId]="enc" (guardada)="recargar()" />
 * ```
 *
 * ## Por qué existe
 *
 * Hay médicos que no quieren llenar una ficha: quieren escribir. Hasta ahora la
 * única forma de dejar algo en la historia era completar una plantilla por
 * especialidad, campo por campo. Esto es la otra mitad, y **se elige desde el
 * mismo selector** que las plantillas — «hoja en blanco» es una opción más de la
 * lista, no otra pantalla.
 *
 * ## Dónde va lo escrito, y por qué ahí
 *
 * A `chart.clinical_note_versions.subjective_text`, la nota clínica narrativa
 * que el modelo ya tenía definida y que ningún cliente usaba. Va al bloque
 * *subjetivo* porque es donde vive el relato de la consulta en una nota SOAP; el
 * médico que quiera separar apreciación y plan tiene la ficha estructurada.
 *
 * **Cada guardado crea una versión, nunca pisa la anterior.** Es una historia
 * clínica: lo escrito ayer sigue ahí con su autor y su número de versión.
 *
 * ## Lo que todavía no hace
 *
 * No firma ni exporta a PDF. Las dos cosas existen en el modelo
 * (`clinical_note_signatures`, `chart.document_records`) y son el paso
 * siguiente: son las que convierten la nota en un documento con valor legal, y
 * hacerlas a medias sería peor que no tenerlas.
 */
@Component({
  selector: 'app-free-note-block',
  imports: [AppButton, Alert, RichTextEditor],
  templateUrl: './free-note-block.html',
  styleUrl: './free-note-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreeNoteBlock {
  /** De quién es la historia. */
  readonly patientProfileId = input.required<string>();

  /** La consulta en curso, si la nota nace dentro de una. */
  readonly encounterId = input<string | null>(null);

  /**
   * Se emite cuando la nota quedó guardada.
   *
   * Hoy el expediente **no lo ata**: recargarlo pasa por el estado de carga y
   * eso destruye este bloque con lo escrito dentro. Queda declarado porque es
   * el contrato del componente y porque el día que la ficha sepa refrescar la
   * pestaña «Notas» sin desmontar nada, atarlo es una línea.
   */
  readonly guardada = output<void>();

  /** Lo escrito, como HTML saneado por el editor. */
  protected readonly contenido = signal('');

  /** Verdadero mientras la petición está en vuelo. */
  protected readonly guardando = signal(false);

  /** El aviso de por qué no se pudo guardar, si pasó. */
  protected readonly error = signal<string | null>(null);

  /** La nota que este bloque abrió, para que el segundo guardado la versione. */
  private readonly noteId = signal<string | null>(null);

  /** Cuántas versiones lleva escritas en esta sesión. */
  protected readonly versiones = signal(0);

  private readonly notes = inject(ChartNotesClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly toast = inject(ToastService);

  /** Sin texto no hay nada que guardar, y el botón lo dice. */
  protected readonly vacio = computed(
    () => this.contenido().replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '',
  );

  /**
   * Guarda lo escrito como una versión nueva de la nota.
   *
   * Resuelve el autor en cada guardado en vez de al montar: el perfil se pide
   * una sola vez por consulta, y hacerlo acá evita que el bloque quede inútil
   * si la petición del perfil falló cuando se dibujó.
   */
  protected guardar(): void {
    if (this.vacio() || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);

    this.profiles.getOwnPractitionerProfile().subscribe({
      next: (perfil) => this.persistir(perfil.profileId),
      error: () => {
        this.guardando.set(false);
        // El caso real: una recepcionista o un administrativo. No es un fallo
        // del guardado sino una cuenta que no puede firmar una nota clínica.
        this.error.set(
          'Tu cuenta no tiene perfil profesional, así que no puede escribir en la historia clínica.',
        );
      },
    });
  }

  /**
   * Manda el texto: abre la nota la primera vez, la versiona después.
   *
   * @param authorProfileId - Quién la escribe.
   */
  private persistir(authorProfileId: string): void {
    const texto = this.contenido();
    const abierta = this.noteId();

    const peticion =
      abierta === null
        ? this.notes.createNote({
            patientProfileId: this.patientProfileId(),
            authorProfileId,
            ...(this.encounterId() === null ? {} : { encounterId: this.encounterId()! }),
            subjectiveText: texto,
          })
        : this.notes.appendVersion(abierta, { authorProfileId, subjectiveText: texto });

    peticion.subscribe({
      next: (referencia) => {
        this.noteId.set(referencia.noteId);
        this.versiones.set(referencia.versionNumber);
        this.guardando.set(false);
        this.toast.success(
          referencia.versionNumber === 1
            ? 'Nota guardada en la historia clínica.'
            : `Nota actualizada (versión ${referencia.versionNumber}).`,
        );
        this.guardada.emit();
      },
      error: () => {
        this.guardando.set(false);
        this.error.set('No pudimos guardar la nota. El texto sigue acá: probá de nuevo.');
      },
    });
  }
}
