import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, type Observable, of, switchMap, tap } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import type { PublicProfileKind } from '../data-access/community/community.types';
import { PublicDirectoryClient } from '../data-access/public-directory/public-directory.client';
import {
  PUBLIC_PROFILE_PREFIX,
  type PublicProfileDetail,
} from '../data-access/public-directory/public-directory.types';
import { ColaAcotada } from './cola-acotada';

/**
 * Lo mínimo para pintar a una persona en una lista: nombre, titular, foto y a
 * dónde lleva su nombre.
 */
export interface ResumenDePerfil {
  readonly id: string;
  readonly slug: string;
  readonly kind: PublicProfileKind;
  readonly displayName: string;
  readonly headline: string | null;
  /** `null` si no tiene foto o no se pudo leer: la lista pinta sus iniciales. */
  readonly avatarUrl: string | null;
  /** La ficha pública, o `null` si no tiene (un paciente no la publica). */
  readonly enlace: readonly string[] | null;
}

/** Cuántas lecturas de perfil pueden estar en vuelo a la vez. */
const SIMULTANEAS = 4;

/**
 * Resuelve «quién es este perfil» a partir de su id, con caché.
 *
 * ## Para qué existe
 *
 * Varias lecturas del contrato traen **sólo el id** de una persona: a quién
 * sigo (`listFollows`), qué actor generó un aviso, quién publicó en el feed
 * personal (`FeedListItem.post`). Mostrar «Perfil 64902038» no sirve a nadie, y
 * lo correcto —que el backend incluya el resumen en cada lectura— es una
 * brecha de la API registrada en el plan. Mientras tanto se resuelve acá,
 * **una vez por persona y por sesión**, nunca una vez por tarjeta.
 *
 * ## Cómo
 *
 * `GET /community/profiles/:id` da el slug, el tipo y el nombre; la foto y el
 * titular salen de la ficha pública (`GET /public/profiles/:prefijo/:slug`),
 * que es la que trae una URL de imagen utilizable. Si la segunda lectura falla
 * se muestra lo que ya se sabe (nombre sin foto): degradar es mejor que perder
 * a la persona de la lista.
 *
 * Las lecturas se encolan de a {@link SIMULTANEAS} (`ColaAcotada`): abrir «Mi red» con
 * cincuenta seguidos no puede disparar cien peticiones en el mismo instante.
 */
@Injectable({ providedIn: 'root' })
export class ProfileSummaryStore {
  private readonly community = inject(CommunityClient);
  private readonly directorio = inject(PublicDirectoryClient);

  /** `undefined` = no pedido; `null` = pedido y no se pudo; objeto = resuelto. */
  private readonly resumenes = signal<Readonly<Record<string, ResumenDePerfil | null>>>({});

  private readonly pedidos = new Set<string>();

  /** `slug` → id del perfil; `null` si no se pudo resolver, `undefined` si no se pidió. */
  private readonly idsPorSlug = signal<Readonly<Record<string, string | null>>>({});
  private readonly slugsPedidos = new Set<string>();

  private readonly cola = new ColaAcotada(SIMULTANEAS);

  /**
   * El resumen de un perfil. Lee una señal: en una plantilla o un `computed`
   * se actualiza solo cuando llega. La primera llamada para un id dispara la
   * lectura.
   *
   * @returns El resumen; `null` si se intentó y no se pudo; `undefined` mientras se resuelve.
   */
  resumen(perfilId: string): ResumenDePerfil | null | undefined {
    const conocido = this.resumenes()[perfilId];
    if (conocido === undefined && !this.pedidos.has(perfilId)) {
      this.pedidos.add(perfilId);
      // Se difiere: `resumen()` se llama dentro de una plantilla y escribir una
      // señal durante el render es un error de Angular.
      queueMicrotask(() =>
        this.cola.encolar(() =>
          this.leer(perfilId).pipe(
            tap((resumen) => this.resumenes.update((actuales) => ({ ...actuales, [perfilId]: resumen }))),
          ),
        ),
      );
    }
    return conocido;
  }

  /**
   * El id del perfil que tiene este `slug`.
   *
   * La superficie pública identifica a las personas por `slug` y **no expone
   * ids internos**; pero seguir, guardar o escribirle a alguien exige su id.
   * Se resuelve con `GET /community/profiles/by-slug/:slug`, una vez por slug.
   *
   * @returns El id; `null` si se intentó y no se pudo; `undefined` mientras se resuelve.
   */
  idPorSlug(slug: string): string | null | undefined {
    const conocido = this.idsPorSlug()[slug];
    if (conocido === undefined && !this.slugsPedidos.has(slug)) {
      this.slugsPedidos.add(slug);
      queueMicrotask(() =>
        this.cola.encolar(() =>
          this.community.readProfileBySlug(slug).pipe(
            map((perfil) => perfil.id),
            catchError(() => of(null)),
            tap((id) => this.idsPorSlug.update((actuales) => ({ ...actuales, [slug]: id }))),
          ),
        ),
      );
    }
    return conocido;
  }

  /** Guarda un resumen que ya se conoce por otro lado (el propio perfil, un autor del feed público). */
  registrar(resumen: ResumenDePerfil): void {
    this.pedidos.add(resumen.id);
    this.resumenes.update((actuales) => ({ ...actuales, [resumen.id]: resumen }));
    this.idsPorSlug.update((actuales) => ({ ...actuales, [resumen.slug]: resumen.id }));
  }

  private leer(perfilId: string): Observable<ResumenDePerfil | null> {
    return this.community.readProfile(perfilId).pipe(
      switchMap((base) => {
        const kind: PublicProfileKind = base.kind ?? 'PRACTITIONER';
        const resumenBase: ResumenDePerfil = {
          id: perfilId,
          slug: base.slug,
          kind,
          displayName: base.displayName,
          headline: base.headline ?? null,
          avatarUrl: null,
          enlace: enlaceDe(kind, base.slug),
        };

        if (kind === 'PATIENT') {
          return of(resumenBase);
        }
        return this.directorio.getProfile(kind, base.slug).pipe(
          map((ficha: PublicProfileDetail) => ({
            ...resumenBase,
            headline: ficha.headline ?? resumenBase.headline,
            avatarUrl: ficha.avatarUrl,
          })),
          catchError(() => of(resumenBase)),
        );
      }),
      catchError(() => of(null)),
    );
  }
}

/** La ficha pública de un perfil, o `null` si su vertical no la publica. */
export function enlaceDe(kind: PublicProfileKind, slug: string): readonly string[] | null {
  if (kind === 'PATIENT') return null;
  return [`/${PUBLIC_PROFILE_PREFIX[kind]}`, slug];
}
