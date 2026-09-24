import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ChartNotesClient } from '../../../../core/data-access/chart-notes/chart-notes.client';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { RichTextEditor } from '../../../../shared/components/molecules/rich-text-editor/rich-text-editor';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { DRAFT_BLOCK, type DraftBlock } from '../draft-block';
import { NoteGrid } from './note-grid/note-grid';

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
  imports: [AppButton, Alert, FormField, NoteGrid, RichTextEditor, Select, Tab, Tabs],
  providers: [{ provide: DRAFT_BLOCK, useExisting: forwardRef(() => FreeNoteBlock) }],
  templateUrl: './free-note-block.html',
  styleUrl: './free-note-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreeNoteBlock implements DraftBlock {
  /** De quién es la historia. */
  readonly patientProfileId = input.required<string>();

  /** La consulta en curso, si la nota nace dentro de una. */
  readonly encounterId = input<string | null>(null);

  /**
   * Las citas de la persona, para elegir de cuál es la nota.
   *
   * Mismo criterio que el diagnóstico y la alergia: desde el expediente no hay
   * consulta en curso y la nota igual pertenece a una —«lo que se habló el
   * martes»—. Vacío no dibuja el campo: un desplegable de una sola opción vacía
   * es una pregunta que no existe.
   */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /**
   * Se emite cuando la nota quedó guardada.
   *
   * Hoy el expediente **no lo ata**: recargarlo pasa por el estado de carga y
   * eso destruye este bloque con lo escrito dentro. Queda declarado porque es
   * el contrato del componente y porque el día que la ficha sepa refrescar la
   * pestaña «Notas» sin desmontar nada, atarlo es una línea.
   */
  readonly guardada = output<void>();

  /**
   * Qué vista está abierta: `0` escribir, `1` la cuadrícula (C-14).
   *
   * Arranca en «Escribir» porque es lo que el bloque hacía y lo que la mayoría
   * de las consultas necesita; la cuadrícula es para lo que se compara entre
   * consultas.
   */
  protected readonly vista = signal(0);

  /** Lo escrito, como HTML saneado por el editor. */
  protected readonly contenido = signal('');

  /** La cita elegida, o `null` por «sin cita asociada». */
  protected readonly citaElegida = signal<string | null>(null);

  /** Las opciones del selector de cita, con la vacía primero. */
  protected readonly opcionesDeCita = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Sin cita asociada' },
    ...this.citas().map((cita) => ({
      value: cita.id,
      label: cita.enCurso ? `${cita.etiqueta} · en curso` : cita.etiqueta,
    })),
  ]);

  /** Verdadero mientras la petición está en vuelo. */
  protected readonly guardando = signal(false);

  /** El aviso de por qué no se pudo guardar, si pasó. */
  protected readonly error = signal<string | null>(null);

  /** La nota que este bloque abrió, para que el segundo guardado la versione. */
  private readonly noteId = signal<string | null>(null);

  /** Cuántas versiones lleva escritas en esta sesión. */
  protected readonly versiones = signal(0);

  /**
   * El texto tal como quedó en el último guardado exitoso. Arranca vacío, así
   * que antes del primer guardado equivale a "nada guardado todavía".
   */
  private readonly ultimoGuardado = signal('');

  /**
   * Contrato de `DraftBlock`. Una nota guardada no es un borrador pendiente
   * —ya quedó en la historia—, pero seguir escribiendo después sí lo es. Y la
   * cita elegida sólo es borrador **antes** del primer guardado: después viaja
   * en el vínculo con la nota abierta (`persistir()`), no en un alta pendiente
   * de esta pantalla. Sin texto no hay nada que proteger: borrar todo después
   * de guardar no pierde nada (la versión ya quedó en el historial).
   */
  readonly tieneCambiosPendientes = computed(
    () =>
      (!this.vacio() && this.contenido() !== this.ultimoGuardado()) ||
      (this.noteId() === null && this.citaElegida() !== null),
  );

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
    // La cita elegida manda sobre el encuentro del anfitrión: desde el
    // expediente no hay consulta en curso y la nota se ata a la que se elija.
    const encuentro = this.citaElegida() ?? this.encounterId();

    const peticion =
      abierta === null
        ? this.notes.createNote({
            patientProfileId: this.patientProfileId(),
            authorProfileId,
            ...(encuentro === null ? {} : { encounterId: encuentro }),
            subjectiveText: texto,
          })
        : this.notes.appendVersion(abierta, { authorProfileId, subjectiveText: texto });

    peticion.subscribe({
      next: (referencia) => {
        this.noteId.set(referencia.noteId);
        this.versiones.set(referencia.versionNumber);
        // El texto capturado al armar la petición, no `contenido()` de nuevo:
        // si la persona siguió escribiendo mientras la petición estaba en
        // vuelo, eso todavía no se guardó y tiene que seguir contando como
        // borrador pendiente.
        this.ultimoGuardado.set(texto);
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
