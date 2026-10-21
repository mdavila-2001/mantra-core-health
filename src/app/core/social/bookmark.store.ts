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

  /** El error de la última lectura, para que la pantalla muestre el código de soporte (M34 S9). */
  readonly error = signal<unknown>(null);

  /** Los ids de las publicaciones guardadas, para armar la pantalla de «Guardados». */
  readonly guardados = computed<readonly string[]>(() => [...this.ids()]);

  private lectura = 0;

  /**
   * Lo que la persona cambió **mientras** se leía el conjunto (id → `true` alta,
   * `false` baja). Al terminar la lectura manda lo leído más estos cambios: así
   * no se pierde un gesto hecho a mitad de lectura, y un id que el servidor ya
   * no tiene (una baja hecha en otra pestaña) sale de verdad.
   */
  private cambiosEnLectura = new Map<string, boolean>();

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
    this.cambiosEnLectura.clear();
    this.cargado.set(false);
    this.fallo.set(false);
    this.error.set(null);
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
          const leidos = new Set(acumulado);
          for (const [id, alta] of this.cambiosEnLectura) {
            if (alta) leidos.add(id);
            else leidos.delete(id);
          }
          this.cambiosEnLectura.clear();
          this.ids.set(leidos);
          this.cargado.set(true);
        },
        error: (error: unknown) => {
          if (esta !== this.lectura) return;
          this.fallo.set(true);
          this.error.set(error);
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
    this.error.set(null);
  }

  private agregar(postId: string): void {
    this.cambiosEnLectura.set(postId, true);
    this.ids.update((actuales) => new Set(actuales).add(postId));
  }

  private sacar(postId: string): void {
    this.cambiosEnLectura.set(postId, false);
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
