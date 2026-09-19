import { computed, DestroyRef, Directive, inject, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { Observable } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicPage,
  PublicProfileDetail,
} from '@core/data-access/public-directory/public-directory.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import type { BreadcrumbItem } from '@shared/components/molecules/breadcrumb/breadcrumb.types';
import type { Hecho } from '@shared/components/molecules/fact-list/fact-list.types';

/** Tarjetas que simula el esqueleto: una pantalla, no el catálogo entero. */
const TARJETAS_DEL_ESQUELETO = 6;

/**
 * Lo común a las dos fichas que abren los directorios del panel: la de una
 * clínica y la de una farmacia.
 *
 * ## Por qué existen estas dos pantallas
 *
 * Porque las tarjetas de los directorios llevaban a `/o/:slug` y `/f/:slug`,
 * que son las fichas anónimas **bajo el marco de la red social**: quien entraba
 * desde su menú terminaba, sin pedirlo, fuera de la aplicación. El cliente lo
 * pidió sacar sin excepciones, y sacarlo a secas habría dejado una tarjeta que
 * no lleva a ningún lado. Así que la ficha ahora vive dentro del panel y
 * muestra lo que hacía falta ver: **qué ofrece** y a cuánto.
 *
 * ## Se lee, y nada más
 *
 * Es la diferencia con «Mis servicios», que es la misma rejilla: allá el precio
 * se edita porque el catálogo es de quien mira. Acá no hay «Editar precio», ni
 * alta, ni baja — el cliente lo pidió explícitamente y además sería una mentira
 * de la pantalla: ninguna de las dos lecturas tiene contraparte de escritura.
 *
 * ## Dos estados y no uno
 *
 * La ficha y su catálogo se piden por separado y cada uno tiene el suyo. Con un
 * solo estado combinado, una lectura de catálogo que falle —hoy es P30/P31 de
 * `PENDIENTES-BACKEND.md`, así que contra la API real todavía falla— se llevaría
 * puesta también la ficha, y quien mira no podría ni ver dónde queda la clínica.
 */
@Directive()
export abstract class PublicCatalogDetail<T> implements OnInit {
  /** Qué clase de sujeto espera esta ficha. Un slug de otra clase da 404. */
  protected abstract readonly kind: Extract<
    PublicProfileDetail['kind'],
    'ORGANIZATION' | 'PHARMACY'
  >;

  /** El directorio del que cuelga, para la miga de pan y la vuelta atrás. */
  protected abstract readonly rutaDelDirectorio: string;

  /** Cómo se llama ese directorio en la miga de pan. */
  protected abstract readonly rotuloDelDirectorio: string;

  /** La lectura del catálogo del vertical concreto. */
  protected abstract leerCatalogo(slug: string): Observable<PublicPage<T>>;

  private readonly ruta = inject(ActivatedRoute);
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * El slug de la ficha. `protected` y no `private`: la ficha de una farmacia
   * cuelga de él una tercera lectura —sus sucursales— y sin esto tendría que
   * volver a escuchar la ruta por su cuenta, con el riesgo de que las dos
   * escuchas quedaran en slugs distintos por un instante.
   */
  protected slug: string | null = null;

  protected readonly estadoDeLaFicha = signal<ViewState<PublicProfileDetail>>(loading());
  protected readonly estadoDelCatalogo = signal<ViewState<readonly T[]>>(loading());

  protected readonly ficha = computed(() => dataOf(this.estadoDeLaFicha()));

  /**
   * El título de la página.
   *
   * Mientras la ficha viaja es el rótulo del directorio y no una cadena vacía:
   * un encabezado que aparece vacío y después cambia de alto empuja la página
   * entera cuando alguien ya empezó a leerla.
   */
  protected readonly titulo = computed(
    () => this.ficha()?.displayName ?? this.rotuloDelDirectorio,
  );

