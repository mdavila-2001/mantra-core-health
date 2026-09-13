/* ============================================================================
    Las opiniones de una ficha pública, y quiénes dieron estrellas.

    ## Qué reemplaza

    El «★ 4,9 (8)» de la cabecera era texto: decía cuántas opiniones había y no
    dejaba leer ninguna. La pregunta que ese número produce —«¿qué dijeron?,
    ¿quiénes?»— no tenía respuesta en la ficha pública.

    ## Dos pestañas, una sola lectura

    «Opiniones» son las que traen texto; «Quiénes dieron estrellas» es **todos**
    los que calificaron, con o sin texto, y cuántas estrellas puso cada uno.
    Salen de la misma lectura: una persona que sólo dio estrellas también
    calificó, y esconderla haría que la lista no sumara el número de la cabecera.

    `organisms/content-dialog` pone el `<dialog>` nativo —fondo, trampa de foco,
    Escape, vuelta del foco— y esto pone el contenido.
    ========================================================================== */

import { DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { RouterLink } from '@angular/router';
import { EMPTY, expand, reduce } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import {
  PUBLIC_PROFILE_PREFIX,
  type PublicProfileDetail,
  type PublicProfileReview,
} from '@core/data-access/public-directory/public-directory.types';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';
import { inicialesDe } from '@shared/text/iniciales';

import { PublicProfilePager } from '../public-profile-pager/public-profile-pager';

export type PestanaDeOpiniones = 'opiniones' | 'estrellas';

type EstadoLista = 'carga' | 'datos' | 'error';

/** Cuántas opiniones entran en una página del modal. */
export const OPINIONES_POR_PAGINA = 5;

/** Cuántas trae cada pedido al servidor; se piden todas las páginas seguidas. */
const LOTE = 50;

@Component({
  selector: 'app-public-profile-reviews',
  imports: [ContentDialog, DatePipe, NgTemplateOutlet, PublicProfilePager, RouterLink],
  templateUrl: './public-profile-reviews.html',
  styleUrl: './public-profile-reviews.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfileReviews implements OnInit {
  private readonly directorio = inject(PublicDirectoryClient);

  readonly kind = input.required<PublicProfileDetail['kind']>();
  readonly slug = input.required<string>();
  readonly displayName = input.required<string>();
  /** El promedio de la cabecera, como número; `null` si nadie calificó. */
  readonly promedio = input<number | null>(null);
  /** Con qué pestaña se abre: «8 opiniones» abre una, la estrella la otra. */
  readonly pestanaInicial = input<PestanaDeOpiniones>('opiniones');

  readonly cerrado = output<void>();

  /**
   * La pestaña elegida. Arranca en `null` y cae a {@link pestanaInicial}: un
   * `linkedSignal` no se recalcula en TestBed en este repo (ver la nota de
   * memoria del equipo), y esto hace lo mismo sin depender de él.
   */
  private readonly elegida = signal<PestanaDeOpiniones | null>(null);
  protected readonly pestana = computed(() => this.elegida() ?? this.pestanaInicial());

  protected readonly todas = signal<readonly PublicProfileReview[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal(false);
  protected readonly paginaOpiniones = signal(0);
  protected readonly paginaEstrellas = signal(0);
  protected readonly porPagina = OPINIONES_POR_PAGINA;
  protected readonly cincoEstrellas = [1, 2, 3, 4, 5] as const;

  protected readonly estado = computed<EstadoLista>(() => {
    if (this.fallo()) return 'error';
    return this.cargando() ? 'carga' : 'datos';
  });

  /** Las que traen texto: lo que se lee en «Opiniones». */
  protected readonly conTexto = computed(() => this.todas().filter((o) => o.text !== null));

  protected readonly titulo = computed(() => `Opiniones sobre ${this.displayName()}`);

  /** El promedio con coma decimal, como se lee en castellano. */
  protected readonly promedioTexto = computed(() => {
    const media = this.promedio();
    return media === null ? '—' : media.toFixed(1).replace('.', ',');
  });

  /** Cuántas personas dieron 5, 4, 3, 2 y 1 estrellas, con su proporción. */
  protected readonly distribucion = computed(() => {
    const todas = this.todas();
    return [5, 4, 3, 2, 1].map((estrellas) => {
      const cuantas = todas.filter((o) => o.rating === estrellas).length;
      return {
        estrellas,
        cuantas,
        porcentaje: todas.length === 0 ? 0 : Math.round((cuantas / todas.length) * 100),
      };
    });
  });

  protected readonly visiblesOpiniones = computed(() =>
    this.recorte(this.conTexto(), this.paginaOpiniones()),
  );

  protected readonly visiblesEstrellas = computed(() =>
    this.recorte(this.todas(), this.paginaEstrellas()),
  );

  /** `input.required` no tiene valor en el constructor: la lectura va acá. */
  ngOnInit(): void {
    this.leer();
  }

  protected elegir(pestana: PestanaDeOpiniones): void {
    this.elegida.set(pestana);
  }

  protected reintentar(): void {
    this.leer();
  }

  protected iniciales(opinion: PublicProfileReview): string {
    return inicialesDe(opinion.reviewer.displayName);
  }

  /** El enlace a la ficha de quien opinó, o `null` si no tiene ficha pública. */
  protected enlace(opinion: PublicProfileReview): readonly string[] | null {
    const { kind, slug } = opinion.reviewer;
    if (kind === null || slug === null || kind === 'MEDICATION') return null;
    return [`/${PUBLIC_PROFILE_PREFIX[kind]}`, slug];
  }

  protected rotuloEstrellas(rating: number): string {
    return rating === 1 ? '1 estrella' : `${rating} estrellas`;
  }

  /** Si la estrella `n` del promedio va encendida (redondeo a la media estrella). */
  protected estrellaDelPromedio(n: number): boolean {
    return n <= Math.round(this.promedio() ?? 0);
  }

  private recorte(
    lista: readonly PublicProfileReview[],
    pagina: number,
  ): readonly PublicProfileReview[] {
    const ultima = Math.max(0, Math.ceil(lista.length / OPINIONES_POR_PAGINA) - 1);
    const desde = Math.min(Math.max(0, pagina), ultima) * OPINIONES_POR_PAGINA;
    return lista.slice(desde, desde + OPINIONES_POR_PAGINA);
  }

  /** Pide todas las páginas seguidas: la distribución necesita la lista entera. */
  private leer(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    const pedir = (cursor?: string) =>
      this.directorio.profileReviews(this.kind(), this.slug(), { cursor, limit: LOTE });

    pedir()
      .pipe(
        expand((pagina) => (pagina.nextCursor === null ? EMPTY : pedir(pagina.nextCursor))),
        reduce(
          (acumuladas, pagina) => [...acumuladas, ...pagina.items],
          [] as PublicProfileReview[],
        ),
      )
      .subscribe({
        next: (todas) => {
          this.todas.set(todas);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.fallo.set(true);
        },
      });
  }
}
