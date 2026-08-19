import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { GroupWallItem } from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';

/** Hasta dónde se sangra el hilo antes de dejar de anidar visualmente. */
const MAX_SANGRIA = 3;

/**
 * Una publicación del muro de un grupo, con su hilo.
 *
 * ## Se pinta a sí misma
 *
 * El componente se usa dentro de su propia plantilla porque el hilo es
 * recursivo. La alternativa —aplanar el árbol y pintar una lista con márgenes
 * calculados— exige recorrerlo dos veces y pierde la relación padre/hijo justo
 * donde importa: al responder.
 *
 * ## La sangría tiene techo
 *
 * A partir del cuarto nivel deja de sangrarse. Sin techo, una discusión de diez
 * respuestas encadenadas termina en una columna de dos palabras de ancho en un
 * teléfono. La relación se sigue viendo por la línea lateral.
 *
 * ## No resuelve nombres
 *
 * El muro devuelve `authorProfileId` y nada más. Resolver el nombre serían N
 * peticiones por pantalla; lo correcto es que el backend lo incluya, y hasta
 * entonces se muestra el identificador acortado en vez de inventar un nombre.
 * Es la misma decisión que ya tomó `app-post-card`.
 */
@Component({
  selector: 'app-group-post',
  imports: [AppButton, DatePipe],
  templateUrl: './group-post.html',
  styleUrl: './group-post.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupPost {
  /** La publicación a pintar, con sus respuestas. */
  readonly post = input.required<GroupWallItem>();

  /** Si quien mira puede responder. */
  readonly puedeResponder = input<boolean>(false);

  /** Qué publicación tiene la caja de respuesta abierta. */
  readonly respondiendoA = input<string | null>(null);

  /** Pide abrir (o cerrar) la caja de respuesta de esta publicación. */
  readonly responder = output<string>();

  protected readonly sangria = computed(() => Math.min(this.post().threadDepth ?? 0, MAX_SANGRIA));

  /** El autor, acortado. No es un nombre: es lo único que trae la lectura. */
  protected readonly autor = computed(() => `Perfil ${this.post().authorProfileId.slice(0, 8)}`);

  protected readonly esRespuestaAbierta = computed(() => this.respondiendoA() === this.post().id);
}
