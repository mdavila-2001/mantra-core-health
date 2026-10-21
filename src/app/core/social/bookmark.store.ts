import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { catchError, defer, finalize, map, type Observable, of, throwError } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import { OwnProfileStore } from './own-profile.store';

const PAGINA = 100;
const TOPE_DE_PAGINAS = 50;

/**
 * Qué publicaciones guardó la persona con sesión.
 *
 * Misma idea que `FollowStore`: la lista de marcadores es **una lectura aparte**
 * y la fila de acciones de cada tarjeta necesita saber, por publicación, si
 * está guardada. Pedirla por tarjeta serían N lecturas; acá se lee una vez y
 * todas las tarjetas, más la pantalla de «Guardados», miran el mismo conjunto.
 *
 * Guardar de nuevo algo ya guardado responde 409 en la API; para quien guarda
 * es éxito —lo que quería ya es verdad— y no un error que mostrar. Sólo se
 * guardan publicaciones (`bookmarkableType: 'POST'`).
 */
@Injectable({ providedIn: 'root' })
export class BookmarkStore {
  private readonly community = inject(CommunityClient);
  private readonly propio = inject(OwnProfileStore);

  private readonly ids = signal<ReadonlySet<string>>(new Set());
  private readonly enCurso = signal<ReadonlySet<string>>(new Set());

  readonly cargado = signal(false);
  readonly fallo = signal(false);

  /** Los ids de las publicaciones guardadas, para armar la pantalla de «Guardados». */
  readonly guardados = computed<readonly string[]>(() => [...this.ids()]);

  private lectura = 0;

  private readonly alCambiarElPerfil = effect(() => {
    const id = this.propio.id();
    untracked(() => (id === null ? this.olvidar() : this.cargar(id)));
  });

  /**
   * ¿Está guardada? `null` mientras no se leyó el conjunto: «no se sabe» no es
   * «no está guardada», y el botón no debe afirmar ninguna de las dos cosas.
   */
  estaGuardada(postId: string): boolean | null {
    if (!this.cargado() || this.fallo()) return null;
    return this.ids().has(postId);
  }

  ocupado(postId: string): boolean {
    return this.enCurso().has(postId);
  }

  guardar(postId: string): Observable<void> {
    return defer(() => {
      const actor = this.propio.id();
      if (actor === null || this.ocupado(postId)) {
        return throwError(() => new Error('No se puede guardar ahora.'));
      }

      this.marcarOcupado(postId, true);
      this.agregar(postId);

      return this.community
        .bookmark({ profileId: actor, bookmarkableType: 'POST', bookmarkableRefId: postId })
        .pipe(
          map(() => undefined),
          catchError((error: unknown) =>
            esConflicto(error) ? of(undefined) : this.revertir(postId, false, error),
          ),
          finalize(() => this.marcarOcupado(postId, false)),
        );
    });
  }

  quitar(postId: string): Observable<void> {
    return defer(() => {
      const actor = this.propio.id();
      if (actor === null || this.ocupado(postId)) {
        return throwError(() => new Error('No se puede quitar ahora.'));
      }

      this.marcarOcupado(postId, true);
      this.sacar(postId);

      return this.community
        .unbookmark({ profileId: actor, bookmarkableType: 'POST', bookmarkableRefId: postId })
        .pipe(
          map(() => undefined),
          catchError((error: unknown) => this.revertir(postId, true, error)),
          finalize(() => this.marcarOcupado(postId, false)),
        );
    });
  }

  /** Vuelve a leer el conjunto (la pantalla de «Guardados» lo hace al abrirse). */
  recargar(): void {
    const actor = this.propio.id();
    if (actor !== null) this.cargar(actor);
  }

  private cargar(actor: string): void {
    const esta = ++this.lectura;
    this.cargado.set(false);
    this.fallo.set(false);
    this.leerPagina(actor, esta, undefined, new Set(), 0);
  }

  private leerPagina(
    actor: string,
    esta: number,
    cursor: string | undefined,
    acumulado: Set<string>,
    paginas: number,
  ): void {
    this.community
      .listBookmarks({ profileId: actor, limit: PAGINA, ...(cursor === undefined ? {} : { cursor }) })
      .subscribe({
        next: (pagina) => {
          if (esta !== this.lectura) return;
          for (const marcador of pagina.items) acumulado.add(marcador.bookmarkableRefId);

          if (pagina.nextCursor !== null && paginas + 1 < TOPE_DE_PAGINAS) {
            this.leerPagina(actor, esta, pagina.nextCursor, acumulado, paginas + 1);
            return;
          }
          this.ids.update((actuales) => new Set([...acumulado, ...actuales]));
          this.cargado.set(true);
        },
        error: () => {
          if (esta !== this.lectura) return;
          this.fallo.set(true);
          this.cargado.set(true);
        },
      });
  }

  private olvidar(): void {
    this.lectura += 1;
    this.ids.set(new Set());
    this.enCurso.set(new Set());
    this.cargado.set(false);
    this.fallo.set(false);
  }

  private agregar(postId: string): void {
    this.ids.update((actuales) => new Set(actuales).add(postId));
  }

  private sacar(postId: string): void {
    this.ids.update((actuales) => {
      const siguiente = new Set(actuales);
      siguiente.delete(postId);
      return siguiente;
    });
  }

  private revertir(postId: string, habiaGuardado: boolean, error: unknown): Observable<never> {
    if (habiaGuardado) this.agregar(postId);
    else this.sacar(postId);
    return throwError(() => error);
  }

  private marcarOcupado(postId: string, ocupado: boolean): void {
    this.enCurso.update((actuales) => {
      const siguiente = new Set(actuales);
      if (ocupado) siguiente.add(postId);
      else siguiente.delete(postId);
      return siguiente;
    });
  }
}

function esConflicto(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}
