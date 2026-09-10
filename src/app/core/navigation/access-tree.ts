/* ============================================================================
    El árbol de accesos — cómo se reparten las secciones del panel en zonas.

    ## Qué problema resuelve

    «Tus accesos» pintaba **todas** las secciones que la sesión alcanza, una al
    lado de la otra. Para un paciente eran ocho y se leía bien; para quien
    atiende son treinta y dos, y para quien administra pasan de cuarenta. Una
    rejilla de cuarenta íconos no es un panel: es un cajón de sastre donde
    encontrar «Evoluciones» cuesta más que buscarlo en el menú lateral.

    El reparto de acá corta ese muro en **cinco zonas como mucho**. La primera
    pantalla responde una sola pregunta —«¿a qué vine hoy?»— y recién adentro
    de la zona aparece el detalle.

    ## Por qué el reparto vive en `core/` y no en el componente

    Por lo mismo que {@link APP_SECTIONS}: si el reparto lo decidiera la
    plantilla, una sección nueva del registro no caería en ninguna zona y
    **desaparecería del panel sin que nada fallara**. Acá cada grupo del menú
    tiene dueño declarado, y `access-tree.spec.ts` no deja agregar un grupo sin
    darle uno.
    ========================================================================== */

import { NAV_GROUPS, type AppSection, type NavGroup, type NavIconName } from './navigation.types';

/**
 * Cuántas zonas puede haber en la primera pantalla.
 *
 * Cinco es el pedido literal del cliente y además el techo razonable: es lo que
 * se abarca de un vistazo sin recorrer con el dedo. No es un `slice` sobre una
 * lista más larga —eso escondería zonas en silencio— sino un límite que
 * `access-tree.spec.ts` hace cumplir sobre {@link ACCESS_AREAS}.
 */
export const MAXIMO_DE_ZONAS = 5;

/**
 * El tono de una zona, del vocabulario de estado del sistema de diseño.
 *
 * Son los nombres de `--st-*`, y esa es toda la decisión: esas parejas
 * fondo/tinta ya están medidas contra WCAG por `scripts/check-contrast.mjs` y
 * ya tienen su versión de tema oscuro. Inventar un color por zona habría
 * significado cinco parejas nuevas sin medir, que en oscuro es exactamente
 * donde se rompen.
 */
export const ACCESS_AREA_TONES = ['info', 'secondary', 'primary', 'success', 'warning'] as const;
export type AccessAreaTone = (typeof ACCESS_AREA_TONES)[number];

/** Una zona del árbol, tal como se declara. */
export interface AccessArea {
  /** Identificador estable: viaja en `data-zona` y en el foco de vuelta. */
  readonly id: string;

  /** Cómo se llama en la tarjeta. En primera persona: es el panel de quien entra. */
  readonly label: string;

  /** Qué hay adentro, en una línea. Es lo que evita tener que abrirla para saberlo. */
  readonly tagline: string;

  readonly icon: NavIconName;

  readonly tone: AccessAreaTone;

  /**
   * Las secciones que caen acá **sí o sí**, en el orden en que se muestran.
   *
   * Gana sobre {@link catchAllGroups} de cualquier zona: «Chats» es del grupo
   * `General` y su lugar es «Pacientes y equipo», no el cajón de lo general. Que ninguna
   * ruta esté declarada en dos zonas lo comprueba la prueba del registro.
   */
  readonly paths: readonly string[];

  /**
   * Grupos del menú cuyas secciones **sobrantes** caen acá.
   *
   * Es la red de seguridad: una sección nueva en `navigation.map.ts` aparece en
   * su zona sola, sin tocar este archivo. Entre las cinco zonas cubren los
   * cinco grupos exactamente una vez, y eso lo hace cumplir la prueba.
   */
  readonly catchAllGroups: readonly NavGroup[];
}

/**
 * Secciones que el árbol no ofrece nunca.
 *
 * Hoy sólo el panel: ofrecer «Panel» dentro del panel es un enlace a la
 * pantalla en la que ya estás, y ocupaba un lugar de los treinta y dos.
 */
export const SECCIONES_FUERA_DEL_ARBOL: readonly string[] = ['dashboard'];

/**
 * Las zonas, en el orden en que se dibujan.
 *
 * El orden es el del día de trabajo: primero lo que se hace con un paciente
 * delante, después con quién se hace, después la red de afuera, después lo que
 * sostiene la práctica, y al final lo propio. «Mi cuenta» va última por la
 * misma razón por la que va última en {@link NAV_GROUPS}: mezclar «mis datos»
 * con «los datos que administro» es lo que hace que alguien edite el registro
 * equivocado.
 */
