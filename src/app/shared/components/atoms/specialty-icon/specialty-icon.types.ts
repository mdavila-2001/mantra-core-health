/**
 * El set de íconos de especialidad médica.
 *
 * ## Por qué no reusa `NavIconName`
 *
 * Porque el set del nav responde «¿qué sección es esta?» y está cerrado a esa
 * pregunta: tiene `stethoscope`, `heart`, `pill` y `scan`, y nada más que sea
 * clínico. Repartir dieciocho especialidades sobre esos cuatro dibujos deja
 * catorce repetidas —cardiología y neumología con el mismo corazón, urología y
 * endocrinología con la misma cápsula— y eso es exactamente lo que el
 * encabezado de `nav-icon.types.ts` prohíbe: «un ícono aporta una cosa,
 * reconocer sin leer; repetido no aporta nada, peor, miente».
 *
 * Así que es un vocabulario aparte, con la misma regla adentro: **un dibujo por
 * especialidad, y que diga algo que su etiqueta no dice ya**. Es el tercer set
 * dibujado a mano del repositorio, junto al del nav y al del glosario.
 *
 * ## Por qué el nombre se resuelve desde el texto y no desde el `conceptId`
 *
 * Porque las dos pantallas que los dibujan reciben cosas distintas: la portada
 * del directorio de médicos tiene el `display` del catálogo, y el agrupador del
 * listado público parte el titular del perfil —texto libre— por `·`. Un mapa
 * por `conceptId` serviría sólo a la primera, y la segunda quedaría sin ícono
 * justo donde más se nota.
 *
 * Resolver por palabra clave cubre las dos, tolera los nombres compuestos
 * («Ginecología y obstetricia», «Traumatología y ortopedia») y degrada a
 * `general` en vez de romper cuando llega una especialidad que el set no
 * conoce. Un catálogo que crezca no deja huecos: deja el ícono genérico, que es
 * el comportamiento correcto para un dato que viene de terminología y no de
 * este archivo.
 */
export const SPECIALTY_ICON_NAMES = [
  'cardiologia',
  'pediatria',
  'ginecologia',
  'dermatologia',
  'traumatologia',
  'medicina-interna',
  'neurologia',
  'psiquiatria',
  'oftalmologia',
  'odontologia',
  'endocrinologia',
  'gastroenterologia',
  'neumologia',
  'urologia',
  'nutricion',
  'fisioterapia',
  'anestesiologia',
  'oncologia',
  'otorrinolaringologia',
  'hematologia',
  /** El de las que el set todavía no dibuja. Nunca un hueco. */
  'general',
] as const;

export type SpecialtyIconName = (typeof SPECIALTY_ICON_NAMES)[number];

/**
 * Las palabras que identifican cada especialidad, en orden de prueba.
 *
 * El orden importa donde una raíz es prefijo de otra: `neumo` va antes que
 * `neuro` no por casualidad —no lo es— pero `oftalmo` sí tiene que ir antes que
 * cualquier regla que capture `oto`, y `traumato` antes que `ortoped` para que
 * «Traumatología y ortopedia» caiga siempre del mismo lado. Se prueban en el
 * orden de esta lista y gana la primera que coincide.
 */
const CLAVES: readonly (readonly [SpecialtyIconName, readonly string[]])[] = [
  ['cardiologia', ['cardio']],
  ['pediatria', ['pediatr', 'neonat']],
  ['ginecologia', ['gineco', 'obstetr', 'matern']],
  ['dermatologia', ['dermat', 'piel']],
  ['traumatologia', ['traumat', 'ortoped', 'osteo']],
  ['neumologia', ['neumo', 'respirat', 'pulmon']],
  ['neurologia', ['neuro']],
  ['psiquiatria', ['psiqui', 'psicol', 'salud mental']],
  ['oftalmologia', ['oftalmo', 'ocular', 'vision', 'optometr']],
  ['odontologia', ['odonto', 'dental', 'bucal', 'estomatolog']],
  ['endocrinologia', ['endocrin', 'diabet', 'tiroid']],
  ['gastroenterologia', ['gastro', 'digestiv', 'hepat', 'proctolog']],
  ['urologia', ['urolog', 'nefrolog', 'renal']],
  ['nutricion', ['nutric', 'diet', 'aliment']],
  ['fisioterapia', ['fisioter', 'kinesio', 'rehabilit']],
  ['anestesiologia', ['anestes', 'dolor']],
  ['oncologia', ['oncolog', 'tumor', 'cancer']],
  ['otorrinolaringologia', ['otorrin', 'audio', 'foniatr']],
  ['hematologia', ['hematolog', 'sangre', 'transfus']],
  ['medicina-interna', ['medicina interna', 'internist', 'infectolog', 'geriatr', 'reumatolog']],
];

/**
 * Quita tildes y baja a minúsculas, para que «Cardiología» y «cardiologia»
 * sean la misma palabra.
 *
 * `NFD` + descartar los diacríticos es la vía sin dependencias: separa la letra
 * de su tilde y borra la tilde. Sin esto, media tabla no coincidiría nunca —los
 * nombres del catálogo vienen acentuados y las claves de acá no—, y el fallo
 * sería mudo: todas las especialidades con el ícono genérico.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * El ícono de una especialidad, por su nombre.
 *
 * @param nombre - El `display` del catálogo, o el trozo de titular que el
 *   listado público usa como encabezado de grupo. Puede venir vacío.
 * @returns El nombre del ícono; `general` cuando ninguna clave coincide, que
 *   es el caso normal para una especialidad nueva del catálogo y no un error.
 */
export function iconoDeEspecialidad(nombre: string | null | undefined): SpecialtyIconName {
  if (nombre === null || nombre === undefined) {
    return 'general';
  }
  const texto = normalizar(nombre);
  for (const [icono, claves] of CLAVES) {
    if (claves.some((clave) => texto.includes(clave))) {
      return icono;
    }
  }
  return 'general';
}
