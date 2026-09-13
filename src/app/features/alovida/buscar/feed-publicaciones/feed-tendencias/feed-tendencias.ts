import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import { inicialesDe } from '@shared/text/iniciales';

/** Cuántos profesionales se muestran. Cinco: los que entran sin scroll. */
const CUANTOS = 5;

/** Cuántos se piden al directorio para elegir entre ellos. */
const MUESTRA = 20;

type EstadoTendencias = 'carga' | 'datos' | 'vacio' | 'error';

/**
 * Los profesionales «en tendencia» de una muestra del directorio.
 *
 * ## Qué es «tendencia» acá, y por qué
 *
 * El directorio público no proyecta visitas ni seguidores; de lo que sirve por
 * profesional, **las reseñas son lo único que crece con la actividad de la
 * semana**: alguien reseña después de atenderse. Así que el criterio es
 * cantidad de reseñas, y a igual cantidad la mejor calificación; el nombre
 * desempata para que la lista no baile entre recargas.
 *
 * Exportada para que la prueba fije el criterio sin montar el componente. Si
 * mañana la API sirve un `trendingScore`, esto es lo único que cambia.
 */
export function enTendencia(
  candidatos: readonly PublicSearchResult[],
  cuantos = CUANTOS,
): PublicSearchResult[] {
  return [...candidatos]
    .sort(
      (a, b) =>
        b.ratingCount - a.ratingCount ||
        (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0) ||
        a.displayName.localeCompare(b.displayName, 'es'),
    )
    .slice(0, cuantos);
}

/**
 * «Doctores en tendencia esta semana» — la tarjeta de arriba de la columna
 * izquierda de la red social.
 *
 * Lee una muestra del directorio de profesionales y se queda con los cinco
 * que más conversación generaron. Cada fila lleva a la ficha pública, que es
 * donde están la agenda y las vías de contacto; el pie lleva al directorio
 * completo.
 */
@Component({
  selector: 'app-feed-tendencias',
  imports: [RouterLink],
  templateUrl: './feed-tendencias.html',
  styleUrl: './feed-tendencias.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedTendencias {
  private readonly directorio = inject(PublicDirectoryClient);

  private readonly muestra = signal<readonly PublicSearchResult[]>([]);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal(false);

  protected readonly doctores = computed(() => enTendencia(this.muestra()));

  protected readonly estado = computed<EstadoTendencias>(() => {
    if (this.cargando()) return 'carga';
    if (this.fallo()) return 'error';
    return this.doctores().length === 0 ? 'vacio' : 'datos';
  });

  constructor() {
    this.cargar();
  }

  protected iniciales(d: PublicSearchResult): string {
    return inicialesDe(d.displayName);
  }

  protected reintentar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.fallo.set(false);
    this.directorio.searchPractitioners({ limit: MUESTRA }).subscribe({
      next: (pagina) => {
        this.muestra.set(pagina.items);
        this.cargando.set(false);
      },
      error: () => {
        this.fallo.set(true);
        this.cargando.set(false);
      },
    });
  }
}
