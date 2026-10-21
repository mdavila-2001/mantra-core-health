import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { FollowStore } from '@core/social/follow.store';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { ProfileSummaryStore, type ResumenDePerfil } from '@core/social/profile-summary.store';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { Card } from '@shared/components/molecules/card/card';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';
import { Tab } from '@shared/components/molecules/tabs/tab/tab';
import { Tabs } from '@shared/components/molecules/tabs/tabs';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { inicialesDe } from '@shared/text/iniciales';
import { FollowButton } from '../follow-button/follow-button';

/** Cuántos profesionales se piden para las sugerencias. */
const MUESTRA = 30;

/** Una fila de «Siguiendo»: el id y su resumen (`undefined` mientras llega). */
interface FilaSeguido {
  readonly id: string;
  readonly resumen: ResumenDePerfil | undefined;
}

/**
 * «Mi red»: a quién sigue la persona y a quién podría seguir.
 *
 * ## Una tarjeta, con pestañas
 *
 * Regla del cliente (`composition-rules.md` §5): una pantalla que es una sola
 * cosa va centrada, a lo ancho y en UNA tarjeta con pestañas, no en tarjetas
 * apiladas. Acá son dos: **Siguiendo** y **Sugerencias**.
 *
 * ## De dónde sale cada lista
 *
 * - **Siguiendo**: del `FollowStore`, que ya leyó `GET /community/follows` y es
 *   la misma fuente que dice «Siguiendo» en cada tarjeta. El contrato trae sólo
 *   el **id** de cada persona, así que nombre, titular y foto se resuelven con
 *   `ProfileSummaryStore` (una vez por persona, con caché y de a pocas).
 * - **Sugerencias**: una muestra del directorio de profesionales, sin la propia
 *   vitrina y **sin quienes ya sigue**. No hay un endpoint de «sugeridos»: no
 *   se inventa uno. El directorio da `slug` y seguir se decide por id, así que
 *   la lista espera a resolver cada id y recién entonces se fija a quién sacar.
 *   Se fija **una vez**: quien sigue a alguien durante la visita lo ve pasar a
 *   «Siguiendo» en su lugar, en vez de ver la fila desaparecer bajo el dedo.
 *
 * Seguir y dejar de seguir son el mismo `app-follow-button` de todas partes, así
 * que cambiar acá cambia en el feed y viceversa.
 */
