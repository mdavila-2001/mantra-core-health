import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { catchError, defer, finalize, map, type Observable, of, throwError } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import { OwnProfileStore } from './own-profile.store';

/** Cuántos seguimientos se piden por página al armar el conjunto. */
const PAGINA = 100;

/** Tope de páginas: un bucle de cursor que no termina no puede colgar la sesión. */
const TOPE_DE_PAGINAS = 50;

/**
 * A quién sigue la persona con sesión — la única fuente del estado «Siguiendo».
 *
 * ## Una lectura, tres superficies
 *
 * El botón «Seguir» aparece en la cabecera de cada publicación, en la ficha
 * pública, en las sugerencias y en «Mi red». Si cada uno preguntara por su
 * cuenta serían decenas de lecturas; si cada uno guardara su propia copia, uno
 * diría «Siguiendo» y el de al lado «Seguir» para la misma persona. Este store
 * lee `GET /community/follows` **una vez** y las tres superficies miran el
 * mismo conjunto.
 *
 * ## La escritura es optimista y vuelve atrás
 *
 * Seguir es un gesto liviano y reversible, no un dato clínico: el botón cambia
 * al tocarlo y, si el servidor rechaza, vuelve a como estaba y avisa. Seguir a
 * quien ya se seguía (409) es éxito: el estado que se quería ya es el que hay.
 *
 * Sólo se siguen perfiles (`followableType: 'PROFILE'`). Los seguimientos de
 * temas o grupos que traiga la lectura quedan en el conjunto —sus ids son
 * uuids y no chocan con los de un perfil—, pero ninguna superficie los ofrece.
 */
@Injectable({ providedIn: 'root' })
export class FollowStore {
  private readonly community = inject(CommunityClient);
  private readonly propio = inject(OwnProfileStore);

  private readonly ids = signal<ReadonlySet<string>>(new Set());

  /** Los perfiles con una escritura en vuelo: el botón se bloquea mientras tanto (sin doble envío). */
  private readonly enCurso = signal<ReadonlySet<string>>(new Set());

  /** `true` cuando ya se leyó el conjunto; antes, «no sigue a nadie» sería una afirmación falsa. */
  readonly cargado = signal(false);

  readonly fallo = signal(false);

  /** A cuántos sigue. */
  readonly total = computed(() => this.ids().size);

  /** Los ids que sigue, para listarlos en «Mi red». */
  readonly seguidos = computed<readonly string[]>(() => [...this.ids()]);

  private lectura = 0;

  private readonly alCambiarElPerfil = effect(() => {
    const id = this.propio.id();
    untracked(() => (id === null ? this.olvidar() : this.cargar(id)));
  });

  /** ¿Sigue a este perfil? Lee una señal: se puede usar en `computed` y en plantillas. */
  sigue(perfilId: string): boolean {
    return this.ids().has(perfilId);
  }

  /** ¿Hay una escritura en vuelo para este perfil? */
  ocupado(perfilId: string): boolean {
    return this.enCurso().has(perfilId);
  }

  /**
   * Sigue a un perfil. Falla con el error del servidor tras volver el estado atrás.
   *
   * Es perezoso (`defer`): el cambio optimista ocurre al suscribirse, no al
   * llamar. Un `seguir()` que nadie suscribe no puede dejar el botón diciendo
   * «Siguiendo» sin haber mandado nada.
   */
  seguir(perfilId: string): Observable<void> {
    return defer(() => {
      const actor = this.propio.id();
      if (actor === null || this.ocupado(perfilId)) {
        return throwError(() => new Error('No se puede seguir ahora.'));
      }
      if (this.sigue(perfilId)) {
        return of(undefined);
      }

      this.marcarOcupado(perfilId, true);
      this.agregar(perfilId);

      return this.community
        .follow({ followerProfileId: actor, followableType: 'PROFILE', followableRefId: perfilId })
        .pipe(
          map(() => undefined),
          // 409: ya lo seguía; el estado deseado ya es el real.
          catchError((error: unknown) =>
            esConflicto(error) ? of(undefined) : this.revertir(perfilId, false, error),
          ),
          finalize(() => this.marcarOcupado(perfilId, false)),
        );
    });
  }

  /** Deja de seguir a un perfil. Misma regla: perezoso, optimista, con reversa. */
  dejarDeSeguir(perfilId: string): Observable<void> {
    return defer(() => {
      const actor = this.propio.id();
      if (actor === null || this.ocupado(perfilId)) {
        return throwError(() => new Error('No se puede dejar de seguir ahora.'));
      }
      if (!this.sigue(perfilId)) {
        return of(undefined);
      }

      this.marcarOcupado(perfilId, true);
      this.quitar(perfilId);

      return this.community
        .unfollow({ followerProfileId: actor, followableType: 'PROFILE', followableRefId: perfilId })
        .pipe(
          map(() => undefined),
          catchError((error: unknown) => this.revertir(perfilId, true, error)),
          finalize(() => this.marcarOcupado(perfilId, false)),
        );
    });
  }

  /** Vuelve a leer a quién sigue (el reintento de «Mi red» tras un fallo). */
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
      .listFollows({ followerProfileId: actor, limit: PAGINA, ...(cursor === undefined ? {} : { cursor }) })
      .subscribe({
        next: (pagina) => {
          if (esta !== this.lectura) return;
          for (const seguimiento of pagina.items) acumulado.add(seguimiento.followableRefId);

          if (pagina.nextCursor !== null && paginas + 1 < TOPE_DE_PAGINAS) {
            this.leerPagina(actor, esta, pagina.nextCursor, acumulado, paginas + 1);
            return;
          }
          // Lo que se siguió mientras se leía no se pierde: se une al leído.
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

  private agregar(perfilId: string): void {
    this.ids.update((actuales) => new Set(actuales).add(perfilId));
  }

  private quitar(perfilId: string): void {
    this.ids.update((actuales) => {
      const siguiente = new Set(actuales);
      siguiente.delete(perfilId);
      return siguiente;
    });
  }

  private revertir(perfilId: string, habiaSeguido: boolean, error: unknown): Observable<never> {
    if (habiaSeguido) this.agregar(perfilId);
    else this.quitar(perfilId);
    return throwError(() => error);
  }

  private marcarOcupado(perfilId: string, ocupado: boolean): void {
    this.enCurso.update((actuales) => {
      const siguiente = new Set(actuales);
      if (ocupado) siguiente.add(perfilId);
      else siguiente.delete(perfilId);
      return siguiente;
    });
  }
}

function esConflicto(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}
