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

  /** El error de la última lectura, para que la pantalla muestre el código de soporte (M34 S9). */
  readonly error = signal<unknown>(null);

  /** A cuántos sigue. */
  readonly total = computed(() => this.ids().size);

  /** Los ids que sigue, para listarlos en «Mi red». */
  readonly seguidos = computed<readonly string[]>(() => [...this.ids()]);

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

  /** ¿Sigue a este perfil? Lee una señal: se puede usar en `computed` y en plantillas. */
  sigue(perfilId: string): boolean {
    return this.ids().has(perfilId);
  }

  /**
   * Lo mismo que {@link sigue} pero en tres estados: `null` mientras no se leyó
   * o si la lectura falló. Con `null` nadie puede afirmar «no lo sigue»: puede
   * que sí. Es la regla de `BookmarkStore.estaGuardada`.
   */
  estado(perfilId: string): boolean | null {
    if (!this.cargado() || this.fallo()) return null;
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
      .listFollows({ followerProfileId: actor, limit: PAGINA, ...(cursor === undefined ? {} : { cursor }) })
      .subscribe({
        next: (pagina) => {
          if (esta !== this.lectura) return;
          for (const seguimiento of pagina.items) acumulado.add(seguimiento.followableRefId);

          if (pagina.nextCursor !== null && paginas + 1 < TOPE_DE_PAGINAS) {
            this.leerPagina(actor, esta, pagina.nextCursor, acumulado, paginas + 1);
            return;
          }
          // Manda lo leído; lo que la persona cambió mientras se leía, encima.
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

  private agregar(perfilId: string): void {
    this.cambiosEnLectura.set(perfilId, true);
    this.ids.update((actuales) => new Set(actuales).add(perfilId));
  }

  private quitar(perfilId: string): void {
    this.cambiosEnLectura.set(perfilId, false);
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
