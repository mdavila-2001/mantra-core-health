import { inject, RESPONSE_INIT } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';

/**
 * Lo que la ficha pública recibe: el perfil, o la ausencia.
 *
 * `null` cubre **las dos** formas de no haber: el slug no existe y el slug
 * existe pero no está publicado. No las distingue porque el servidor tampoco
 * las distingue —devuelve el mismo 404 con el mismo cuerpo—, y separarlas acá
 * reintroduciría por la pantalla la filtración que el backend evita: «este
 * perfil existe pero es privado» confirma que existe.
 */
export type PerfilPublicoResuelto = PublicProfileDetail | null;

/**
 * Resuelve la ficha **antes** de pintar.
 *
 * ## Por qué un resolver y no una lectura dentro del componente
 *
 * Por el SSR, que es el criterio duro de este carril: el HTML que devuelve el
 * servidor tiene que traer ya el nombre del profesional, no un cascarón que lo
 * pide al hidratar. El router espera al resolver antes de activar la ruta, así
 * que cuando Angular serializa la página el dato ya está adentro.
 *
 * Una lectura disparada desde el componente también mantendría la aplicación
 * inestable mientras la petición viaja, pero deja el primer render con el
 * estado vacío y depende de que nadie ponga un `@defer` o un `untracked` en el
 * medio. El resolver lo vuelve una propiedad de la ruta.
 *
 * ## Por qué un 404 no es un error acá
 *
 * Porque es una respuesta esperada de una URL que cualquiera puede escribir a
 * mano. Dejar que la excepción suba mataría la navegación y mandaría a la
 * pantalla de recuperación —«algo falló, recargá»— cuando lo que pasó es que
 * ese perfil no está. Se convierte en `null` y la pantalla lo cuenta.
 *
 * ## Y por qué igual tiene que ser un 404 de verdad
 *
 * Porque la pantalla amable no alcanza: sin el estado correcto, un rastreador
 * indexa «Ese perfil no está disponible» como una página válida del directorio,
 * y el enlace muerto queda en los resultados de búsqueda repartiendo visitas a
 * una ficha que no existe.
 *
 * `RESPONSE_INIT` es el objeto que el motor de SSR usa para construir la
 * respuesta **después** de renderizar, así que cambiarle el estado durante el
 * render llega a tiempo. Es la vía soportada: no hace falta que
 * `src/server.ts` —zona roja compartida con las otras cuatro máquinas— consulte
 * el slug por su cuenta y duplique la petición a la API.
 *
 * En el navegador el token no existe, y por eso se inyecta `optional`: una
 * navegación del lado del cliente no tiene ninguna respuesta HTTP que marcar.
 */
export const perfilPublicoResolver: ResolveFn<PerfilPublicoResuelto> = (ruta) => {
  const cliente = inject(PublicDirectoryClient);
  // Se resuelve **acá**, dentro del contexto de inyección: el `catchError` de
  // abajo corre después, cuando `inject()` ya no está disponible.
  const respuesta = inject(RESPONSE_INIT, { optional: true });

  const slug = ruta.paramMap.get('slug') ?? '';
  const kind = (ruta.data['kind'] ?? 'PRACTITIONER') as PublicProfileDetail['kind'];

  return cliente.getProfile(kind, slug).pipe(
    catchError(() => {
      if (respuesta !== null) respuesta.status = 404;
      return of(null);
    }),
  );
};
