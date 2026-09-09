import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { PdfExportService } from './pdf-export.service';

/**
 * Exporta a PDF lo que hay en pantalla.
 *
 * ## Por qué es un botón y no una llamada suelta
 *
 * El pedido del cliente es que **casi todo** se pueda exportar. Con una función
 * suelta, cada pantalla tendría que declarar una referencia al elemento, un
 * manejador, un nombre de archivo y su propio botón: cuarenta pantallas,
 * cuarenta oportunidades de hacerlo distinto. Acá se enchufa una etiqueta.
 *
 * ## Qué exporta si no le dicen qué
 *
 * Su **contenedor**: sube por el DOM hasta el ancestro que le indiquen, o hasta
 * la sección que lo contiene. Es lo que casi siempre se quiere —«esta ficha en
 * PDF»— y evita que cada pantalla tenga que declarar una plantilla de
 * referencia sólo para esto.
 *
 * Quien necesite exportar otra cosa le pasa el elemento con `target`.
 *
 * ## Lo que el PDF trae y lo que no
 *
 * Sale con el membrete de AloVida —el isotipo arriba, la filigrana de fondo y
 * la numeración de páginas al pie— porque eso lo pone el maquetador en todos
 * los documentos del sistema.
 *
 * Lo que **no** hace es copiar la pantalla: recorre encabezados, párrafos,
 * ítems de lista, listas de definiciones y filas de tabla, y los maqueta como
 * documento. No replica el CSS de la vista. Un PDF que intentara ser una
 * captura saldría ilegible en papel; vale saberlo antes de esperar que se vea
 * igual que en el navegador.
 */
@Component({
  selector: 'app-pdf-export-button',
  imports: [AppButton],
  templateUrl: './pdf-export-button.html',
  styleUrl: './pdf-export-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfExportButton {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly pdf = inject(PdfExportService);

  /**
   * Nombre del archivo, sin extensión.
   *
   * Se le agrega `.pdf` si falta. Conviene que diga de qué es y de quién: un
   * escritorio con seis archivos «documento.pdf» no sirve de nada.
   */
  readonly filename = input.required<string>();

  /** Título impreso arriba del documento y guardado en sus metadatos. */
  readonly title = input<string>('');

  /**
   * La bajada bajo el título: de quién es el papel, o de qué fecha.
   *
   * Es lo que deja identificar la copia impresa sin abrirla del todo — «Ana
   * Quispe · 8 de septiembre de 2026» dice mucho más que el título solo.
   */
  readonly subtitle = input<string>('');

  /**
   * La clase de documento, en versalitas arriba a la derecha: «FICHA DE
   * PACIENTE», «PRESUPUESTO». Si no viene, ese lugar queda vacío en vez de
   * repetir el título.
   */
  readonly kind = input<string>('');

  /**
   * Qué exportar. Si no viene, se exporta el contenedor del botón.
   *
   * Se acepta el elemento y no un selector: un selector se resuelve contra el
   * documento entero y en una pantalla con dos tablas exportaría la equivocada
   * sin avisar.
   */
  readonly target = input<HTMLElement | null>(null);

  /** Texto del botón. Se cambia cuando «Exportar a PDF» es ambiguo. */
  readonly label = input<string>('Exportar a PDF');

  /** Variante del botón, para que encaje donde se lo ponga. */
  readonly variant = input<'primary' | 'secondary' | 'outline' | 'ghost'>('outline');

  protected readonly error = signal('');
  protected readonly nombreVisible = computed(() => this.label());

  protected exportar(): void {
    const elemento = this.target() ?? this.contenedor();
    if (elemento === null) {
      // Sin contenedor no hay nada que exportar. Se dice en vez de generar un
      // PDF en blanco, que se lee como «la exportación está rota».
      this.error.set('No encontramos qué exportar en esta pantalla.');
      return;
    }

    this.error.set('');
    // La exportación es asíncrona porque el motor se carga al usarlo — ver el
    // porqué en `PdfExportService`. Un fallo se dice: un botón que no hace nada
    // se lee como «la aplicación está rota».
    void this.pdf
      .export(elemento, this.filename(), {
        title: this.title(),
        // Se mandan sólo si dicen algo: el maquetador distingue «no hay
        // bajada» de «hay una bajada vacía», y una cadena vacía le dejaría el
        // hueco reservado en la hoja.
        ...(this.subtitle() === '' ? {} : { subtitle: this.subtitle() }),
        ...(this.kind() === '' ? {} : { kind: this.kind() }),
      })
      .catch(() => this.error.set('No pudimos generar el PDF. Reintentá.'));
  }

  /**
   * El contenedor del botón.
   *
   * Se busca la sección o el artículo que lo envuelve, y si no hay ninguno, el
   * padre directo. Nunca el `body`: exportar la aplicación entera —barra
   * lateral, menú y todo— no es lo que nadie quiere.
   */
  private contenedor(): HTMLElement | null {
    const propio = this.host.nativeElement as HTMLElement;
    const seccion = propio.closest('section, article, form, [data-pdf-root]');
    return (seccion as HTMLElement | null) ?? propio.parentElement;
  }
}
