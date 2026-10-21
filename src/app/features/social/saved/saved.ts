import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, tap } from 'rxjs';

import { CommunityClient } from '@core/data-access/community/community.client';
import type { PostDetail } from '@core/data-access/community/community.types';
import { BookmarkStore } from '@core/social/bookmark.store';
import { ColaAcotada } from '@core/social/cola-acotada';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';
import { ToastService } from '@shared/components/molecules/toast/toast.service';
import { PublicPostCard } from '../../public-profile/public-post-card/public-post-card';
import { dePublicacion, type PostVista } from '../../alovida/buscar/feed-publicaciones/feed-publicaciones.vista';
import { ReportPost } from '../report-post/report-post';

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
  imports: [EmptyState, PublicPostCard, ReportPost, RouterLink],
  templateUrl: './saved.html',
  styleUrl: './saved.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Saved {
  private readonly marcadores = inject(BookmarkStore);
  private readonly community = inject(CommunityClient);
  private readonly resumenes = inject(ProfileSummaryStore);
  private readonly propio = inject(OwnProfileStore);
  private readonly router = inject(Router);
  private readonly avisos = inject(ToastService);

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

  /* ---- el menú «…» de cada tarjeta: lo mismo que en Inicio ------------- */

  /** Qué publicación se está denunciando; el formulario reemplaza a la tarjeta en su lugar. */
  protected readonly denunciando = signal<string | null>(null);

  protected abrirDenuncia(postId: string): void {
    this.denunciando.set(postId);
  }

  protected cerrarDenuncia(): void {
    this.denunciando.set(null);
  }

  /** «No ver más este tipo de publicaciones»: sin destino todavía (P-01-3). Se avisa en vez de callar. */
  protected pedirOcultar(): void {
    this.avisos.info('Todavía no puede ajustar qué tipo de publicaciones ve. Está en camino.');
  }

  /** «Contactarme con este doctor»: sin destino definido (P-01-1), se manda a la ficha. */
  protected pedirContacto(slug: string): void {
    this.avisos.info('Sus vías de contacto están en su perfil.');
    void this.router.navigate(['/p', slug]);
  }

  protected quitar(postId: string): void {
    this.marcadores.quitar(postId).subscribe({ error: () => undefined });
  }

  protected reintentar(): void {
    this.marcadores.recargar();
  }
}
