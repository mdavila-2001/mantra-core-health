/**
 * Quién emite la matrícula que habilita a ejercer: **tres** autoridades.
 *
 * ## Por qué tres y no diez
 *
 * El propietario lo pidió el 13/09/2026: «en agregar matrícula solo son 3:
 * Ministerio de Salud, SEDES (Gobernación) y Colegio de la profesión». La lista
 * anterior nombraba uno por uno los nueve colegios del país, y eso obligaba a
 * elegir entre «Colegio Médico» y «Colegio de Psicólogos» a quien ya había
 * dicho su profesión dos pasos antes. El colegio **sale del título**: la opción
 * es una sola, y lo que viaja es el nombre del colegio que corresponde.
 *
 * ## Por qué vive acá
 *
 * Porque la usan el alta de médico y el editor del perfil, y el propietario
 * pidió —muchas veces— que las dos pantallas pregunten lo mismo. Dos copias se
 * separan en el primer cambio.
 *
 * ## Lo que se guarda
 *
 * Texto, no un concepto: `regulatoryAuthority` es un varchar en el backend (ver
 * el comentario largo de `register-practitioner.ts`). Los valores son los
 * nombres oficiales que ya había en la base —«Ministerio de Salud y Deportes»,
 * «Servicio Departamental de Salud (SEDES)», «Colegio Médico de Bolivia»—, así
 * que las matrículas cargadas antes siguen coincidiendo con una opción.
 */

/** Ver `professional-degrees.ts`: `core` no importa tipos de los componentes. */
interface AuthorityOption {
  readonly value: string;
  readonly label: string;
}

export const MINISTRY_AUTHORITY = 'Ministerio de Salud y Deportes';
export const SITES_AUTHORITY = 'Servicio Departamental de Salud (SEDES)';

/** El colegio cuando el título no dice cuál: sin título, o uno sin colegio propio. */
export const PROFESSION_COLLEGE = 'Colegio de la profesión';

export const DOCTOR_COLLEGE = 'Colegio Médico de Bolivia';
export const DENTISTS_COLLEGE = 'Colegio de Odontólogos de Bolivia';

/** El colegio de cada título de `OPCIONES_TITULO_PROFESIONAL` que tiene uno. */
const COLLEGE_BY_TITLE: Readonly<Record<string, string>> = {
  'Médico / Médica': DOCTOR_COLLEGE,
  'Médico especialista / Médica especialista': DOCTOR_COLLEGE,
  'Odontólogo / Odontóloga': DENTISTS_COLLEGE,
  'Licenciado / Licenciada en Enfermería': 'Colegio de Enfermeras de Bolivia',
  'Licenciado / Licenciada en Bioquímica y Farmacia': 'Colegio de Bioquímica y Farmacia de Bolivia',
  'Licenciado / Licenciada en Nutrición': 'Colegio de Nutricionistas y Dietistas de Bolivia',
  'Licenciado / Licenciada en Psicología': 'Colegio de Psicólogos de Bolivia',
  'Licenciado / Licenciada en Fisioterapia y Kinesiología':
    'Colegio de Fisioterapia y Kinesiología de Bolivia',
  'Licenciado / Licenciada en Trabajo Social': 'Colegio de Trabajadores Sociales de Bolivia',
};

const COLLEGES: ReadonlySet<string> = new Set([
  PROFESSION_COLLEGE,
  ...Object.values(COLLEGE_BY_TITLE),
]);

/**
 * El colegio que corresponde a un título profesional.
 *
 * @param titulo - El título tal como está en la lista cerrada.
 * @returns El nombre del colegio, o {@link PROFESSION_COLLEGE} si el título
 *   no tiene uno conocido.
 */
export function titleCollege(titulo: string): string {
  return COLLEGE_BY_TITLE[titulo] ?? PROFESSION_COLLEGE;
}

/** Si una autoridad guardada es alguno de los colegios (y no Ministerio o SEDES). */
export function isCollege(autoridad: string): boolean {
  return COLLEGES.has(autoridad);
}

/**
 * Las tres opciones, con el colegio ya resuelto para ese título.
 *
 * @param titulo - El título profesional elegido; vacío si todavía no hay.
 */
export function optionsRegulatoryAuthority(titulo: string): readonly AuthorityOption[] {
  const colegio = titleCollege(titulo);
  return [
    { value: MINISTRY_AUTHORITY, label: 'Ministerio de Salud' },
    { value: SITES_AUTHORITY, label: 'SEDES (Gobernación)' },
    {
      value: colegio,
      label:
        colegio === PROFESSION_COLLEGE
          ? 'Colegio de la profesión'
          : `Colegio de la profesión (${colegio})`,
    },
  ];
}
