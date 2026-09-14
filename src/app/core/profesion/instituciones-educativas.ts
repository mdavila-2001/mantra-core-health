/**
 * La forma de una opción, declarada **acá** y no importada de
 * `shared/components/atoms/select`: `core` es una capa por debajo de los
 * componentes y no puede depender de ellos —`check-architecture` lo verifica—.
 * TypeScript compara por estructura, así que esto sigue sirviendo tal cual a un
 * `app-select`.
 */
interface OpcionDeInstitucion {
  readonly value: string;
  readonly label: string;
  /** Los separadores de grupo: se ven, no se eligen. */
  readonly disabled?: boolean;
}

/**
 * El valor centinela de «no está en la lista».
 *
 * No es una institución: es la puerta de salida al campo escrito a mano. Va
 * como constante y no como texto suelto para que nadie lo compare contra una
 * cadena tecleada dos veces distinto.
 */
export const INSTITUCION_FUERA_DE_CATALOGO = '__otra__';

/**
 * Las universidades del **Sistema de la Universidad Boliviana** (CEUB): las
 * autónomas públicas más las de régimen especial que el Sistema reconoce como
 * miembros plenos.
 *
 * Son las que emiten título con validez nacional automática, y por eso van
 * primero: es el caso mayoritario de quien se registra acá.
 */
export const UNIVERSIDADES_DEL_SISTEMA: readonly OpcionDeInstitucion[] = [
  {
    value: 'Universidad Mayor de San Andrés',
    label: 'Universidad Mayor de San Andrés (UMSA) — La Paz',
  },
  {
    value: 'Universidad Mayor de San Simón',
    label: 'Universidad Mayor de San Simón (UMSS) — Cochabamba',
  },
  {
    value: 'Universidad Mayor Real y Pontificia de San Francisco Xavier de Chuquisaca',
    label: 'Universidad San Francisco Xavier de Chuquisaca (USFX) — Sucre',
  },
  {
    value: 'Universidad Autónoma Gabriel René Moreno',
    label: 'Universidad Autónoma Gabriel René Moreno (UAGRM) — Santa Cruz',
  },
  { value: 'Universidad Técnica de Oruro', label: 'Universidad Técnica de Oruro (UTO) — Oruro' },
  {
    value: 'Universidad Autónoma Tomás Frías',
    label: 'Universidad Autónoma Tomás Frías (UATF) — Potosí',
  },
  {
    value: 'Universidad Autónoma Juan Misael Saracho',
    label: 'Universidad Autónoma Juan Misael Saracho (UAJMS) — Tarija',
  },
  {
    value: 'Universidad Autónoma del Beni José Ballivián',
    label: 'Universidad Autónoma del Beni José Ballivián (UABJB) — Beni',
  },
  {
    value: 'Universidad Amazónica de Pando',
    label: 'Universidad Amazónica de Pando (UAP) — Pando',
  },
  { value: 'Universidad Nacional Siglo XX', label: 'Universidad Nacional Siglo XX — Llallagua' },
  {
    value: 'Universidad Pública de El Alto',
    label: 'Universidad Pública de El Alto (UPEA) — El Alto',
  },
  {
    value: 'Universidad Católica Boliviana San Pablo',
    label: 'Universidad Católica Boliviana San Pablo (UCB)',
  },
  { value: 'Escuela Militar de Ingeniería', label: 'Escuela Militar de Ingeniería (EMI)' },
];

/**
 * Universidades privadas y centros de formación superior con oferta en salud,
 * bajo autorización del Ministerio de Educación.
 *
 * La lista es la de uso corriente en Bolivia, **no** un padrón importado: ver
 * la nota de {@link OPCIONES_INSTITUCION_EDUCATIVA} sobre de dónde sale y qué
 * la reemplaza.
 */
