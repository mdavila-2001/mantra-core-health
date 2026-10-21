import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import type { NewPostMedia, PostVisibility } from '../../../core/data-access/community/community.types';
import { describeApiFailure } from '../../../core/http/api-failure';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { CommentMediaPicker } from '../../../shared/components/molecules/comment-media-picker/comment-media-picker';
import type { AdjuntoEmitido } from '../../../shared/components/molecules/comment-media-picker/comment-media-picker.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/**
 * Tope real del cuerpo, tomado del DTO del servidor (`CreatePostDto.bodyText`,
 * `@MaxLength(5000)`).
 *
 * No es un número elegido acá: si el cliente permitiera más, el formulario
 * dejaría escribir un texto que el servidor rechaza al enviar, y la persona
 * perdería lo que escribió sin saber por qué.
 */
export const POST_BODY_MAX = 5000;

/** Tope real de etiquetas por publicación (`CreatePostDto.hashtags`, `@ArrayMaxSize(30)`). */
export const POST_HASHTAG_MAX = 30;

/** Cuántas imágenes como máximo por publicación (el contrato admite 20; diez alcanzan para un caso clínico). */
export const POST_MEDIA_MAX = 10;

/**
 * Las tres visibilidades que el contrato admite, con el texto que se muestra.
 *
 * Los códigos **son** los del enum del DTO (`PUBLIC`, `FOLLOWERS`, `PRIVATE`),
 * no cadenas inventadas para la pantalla: el servidor los resuelve a concepto de
 * terminología y cualquier otro valor es un 400.
 */
export const VISIBILIDADES: readonly {
  readonly value: PostVisibility;
  readonly label: string;
  readonly hint: string;
}[] = [
  {
    value: 'PUBLIC',
    label: 'Pública',
    hint: 'La puede leer cualquiera con sesión.',
  },
  {
    value: 'FOLLOWERS',
    label: 'Sólo quienes me siguen',
    hint: 'La leen los perfiles que le siguen en este momento.',
  },
  {
    value: 'PRIVATE',
    label: 'Sólo yo',
    hint: 'No la ve nadie más que usted.',
  },
];

/**
 * Extrae las etiquetas de un texto, como las entiende el servidor: **sin `#`**.
 *
 * El backend recibe `hashtags: string[]` «sin #» y hace su propio `upsert`; acá
 * sólo se derivan del cuerpo para no pedir dos veces lo mismo. Se normalizan a
 * minúsculas y se deduplican porque dos etiquetas que difieren en el caso son la
 * misma etiqueta, y mandarlas dos veces crearía dos vínculos al mismo hashtag.
 *
 * @param texto - Cuerpo de la publicación.
 * @returns Las etiquetas únicas, en el orden en que aparecen, hasta el tope.
 */
export function etiquetasDe(texto: string): readonly string[] {
  const encontradas = texto.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  const unicas = new Set(
    encontradas.map((etiqueta) => etiqueta.slice(1).toLowerCase()),
  );
  return [...unicas].slice(0, POST_HASHTAG_MAX);
}

/**
 * El redactor del muro.
 *
 * ## Validación en los dos lados, con el mismo número
 *
 * El tope de 5 000 caracteres y el de 30 etiquetas salen del DTO del servidor.
 * El formulario los aplica para avisar antes de enviar, no para reemplazar la
 * validación: el servidor vuelve a comprobarlos y su respuesta es la que manda.
 *
 * ## Un solo envío en vuelo
 *
 * `enviando` bloquea el botón **y** la función: sin lo segundo, dos pulsaciones
 * rápidas —o un `Enter` sostenido— publican dos veces, y una publicación
 * duplicada no se puede deshacer desde esta pantalla.
 *
 * ## Nada de inserción optimista
 *
 * El muro no muestra la publicación hasta que el servidor devuelve su id. Podría
 * insertarse antes y reconciliarse después, pero una tarjeta sin id no puede
 * recibir reacciones ni comentarios —las dos escrituras necesitan el id real— y
 * el resultado sería una tarjeta que se ve pero no se puede usar. Publicar no es
 * un gesto que se repita cien veces por minuto: puede esperar su confirmación.
 * Lo que se emite es `publicado`, y quien contiene al composer decide si recarga.
 *
 * ## Los dos puntos de extensión, presentes y honestos
 *
 * - **Imágenes (P5).** El botón existe, se ve y está deshabilitado, con el
 *   motivo escrito. `NewPost` ya admite `media`, así que P5 llena el arreglo y
 *   habilita el botón sin reescribir el formulario.
 * - **Advertencia de PII (P6).** El hueco `avisoPii` se pinta encima del
 *   textarea si alguien lo llena. Hoy nadie lo llena y no se muestra nada: una
 *   advertencia inventada acá diría que el sistema detecta algo que no detecta.
 *
 * Ninguno de los dos simula la función que le falta.
 */
