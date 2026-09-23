/**
 * El set de íconos de un servicio del catálogo.
 *
 * ## Por qué no reusa `SpecialtyIconName`
 *
 * Porque responden preguntas distintas. El set de especialidades contesta
 * «¿de qué se ocupa este médico?» —cardiología, pediatría—, y el catálogo de
 * una práctica no lista especialidades: lista **lo que se hace y se cobra**.
 * Una práctica de cardiología ofrece la consulta, el electrocardiograma, el
 * ecocardiograma y el control post-operatorio, y con el set de especialidades
 * las cuatro llevarían el mismo corazón. Eso es exactamente lo que el
 * encabezado de `specialty-icon.types.ts` prohíbe: «un ícono aporta una cosa,
 * reconocer sin leer; repetido no aporta nada, peor, miente».
 *
 * Tampoco reusa `NavIconName`, que contesta «¿qué sección es esta?».
 *
 * Así que es un vocabulario aparte —el cuarto dibujado a mano del
 * repositorio— con la misma regla adentro: **un dibujo por clase de servicio,
 * y que diga algo que su etiqueta no dice ya**.
 *
 * ## Por qué se resuelve desde el nombre y no desde el `serviceConceptId`
 *
 * Porque el nombre es lo único que siempre está. `serviceConceptId` es
 * opcional en `ServiceCatalogItem` y viene vacío en todo lo que se dio de alta
 * a mano —que es la mayoría de un catálogo recién armado—, así que un mapa por
 * concepto dejaría sin ícono justo a las tarjetas escritas por el profesional.
 * El `code` tampoco sirve: es del catálogo de cada práctica y no significa
 * nada fuera de ella.
 *
 * Resolver por palabra clave tolera los nombres compuestos que trae el arancel
 * («Ecografía abdominal», «Consulta de control»), y degrada a `general` en vez
 * de romper cuando llega un servicio que el set no conoce. Un catálogo que
 * crezca no deja huecos: deja el ícono genérico, que es el comportamiento
 * correcto para un texto que escribe cada práctica y no este archivo.
 */
export const SERVICE_ICON_NAMES = [
  'consulta',
  'teleconsulta',
  'control',
  'laboratorio',
  'imagen',
  'ecografia',
  'procedimiento',
  'vacuna',
  'odontologia',
  'terapia',
  'internacion',
  'enfermeria',
  'certificado',
  /** El de los que el set todavía no dibuja. Nunca un hueco. */
  'general',
] as const;

export type ServiceIconName = (typeof SERVICE_ICON_NAMES)[number];

/**
 * Las palabras que identifican cada clase de servicio, en orden de prueba.
 *
 * El orden importa donde una palabra contiene a otra, y acá hay tres pares que
 * se pisan:
 *
 * - `teleconsulta` va **antes** que `consulta`, porque la contiene entera.
 * - `odontologia` va antes que `procedimiento` y que `terapia`, para que
 *   «Extracción dental» y «Limpieza dental» no caigan en el bisturí.
 * - `control` va antes que `consulta`, para que «Consulta de control» —que
 *   tiene las dos— caiga siempre del mismo lado.
 *
 * Se prueban en el orden de esta lista y gana la primera que coincide.
 */
const CLAVES: readonly (readonly [ServiceIconName, readonly string[]])[] = [
  ['teleconsulta', ['teleconsulta', 'telemedicina', 'videoconsulta', 'virtual', 'a distancia', 'online', 'remota']],
  ['odontologia', ['odontolog', 'dental', 'ortodon', 'endodon', 'periodon', 'caries', 'muela', 'profilaxis', 'bucal']],
  ['ecografia', ['ecograf', 'ecocardio', 'ultrason', 'doppler']],
  ['imagen', ['radiograf', 'rayos x', 'tomograf', 'resonancia', 'mamograf', 'densitometr', 'radiolog', 'imagenolog']],
  ['laboratorio', ['laborat', 'analisis', 'hemograma', 'hemocultiv', 'urocultiv', 'bioquimic', 'serolog', 'biopsia', 'citolog', 'muestra', 'perfil lipid', 'glucemia', 'orina']],
  ['vacuna', ['vacun', 'inmuniz', 'inyect', 'inyecc', 'infiltra']],
  ['procedimiento', ['cirug', 'quirurg', 'operacion', 'procedimiento', 'sutura', 'drenaje', 'cauteriz', 'endoscop', 'colonoscop', 'extirpa', 'legrado']],
  ['terapia', ['terapia', 'kinesio', 'fisioter', 'rehabilit', 'sesion', 'psicolog', 'fonoaud', 'nutricional', 'masaje']],
  ['internacion', ['internacion', 'hospitaliz', 'dia cama', 'estadia', 'observacion', 'quirofano', 'sala de']],
  ['enfermeria', ['enfermer', 'curacion', 'vendaje', 'suero', 'nebuliz', 'signos vitales', 'presion arterial', 'toma de muestra']],
  ['certificado', ['certificad', 'informe', 'constancia', 'apto medic', 'carnet', 'junta medica', 'peritaje', 'dictamen', 'receta']],
  ['control', ['control', 'seguimiento', 'chequeo', 'revision', 'postoperator', 'post operator', 'preventiv']],
  // «Cita médica» es el nombre del servicio que toda práctica trae de fábrica:
  // sin `cita` acá, la única tarjeta que se ve en un catálogo recién creado
  // sería justo la del ícono genérico.
  ['consulta', ['consulta', 'cita', 'visita', 'atencion', 'valoracion', 'evaluacion', 'interconsulta', 'primera vez']],
];

/**
 * Quita tildes y baja a minúsculas, para que «Ecografía» y «ecografia» sean la
 * misma palabra.
 *
 * `NFD` + descartar los diacríticos es la vía sin dependencias: separa la
 * letra de su tilde y borra la tilde. Sin esto, media tabla no coincidiría
 * nunca —los nombres del arancel vienen acentuados y las claves de acá no— y
 * el fallo sería mudo: todos los servicios con el ícono genérico.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * El ícono de un servicio, por su nombre.
 *
 * @param nombre - El `name` de `ServiceCatalogItem`: lo escribe cada práctica
 *   o lo trae el arancel al importar. Puede venir vacío.
 * @returns El nombre del ícono; `general` cuando ninguna clave coincide, que
 *   es el caso normal para un servicio que la práctica inventó y no un error.
 */
export function iconoDeServicio(nombre: string | null | undefined): ServiceIconName {
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