export const ACCESS_AREAS: readonly AccessArea[] = [
  {
    id: 'consulta',
    label: 'Consultas',
    tagline: 'Tu agenda, tus evoluciones, tus estudios y los formularios de cada atención.',
    icon: 'stethoscope',
    tone: 'info',
    paths: [
      'schedule',
      'progress-notes',
      'medical-records',
      'diagnostics',
      'interventions',
      'form-builder',
      'questionnaires',
    ],
    catchAllGroups: ['Atención'],
  },
  {
    id: 'gente',
    label: 'Pacientes y equipo',
    tagline: 'A quién atendés y con quién trabajás: pacientes, equipo y conversaciones.',
    icon: 'people',
    tone: 'secondary',
    paths: ['messaging', 'groups', 'administration/patients', 'administration/users'],
    // Sin cajón propio a propósito: «Pacientes y equipo» reúne secciones de tres grupos
    // distintos, así que no puede ser el destino por omisión de ninguno.
    catchAllGroups: [],
  },
  {
    id: 'red',
    label: 'Directorios',
    tagline: 'A dónde derivar y a quién: clínicas, laboratorios y farmacias de la plataforma.',
    icon: 'globe',
    tone: 'primary',
    paths: ['directory', 'clinics-directory', 'laboratory-directory', 'pharmacies-directory'],
    catchAllGroups: ['General'],
  },
  {
    id: 'organizacion',
    label: 'Administración',
    tagline: 'Lo que sostiene tu práctica: sedes, cobros, catálogos y permisos.',
    icon: 'building',
    tone: 'success',
    paths: [
      'administration/my-organization',
      'administration/medical-organization',
      'administration/accounting',
      'billing',
    ],
    catchAllGroups: ['Administración', 'Facturación'],
  },
  {
    id: 'cuenta',
    label: 'Mi cuenta',
    tagline: 'Tus datos, tus turnos, tus avisos y tu identidad verificada.',
    icon: 'patients',
    tone: 'warning',
    paths: ['my-account', 'notification-center', 'my-account/identity', 'tutorials'],
    catchAllGroups: ['Mi cuenta'],
  },
];

/** Una zona ya resuelta contra la sesión: la declaración más lo que le tocó. */
export interface AccessAreaView {
  readonly area: AccessArea;

  /** Lo que la sesión alcanza de esta zona: primero lo que existe, después lo planificado. */
  readonly sections: readonly AppSection[];

  /** Cuántas de esas ya tienen pantalla. Es la cifra que se muestra en la tarjeta. */
  readonly disponibles: number;
}

/**
 * Reparte las secciones visibles de una sesión en las zonas del árbol.
 *
 * Dos pasadas y no una: las rutas declaradas en {@link AccessArea.paths} tienen
 * que ganarle al cajón de **cualquier** zona, no sólo al de las que vienen
 * después. Con una sola pasada el resultado dependería del orden en que están
 * escritas las zonas, que es la clase de acoplamiento que nadie recuerda al
 * reordenarlas.
 *
 * Una zona sin nada adentro **no se devuelve**: un rótulo vacío le dice a la
 * persona que hay algo que no puede ver, que es justo lo que el filtrado por
 * roles quería evitar.
 *
 * @param sections - Las secciones que la sesión puede abrir (`visibleSections`).
 * @returns Las zonas con contenido, en el orden de {@link ACCESS_AREAS}.
 */
export function buildAccessTree(sections: readonly AppSection[]): readonly AccessAreaView[] {
  const candidatas = sections.filter((s) => !SECCIONES_FUERA_DEL_ARBOL.includes(s.path));
  const porRuta = new Map(candidatas.map((s) => [s.path, s]));
  const reclamadas = new Set<string>();

  // Pasada 1 — lo declarado explícitamente, en el orden en que se declaró.
  const explicitas = ACCESS_AREAS.map((area) => {
    const propias = area.paths
      .map((path) => porRuta.get(path))
      .filter((s): s is AppSection => s !== undefined);
    for (const seccion of propias) {
      reclamadas.add(seccion.path);
    }
    return propias;
  });

  // Pasada 2 — el resto, por el grupo al que pertenece, en el orden del registro.
  return ACCESS_AREAS.map((area, indice) => {
    const sobrantes = candidatas.filter(
      (s) => !reclamadas.has(s.path) && area.catchAllGroups.includes(s.group),
    );
    const todas = ordenarPorDisponibilidad([...(explicitas[indice] ?? []), ...sobrantes]);
    return {
      area,
      sections: todas,
      disponibles: todas.filter((s) => s.availability === 'disponible').length,
    };
  }).filter((zona) => zona.sections.length > 0);
}

/**
 * Lo que se puede abrir primero; lo que está en construcción, al final.
 *
 * Estable dentro de cada mitad: el orden declarado se conserva, porque es el
 * orden en que se usan las secciones y no un alfabético que no dice nada.
 */
function ordenarPorDisponibilidad(secciones: readonly AppSection[]): readonly AppSection[] {
  return [
    ...secciones.filter((s) => s.availability === 'disponible'),
    ...secciones.filter((s) => s.availability !== 'disponible'),
  ];
}

/**
 * Los grupos que ninguna zona reclama como cajón.
 *
 * Existe para la prueba del registro, no para el producto: es la forma de que
 * agregar un grupo a {@link NAV_GROUPS} sin darle dueño rompa una prueba en vez
 * de esconder secciones en producción.
 */
export function gruposSinZona(): readonly NavGroup[] {
  const cubiertos = new Set(ACCESS_AREAS.flatMap((area) => area.catchAllGroups));
  return NAV_GROUPS.filter((grupo) => !cubiertos.has(grupo));
}
