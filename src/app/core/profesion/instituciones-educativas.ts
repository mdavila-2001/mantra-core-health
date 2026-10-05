/**
 * La forma de una opción, declarada **acá** y no importada de
 * `shared/components/atoms/select`: `core` es una capa por debajo de los
 * componentes y no puede depender de ellos —`check-architecture` lo verifica—.
 * TypeScript compara por estructura, así que esto sigue sirviendo tal cual a un
 * `app-select`.
 */
export interface OpcionDeInstitucion {
  readonly value: string;
  readonly label: string;
  /** Los separadores de grupo: se ven, no se eligen. */
  readonly disabled?: boolean;
  /**
   * Las ciudades donde la universidad tiene sede, la principal primero. Es lo
   * único que ofrece el desplegable «Ciudad de estudio»: la ciudad **sale de
   * la universidad** y no se escribe (propietario, 04/10/2026). Con una sola
   * sede el desplegable queda fijo en ella.
   */
  readonly sedes?: readonly string[];
  /**
   * Qué carreras de grado del área de salud dicta, con los rótulos de
   * {@link AreaDeSalud}. Vacío: ninguna. Es lo que acota las universidades de un
   * título de salud (la UPSA entra por Psicología aunque no tenga Medicina).
   */
  readonly areasDeSalud?: readonly AreaDeSalud[];
  /** De dónde salen `sedes` y `areasDeSalud`: la página oficial consultada. */
  readonly fuentes?: readonly string[];
  /** `false` si algún dato no se pudo confirmar en la fuente oficial. */
  readonly verificado?: boolean;
}

/**
 * Las carreras de grado del área de salud, como rótulos normalizados.
 *
 * Las de cada universidad boliviana se relevaron el 04/10/2026 en su sitio
 * oficial (las URL van en `fuentes` de cada una). «Tecnología Médica» agrupa
 * laboratorio clínico, imagenología y afines cuando la casa de estudios los
 * dicta bajo ese nombre.
 */
