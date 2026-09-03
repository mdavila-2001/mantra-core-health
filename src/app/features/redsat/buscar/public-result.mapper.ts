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
import { inicialesDe } from '@shared/text/iniciales';

import type { CentroAtributo, CentroTarjeta } from './centro-card/centro-card.types';
import {
  PUBLIC_PROFILE_PREFIX,
  type PublicResultKind,
  type PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';

// Se reexporta porque las pantallas del buscador la importan de acá desde el
// carril P4. La implementación se mudó a `shared/text` al descubrirse que el
// directorio de médicos tenía una copia que no descartaba el tratamiento.
export { inicialesDe } from '@shared/text/iniciales';

/** Cómo se rotula cada vertical en la insignia junto al nombre. */
const ROTULO_POR_TIPO: Readonly<Record<PublicResultKind, string>> = {
  PRACTITIONER: 'Profesional',
  ORGANIZATION: 'Organización',
  PHARMACY: 'Farmacia',
  DIAGNOSTIC_UNIT: 'Laboratorio',
  INSURER: 'Aseguradora',
  MEDICATION: 'Medicamento',
};

/**
 * La ruta de la ficha de un resultado.
 *
 * `MEDICATION` **no tiene ficha**: el contrato público sirve cinco prefijos y
 * ninguno es de medicamento —un medicamento vive en el catálogo de farmacia y
 * no en `community.public_profiles`—. Su tarjeta acota el vertical a ese
 * nombre en vez de llevar a una ficha que no existe.
 */
export function rutaDeFicha(resultado: PublicSearchResult): string {
  if (resultado.kind === 'MEDICATION') return '/search/medications';
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

/* ============================================================================
    La otra forma del mismo resultado: la tarjeta con portada de un centro.
    ========================================================================== */

/**
 * Dónde queda, en la forma en que se lee: la calle primero y la ciudad
 * después.
 *
 * Devuelve `null` cuando no hay ninguna de las dos, y **no** escribe «Sin
 * dirección»: una línea que dice que falta un dato ocupa el mismo lugar que la
 * que lo trae, y en una grilla de veinte tarjetas eso es veinte veces el mismo
 * aviso inútil.
 */
export function dondeQueda(resultado: PublicSearchResult): string | null {
  const partes = [resultado.address, resultado.city].filter(
    (parte): parte is string => parte !== null && parte !== '',
  );
  return partes.length === 0 ? null : partes.join(' · ');
}

/**
 * El día del próximo turno, en la forma corta que entra en una tarjeta.
 *
 * `nextAvailableDate` llega truncada a día **a propósito**: la hora exacta
 * cambia entre que se pinta y se toca. El rótulo dice «desde» por lo mismo —no
 * promete ese horario, dice a partir de cuándo hay.
 */
function turnoDe(resultado: PublicSearchResult): string | null {
  if (!resultado.hasPublishedAgenda) return null;
  if (resultado.nextAvailableDate === null) return 'Con agenda publicada';

  // `YYYY-MM-DD` partido a mano y no `new Date(cadena)`: esa cadena se
  // interpreta como UTC y en Bolivia (-4) el 1 de marzo se dibujaría como el
  // 29 de febrero. Es el mismo error que ya costó un día en las recetas.
  const [anio, mes, dia] = resultado.nextAvailableDate.split('-').map(Number);
  if (!anio || !mes || !dia) return 'Con agenda publicada';
  const fecha = new Date(anio, mes - 1, dia);
  const corta = fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
  return `Turno desde el ${corta}`;
}

/**
 * Traduce una fila del directorio a la tarjeta con portada de un centro.
 *
 * ## Lo que no inventa, otra vez
 *
 * Un portal de inmuebles pone precio, superficie y antigüedad en la tarjeta.
 * El equivalente en salud —cuánto sale la consulta, cuánto se espera, qué
 * aseguradoras tiene en convenio— la API pública **no lo sirve**: `toResult`
 * en `community-public.service.ts` proyecta una lista blanca de claves y hay
 * una prueba que falla si aparece una de más. Así que esos atributos no se
 * pintan. Un precio de relleno en un directorio de salud no es un pendiente de
 * diseño: es alguien que llega con Bs 200 a una consulta de Bs 350.
 */
export function aCentro(resultado: PublicSearchResult): CentroTarjeta {
  const atributos: CentroAtributo[] = [];

  const puntuacion = puntuacionDe(resultado);
  if (puntuacion !== null) {
    atributos.push({
      clave: 'puntuacion',
      texto: `${puntuacion} (${resultado.ratingCount})`,
      etiqueta: `${puntuacion} de 5, sobre ${resultado.ratingCount} ${
        resultado.ratingCount === 1 ? 'reseña' : 'reseñas'
      }`,
    });
  }

  const turno = turnoDe(resultado);
  if (turno !== null) atributos.push({ clave: 'turno', texto: turno });

  return {
    id: `${resultado.kind}:${resultado.slug}`,
    nombre: resultado.displayName,
    link: rutaDeFicha(resultado),
    titular: resultado.headline === '' ? null : resultado.headline,
    donde: dondeQueda(resultado),
    portada: resultado.coverUrl,
    logo: resultado.avatarUrl,
    iniciales: inicialesDe(resultado.displayName),
    // El sello dice «Declarado» cuando no está verificado, y no se calla: una
    // tarjeta sin sello se leería como verificada por omisión.
    sellos: [
      resultado.verified
        ? { texto: 'Verificado', tono: 'ok' as const }
        : { texto: 'Declarado', tono: 'neutro' as const },
    ],
    atributos,
  };
}