export const UNIVERSIDADES_PRIVADAS: readonly OpcionDeInstitucion[] = [
  { value: 'Universidad Privada Boliviana', label: 'Universidad Privada Boliviana (UPB)' },
  { value: 'Universidad Privada del Valle', label: 'Universidad Privada del Valle (Univalle)' },
  {
    value: 'Universidad Privada de Santa Cruz de la Sierra',
    label: 'Universidad Privada de Santa Cruz de la Sierra (UPSA)',
  },
  { value: 'Universidad Privada Domingo Savio', label: 'Universidad Privada Domingo Savio (UPDS)' },
  { value: 'Universidad Franz Tamayo', label: 'Universidad Franz Tamayo (UNIFRANZ)' },
  {
    value: 'Universidad Nuestra Señora de La Paz',
    label: 'Universidad Nuestra Señora de La Paz (UNSLP)',
  },
  {
    value: 'Universidad Evangélica Boliviana',
    label: 'Universidad Evangélica Boliviana (UEB) — Santa Cruz',
  },
  {
    value: 'Universidad Cristiana de Bolivia',
    label: 'Universidad Cristiana de Bolivia (UCEBOL) — Santa Cruz',
  },
  { value: 'Universidad NUR', label: 'Universidad NUR — Santa Cruz' },
  { value: 'Universidad de Aquino Bolivia', label: 'Universidad de Aquino Bolivia (UDABOL)' },
  {
    value: 'Universidad Técnica Privada Cosmos',
    label: 'Universidad Técnica Privada Cosmos (UNITEPC) — Cochabamba',
  },
  {
    value: 'Universidad Salesiana de Bolivia',
    label: 'Universidad Salesiana de Bolivia (USB) — La Paz',
  },
  {
    value: 'Universidad Adventista de Bolivia',
    label: 'Universidad Adventista de Bolivia (UAB) — Cochabamba',
  },
  {
    value: 'Universidad San Francisco de Asís',
    label: 'Universidad San Francisco de Asís (USFA) — La Paz',
  },
  {
    value: 'Universidad Privada Abierta Latinoamericana',
    label: 'Universidad Privada Abierta Latinoamericana (UPAL)',
  },
  { value: 'Universidad Central', label: 'Universidad Central (UNICEN) — La Paz' },
  {
    value: 'Universidad Tecnológica Privada de Santa Cruz',
    label: 'Universidad Tecnológica Privada de Santa Cruz (UTEPSA)',
  },
  { value: 'Universidad Real de La Paz', label: 'Universidad Real de La Paz' },
];

/**
 * Las instituciones donde se cursó un título, como lista.
 *
 * ## Por qué dejó de ser texto libre
 *
 * Lo pidió el propietario el 13/09/2026: «Institución debe ser un campo select,
 * no texto, de universidades o centros educativos catalogados como
 * autorizados». Escrito a mano, la misma casa de estudios llegaba como «UMSA»,
 * «U.M.S.A.», «Universidad Mayor de San Andres» y «umsa», y quien verifica un
 * título tiene que reconciliarlas a ojo.
 *
 * ## De dónde sale esta lista, y qué NO es
 *
 * Es una lista **curada a mano** con las universidades del Sistema de la
 * Universidad Boliviana y las privadas de uso corriente con oferta en salud.
 * **No es un padrón importado ni una fuente verificada**: no existe uno en
 * ninguna de las cuatro capas del proyecto —ni value set en la terminología, ni
 * tabla en el modelo, ni endpoint en la API—, y el `issuingInstitutionText` del
 * contrato sigue siendo texto de hasta cien caracteres.
 *
 * Por eso el valor de cada opción es **el nombre**, no un id: lo que viaja al
 * backend es exactamente lo que viajaba antes. El día que exista el catálogo,
 * esto pasa a ser un mapeo y las pantallas lo heredan sin cambiar dónde se
 * guarda la respuesta. Queda anotado en `docs/progress/BLOCKERS.md`.
 *
 * ## Por qué hay una salida a texto libre
 *
 * Porque una lista cerrada de universidades bolivianas deja afuera a cualquiera
 * que se formó en Cuba, Argentina o España —que es justo el caso que este campo
 * abre, y la razón por la que estaba en texto libre—. {@link
 * INSTITUCION_FUERA_DE_CATALOGO} devuelve el campo escrito a mano en vez de
 * negarle la carga del título a quien estudió afuera.
 *
 * Los separadores van como opciones deshabilitadas porque `app-select` monta un
 * `<select>` plano sin `<optgroup>`: se ven, no se eligen, y su valor nunca
 * llega a emitirse.
 */
export const OPCIONES_INSTITUCION_EDUCATIVA: readonly OpcionDeInstitucion[] = [
  { value: '__grupo-sistema__', label: '— Sistema de la Universidad Boliviana —', disabled: true },
  ...UNIVERSIDADES_DEL_SISTEMA,
  { value: '__grupo-privadas__', label: '— Universidades privadas autorizadas —', disabled: true },
  ...UNIVERSIDADES_PRIVADAS,
  { value: '__grupo-otra__', label: '— Otra —', disabled: true },
  {
    value: INSTITUCION_FUERA_DE_CATALOGO,
    label: 'Otra institución o estudié en el exterior…',
  },
];

/**
 * Si una institución ya guardada figura en el catálogo.
 *
 * Los títulos cargados antes de la lista traen textos escritos a mano. El
 * editor **no los borra ni los corrige solo** —mismo criterio que
 * `esTituloDeLaLista`—: los muestra tal cual y deja elegir del catálogo cuando
 * la persona quiera.
 */
export function esInstitucionDelCatalogo(institucion: string): boolean {
  return (
    UNIVERSIDADES_DEL_SISTEMA.some((opcion) => opcion.value === institucion) ||
    UNIVERSIDADES_PRIVADAS.some((opcion) => opcion.value === institucion)
  );
}
