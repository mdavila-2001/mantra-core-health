/* ============================================================================
    Zonas horarias por país (registro de aseguradora — códigos y zona horaria).

    La mayoría de los países del mundo tienen una sola hora civil oficial: ahí
    no hay nada que preguntar, se asigna en segundo plano. Un puñado —por
    tamaño o por historia— reparte su territorio en varias zonas IANA reales, y
    obligar a uno solo de esos husos sería tan equivocado como no preguntar
    nada: una aseguradora con casa matriz en Los Ángeles no opera en horario de
    Nueva York.

    Este catálogo declara las dos formas: un país con una sola entrada es de
    zona única (`esPaisMultizona` da `false`); un país con varias es multizona,
    y la primera marcada `isDefault` es la que se preselecciona —la capital o
    la zona de mayor población, no la primera por orden alfabético—.

    Alcance: los cinco países que el registro de aseguradora puede elegir
    (`legal-entity-types.dictionary.ts`: BO · BR · US · AR · MX) más los que
    pide el catálogo de referencia del enunciado, para que un país nuevo en el
    selector de constitución ya tenga zona horaria resuelta el día que se
    agregue. Las etiquetas están en castellano, como el resto del copy de esta
    pantalla (`uiLanguage` es fijo `'es'`; el diccionario trilingüe de tipos
    societarios es terminología jurídica, no aplica acá).

    Los IANA de EE. UU., México, Rusia y Australia se verificaron contra la
    zona horaria real de cada territorio citado —no contra la ciudad más
    grande del país—: Arizona no observa horario de verano y por eso tiene su
    propio `America/Phoenix` distinto de `America/Denver`; Sinaloa y Baja
    California Sur son `America/Mazatlan`, no `America/Hermosillo` (Sonora);
    Omsk es su propia zona (`Asia/Omsk`), no la de Novosibirsk; y Brisbane
    (Queensland, sin horario de verano) y Darwin (Territorio del Norte) son
    zonas propias, no la de Sydney ni la de Adelaide.
    ========================================================================== */

/** Una zona horaria ofrecida para un país multizona. */
export interface ZonaHorariaOpcion {
  /** El identificador IANA (`America/La_Paz`), lo único que viaja al backend. */
  readonly iana: string;
  /** Lo que ve la persona en el selector. */
  readonly label: string;
  /** La que se preselecciona. Cada país tiene exactamente una. */
  readonly isDefault?: boolean;
}

/** El catálogo, indexado por el ISO-3166 alpha-2 del país de constitución. */
export const ZONAS_HORARIAS_MUNDIALES_POR_PAIS: Readonly<
  Record<string, readonly ZonaHorariaOpcion[]>
