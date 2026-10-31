import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, map, of, Subject, switchMap, tap } from 'rxjs';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';

/** Lo que una búsqueda dejó: opciones o el motivo de que no haya podido buscar. */
type Resultado =
  | { readonly ok: true; readonly opciones: readonly ReferenceOption[] }
  | { readonly ok: false; readonly error: string };

/**
 * El buscador de personas de las altas de organización, sub-organización y
 * membresía (`POST /iam/users/search`).
 *
 * Tres cosas que antes cada pantalla resolvía sola, y mal:
 *
 * - **Un error no es un vacío.** Un 403, un 500 o un corte de red se veían
 *   como «Ningún usuario coincide», que manda a buscar otro nombre cuando lo
 *   que falló fue la búsqueda. Ahora `error` dice qué pasó, con el código de
 *   la petición cuando la API lo da (S9), y las opciones quedan vacías.
 * - **La última tecla manda.** `switchMap` cancela la búsqueda anterior: una
 *   respuesta vieja que llega tarde no pisa la de lo que se escribió después.
 * - **Una sola traducción a opciones**, con la pista «Correo sin verificar».
 *
 * Se crea en el inicializador de un campo del componente (usa `inject`).
 *
 * @param limite - Cuántos candidatos trae cada búsqueda.
 */
export function crearBuscadorDePersonas(limite: number) {
  const iam = inject(IamClient);
  const candidatos = signal<readonly ReferenceOption[]>([]);
  const buscando = signal(false);
  const error = signal<string | null>(null);
  const textos = new Subject<string>();

  textos
    .pipe(
      tap(() => error.set(null)),
      switchMap((texto) => {
        if (texto === '') {
          candidatos.set([]);
          buscando.set(false);
          return EMPTY;
        }
        buscando.set(true);
        return iam.searchUsers({ query: texto, limit: limite }).pipe(
          map(
            (pagina): Resultado => ({
              ok: true,
              opciones: pagina.items.map((usuario) => ({
                value: usuario.id,
                label: usuario.displayName,
                ...(usuario.emailVerified ? {} : { hint: 'Correo sin verificar' }),
              })),
            }),
          ),
          catchError((fallo: unknown) => of<Resultado>({ ok: false, error: mensajeDeFallo(fallo) })),
        );
      }),
      takeUntilDestroyed(inject(DestroyRef)),
    )
    .subscribe((resultado) => {
      buscando.set(false);
      candidatos.set(resultado.ok ? resultado.opciones : []);
      error.set(resultado.ok ? null : resultado.error);
    });

  return {
    candidatos: candidatos.asReadonly(),
    buscando: buscando.asReadonly(),
    error: error.asReadonly(),
    buscar: (texto: string) => textos.next(texto),
  };
}

/** El fallo, dicho para la persona, con el código de la petición si lo hay. */
function mensajeDeFallo(fallo: unknown): string {
  const estado = errorToViewState<never>(fallo);
  switch (estado.status) {
    case 'offline':
      return 'No pudimos buscar personas: revise su conexión e intente de nuevo.';
    case 'forbidden':
      return `No pudimos buscar personas: ${estado.message ?? 'su cuenta no tiene permiso para hacerlo.'}`;
    case 'error':
      return `No pudimos buscar personas. Intente de nuevo; si sigue, repórtelo con el código ${estado.requestId}.`;
    case 'validation':
      return `No pudimos buscar personas: ${estado.issues.map((issue) => issue.message).join(' ') || 'revise lo escrito.'}`;
    default:
      return 'No pudimos buscar personas. Intente de nuevo.';
  }
}
