/* ============================================================================
    El JSON-LD de una ficha pública.

    Es la mitad del carril P4 que no se ve en pantalla: sin datos estructurados
    la ficha aparece en Google como un enlace azul, y con ellos aparece como un
    profesional con su especialidad y su puntuación. La otra mitad —que el HTML
    del servidor ya traiga el nombre— la resuelve el SSR.
    ========================================================================== */

import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';

/**
 * Qué tipo de schema.org declara cada vertical.
 *
 * No son intercambiables y el prefijo de la ruta existe justamente para que no
 * se mezclen: servir una farmacia en `/p/` la anunciaría como `Physician`, que
 * es una afirmación falsa sobre un negocio, no un detalle de metadatos. Por eso
 * la API devuelve 404 en vez de redirigir cuando el slug es de otra clase.
 */
const TIPO_SCHEMA: Readonly<Record<PublicProfileDetail['kind'], string>> = {
  PRACTITIONER: 'Physician',
  ORGANIZATION: 'MedicalOrganization',
  PHARMACY: 'Pharmacy',
  DIAGNOSTIC_UNIT: 'DiagnosticLab',
  INSURER: 'InsuranceAgency',
};

/** El prefijo de ruta corta de cada vertical, para la URL canónica. */
const PREFIJO: Readonly<Record<PublicProfileDetail['kind'], string>> = {
  PRACTITIONER: 'p',
  ORGANIZATION: 'o',
  PHARMACY: 'f',
  DIAGNOSTIC_UNIT: 'l',
  INSURER: 's',
};

/**
 * Arma el JSON-LD de una ficha.
 *
 * ## Lo que no declara
 *
 * **No hay `aggregateRating` sin reseñas.** `ratingCount: 0` es el estado
 * normal de un directorio recién poblado, y schema.org exige `ratingCount`
 * mayor que cero: declarar «0 reseñas, puntuación 0» hace que Google marque el
 * dato como inválido y, peor, publica en el buscador que a este profesional lo
 * calificaron mal cuando nadie lo calificó.
 *
 * **No hay `address` sin calle NI ciudad, ni `geo` sin coordenadas.** Un
 * `PostalAddress` vacío es un resultado de mapa que manda a alguien a ninguna
 * parte. Con una sola de las dos sí se declara: la localidad sola es válida y
 * es media búsqueda de un médico.
 *
 * Todo campo se agrega sólo si tiene valor; no hay claves con `null`.
 *
 * @param perfil - La ficha tal como la sirve la API pública.
 * @param origen - Origen absoluto del sitio, para la URL canónica.
 * @returns El objeto JSON-LD listo para serializar.
 */
export function jsonLdDePerfil(
  perfil: PublicProfileDetail,
  origen: string,
): Record<string, unknown> {
  const datos: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': TIPO_SCHEMA[perfil.kind],
    name: perfil.displayName,
    url: `${origen}/${PREFIJO[perfil.kind]}/${perfil.slug}`,
  };

  if (perfil.headline !== null && perfil.headline !== '') {
    datos['description'] = perfil.headline;
  } else if (perfil.biography !== null && perfil.biography !== '') {
    datos['description'] = perfil.biography.slice(0, 300);
  }

  if (perfil.avatarUrl !== null) datos['image'] = perfil.avatarUrl;

  if (perfil.specialties.length > 0) {
    // `medicalSpecialty` es de `Physician` y `MedicalOrganization`; en los
    // otros tres el mismo dato es el rubro, y va como `knowsAbout`.
    const clave =
      perfil.kind === 'PRACTITIONER' || perfil.kind === 'ORGANIZATION'
        ? 'medicalSpecialty'
        : 'knowsAbout';
    datos[clave] = [...perfil.specialties];
  }

  // **La ciudad sola también cuenta** (B3 del plan de UX del 22/08/2026). Antes
  // hacía falta la calle para declarar nada, así que una ficha que dice
  // «Cochabamba» aparecía en el buscador sin ninguna localidad — y «dónde
  // atiende» es media búsqueda de un médico. Un `addressLocality` sin
  // `streetAddress` es un `PostalAddress` válido; lo que no vale es uno vacío,
  // que manda a alguien a ninguna parte.
  const tieneCalle = perfil.address !== null && perfil.address !== '';
  const tieneCiudad = perfil.city !== null && perfil.city !== '';
  if (tieneCalle || tieneCiudad) {
    const direccion: Record<string, unknown> = { '@type': 'PostalAddress' };
    if (tieneCalle) direccion['streetAddress'] = perfil.address;
    if (tieneCiudad) direccion['addressLocality'] = perfil.city;
    datos['address'] = direccion;
  }

  if (perfil.location !== null) {
    datos['geo'] = {
      '@type': 'GeoCoordinates',
      latitude: perfil.location.lat,
      longitude: perfil.location.lng,
    };
  }

  if (perfil.ratingAverage !== null && perfil.ratingCount > 0) {
    datos['aggregateRating'] = {
      '@type': 'AggregateRating',
      ratingValue: perfil.ratingAverage,
      reviewCount: perfil.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return datos;
}

/**
 * Serializa el JSON-LD para meterlo dentro de un `<script>`.
 *
 * `</script>` dentro de una cadena del JSON cerraría la etiqueta ahí mismo y
 * dejaría el resto del objeto como marcado suelto en la página: es la vía
 * clásica de inyección por un campo de texto que alguien controla, y acá los
 * campos los escribe cada prestador en su propia vitrina. Escapar la barra
 * produce el mismo JSON —`<\/script>` y `</script>` son la misma cadena para
 * cualquier lector— sin cerrar nada.
 */
export function serializarJsonLd(datos: Record<string, unknown>): string {
  return JSON.stringify(datos).replace(/</g, '\\u003c');
}
