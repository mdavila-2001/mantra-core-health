import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, tap } from 'rxjs';

import { CommunityClient } from '@core/data-access/community/community.client';
import type { PostDetail } from '@core/data-access/community/community.types';
import { BookmarkStore } from '@core/social/bookmark.store';
import { ColaAcotada } from '@core/social/cola-acotada';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';
import { PublicPostCard } from '../../public-profile/public-post-card/public-post-card';
import { dePublicacion, type PostVista } from '../../alovida/buscar/feed-publicaciones/feed-publicaciones.vista';

/** Cuántas publicaciones se leen a la vez: las guardadas pueden ser decenas. */
const SIMULTANEAS = 3;

interface FilaGuardada {
  readonly id: string;
  readonly tipo: 'cargando' | 'perdida' | 'datos';
  readonly vista: PostVista | null;
}

type EstadoGuardados = 'carga' | 'datos' | 'vacio' | 'error';

/**
 * «Guardados»: las publicaciones que la persona marcó para leer después.
 *
 * ## De dónde sale
 *
 * `GET /community/bookmarks` trae sólo los **ids** (`BookmarkStore`, la misma
 * fuente que pinta «Guardado» en cada tarjeta). Cada publicación se lee por id
 * (`readPost`), de a pocas, y su autor se resuelve con `ProfileSummaryStore`.
 * La tarjeta es la de siempre: al quitar «Guardar» desde ella la publicación
 * sale de esta lista sola, porque la lista se deriva del store.
 *
 * Una publicación guardada que ya no se puede leer (la borraron o dejó de ser
 * visible) no desaparece en silencio: queda una fila que lo dice y deja
 * quitarla de guardados.
 */
@Component({
  selector: 'app-saved',
  imports: [EmptyState, PublicPostCard, RouterLink],
  templateUrl: './saved.html',
  styleUrl: './saved.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Saved {
  private readonly marcadores = inject(BookmarkStore);
  private readonly community = inject(CommunityClient);
  private readonly resumenes = inject(ProfileSummaryStore);
  private readonly propio = inject(OwnProfileStore);

  /** Detalle leído por id; `null` = se intentó y no se pudo. */
  private readonly detalles = signal<Readonly<Record<string, PostDetail | null>>>({});
  private readonly pedidos = new Set<string>();
  private readonly cola = new ColaAcotada(SIMULTANEAS);

  protected readonly actor = this.propio.id;

  protected readonly estado = computed<EstadoGuardados>(() => {
    if (!this.propio.resuelto() || (this.actor() !== null && !this.marcadores.cargado())) return 'carga';
    if (this.marcadores.fallo()) return 'error';
    return this.marcadores.guardados().length === 0 ? 'vacio' : 'datos';
  });

  protected readonly sinVitrina = computed(() => this.propio.resuelto() && this.actor() === null);

  /** Lo guardado, en el orden en que el servidor lo da, con su detalle si ya llegó. */
  protected readonly filas = computed<readonly FilaGuardada[]>(() =>
    this.marcadores.guardados().map((id) => {
      const detalle = this.detalles()[id];
      if (detalle === undefined) return { id, tipo: 'cargando', vista: null };
      if (detalle === null) return { id, tipo: 'perdida', vista: null };
      const vista: PostVista = dePublicacion(
        detalle,
        new Date(0),
        this.resumenes.resumen(detalle.authorPublicProfileId),
        detalle.media.map((m) => m.fileId),
      );
      return { id, tipo: 'datos', vista };
    }),
  );

  /** Cada id nuevo en el store dispara su lectura, una sola vez. */
  private readonly leerFaltantes = effect(() => {
    const ids = this.marcadores.guardados();
    untracked(() => {
      for (const id of ids) {
        if (this.pedidos.has(id)) continue;
        this.pedidos.add(id);
        this.cola.encolar(() =>
          this.community.readPost(id).pipe(
            tap((p) => this.detalles.update((d) => ({ ...d, [id]: p }))),
            catchError(() => {
              this.detalles.update((d) => ({ ...d, [id]: null }));
              return of(null);
            }),
          ),
        );
      }
    });
  });

  protected quitar(postId: string): void {
    this.marcadores.quitar(postId).subscribe({ error: () => undefined });
  }

  protected reintentar(): void {
    this.marcadores.recargar();
  }
}