@Component({
  selector: 'app-composer',
  imports: [Alert, AppButton, CommentMediaPicker, Select, Textarea],
  templateUrl: './composer.html',
  styleUrl: './composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Composer {
  private readonly community = inject(CommunityClient);

  private readonly selectorDeImagenes = viewChild(CommentMediaPicker, { read: CommentMediaPicker });
  private readonly contenedorDeImagenes = viewChild<ElementRef<HTMLElement>>('imagenes');

  /** Quién publica: su perfil público. El contrato lo exige y no lo deduce de la sesión. */
  readonly profileId = input.required<string>();

  /** Cómo se llama quien publica, para la cabecera («Valeria Rojas Mendoza»). */
  readonly autorNombre = input('');

  /** Su foto, si la tiene; sin ella se dibujan sus iniciales. */
  readonly autorAvatar = input<string | null>(null);

  /** Sus iniciales, para cuando no hay foto. */
  readonly autorIniciales = input('');

  /**
   * Advertencia previa a publicar, si alguien la calcula (P8: detección de
   * datos de pacientes). Vacío hoy, y por eso no se pinta nada: una
   * advertencia inventada acá diría que el sistema detecta algo que no detecta.
   */
  readonly avisoPii = input<string>('');

  /** Si arranca con el foco en «Agregar imágenes» (el atajo «Foto» de la barra de crear). */
  readonly enfocarImagenes = input(false);

  /** Se emite con el id de la publicación creada, después de que el servidor confirmó. */
  readonly publicado = output<string>();

  /** `true` cuando hay algo escrito o adjunto que se perdería al cerrar. */
  readonly borradorCambio = output<boolean>();

  protected readonly cuerpo = signal('');
  protected readonly visibilidad = signal<PostVisibility>('PUBLIC');
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly imagenes = signal<readonly NewPostMedia[]>([]);

  protected readonly opciones: readonly SelectOption<PostVisibility>[] =
    VISIBILIDADES.map(({ value, label }) => ({ value, label }));
  protected readonly maximo = POST_BODY_MAX;
  protected readonly maximoDeImagenes = POST_MEDIA_MAX;

  protected readonly etiquetas = computed(() => etiquetasDe(this.cuerpo()));

  protected readonly restantes = computed(
    () => POST_BODY_MAX - this.cuerpo().length,
  );

  private readonly texto = computed(() => this.cuerpo().trim());

  protected readonly excedido = computed(() => this.restantes() < 0);

  /** Hay algo que se perdería: la guardia de cierre del diálogo lo pregunta. */
  readonly hayBorrador = computed(() => this.texto().length > 0 || this.imagenes().length > 0);

  /**
   * El texto es obligatorio aunque haya imágenes: el contrato exige `bodyText`
   * de al menos un carácter, y una imagen sola no lo cumple.
   */
  protected readonly puedePublicar = computed(
    () => this.texto().length > 0 && !this.excedido() && !this.enviando(),
  );

  protected readonly explicacion = computed(
    () =>
      VISIBILIDADES.find((opcion) => opcion.value === this.visibilidad())
        ?.hint ?? '',
  );

  private readonly avisarBorrador = effect(() => {
    const hay = this.hayBorrador();
    untracked(() => this.borradorCambio.emit(hay));
  });

  private readonly enfocarAlAbrir = effect(() => {
    if (!this.enfocarImagenes()) return;
    // El selector existe una vez dibujado; se enfoca su primer botón.
    queueMicrotask(() =>
      this.contenedorDeImagenes()?.nativeElement.querySelector<HTMLElement>('button')?.focus(),
    );
  });

  /**
   * Los adjuntos que reporta el selector. Sólo imágenes: el selector se
   * configura para eso, y el filtro es la red de seguridad si alguien cambiara
   * su configuración sin mirar acá.
   */
  protected alCambiarImagenes(lista: readonly AdjuntoEmitido[]): void {
    this.imagenes.set(
      lista
        .filter((m) => m.mediaRole === 'IMAGE')
        .map((m) => ({
          fileId: m.fileId,
          mediaRole: 'IMAGE' as const,
          ...(m.altText === undefined ? {} : { altText: m.altText }),
          ...(m.ordinal === undefined ? {} : { ordinal: m.ordinal }),
        })),
    );
  }

  protected cambiarVisibilidad(valor: PostVisibility | null): void {
    if (
      valor !== null &&
      VISIBILIDADES.some((candidata) => candidata.value === valor)
    ) {
      this.visibilidad.set(valor);
    }
  }

  protected publicar(): void {
    if (!this.puedePublicar()) {
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    const etiquetas = this.etiquetas();
    const imagenes = this.imagenes();

    this.community
      .publishPost(this.profileId(), {
        bodyText: this.texto(),
        visibility: this.visibilidad(),
        ...(etiquetas.length > 0 ? { hashtags: [...etiquetas] } : {}),
        ...(imagenes.length > 0 ? { media: [...imagenes] } : {}),
      })
      .subscribe({
        next: ({ id }) => {
          this.cuerpo.set('');
          this.visibilidad.set('PUBLIC');
          this.imagenes.set([]);
          this.selectorDeImagenes()?.limpiar();
          this.enviando.set(false);
          this.publicado.emit(id);
        },
        error: (error: unknown) => {
          // Lo escrito y lo adjunto se conservan: perderlo ante un fallo está prohibido.
          this.enviando.set(false);
          this.error.set(describeApiFailure(error, 'No pudimos publicar. Revise y reintente.'));
        },
      });
  }
}
