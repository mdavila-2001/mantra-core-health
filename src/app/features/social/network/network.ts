import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import { FollowStore } from '@core/social/follow.store';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';
import { Card } from '@shared/components/molecules/card/card';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';
import { Tab } from '@shared/components/molecules/tabs/tab/tab';
import { Tabs } from '@shared/components/molecules/tabs/tabs';
import { inicialesDe } from '@shared/text/iniciales';
import { FollowButton } from '../follow-button/follow-button';

/** Cuántos profesionales se piden para las sugerencias. */
const MUESTRA = 30;

type EstadoLista = 'carga' | 'datos' | 'vacio' | 'error';

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
  imports: [Card, EmptyState, FollowButton, RouterLink, Tab, Tabs],
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

  protected readonly total = this.seguimientos.total;

  protected readonly estadoSiguiendo = computed<EstadoLista>(() => {
    if (!this.propio.resuelto() || (this.tieneVitrina() && !this.seguimientos.cargado())) return 'carga';
    if (this.seguimientos.fallo()) return 'error';
    return this.seguimientos.total() === 0 ? 'vacio' : 'datos';
  });

  /** Cada seguido con su resumen (que puede estar todavía llegando). */
  protected readonly seguidos = computed(() =>
    this.seguimientos.seguidos().map((id) => ({ id, resumen: this.resumenes.resumen(id) })),
  );

  protected iniciales(nombre: string): string {
    return inicialesDe(nombre);
  }

  protected reintentarSiguiendo(): void {
    this.seguimientos.recargar();
  }

  /* ---- Sugerencias ------------------------------------------------------- */

  private readonly muestra = signal<readonly PublicSearchResult[]>([]);
  protected readonly cargandoSugerencias = signal(false);
  protected readonly falloSugerencias = signal(false);
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

  protected readonly estadoSugerencias = computed<EstadoLista>(() => {
    if (this.cargandoSugerencias()) return 'carga';
    if (!this.falloSugerencias() && this.yaSeguidos() === null) return 'carga';
    if (this.falloSugerencias()) return 'error';
    return this.sugerencias().length === 0 ? 'vacio' : 'datos';
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
    this.falloSugerencias.set(false);
    this.yaSeguidos.set(null);
    this.sugerenciasCargadas.set(false);
    this.directorio.searchPractitioners({ limit: MUESTRA }).subscribe({
      next: (pagina) => {
        this.muestra.set(pagina.items);
        this.sugerenciasCargadas.set(true);
        this.cargandoSugerencias.set(false);
      },
      error: () => {
        this.falloSugerencias.set(true);
        this.cargandoSugerencias.set(false);
      },
    });
  }
}
