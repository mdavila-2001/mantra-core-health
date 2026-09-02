/* ============================================================================
    Quién reaccionó a una publicación (AC-01-9, AC-01-10).

    ## Qué reemplaza

    Un `<span>` que pintaba `👍 4` y no dejaba tocarlo. El recuento estaba, la
    pregunta que produce —«¿quiénes?»— no tenía respuesta en ninguna pantalla, y
    del lado de la API tampoco: `getPostReactions` devolvía recuentos por tipo,
    no personas. La lectura que lista gente es nueva en este mismo carril.

    ## Por qué es un componente y no un `DialogService.confirm()`

    Porque no se confirma nada: se lee una lista paginada con sus cuatro
    estados, y aquél devuelve `boolean` sobre un `message: string`.
    `organisms/content-dialog` pone el `<dialog>` nativo —fondo, inertización,
    trampa de foco, Escape, bloqueo del scroll y vuelta del foco— y esto pone
    la lista.

    ## Lo que la lista deliberadamente no muestra

    Ni cuándo reaccionó cada quien ni su identificador interno. La API no los
    sirve, y es a propósito: en una red social **médica**, decir que fulano
    reaccionó a la publicación de un oncólogo **a tal hora** es más de lo que
    hace falta para responder «¿quiénes?».
    ========================================================================== */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import {
  PUBLIC_PROFILE_PREFIX,
  type PublicPostReaction,
} from '@core/data-access/public-directory/public-directory.types';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';
import { inicialesDe } from '@shared/text/iniciales';

/** Los cuatro estados del M34, con los nombres que ya usa la superficie pública. */
type EstadoLista = 'carga' | 'datos' | 'vacio' | 'error';

/** Cuántas personas trae cada página. El servidor recorta a `[1, 50]`. */
const TAMANO_DE_PAGINA = 25;

@Component({
  selector: 'app-public-post-reactions',
  imports: [ContentDialog, NgTemplateOutlet, RouterLink],
  templateUrl: './public-post-reactions.html',
  styleUrl: './public-post-reactions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPostReactions implements OnInit {
  private readonly directorio = inject(PublicDirectoryClient);

  readonly postId = input.required<string>();

  /** Cuántas reacciones dice la publicación, para el título del modal. */
  readonly total = input<number>(0);

  readonly cerrado = output<void>();

  protected readonly personas = signal<readonly PublicPostReaction[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly fallo = signal(false);

  protected readonly estado = computed<EstadoLista>(() => {
    if (this.fallo()) return 'error';
    if (this.cargando()) return 'carga';
    return this.personas().length === 0 ? 'vacio' : 'datos';
  });

  protected readonly hayMas = computed(() => this.cursor() !== null);

  protected readonly titulo = computed(() =>
    this.total() === 1 ? 'Una reacción' : `${this.total()} reacciones`,
  );

  /**
   * La primera lectura va en `ngOnInit` y **no** en el constructor.
   *
   * `postId` es un `input.required`, y en el constructor todavía no tiene
   * valor: leerlo ahí lanza `NG0950`. Es la clase de error que no se ve
   * escribiendo el componente —el constructor «anda»— y aparece recién cuando
   * alguien lo monta de verdad.
   */
  ngOnInit(): void {
    this.leer();
  }

  /**
   * El enlace a la ficha de quien reaccionó, con el prefijo de su vertical, o
   * `null`.
   *
   * `MEDICATION` no es una persona y no tiene ficha con slug: un medicamento no
   * reacciona a nada, pero el tipo del vertical es el mismo para todo el
   * directorio. Devolver `null` y no enlazar es preferible a construir una URL
   * que da 404.
   */
  protected enlace(persona: PublicPostReaction): readonly string[] | null {
    if (persona.kind === 'MEDICATION') {
      return null;
    }
    return [`/${PUBLIC_PROFILE_PREFIX[persona.kind]}`, persona.slug];
  }

  protected iniciales(persona: PublicPostReaction): string {
    return inicialesDe(persona.displayName);
  }

  protected reintentar(): void {
    this.leer();
  }

  protected verMas(): void {
    const cursor = this.cursor();
    if (cursor === null || this.cargandoMas()) {
      return;
    }
    this.cargandoMas.set(true);
    this.directorio.postReactions(this.postId(), { cursor, limit: TAMANO_DE_PAGINA }).subscribe({
      next: (pagina) => {
        // Concatena, no reemplaza: quien abrió la lista para buscar a alguien
        // pierde el rastro si la página anterior desaparece.
        this.personas.update((previas) => [...previas, ...pagina.items]);
        this.cursor.set(pagina.nextCursor);
        this.cargandoMas.set(false);
      },
      error: () => {
        // Un fallo al pedir MÁS no borra lo que ya se estaba leyendo.
        this.cargandoMas.set(false);
        this.fallo.set(true);
      },
    });
  }

  private leer(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    this.directorio.postReactions(this.postId(), { limit: TAMANO_DE_PAGINA }).subscribe({
      next: (pagina) => {
        this.personas.set(pagina.items);
        this.cursor.set(pagina.nextCursor);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.fallo.set(true);
      },
    });
  }
}