> = {
  // --- Zona única -----------------------------------------------------------
  BO: [
    { iana: 'America/La_Paz', label: 'Bolivia · Hora Oficial (America/La_Paz, UTC-4)', isDefault: true },
  ],
  AR: [
    {
      iana: 'America/Argentina/Buenos_Aires',
      label: 'Argentina · Hora Oficial (Buenos Aires, UTC-3)',
      isDefault: true,
    },
  ],
  CL: [{ iana: 'America/Santiago', label: 'Chile · Santiago (UTC-4)', isDefault: true }],
  CO: [{ iana: 'America/Bogota', label: 'Colombia · Bogotá (UTC-5)', isDefault: true }],
  PE: [{ iana: 'America/Lima', label: 'Perú · Lima (UTC-5)', isDefault: true }],
  UY: [{ iana: 'America/Montevideo', label: 'Uruguay · Montevideo (UTC-3)', isDefault: true }],
  PY: [{ iana: 'America/Asuncion', label: 'Paraguay · Asunción (UTC-4)', isDefault: true }],
  ES: [{ iana: 'Europe/Madrid', label: 'España · Madrid (UTC+1)', isDefault: true }],
  FR: [{ iana: 'Europe/Paris', label: 'Francia · París (UTC+1)', isDefault: true }],
  DE: [{ iana: 'Europe/Berlin', label: 'Alemania · Berlín (UTC+1)', isDefault: true }],
  GB: [{ iana: 'Europe/London', label: 'Reino Unido · Londres (UTC+0)', isDefault: true }],
  IT: [{ iana: 'Europe/Rome', label: 'Italia · Roma (UTC+1)', isDefault: true }],
  JP: [{ iana: 'Asia/Tokyo', label: 'Japón · Tokio (UTC+9)', isDefault: true }],
  CN: [{ iana: 'Asia/Shanghai', label: 'China · Hora Oficial de Pekín (UTC+8)', isDefault: true }],
  ZA: [{ iana: 'Africa/Johannesburg', label: 'Sudáfrica · Johannesburgo (UTC+2)', isDefault: true }],
  EG: [{ iana: 'Africa/Cairo', label: 'Egipto · El Cairo (UTC+2)', isDefault: true }],

  // --- Multizona --------------------------------------------------------------
  US: [
    {
      iana: 'America/New_York',
      label: 'Hora del Este / Eastern (Nueva York, Florida, Washington D.C.)',
      isDefault: true,
    },
    { iana: 'America/Chicago', label: 'Hora del Centro / Central (Texas, Illinois, Chicago)' },
    { iana: 'America/Denver', label: 'Hora de la Montaña / Mountain (Colorado, Denver)' },
    { iana: 'America/Phoenix', label: 'Hora de Arizona (sin horario de verano)' },
    { iana: 'America/Los_Angeles', label: 'Hora del Pacífico / Pacific (California, Los Ángeles, Seattle)' },
    { iana: 'America/Anchorage', label: 'Hora de Alaska (Anchorage)' },
    { iana: 'Pacific/Honolulu', label: 'Hora de Hawái (Honolulu)' },
  ],
  BR: [
    { iana: 'America/Sao_Paulo', label: 'Brasilia / São Paulo / Río de Janeiro (UTC-3)', isDefault: true },
    { iana: 'America/Manaus', label: 'Amazonas / Manaus (UTC-4)' },
    { iana: 'America/Cuiaba', label: 'Mato Grosso / Cuiabá (UTC-4)' },
    { iana: 'America/Rio_Branco', label: 'Acre / Rio Branco (UTC-5)' },
  ],
  MX: [
    {
      iana: 'America/Mexico_City',
      label: 'Zona Centro / CDMX, Guadalajara, Monterrey (UTC-6)',
      isDefault: true,
    },
    { iana: 'America/Tijuana', label: 'Zona Noroeste / Tijuana, Baja California (UTC-8)' },
    { iana: 'America/Hermosillo', label: 'Zona Pacífico / Sonora (UTC-7)' },
    { iana: 'America/Mazatlan', label: 'Zona Pacífico / Sinaloa, Nayarit, Baja California Sur (UTC-7)' },
    { iana: 'America/Cancun', label: 'Zona Sureste / Cancún, Quintana Roo (UTC-5)' },
  ],
  RU: [
    { iana: 'Europe/Moscow', label: 'Hora de Moscú / San Petersburgo (MSK, UTC+3)', isDefault: true },
    { iana: 'Asia/Yekaterinburg', label: 'Urales / Yekaterinburg (MSK+2, UTC+5)' },
    { iana: 'Asia/Omsk', label: 'Omsk (MSK+3, UTC+6)' },
    { iana: 'Asia/Novosibirsk', label: 'Siberia Occidental / Novosibirsk (MSK+4, UTC+7)' },
    { iana: 'Asia/Krasnoyarsk', label: 'Siberia Central / Krasnoyarsk (MSK+4, UTC+7)' },
    { iana: 'Asia/Irkutsk', label: 'Irkutsk / Baikal (MSK+5, UTC+8)' },
    { iana: 'Asia/Vladivostok', label: 'Lejano Oriente / Vladivostok (MSK+7, UTC+10)' },
  ],
  CA: [
    { iana: 'America/Toronto', label: 'Eastern / Toronto, Montreal, Ottawa (UTC-5)', isDefault: true },
    { iana: 'America/Winnipeg', label: 'Central / Winnipeg (UTC-6)' },
    { iana: 'America/Edmonton', label: 'Mountain / Calgary, Edmonton (UTC-7)' },
    { iana: 'America/Vancouver', label: 'Pacific / Vancouver (UTC-8)' },
    { iana: 'America/Halifax', label: 'Atlantic / Halifax (UTC-4)' },
  ],
  AU: [
    { iana: 'Australia/Sydney', label: 'Eastern / Sydney, Melbourne (AEST/AEDT)', isDefault: true },
    { iana: 'Australia/Brisbane', label: 'Eastern sin horario de verano / Brisbane, Queensland (AEST)' },
    { iana: 'Australia/Adelaide', label: 'Central / Adelaide (ACST/ACDT)' },
    { iana: 'Australia/Darwin', label: 'Central sin horario de verano / Darwin (ACST)' },
    { iana: 'Australia/Perth', label: 'Western / Perth (AWST)' },
  ],
};

/** El huso que se asigna cuando un país no está en el catálogo: Bolivia. */
const ZONA_DEFECTO = 'America/La_Paz';

/** Las zonas horarias que ofrece un país. Un ISO desconocido cae en zona única `America/La_Paz`. */
export function obtenerZonasHorariasDePais(countryIso: string): readonly ZonaHorariaOpcion[] {
  const normalizado = countryIso.trim().toUpperCase();
  return (
    ZONAS_HORARIAS_MUNDIALES_POR_PAIS[normalizado] ?? [
      { iana: ZONA_DEFECTO, label: 'Hora Oficial', isDefault: true },
    ]
  );
}

/** La zona preseleccionada de un país: la marcada `isDefault`, o la primera si ninguna lo está. */
export function obtenerZonaHorariaDefectoDePais(countryIso: string): string {
  const zonas = obtenerZonasHorariasDePais(countryIso);
  return (zonas.find((zona) => zona.isDefault) ?? zonas[0]).iana;
}

/** Si el país reparte su territorio en más de una zona horaria real. */
export function esPaisMultizona(countryIso: string): boolean {
  return obtenerZonasHorariasDePais(countryIso).length > 1;
}
