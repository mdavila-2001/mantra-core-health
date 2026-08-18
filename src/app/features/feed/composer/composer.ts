import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import type { PostVisibility } from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
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
    hint: 'La leen los perfiles que te siguen en este momento.',
  },
  {
    value: 'PRIVATE',
    label: 'Sólo yo',
    hint: 'No la ve nadie más que vos.',
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
  imports: [Alert, AppButton, Card, FormField, Select, Textarea],
  templateUrl: './composer.html',
  styleUrl: './composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Composer {
  private readonly community = inject(CommunityClient);

  /**
   * La vitrina que firma la publicación.
   *
   * Sin ella no se puede publicar: el servidor exige el perfil en la ruta y
   * comprueba que sea del actor. Quien no tenga vitrina ve la invitación a
   * crearla, no un formulario que va a fallar.
   */
  readonly profileId = input.required<string>();

  /**
   * Advertencia a mostrar sobre el cuerpo, si hay alguna.
   *
   * Es el punto de extensión de P6: la detección de datos identificables de
   * pacientes es una regla del backend, y hasta que exista, esto queda vacío.
   */
  readonly avisoPii = input<string>('');

  /** Se emite con el id de la publicación creada. */
  readonly publicado = output<string>();

  protected readonly cuerpo = signal('');
  protected readonly visibilidad = signal<PostVisibility>('PUBLIC');
  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  /** Las opciones tal como las pide `app-select`, con el tipo del código. */
  protected readonly opciones: readonly SelectOption<PostVisibility>[] =
    VISIBILIDADES.map(({ value, label }) => ({ value, label }));
  protected readonly maximo = POST_BODY_MAX;

  protected readonly etiquetas = computed(() => etiquetasDe(this.cuerpo()));

  protected readonly restantes = computed(
    () => POST_BODY_MAX - this.cuerpo().length,
  );

  /** El texto sin espacios alrededor: es lo que se manda y lo que se valida. */
  private readonly texto = computed(() => this.cuerpo().trim());

  protected readonly excedido = computed(() => this.restantes() < 0);

  protected readonly puedePublicar = computed(
    () => this.texto().length > 0 && !this.excedido() && !this.enviando(),
  );

  /** La explicación de la visibilidad elegida, para no dejarla a la adivinanza. */
  protected readonly explicacion = computed(
    () =>
      VISIBILIDADES.find((opcion) => opcion.value === this.visibilidad())
        ?.hint ?? '',
  );

  /**
   * Acepta el código elegido, y sólo si es uno de los tres del contrato.
   *
   * Un valor fuera de la lista —o un `null`— **no** cae en «PUBLIC por
   * defecto»: eso publicaría más abierto de lo que se pidió, que es el peor
   * error posible en esta pantalla.
   */
  protected cambiarVisibilidad(valor: PostVisibility | null): void {
    if (
      valor !== null &&
      VISIBILIDADES.some((candidata) => candidata.value === valor)
    ) {
      this.visibilidad.set(valor);
    }
  }

  protected publicar(): void {
    // Single-flight: la guarda está acá y no sólo en el `disabled` del botón,
    // porque el botón no es el único camino a esta función.
    if (!this.puedePublicar()) {
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    const etiquetas = this.etiquetas();

    this.community
      .publishPost(this.profileId(), {
        bodyText: this.texto(),
        visibility: this.visibilidad(),
        ...(etiquetas.length > 0 ? { hashtags: [...etiquetas] } : {}),
      })
      .subscribe({
        next: ({ id }) => {
          this.cuerpo.set('');
          this.visibilidad.set('PUBLIC');
          this.enviando.set(false);
          this.publicado.emit(id);
        },
        error: () => {
          // El cuerpo **no** se limpia: si falló, lo que se escribió es lo único
          // que no se puede recuperar.
          this.enviando.set(false);
          this.error.set('No pudimos publicar. Revisá y reintentá.');
        },
      });
  }
}
