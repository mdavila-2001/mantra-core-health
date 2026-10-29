import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, from, map, mergeMap } from 'rxjs';

import { AuthzAdminClient } from '../../../core/data-access/authz-admin/authz-admin.client';

/** Cuántas lecturas de nombre viajan a la vez: las de una página, no las de la tabla entera. */
const LECTURAS_SIMULTANEAS = 4;

/**
 * El nombre visible de las personas de una lista que sólo trae `userId`.
 *
 * ## Por qué hace falta
 *
 * `GET /tenants/{id}/memberships` devuelve el identificador de la cuenta y
 * nada más: una fila «0b1c…» no le dice a nadie quién es. La API no ofrece
 * una lectura en lote de nombres, así que se resuelve **de a una por cuenta
 * visible** (`GET /iam/users/{id}`), de a cuatro, y una sola vez por cuenta.
 *
 * ## Lo que NO hace
 *
 * - **No inventa un nombre.** Esa lectura la autoriza `SECURITY_ADMIN`; para
 *   cualquier otro rol responde 403, y la cuenta queda sin nombre. La pantalla
 *   lo dice («Nombre no disponible») en vez de mostrar el uuid como si fuera
 *   un dato. Un fallo de una cuenta no frena a las demás.
 * - **No reintenta.** Una cuenta que falló no se vuelve a pedir en cada
 *   página: el 403 de una es el 403 de todas.
 *
 * Se crea en el inicializador de un campo del componente (usa `inject`).
 */
export function crearResolvedorDeNombres() {
  const authz = inject(AuthzAdminClient);
  const destroyRef = inject(DestroyRef);
  const nombres = signal<ReadonlyMap<string, string>>(new Map());
  const intentadas = new Set<string>();

  return {
    /** Nombre de cada cuenta que se pudo leer, por su `userId`. */
    nombres: nombres.asReadonly(),

    /** Pide los nombres de las cuentas que todavía no se intentaron. */
    resolver(userIds: readonly string[]): void {
      const pendientes = [...new Set(userIds)].filter((id) => !intentadas.has(id));
      if (pendientes.length === 0) {
        return;
      }
      for (const id of pendientes) {
        intentadas.add(id);
      }

      from(pendientes)
        .pipe(
          mergeMap(
            (id) =>
              authz.displayNameOf(id).pipe(
                map((nombre) => [id, nombre] as const),
                // Sin nombre no es sin fila: la cuenta queda fuera del mapa.
                catchError(() => EMPTY),
              ),
            LECTURAS_SIMULTANEAS,
          ),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe(([id, nombre]) =>
          nombres.update((actuales) => new Map(actuales).set(id, nombre)),
        );
    },
  };
}
