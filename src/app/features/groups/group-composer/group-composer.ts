import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';

/** Tope de caracteres, el mismo que valida el backend. */
const MAX_LARGO = 5000;

/**
 * La caja de escribir del muro de un grupo.
 *
 * ## El aviso de datos personales no es decorativo
 *
 * `DOC-SOC-014` (P6) exige que quien escribe en una superficie social vea,
 * **antes de escribir**, que ese texto no es una historia clínica. En un grupo
 * pesa más que en el muro general: un grupo de apoyo invita a contar el caso
 * propio con nombre y diagnóstico, y ahí lo leen todos los integrantes.
 *
 * Por eso el aviso está encima del área de texto y no debajo del botón: leerlo
 * después de haber escrito no cambia lo que se escribió.
 *
 * ## Publicar y responder son el mismo componente
 *
 * Lo único que cambia es el rótulo. Duplicarlo en dos componentes haría que la
 * validación del largo y el aviso de PII vivan en dos lugares, y el segundo se
 * olvida.
 */
@Component({
  selector: 'app-group-composer',
  imports: [AppButton, FormField, Textarea],
  templateUrl: './group-composer.html',
  styleUrl: './group-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupComposer {
  /** Texto del botón. Distingue publicar de responder. */
  readonly accion = input<string>('Publicar');

  /** Qué se sugiere escribir. */
  readonly placeholder = input<string>('Escribí algo para el grupo…');

  /** Si la escritura está en curso. */
  readonly enviando = input<boolean>(false);

  /** El texto listo para publicar. */
  readonly publicado = output<string>();

  /** Cancela una respuesta empezada. Sólo se ofrece si alguien la escucha. */
  readonly cancelado = output<void>();

  /** Si se muestra el botón de cancelar. */
  readonly cancelable = input<boolean>(false);

  protected readonly texto = signal('');
  protected readonly maxLargo = MAX_LARGO;

  protected readonly puedeEnviar = computed(
    () => this.texto().trim().length > 0 && !this.enviando(),
  );

  /** Entrega el texto y deja la caja limpia para lo siguiente. */
  protected enviar(): void {
    const cuerpo = this.texto().trim();
    if (cuerpo.length === 0) {
      return;
    }
    this.publicado.emit(cuerpo);
    this.texto.set('');
  }

  /** Descarta lo escrito y avisa a quien abrió la respuesta. */
  protected cancelar(): void {
    this.texto.set('');
    this.cancelado.emit();
  }
}