  protected readonly bajada = computed(() => this.ficha()?.headline ?? '');

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: this.rotuloDelDirectorio, routerLink: this.rutaDelDirectorio },
    { label: this.titulo() },
  ]);

  protected readonly items = computed<readonly T[]>(() => dataOf(this.estadoDelCatalogo()) ?? []);

  /** Huecos del esqueleto. Se calcula una vez: no depende de ningún dato. */
  protected readonly huecosDelEsqueleto = Array.from(
    { length: TARJETAS_DEL_ESQUELETO },
    (_, indice) => indice,
  );

  /**
   * La ruta se escucha en `ngOnInit` y **no en el constructor**.
   *
   * Porque el slug llega de forma síncrona y dispara la carga en el acto, y en
   * ese instante los campos de la subclase todavía no existen: TypeScript
   * inicializa los del padre primero, así que el cliente que la subclase
   * inyecta sería `undefined` y `leerCatalogo` moriría antes de la primera
   * petición. Es lo que pasó al escribir esto. En `ngOnInit` la instancia ya
   * está entera.
   */
  ngOnInit(): void {
    this.ruta.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.slug = params.get('slug');
      this.cargar();
    });
  }

  protected cargar(): void {
    const slug = this.slug;
    if (slug === null || slug === '') {
      const volver = { label: `Volver a ${this.rotuloDelDirectorio.toLowerCase()}`, route: this.rutaDelDirectorio };
      this.estadoDeLaFicha.set(notFound(volver));
      this.estadoDelCatalogo.set(notFound(volver));
      return;
    }

    this.estadoDeLaFicha.set(loading());
    this.directorio
      .getProfile(this.kind, slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (perfil) => this.estadoDeLaFicha.set(ready(perfil)),
        error: (error: unknown) =>
          this.estadoDeLaFicha.set(errorToViewState<PublicProfileDetail>(error)),
      });

    this.recargarCatalogo();
  }

  /** Reintenta **sólo** el catálogo: la ficha ya está en pantalla. */
  protected recargarCatalogo(): void {
    const slug = this.slug;
    if (slug === null || slug === '') return;

    this.estadoDelCatalogo.set(loading());
    this.leerCatalogo(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagina) => this.estadoDelCatalogo.set(ready(pagina.items)),
        error: (error: unknown) =>
          this.estadoDelCatalogo.set(errorToViewState<readonly T[]>(error)),
      });
  }

  /**
   * El resumen del establecimiento: dónde queda, si está verificado y cómo lo
   * califican.
   *
   * En columnas y no en filas: son valores cortos que se leen de una pasada
   * para reconocer el lugar, no campos que alguien viene a buscar uno por uno.
   * `null` no se dibuja, así que una ficha sin dirección no muestra el hueco.
   */
  protected identificacion(perfil: PublicProfileDetail): readonly Hecho[] {
    return [
      { etiqueta: 'Ciudad', valor: perfil.city, icono: 'pin' },
      { etiqueta: 'Dirección', valor: perfil.address, icono: 'building' },
      {
        etiqueta: 'Verificación',
        valor: perfil.verified ? 'Verificado' : 'Declarado',
        icono: 'shield',
        // Lo declarado va **rotulado** y sin tono de estado: pintarlo de
        // ámbar lo leería como un problema, y no lo es — es lo normal en un
        // directorio recién poblado. Ver el mapper de la tarjeta.
        ...(perfil.verified ? { tono: 'ok' as const } : {}),
      },
      { etiqueta: 'Reseñas', valor: this.puntuacion(perfil), icono: 'star' },
    ];
  }

  /**
   * La puntuación con coma decimal, o `null` cuando todavía no hay reseñas.
   *
   * `0,0` diría que la atención se calificó mal cuando nadie la calificó
   * todavía. Es la misma regla que la tarjeta del directorio.
   */
  private puntuacion(perfil: PublicProfileDetail): string | null {
    if (perfil.ratingAverage === null || perfil.ratingCount === 0) return null;
    const media = perfil.ratingAverage.toFixed(1).replace('.', ',');
    return `${media} · ${perfil.ratingCount} ${perfil.ratingCount === 1 ? 'reseña' : 'reseñas'}`;
  }

  /**
   * El importe con la coma decimal de es-BO, o `null` si no hay precio.
   *
   * Se cambia el separador y no se reformatea el número: `toLocaleString` sobre
   * un `parseFloat` volvería a meter el redondeo que la cadena exacta evita. Es
   * la misma decisión que la ficha de laboratorio.
   */
  protected importe(valor: string | null, moneda: string | null): string | null {
    if (valor === null) return null;
    const monto = valor.replace('.', ',');
    return moneda === null ? monto : `${monto} ${moneda}`;
  }
}