@Component({
  selector: 'app-network',
  imports: [Card, EmptyState, FollowButton, RouterLink, Tab, Tabs, ViewStateHost],
  templateUrl: './network.html',
  styleUrl: './network.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Network {
  private readonly seguimientos = inject(FollowStore);
  private readonly resumenes = inject(ProfileSummaryStore);
  private readonly propio = inject(OwnProfileStore);
  private readonly directorio = inject(PublicDirectoryClient);

  protected readonly pestana = signal(0);

  /* ---- Siguiendo --------------------------------------------------------- */

  protected readonly tieneVitrina = computed(() => this.propio.id() !== null);

  /**
   * Cada seguido con su resumen. Los ids que **no se pudieron leer como
   * perfil** no se listan: el contrato también devuelve seguimientos de temas o
   * grupos (los ids no se distinguen sin traducir su concepto), y ofrecer
   * «dejar de seguir» como perfil sobre uno de esos mandaría una baja
   * equivocada. Se cuentan aparte, en {@link noMostrables}.
   */
  private readonly todos = computed(() =>
    this.seguimientos.seguidos().map((id) => ({ id, resumen: this.resumenes.resumen(id) })),
  );

  protected readonly noMostrables = computed(() => this.todos().filter((f) => f.resumen === null).length);

  /** «Siguiendo» en los estados del M34 (`ViewState`), que dibuja `app-view-state-host`. */
  protected readonly siguiendo = computed<ViewState<readonly FilaSeguido[]>>(() => {
    if (!this.propio.resuelto() || (this.tieneVitrina() && !this.seguimientos.cargado())) return loading();
    if (this.seguimientos.fallo()) return errorToViewState(this.seguimientos.error());
    if (!this.tieneVitrina()) {
      return empty(
        { label: 'Crear mi vitrina', route: '/my-account/profile/edit' },
        'El contrato de la red exige el perfil de quien sigue.',
      );
    }
    if (this.seguimientos.total() === 0) {
      return empty({ label: 'Ver sugerencias' }, 'Siga a profesionales para ver lo que publican en su inicio.');
    }
    const filas = this.todos().filter((f): f is FilaSeguido => f.resumen !== null);
    return ready(filas);
  });

  protected readonly filasSeguidas = computed(() => {
    const estado = this.siguiendo();
    return estado.status === 'ready' ? estado.data : [];
  });

  protected iniciales(nombre: string): string {
    return inicialesDe(nombre);
  }

  protected reintentarSiguiendo(): void {
    this.seguimientos.recargar();
  }

  /* ---- Sugerencias ------------------------------------------------------- */

  private readonly muestra = signal<readonly PublicSearchResult[]>([]);
  protected readonly cargandoSugerencias = signal(false);
  /** El error de la última lectura del directorio, o `null`. */
  private readonly errorSugerencias = signal<unknown>(null);
  private sugerenciasPedidas = false;

  private readonly sugerenciasCargadas = signal(false);

  /** `slug`s de quienes ya seguía al abrir las sugerencias; `null` mientras no se sabe. */
  private readonly yaSeguidos = signal<ReadonlySet<string> | null>(null);

  private readonly candidatos = computed(() => {
    const miSlug = this.propio.perfil()?.slug ?? null;
    return this.muestra().filter((p) => p.slug !== miSlug);
  });

  private readonly fijarYaSeguidos = effect(() => {
    if (this.cargandoSugerencias() || !this.sugerenciasCargadas() || this.yaSeguidos() !== null) return;
    // Sin vitrina no se sigue a nadie: no hay a quién sacar ni ids que resolver.
    if (!this.tieneVitrina()) {
      untracked(() => this.yaSeguidos.set(new Set()));
      return;
    }
    if (!this.seguimientos.cargado()) return;
    const ids = this.candidatos().map((p) => [p.slug, this.resumenes.idPorSlug(p.slug)] as const);
    if (ids.some(([, id]) => id === undefined)) return;
    const fuera = new Set(ids.filter(([, id]) => typeof id === 'string' && this.seguimientos.sigue(id)).map(([slug]) => slug));
    untracked(() => this.yaSeguidos.set(fuera));
  });

  protected readonly sugerencias = computed(() => {
    const fuera = this.yaSeguidos() ?? new Set<string>();
    return this.candidatos().filter((p) => !fuera.has(p.slug));
  });

  protected readonly estadoSugerencias = computed<ViewState<readonly PublicSearchResult[]>>(() => {
    if (this.errorSugerencias() !== null) return errorToViewState(this.errorSugerencias());
    if (this.cargandoSugerencias() || this.yaSeguidos() === null) return loading();
    const lista = this.sugerencias();
    return lista.length === 0
      ? empty({ label: 'Ver todos los profesionales', route: '/search/practitioners' }, 'Cuando haya más perfiles publicados, aparecen acá.')
      : ready(lista);
  });

  /** La pestaña de sugerencias se pide al abrirla, no antes: nadie la mira hasta entonces. */
  protected alCambiarPestana(indice: number): void {
    this.pestana.set(indice);
    if (indice === 1 && !this.sugerenciasPedidas) {
      this.cargarSugerencias();
    }
  }

  protected cargarSugerencias(): void {
    this.sugerenciasPedidas = true;
    this.cargandoSugerencias.set(true);
    this.errorSugerencias.set(null);
    this.yaSeguidos.set(null);
    this.sugerenciasCargadas.set(false);
    this.directorio.searchPractitioners({ limit: MUESTRA }).subscribe({
      next: (pagina) => {
        this.muestra.set(pagina.items);
        this.sugerenciasCargadas.set(true);
        this.cargandoSugerencias.set(false);
      },
      error: (error: unknown) => {
        this.errorSugerencias.set(error);
        this.cargandoSugerencias.set(false);
      },
    });
  }
}
