/* ============================================================================
    De una fila del directorio público a la tarjeta que dibuja la maqueta.

    ## Por qué vive en `features` y no junto al cliente, en `core`

    Porque traduce a `SearchResultItem`, que es un tipo del **banco de
    componentes**. `core/data-access` no puede importar de `shared/components`
    —`check-architecture.mjs` lo denuncia, y con razón: la capa que habla con la
    API no debe saber cómo se dibuja una tarjeta, o cambiar la molécula
    obligaría a tocar el cliente—. Acá la dirección es la correcta: una pantalla
    conoce a la vez su dominio y su banco.

    Las seis pantallas de listado pintan la misma tarjeta con datos del mismo
    endpoint; traducir el resultado a `SearchResultItem` en cada una daría seis
    copias de esta función, y la primera que se olvide de omitir la puntuación
    sin reseñas pondrá «0,0 ★» en una ficha de salud.
    ========================================================================== */

import type { SearchResultItem } from '@shared/components/molecules';

import {
  PUBLIC_PROFILE_PREFIX,
  type PublicResultKind,
  type PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';

/** Cómo se rotula cada vertical en la insignia junto al nombre. */
const ROTULO_POR_TIPO: Readonly<Record<PublicResultKind, string>> = {
  PRACTITIONER: 'Profesional',
  ORGANIZATION: 'Organización',
  PHARMACY: 'Farmacia',
  DIAGNOSTIC_UNIT: 'Laboratorio',
  INSURER: 'Aseguradora',
  MEDICATION: 'Medicamento',
};

/** Los tratamientos que no aportan una inicial. */
const TRATAMIENTOS = new Set(['dr', 'dra', 'lic', 'mgr', 'prof', 'sr', 'sra', 'srta']);

/**
 * Las iniciales del cuadrado cuando no hay foto.
 *
 * **El tratamiento no cuenta.** «Dra. Marisol Quispe Ticona» da `MQ` y no `DM`:
 * en un directorio médico casi todos los nombres empiezan con «Dr.» o «Dra.»,
 * así que tomarlo como primera inicial pondría la misma letra en media
 * pantalla y dejaría de distinguir a nadie, que es lo único que las iniciales
 * tienen que hacer.
 */
export function inicialesDe(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(
      (parte) =>
        /^[\p{L}]/u.test(parte) && !TRATAMIENTOS.has(parte.replace(/\./g, '').toLowerCase()),
    )
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * La ruta de la ficha de un resultado.
 *
 * `MEDICATION` **no tiene ficha**: el contrato público sirve cinco prefijos y
 * ninguno es de medicamento —un medicamento vive en el catálogo de farmacia y
 * no en `community.public_profiles`—. Su tarjeta acota el vertical a ese
 * nombre en vez de llevar a una ficha que no existe.
 */
export function rutaDeFicha(resultado: PublicSearchResult): string {
  if (resultado.kind === 'MEDICATION') return '/buscar/medicamentos';
  return `/${PUBLIC_PROFILE_PREFIX[resultado.kind]}/${resultado.slug}`;
}

/** Los parámetros de la tarjeta de un medicamento, que busca y no navega. */
export function consultaDeFicha(
  resultado: PublicSearchResult,
): Record<string, string> | undefined {
  return resultado.kind === 'MEDICATION' ? { q: resultado.displayName } : undefined;
}

/**
 * La puntuación con coma decimal, o `null` cuando todavía no hay reseñas.
 *
 * `ratingCount: 0` con `ratingAverage: null` es el estado normal de un
 * directorio recién poblado, no un error, y pintarlo como «0,0» diría que la
 * atención se calificó mal cuando nadie la calificó todavía.
 */
export function puntuacionDe(resultado: PublicSearchResult): string | null {
  if (resultado.ratingAverage === null || resultado.ratingCount === 0) return null;
  return resultado.ratingAverage.toFixed(1).replace('.', ',');
}

/**
 * Traduce una fila del directorio a la tarjeta de la maqueta.
 *
 * ## Lo que no inventa
 *
 * La maqueta dibuja además precio, disponibilidad horaria, distancia y
 * modalidad. **La API pública no sirve ninguno de esos campos** —`toResult` en
 * `community-public.service.ts` proyecta nueve claves y la lista blanca falla
 * si aparece una más—, así que la tarjeta los omite en vez de rellenarlos con
 * los valores de la maqueta. Un precio inventado en un directorio de salud no
 * es un pendiente de diseño: es alguien que llega con Bs 200 a una consulta de
 * Bs 350.
 *
 * ## El sello dice «Declarado» cuando no está verificado, y no se calla
 *
 * La ficha de V65 lo pide explícitamente: lo declarado se muestra **rotulado**
 * como declarado, nunca mezclado con lo verificado ni escondido. Una tarjeta
 * sin sello se leería como verificada por omisión.
 */
export function aTarjeta(resultado: PublicSearchResult): SearchResultItem {
  const meta: { text: string; iconKey?: string }[] = [];
  if (resultado.headline !== null && resultado.headline !== '') {
    meta.push({ text: resultado.headline, iconKey: 'especialidad' });
  }
  if (resultado.city !== null && resultado.city !== '') {
    meta.push({ text: resultado.city, iconKey: 'lugar' });
  }
  const puntuacion = puntuacionDe(resultado);
  if (puntuacion !== null) {
    meta.push({
      text: `${puntuacion} · ${resultado.ratingCount} ${
        resultado.ratingCount === 1 ? 'reseña' : 'reseñas'
      }`,
      iconKey: 'puntuacion',
    });
  }

  return {
    id: `${resultado.kind}:${resultado.slug}`,
    title: resultado.displayName,
    link: rutaDeFicha(resultado),
    figureText: inicialesDe(resultado.displayName),
    ...(resultado.avatarUrl === null ? {} : { figureImageUrl: resultado.avatarUrl }),
    kind: { label: ROTULO_POR_TIPO[resultado.kind], tone: 'info' },
    meta,
    seals: [
      resultado.verified
        ? { label: 'Verificado', tone: 'ok' as const }
        : { label: 'Declarado', tone: 'neutro' as const },
    ],
  };
}