export type AreaDeSalud =
  | 'Medicina'
  | 'Odontología'
  | 'Enfermería'
  | 'Bioquímica y Farmacia'
  | 'Psicología'
  | 'Nutrición'
  | 'Fisioterapia y Kinesiología'
  | 'Fonoaudiología'
  | 'Tecnología Médica'
  | 'Veterinaria'
  | 'Trabajo Social';

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
    sedes: ['La Paz', 'Chulumani', 'San Buenaventura', 'Patacamaya', 'Achacachi'],
    areasDeSalud: [
      'Medicina',
      'Enfermería',
      'Nutrición',
      'Tecnología Médica',
      'Fonoaudiología',
      'Odontología',
      'Bioquímica y Farmacia',
      'Psicología',
      'Trabajo Social',
      'Veterinaria',
    ],
    fuentes: [
      'https://www.umsa.bo/en/facultades',
      'https://dsie.umsa.bo/pages/medicina.html',
      'https://umsa.bo/en/web/idru-du/academica',
    ],
  },
  {
    value: 'Universidad Mayor de San Simón',
    label: 'Universidad Mayor de San Simón (UMSS) — Cochabamba',
    sedes: ['Cochabamba', 'Punata', 'Valle del Sacta', 'Arani'],
    areasDeSalud: [
      'Medicina',
      'Fisioterapia y Kinesiología',
      'Nutrición',
      'Odontología',
      'Bioquímica y Farmacia',
      'Psicología',
      'Trabajo Social',
      'Veterinaria',
      'Enfermería',
    ],
    fuentes: [
      'https://websis.umss.edu.bo/umss_carreras.asp?codser=UMSS&idcat=45',
      'https://disu.umss.edu.bo/unid_desconcentradas/',
    ],
    verificado: false,
  },
  {
    value: 'Universidad Mayor Real y Pontificia de San Francisco Xavier de Chuquisaca',
    label: 'Universidad San Francisco Xavier de Chuquisaca (USFX) — Sucre',
    sedes: ['Sucre', 'Monteagudo', 'Muyupampa', 'Camargo'],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Enfermería',
      'Bioquímica y Farmacia',
      'Psicología',
      'Trabajo Social',
      'Fisioterapia y Kinesiología',
      'Nutrición',
      'Tecnología Médica',
      'Veterinaria',
    ],
    fuentes: [
      'https://usfx.bo/grado/',
      'https://eventos.usfx.bo/unidades',
      'https://usfx.bo/2024/08/15/monteagudo-sede-de-la-oferta-academica-de-la-usfx/',
    ],
  },
  {
    value: 'Universidad Autónoma Gabriel René Moreno',
    label: 'Universidad Autónoma Gabriel René Moreno (UAGRM) — Santa Cruz',
    sedes: [
      'Santa Cruz de la Sierra',
      'Montero',
      'Camiri',
      'Yapacaní',
      'San Julián',
      'San Ignacio de Velasco',
      'Vallegrande',
    ],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Enfermería',
      'Bioquímica y Farmacia',
      'Psicología',
      'Veterinaria',
      'Trabajo Social',
    ],
    fuentes: [
      'https://www.uagrm.edu.bo/facultades',
      'https://www.uagrm.edu.bo/facultades/fcsh',
      'https://www.uagrm.edu.bo/facultades/faichi',
    ],
  },
  {
    value: 'Universidad Técnica de Oruro',
    label: 'Universidad Técnica de Oruro (UTO) — Oruro',
    sedes: ['Oruro', 'Challapata', 'Huanuni'],
    areasDeSalud: ['Medicina', 'Enfermería', 'Odontología', 'Nutrición', 'Veterinaria'],
    fuentes: [
      'https://www.uto.edu.bo/facultad-de-ciencias-de-la-salud/',
      'https://www.uto.edu.bo/wp-content/uploads/2025/10/p_veterinaria.pdf',
    ],
    verificado: false,
  },
  {
    value: 'Universidad Autónoma Tomás Frías',
    label: 'Universidad Autónoma Tomás Frías (UATF) — Potosí',
    sedes: ['Potosí', 'Tupiza', 'Uyuni', 'Villazón', 'Uncía'],
    areasDeSalud: ['Medicina', 'Odontología', 'Enfermería', 'Trabajo Social', 'Veterinaria'],
    fuentes: [
      'https://oferta.uatf.edu.bo/pagina_web_carreras/index.html',
      'https://svr4.uatf.edu.bo/carreras/?p=MED',
    ],
  },
  {
    value: 'Universidad Autónoma Juan Misael Saracho',
    label: 'Universidad Autónoma Juan Misael Saracho (UAJMS) — Tarija',
    sedes: ['Tarija', 'Yacuiba', 'Bermejo', 'Villa Montes', 'Entre Ríos'],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Enfermería',
      'Bioquímica y Farmacia',
      'Psicología',
      'Veterinaria',
    ],
    fuentes: [
      'https://www.uajms.edu.bo/oferta-academica/',
      'https://www.uajms.edu.bo/oferta-academica/facultad-de-ciencias-de-la-enfermeria/',
    ],
  },
  {
    value: 'Universidad Autónoma del Beni José Ballivián',
    label: 'Universidad Autónoma del Beni José Ballivián (UABJB) — Beni',
    sedes: ['Trinidad', 'Riberalta', 'Guayaramerín', 'San Borja'],
    areasDeSalud: ['Medicina', 'Enfermería', 'Bioquímica y Farmacia', 'Veterinaria'],
    fuentes: [
      'https://www.uabjb.edu.bo/index.php/facultades',
      'https://uabjb.edu.bo/index.php/bioquimica-y-farmacia',
    ],
  },
  {
    value: 'Universidad Amazónica de Pando',
    label: 'Universidad Amazónica de Pando (UAP) — Pando',
    sedes: ['Cobija'],
    areasDeSalud: [
      'Medicina',
      'Enfermería',
      'Odontología',
      'Bioquímica y Farmacia',
      'Psicología',
      'Trabajo Social',
      'Veterinaria',
    ],
    fuentes: ['https://uap.edu.bo/area-ciencias-de-salud-2/'],
    verificado: false,
  },
  {
    value: 'Universidad Nacional Siglo XX',
    label: 'Universidad Nacional Siglo XX — Llallagua',
    sedes: [
      'Llallagua',
      'Huanuni',
      'Telamayu',
      'Colquiri',
      'Caripuyo',
      'Pocoata',
      'Poopó',
      'Antequera',
      'Mariposas',
    ],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Enfermería',
      'Bioquímica y Farmacia',
      'Tecnología Médica',
      'Fisioterapia y Kinesiología',
    ],
    fuentes: ['https://www.unsxx.bo/'],
  },
  {
    value: 'Universidad Pública de El Alto',
    label: 'Universidad Pública de El Alto (UPEA) — El Alto',
    sedes: ['El Alto'],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Enfermería',
      'Nutrición',
      'Psicología',
      'Trabajo Social',
      'Veterinaria',
    ],
    fuentes: [
      'https://vicerrectorado.upea.bo/admin/controlador_carreras/view_carrera/14',
      'https://psicologia.upea.edu.bo/',
    ],
    verificado: false,
  },
  {
    value: 'Universidad Católica Boliviana San Pablo',
    label: 'Universidad Católica Boliviana San Pablo (UCB)',
    sedes: ['La Paz', 'Cochabamba', 'Santa Cruz de la Sierra', 'Tarija', 'Sucre'],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Enfermería',
      'Psicología',
      'Fisioterapia y Kinesiología',
    ],
    fuentes: [
      'https://www.ucb.edu.bo/sedes-academicas-de-la-ucb/',
      'https://www.ucb.edu.bo/formacion_grado/medicina/',
    ],
  },
  {
    value: 'Escuela Militar de Ingeniería',
    label: 'Escuela Militar de Ingeniería (EMI)',
    sedes: ['La Paz', 'Cochabamba', 'Santa Cruz de la Sierra', 'Riberalta', 'Shinahota'],
    areasDeSalud: [],
    fuentes: ['https://www.emi.edu.bo/universidad'],
  },
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
  {
    value: 'Universidad Privada Boliviana',
    label: 'Universidad Privada Boliviana (UPB)',
    sedes: ['Cochabamba', 'La Paz', 'Santa Cruz de la Sierra'],
    areasDeSalud: ['Psicología'],
    fuentes: [
      'https://www1.upb.edu/es/carreras/psicologia-organizacional-sc-inicio',
      'https://www.upb.edu/',
    ],
  },
  {
    value: 'Universidad Privada del Valle',
    label: 'Universidad Privada del Valle (Univalle)',
    sedes: ['Cochabamba', 'La Paz', 'Sucre', 'Trinidad', 'Santa Cruz de la Sierra'],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Bioquímica y Farmacia',
      'Fisioterapia y Kinesiología',
      'Enfermería',
      'Nutrición',
      'Psicología',
    ],
    fuentes: ['https://www.univalle.edu/?page_id=20293', 'https://www.univalle.edu/?page_id=20109'],
  },
  {
    value: 'Universidad Privada de Santa Cruz de la Sierra',
    label: 'Universidad Privada de Santa Cruz de la Sierra (UPSA)',
    sedes: ['Santa Cruz de la Sierra'],
    areasDeSalud: ['Psicología'],
    fuentes: [
      'https://www.upsa.edu.bo/es/carreras-facultad-de-humanidades-y-comunicacion/psicologia',
    ],
  },
  {
    value: 'Universidad Privada Domingo Savio',
    label: 'Universidad Privada Domingo Savio (UPDS)',
    sedes: [
      'Santa Cruz de la Sierra',
      'Tarija',
      'Potosí',
      'Cochabamba',
      'La Paz',
      'Trinidad',
      'Sucre',
      'Oruro',
      'Cobija',
    ],
    areasDeSalud: [
      'Medicina',
      'Fisioterapia y Kinesiología',
      'Bioquímica y Farmacia',
      'Nutrición',
      'Psicología',
    ],
    fuentes: [
      'https://www.upds.edu.bo/facultad/ciencias-de-la-salud/',
      'https://www.upds.edu.bo/admisiones/nacional/',
    ],
  },
  {
    value: 'Universidad Franz Tamayo',
    label: 'Universidad Franz Tamayo (UNIFRANZ)',
    sedes: ['El Alto', 'La Paz', 'Cochabamba', 'Santa Cruz de la Sierra'],
    areasDeSalud: ['Medicina', 'Odontología', 'Enfermería', 'Bioquímica y Farmacia', 'Psicología'],
    fuentes: ['https://unifranz.edu.bo/'],
  },
  {
    value: 'Universidad Nuestra Señora de La Paz',
    label: 'Universidad Nuestra Señora de La Paz (UNSLP)',
    sedes: ['La Paz'],
    areasDeSalud: ['Medicina', 'Enfermería', 'Fonoaudiología', 'Odontología'],
    fuentes: ['https://unslp.edu.bo/facultades/medicina/'],
  },
  {
    value: 'Universidad Evangélica Boliviana',
    label: 'Universidad Evangélica Boliviana (UEB) — Santa Cruz',
    sedes: ['Santa Cruz de la Sierra'],
    areasDeSalud: [
      'Medicina',
      'Bioquímica y Farmacia',
      'Enfermería',
      'Nutrición',
      'Tecnología Médica',
      'Psicología',
      'Veterinaria',
    ],
    fuentes: ['https://ueb.edu.bo/medicina/'],
  },
  {
    value: 'Universidad Cristiana de Bolivia',
    label: 'Universidad Cristiana de Bolivia (UCEBOL) — Santa Cruz',
    sedes: ['Santa Cruz de la Sierra'],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Fisioterapia y Kinesiología',
      'Bioquímica y Farmacia',
      'Enfermería',
      'Tecnología Médica',
    ],
    fuentes: ['https://www.ucebol.edu.bo/carreras/medicina.aspx'],
  },
  {
    value: 'Universidad NUR',
    label: 'Universidad NUR — Santa Cruz',
    sedes: ['Santa Cruz de la Sierra', 'La Paz'],
    areasDeSalud: ['Fisioterapia y Kinesiología', 'Nutrición', 'Psicología'],
    fuentes: ['https://www.nur.edu/carreras-universitarias/'],
  },
  {
    value: 'Universidad de Aquino Bolivia',
    label: 'Universidad de Aquino Bolivia (UDABOL)',
    sedes: ['La Paz', 'Santa Cruz de la Sierra', 'Cochabamba', 'Oruro'],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Bioquímica y Farmacia',
      'Enfermería',
      'Fisioterapia y Kinesiología',
      'Psicología',
      'Veterinaria',
    ],
    fuentes: ['https://landing.udabol.edu.bo/'],
  },
  {
    value: 'Universidad Técnica Privada Cosmos',
    label: 'Universidad Técnica Privada Cosmos (UNITEPC) — Cochabamba',
    sedes: [
      'Cochabamba',
      'Ivirgarzama',
      'La Paz',
      'El Alto',
      'Santa Cruz de la Sierra',
      'Guayaramerín',
      'Puerto Quijarro',
      'Cobija',
    ],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Enfermería',
      'Veterinaria',
      'Fisioterapia y Kinesiología',
      'Bioquímica y Farmacia',
      'Fonoaudiología',
      'Nutrición',
    ],
    fuentes: ['https://unitepc.edu.bo/sedes-carreras/'],
  },
  {
    value: 'Universidad Salesiana de Bolivia',
    label: 'Universidad Salesiana de Bolivia (USB) — La Paz',
    sedes: ['Montero', 'La Paz', 'Cochabamba', 'San Carlos', 'Camiri', 'Yacuiba'],
    areasDeSalud: ['Psicología'],
    fuentes: ['https://www2.usalesiana.edu.bo/'],
  },
  {
    value: 'Universidad Adventista de Bolivia',
    label: 'Universidad Adventista de Bolivia (UAB) — Cochabamba',
    sedes: ['Vinto'],
    areasDeSalud: [
      'Enfermería',
      'Nutrición',
      'Bioquímica y Farmacia',
      'Psicología',
      'Fisioterapia y Kinesiología',
    ],
    fuentes: ['https://www.uab.edu.bo/la-uab/', 'https://www.uab.edu.bo/bioquimica/'],
  },
  {
    value: 'Universidad San Francisco de Asís',
    label: 'Universidad San Francisco de Asís (USFA) — La Paz',
    sedes: ['La Paz', 'El Alto', 'Tupiza', 'Villazón'],
    areasDeSalud: ['Psicología'],
    fuentes: ['https://www.usfa.edu.bo/pregrado'],
  },
  {
    value: 'Universidad Privada Abierta Latinoamericana',
    label: 'Universidad Privada Abierta Latinoamericana (UPAL)',
    sedes: ['Cochabamba', 'Oruro'],
    areasDeSalud: [
      'Medicina',
      'Odontología',
      'Bioquímica y Farmacia',
      'Psicología',
      'Enfermería',
      'Fisioterapia y Kinesiología',
    ],
    fuentes: ['https://www.upal.edu.bo/en/about-us/'],
  },
  {
    value: 'Universidad Central',
    label: 'Universidad Central (UNICEN) — La Paz',
    sedes: ['Cochabamba', 'La Paz', 'Santa Cruz de la Sierra'],
    areasDeSalud: ['Medicina', 'Fisioterapia y Kinesiología', 'Psicología'],
    fuentes: ['https://unicen.edu.bo/areas/salud/'],
  },
  {
    value: 'Universidad Tecnológica Privada de Santa Cruz',
    label: 'Universidad Tecnológica Privada de Santa Cruz (UTEPSA)',
    sedes: ['Santa Cruz de la Sierra'],
    areasDeSalud: ['Psicología'],
    fuentes: [
      'https://v3.utepsa.edu/index.php/facultades/ciencias-juridicas-sociales-y-humanisticas/psicologia',
    ],
  },
  {
    value: 'Universidad Real de La Paz',
    label: 'Universidad Real de La Paz',
    sedes: ['La Paz'],
    areasDeSalud: [],
    fuentes: ['https://www.ureal.edu.bo/carreras.php'],
  },
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
