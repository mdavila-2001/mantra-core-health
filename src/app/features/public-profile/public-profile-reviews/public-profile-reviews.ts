import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import { AuthService } from '@core/auth/auth.service';
import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicProfileDetail,
  PublicProfileReview,
} from '@core/data-access/public-directory/public-directory.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { RateEncounterDialog } from '../rate-encounter-dialog/rate-encounter-dialog';

/** Cuántas opiniones se traen por página. */
const POR_PAGINA = 10;

/** El máximo de estrellas, para dibujar las vacías y para el texto accesible. */
const ESTRELLAS = 5;

/**
 * Las **opiniones** de una ficha pública (P31).
 *
 * ## Por qué es un componente y no un bloque más de la tarjeta
 *
 * La tarjeta de la ficha (`app-public-profile-card`) la comparten la ficha
 * pública y la vista previa de «Tu perfil público». Las opiniones se piden en
 * una segunda llamada y se paginan, así que meterlas ahí obligaría a la vista
 * previa a hacer un viaje que no necesita — y a alguien a mirar sus propias
 * opiniones desde el editor de su perfil, que no es la pantalla donde se leen.
 *
 * ## El promedio no se calcula acá
 *
 * Viene con la página y es el del **perfil**, no el de lo que se está
 * mirando. Promediar `items` daría un número que cambia al pulsar «Ver más»,
 * y el visitante leería dos valores distintos para la misma pregunta en la
 * misma pantalla.
 *
 * ## Quién firma
 *
 * `reviewerDisplayName` en `null` significa que el autor **eligió** publicar
 * como anónimo, no que falte el dato: la pantalla lo dice con palabras
 * («Paciente verificado») y nunca deja un hueco. El backend ni siquiera pide
 * el nombre de quien eligió el anonimato.
 */
@Component({
  selector: 'app-public-profile-reviews',
  imports: [AppButton, Alert, DatePipe, RateEncounterDialog],
  templateUrl: './public-profile-reviews.html',
  styleUrl: './public-profile-reviews.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfileReviews implements OnInit {
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly auth = inject(AuthService);

  /** Qué clase de sujeto es. Fija el prefijo de la ruta pública. */
  readonly kind = input.required<PublicProfileDetail['kind']>();

  /** El slug de la ficha, tal como está en la URL. */
  readonly slug = input.required<string>();

  /** Cómo se llama a quien se califica, para el texto del diálogo. */
  readonly professionalName = input.required<string>();

  protected readonly estado = signal<ViewState<null>>(ready(null));
  protected readonly opiniones = signal<readonly PublicProfileReview[]>([]);
  protected readonly promedio = signal<number | null>(null);
  protected readonly total = signal(0);
  private readonly cursor = signal<string | null>(null);

  /** Si quedan más por traer. */
  protected readonly hayMas = computed(() => this.cursor() !== null);

  protected readonly cargando = computed(() => this.estado().status === 'loading');

  /** El fallo de la carga, en palabras, o `null` si no hubo. */
  protected readonly error = computed<string | null>(() => {
    const estado = this.estado();
    if (estado.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (estado.status === 'error') {
      return 'No pudimos traer las opiniones.';
    }
    return null;
  });

  /**
   * El promedio con una decimal y coma, como se escribe acá.
   *
   * `null` cuando nadie calificó: la plantilla dice «Sin calificaciones», que
   * no es lo mismo que un cero.
   */
  protected readonly promedioTexto = computed<string | null>(() => {
    const media = this.promedio();
    return media === null ? null : media.toFixed(1).replace('.', ',');
  });

  /**
   * Si quien mira puede calificar: una sesión con perfil de paciente.
   *
   * No comprueba que se haya atendido con ESTE profesional —eso lo sabe el
   * servidor, y averiguarlo acá exigiría cruzar sus atenciones con una ficha
   * pública que a propósito no publica a quién representa—. Ofrecerlo y que
   * el servidor explique por qué no, cuando no corresponde, es mejor que
   * esconder el camino a quien sí puede.
   */
  protected readonly puedeCalificar = computed(
    () => this.auth.patientProfileId() !== null,
  );

  /** Si el diálogo de calificar está abierto. */
  protected readonly calificando = signal(false);

  protected abrirCalificacion(): void {
    this.calificando.set(true);
  }

  protected cerrarCalificacion(): void {
    this.calificando.set(false);
  }

  /**
   * Recarga las opiniones desde cero tras publicar una.
   *
   * Se descarta lo que había en vez de insertar la nueva arriba: el promedio y
   * el total los calcula el servidor, y componerlos acá daría dos números
   * distintos para la misma pregunta hasta la siguiente visita.
   */
  protected calificacionPublicada(): void {
    this.calificando.set(false);
    this.opiniones.set([]);
    this.cursor.set(null);
    this.cargar();
  }

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * Trae la página siguiente, o la primera si todavía no hay ninguna.
   *
   * Acumula en vez de reemplazar: «Ver más opiniones» agrega debajo, no
   * cambia de página — quien venía leyendo la cuarta no vuelve al principio.
   */
  protected cargar(): void {
    if (this.cargando()) {
      return;
    }
    this.estado.set(loading());
    const cursorActual = this.cursor();
    this.directorio
      .profileReviews(this.kind(), this.slug(), {
        limit: POR_PAGINA,
        ...(cursorActual === null ? {} : { cursor: cursorActual }),
      })
      .subscribe({
        next: (pagina) => {
          this.opiniones.update((previas) => [...previas, ...pagina.items]);
          this.promedio.set(pagina.ratingAverage);
          this.total.set(pagina.ratingCount);
          this.cursor.set(pagina.nextCursor);
          this.estado.set(ready(null));
        },
        error: (error: unknown) => {
          this.estado.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Las cinco posiciones de estrella de una opinión, llenas o vacías.
   *
   * Se calcula acá y no con un `@for` sobre un arreglo en la plantilla porque
   * la plantilla no debe construir datos; y son cinco casillas siempre, para
   * que «3 de 5» se lea de un vistazo sin contar.
   *
   * @param puntaje - Las estrellas que puso el autor.
   * @returns Cinco booleanos, uno por posición.
   */
  protected estrellas(puntaje: number): readonly boolean[] {
    return Array.from({ length: ESTRELLAS }, (_, i) => i < puntaje);
  }

  /**
   * Cómo se nombra al autor de una opinión.
   *
   * @param opinion - La opinión a rotular.
   * @returns El nombre que eligió mostrar, o el rótulo del anonimato.
   */
  protected autor(opinion: PublicProfileReview): string {
    return opinion.reviewerDisplayName ?? 'Paciente verificado';
  }

  /**
   * El puntaje dicho con palabras, para quien no ve las estrellas.
   *
   * @param puntaje - Las estrellas que puso el autor.
   * @returns La frase para el lector de pantalla.
   */
  protected puntajeAccesible(puntaje: number): string {
    return `${puntaje} de ${ESTRELLAS} estrellas`;
  }
}
