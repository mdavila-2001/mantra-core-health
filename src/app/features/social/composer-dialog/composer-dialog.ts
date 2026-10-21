import { ChangeDetectionStrategy, Component, inject, input, output, signal, viewChild } from '@angular/core';

import { DialogService } from '@shared/components/molecules/dialog/dialog-service';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';
import { Composer } from '../composer/composer';

/**
 * La ventana de «Crear publicación».
 *
 * Es un modal (`app-content-dialog`) y no un formulario desplegado en la
 * página: redactar una publicación con fotos es una tarea con principio y fin,
 * y en una red profesional ocupa la ventana hasta que se publica o se descarta.
 * Del modal salen gratis las cosas que importan: el foco queda adentro y
 * atrapado, `Esc` cierra, el foco vuelve al botón que lo abrió y la página de
 * atrás no se desplaza.
 *
 * ## Cerrar con algo escrito pregunta
 *
 * Con texto o imágenes sin publicar, cerrar (cruz, `Esc` o clic afuera) pasa por
 * `closeGuard` y pregunta si se descarta. Perder lo que la persona cargó sin
 * avisar está prohibido (regla 95.3.3). Sin nada escrito, cierra directo.
 */
@Component({
  selector: 'app-composer-dialog',
  imports: [Composer, ContentDialog],
  templateUrl: './composer-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposerDialog {
  private readonly dialogs = inject(DialogService);
  private readonly dialogo = viewChild.required(ContentDialog);

  /** Quién publica (su perfil público). */
  readonly profileId = input.required<string>();
  readonly autorNombre = input('');
  readonly autorAvatar = input<string | null>(null);
  readonly autorIniciales = input('');

  /** Si arranca con el foco en «Agregar imágenes» (el atajo «Foto»). */
  readonly enfocarImagenes = input(false);

  /** Se emite con el id de la publicación creada. */
  readonly publicado = output<string>();

  /** Se emite cuando el modal terminó de cerrarse, por publicar o por descartar. */
  readonly cerrado = output<void>();

  private readonly hayBorrador = signal(false);

  protected alCambiarBorrador(hay: boolean): void {
    this.hayBorrador.set(hay);
  }

  /** `true` deja cerrar; con un borrador pregunta antes de descartarlo. */
  protected readonly guardia = (): boolean | Promise<boolean> =>
    !this.hayBorrador() || this.dialogs.confirmarDescarte();

  protected alPublicar(id: string): void {
    this.publicado.emit(id);
    // La publicación ya está guardada: no hay nada que descartar, se cierra sin preguntar.
    this.dialogo().close(true);
  }
}
