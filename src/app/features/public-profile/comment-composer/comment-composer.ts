import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';

import { CommunityClient } from '@core/data-access/community/community.client';
import type { NewCommentMedia } from '@core/data-access/community/community.types';
import { describeApiFailure } from '@core/http/api-failure';
import { CommentMediaPicker } from '@shared/components/molecules/comment-media-picker/comment-media-picker';

/**
 * El redactor de un comentario, tanto el de arriba del hilo como el de una
 * respuesta.
 *
 * ## Una sola pieza para los dos
 *
 * Responder es comentar con un `parentCommentId`: mismo texto, mismos
 * adjuntos, mismo error. Antes «Responder» mandaba a otra pantalla (el muro
 * viejo) porque el redactor con adjuntos vivía sólo ahí; con esta pieza el
 * hilo es autosuficiente y se responde **sin salir de la publicación**, que es
 * lo que hace una red profesional.
 *
 * ## Qué conserva
 *
 * - Lo escrito y los adjuntos **sobreviven a un fallo** (regla 95.3.3): sólo se
 *   limpian cuando el servidor confirma.
 * - El botón se bloquea mientras se envía (95.3.4): no hay doble envío.
 * - El texto es obligatorio: el contrato rechaza un comentario sin `bodyText`,
 *   y un adjunto solo no lo cumple.
 *
 * Los adjuntos se suben al elegirlos (`app-comment-media-picker`) y acá sólo
 * viaja el `fileId` ya confirmado.
 */
@Component({
  selector: 'app-comment-composer',
  imports: [CommentMediaPicker],
  templateUrl: './comment-composer.html',
  styleUrl: './comment-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentComposer {
  private readonly community = inject(CommunityClient);

  private readonly campo = viewChild<ElementRef<HTMLTextAreaElement>>('campo');
  private readonly formulario = viewChild<ElementRef<HTMLFormElement>>('formulario');
  private readonly selector = viewChild(CommentMediaPicker);

  /** La publicación que se comenta. */
  readonly postId = input.required<string>();

  /** Quién comenta: su perfil público (el contrato no lo deduce de la sesión). */
  readonly actorProfileId = input.required<string>();

  /** El comentario al que se responde; `null` si es uno de primer nivel. */
  readonly parentCommentId = input<string | null>(null);

  readonly placeholder = input('Agregue un comentario…');

  /** Prefijo de los `data-testid`: el redactor de arriba y los de respuesta no se confunden. */
  readonly testidBase = input('comment-composer');

  /** Si se ofrece «Cancelar» (los de respuesta sí; el de arriba no). */
  readonly cancelable = input(false);

  /** Si toma el foco al dibujarse (el de respuesta: se abre para escribir). */
  readonly enfocar = input(false);

  /** Se emite con el id del comentario creado cuando el servidor lo confirmó. */
  readonly enviado = output<string>();

  readonly cancelado = output<void>();

  protected readonly borrador = signal('');
  protected readonly enviando = signal(false);
  protected readonly fallo = signal<string | null>(null);
  protected readonly adjuntos = signal<readonly NewCommentMedia[]>([]);
  private readonly conFoco = signal(false);
  /** Un puntero apretado dentro del formulario: el foco está por pasar a otro control de adentro. */
  private pulsandoDentro = false;

  protected readonly puedeEnviar = computed(
    () => this.borrador().trim().length > 0 && !this.enviando(),
  );

  /**
   * Los adjuntos se ofrecen en cuanto la persona empieza: no antes, para no cargar la fila.
   *
   * «Empezar» es tener el foco en **cualquier parte del formulario**, no sólo en
   * el campo: con el campo vacío, tocar «Agregar imagen» le quita el foco al
   * campo antes del clic, y si eso desmontaba el selector el clic se perdía (y
   * con Tab, el foco caía a la página).
   */
  protected readonly activo = computed(
    () => this.conFoco() || this.borrador().length > 0 || this.adjuntos().length > 0,
  );

  constructor() {
    afterNextRender(() => {
      if (this.enfocar()) {
        this.campo()?.nativeElement.focus();
      }
    });
  }

  protected escribir(evento: Event): void {
    this.borrador.set((evento.target as HTMLTextAreaElement).value);
  }

  protected alEntrar(): void {
    this.pulsandoDentro = false;
    this.conFoco.set(true);
  }

  protected alPulsar(): void {
    this.pulsandoDentro = true;
  }

  protected alSalir(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (destino !== null && this.formulario()?.nativeElement.contains(destino)) return;
    // Safari no enfoca los botones al tocarlos: `relatedTarget` llega vacío
    // aunque el toque sea adentro. El `pointerdown` previo lo delata.
    if (this.pulsandoDentro) return;
    this.conFoco.set(false);
  }

  /** Id del mensaje de error, para vincularlo al campo (`aria-describedby`). */
  protected readonly idDelError = computed(
    () => `${this.testidBase()}-${this.postId()}-${this.parentCommentId() ?? 'raiz'}-error`,
  );

  protected enviar(evento?: Event): void {
    evento?.preventDefault();
    if (!this.puedeEnviar()) {
      return;
    }

    const media = this.adjuntos();
    const padre = this.parentCommentId();

    this.enviando.set(true);
    this.fallo.set(null);

    this.community
      .createComment({
        authorProfileId: this.actorProfileId(),
        commentableRefId: this.postId(),
        bodyText: this.borrador().trim(),
        ...(padre === null ? {} : { parentCommentId: padre }),
        ...(media.length > 0 ? { media } : {}),
      })
      .subscribe({
        next: ({ id }) => {
          this.borrador.set('');
          this.adjuntos.set([]);
          this.selector()?.limpiar();
          this.enviando.set(false);
          this.enviado.emit(id);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.fallo.set(describeApiFailure(error, 'No pudimos publicar su comentario.'));
        },
      });
  }

  protected cancelar(): void {
    this.cancelado.emit();
  }
}
