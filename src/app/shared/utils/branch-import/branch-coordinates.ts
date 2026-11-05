/** Map points for the branch import: from map links and from latitud/longitud columns. */

/** Un punto del mapa, en grados decimales. */
export interface BranchCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

/** Número decimal con signo, como lo escriben los mapas: `-17.7833`. */
const DECIMAL = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

/**
 * Los lugares donde un enlace de mapa deja escrito el punto, del más preciso
 * al más aproximado. En Google Maps, `!3d…!4d…` es el lugar marcado y `@…,…` el
 * centro de la vista: si están los dos, manda el lugar.
 */
const COORDINATE_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`!3d${DECIMAL}!4d${DECIMAL}`),
  new RegExp(String.raw`[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?${DECIMAL}(?:,|%2C)\s*${DECIMAL}`, 'i'),
  new RegExp(String.raw`@${DECIMAL},${DECIMAL}`),
  new RegExp(String.raw`[?&]mlat=${DECIMAL}&mlon=${DECIMAL}`, 'i'),
  new RegExp(String.raw`#map=\d{1,2}(?:\.\d+)?/${DECIMAL}/${DECIMAL}`),
  new RegExp(String.raw`^geo:${DECIMAL},${DECIMAL}`, 'i'),
];

/**
 * Las coordenadas que un enlace de mapa trae escritas, o `null`.
 *
 * No se sigue ningún enlace: un acortado (`maps.app.goo.gl/…`) no lleva el
 * punto, y abrirlo desde el navegador pegaría contra la CSP (`connect-src
 * 'self'`) y le avisaría a Google de cada carga. Se guarda el enlace tal cual y
 * el pin se marca a mano.
 */
export function coordinatesFromMapUrl(value: string): BranchCoordinates | null {
  let text = value.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Un `%` suelto no invalida el enlace: se busca sobre el texto crudo.
  }
  for (const pattern of COORDINATE_PATTERNS) {
    const match = pattern.exec(text);
    if (match === null) {
      continue;
    }
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (isLatitude(latitude) && isLongitude(longitude) && !(latitude === 0 && longitude === 0)) {
      return { latitude, longitude };
    }
  }
  return null;
}

function isLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/** Excel in Spanish writes «-17,7690»: a decimal comma is read as a point. */
function parseDegrees(text: string): number {
  return text === '' ? Number.NaN : Number(text.replace(',', '.'));
}

/**
 * The point from the `latitud` and `longitud` columns. Both or none: one alone
 * (or out of range, or not a number) is an error on its row.
 */
export function coordinatesFromColumns(
  latitudeText: string,
  longitudeText: string,
  errors: string[],
): BranchCoordinates | null {
  if (latitudeText === '' && longitudeText === '') {
    return null;
  }
  if (latitudeText === '' || longitudeText === '') {
    errors.push('La latitud y la longitud van juntas: falta una de las dos.');
    return null;
  }
  const latitude = parseDegrees(latitudeText);
  const longitude = parseDegrees(longitudeText);
  if (!isLatitude(latitude) || !isLongitude(longitude)) {
    errors.push('La latitud (-90 a 90) y la longitud (-180 a 180) tienen que ser números decimales.');
    return null;
  }
  return { latitude, longitude };
}
