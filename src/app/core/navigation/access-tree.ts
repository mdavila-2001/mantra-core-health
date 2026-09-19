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
   * su zona sola, sin tocar este archivo. Entre las zonas cubren los grupos
   * del menú exactamente una vez —salvo {@link GRUPOS_FUERA_DEL_ARBOL}—, y eso lo hace cumplir la prueba.
   */
  readonly catchAllGroups: readonly NavGroup[];
}

/**
 * Secciones que el árbol no ofrece nunca.
 *
 * **`dashboard`** — ofrecer «Panel» dentro del panel es un enlace a la pantalla
 * en la que ya estás, y ocupaba un lugar de los treinta y dos.
 *
 * **`directories`** (10/09/2026) — la portada de los directorios. Dentro de la
 * zona «Directorios» era una cuarta tarjeta, «Directorios», al lado de las que
 * ya llevan a cada directorio concreto: un acceso al agrupador cuyos accesos
 * estaban a su izquierda. El mismo rodeo que el 08/09 se sacó del menú lateral,
 * repetido un escalón más adentro.
 *
 * Lo que **no** cambia: la sección sigue existiendo, con su ruta, su rol y su
 * renglón en el menú lateral —que es el pedido explícito del cliente: ese
 * acceso se conserva porque ya está—. Esto decide sólo dónde **no** se ofrece.
 *
 * Va acá y no sacándola de {@link AccessArea.paths}: la zona `red` declara
 * `catchAllGroups: ['General']`, así que quitarla de `paths` la habría dejado
 * caer en la misma zona por el cajón —mismo resultado, más difícil de encontrar—.
 *
 * **Las siete de «Consultas»** (19/09/2026) — `diagnostics`, `lab-visits`,
 * `questionnaires`, `form-builder`, `glossary`, `my-services` y
 * `my-quotations`. La zona le abría diez tarjetas al médico y la pregunta que
 * la zona existe para responder —«¿a qué vine hoy?»— no se contesta con diez
 * opciones: se contesta con la agenda, lo que se escribe y el expediente. Las
 * otras siete son tareas que se hacen **desde** una de esas tres o una vez al
 * mes, y competían de igual a igual con las que se usan todos los días.
 * Pedido del propietario del producto mirando la zona del médico.
 *
 * Ninguna se vuelve inalcanzable, y por eso salen del árbol y no del registro:
 * «Formularios», «Glosario», «Mis servicios» y «Cotizaciones» conservan su
 * renglón en el menú lateral —es la lista cerrada que fija
 * `navigation.service.spec.ts`—, y las tres que el médico nunca tuvo en el menú
 * (`diagnostics`, `lab-visits`, `questionnaires`) se llegan desde donde su
 * propio registro dice que se llegan: los estudios desde el Archivo clínico,
 * las visitas desde Consultas médicas y la encuesta desde la consulta del
 * paciente al que se le asigna.
 *
 * **Cuatro de «Administración»** (19/09/2026) — `administration/my-practice`,
 * `administration/pharmacy-orders`, `administration/pharmacy-campaigns` y
 * `administration/pharmacy-profile`. Pedido del propietario mirando la zona del
 * médico. «Mi consultorio propio» se abre desde «Mi perfil», que es donde
 * alguien va a buscar «¿dónde atiendo?»; las tres de farmacia son del mostrador
 * de una farmacia, no del consultorio, y quien lo atiende las sigue teniendo en
 * su menú lateral. Ninguna ruta se cierra: esto decide sólo dónde no se ofrecen.
 */
export const SECCIONES_FUERA_DEL_ARBOL: readonly string[] = [
  'dashboard',
  'directories',
  'diagnostics',
  'lab-visits',
  'questionnaires',
  'form-builder',
  'glossary',
  'my-services',
  'my-quotations',
  'administration/my-practice',
  'administration/pharmacy-orders',
  'administration/pharmacy-campaigns',
  'administration/pharmacy-profile',
  'tutorials',
];

/**
 * Grupos del menú que el árbol no ofrece nunca, enteros.
 *
 * **`Mi cuenta`** (19/09/2026) — la quinta zona repetía, un escalón más abajo,
 * lo que ya abre el perfil: los datos propios, los turnos, los avisos y la
 * identidad verificada. Pedido del propietario del producto mirando el panel
 * del médico: «para eso tenemos el perfil». Dos puertas a lo mismo en la misma
 * pantalla se leen como dos destinos distintos.
 *
 * Se excluye el **grupo** y no una lista de rutas: una sección nueva de «Mi
 * cuenta» tampoco tiene lugar en el panel de trabajo, y declararla ruta por
 * ruta es la lista que alguien se olvida de actualizar. Como en
 * {@link SECCIONES_FUERA_DEL_ARBOL}, nada se vuelve inalcanzable: el registro
 * no cambia y el menú lateral las sigue ofreciendo. `tutorials` —que la zona
 * también llevaba, aunque es del grupo «General»— sale por la lista de rutas:
 * se dispara desde la pantalla que explica.
 */
export const GRUPOS_FUERA_DEL_ARBOL: readonly NavGroup[] = ['Mi cuenta'];

/**
 * Los accesos que, desde el panel, abren en un **modal** en vez de navegar.
 *
 * ## Por qué se declara acá y no en la plantilla del panel
 *
 * Por lo mismo que el reparto en zonas: el panel no escribe ni una ruta a mano
 * —lee el registro—, y meter un `@if (seccion.path === 'groups')` en su
 * plantilla habría empezado la lista de excepciones que este archivo existe
 * para evitar. Acá cada excepción tiene nombre, y `access-tree.spec.ts` puede
 * comprobar que la sección que se nombra existe de verdad.
 *
 * El valor es la **clave del contenido**, no un componente: `core/` no importa
 * componentes de `features/`. El panel traduce la clave al modal que
 * corresponde (`dashboard/access-tree`).
 *
 * ## Qué abre en modal y qué sigue navegando
 *
 * Sólo lo que el pedido del 10/09/2026 nombra: «Grupos y foros», que pasa a
 * abrir Comunidades, y los tres directorios concretos, que se consultan sin
 * salir del panel. La navegación estructural del menú lateral **no cambia**: las
 * mismas rutas siguen abriendo las mismas pantallas completas.
 */
export const ACCESO_EN_MODAL: Readonly<Record<string, string>> = {
  groups: 'comunidades',
  'clinics-directory': 'directorio-clinicas',
  'laboratory-directory': 'directorio-laboratorios',
  'pharmacies-directory': 'directorio-farmacias',
};

/**
 * Las zonas, en el orden en que se dibujan.
 *
 * El orden es el del día de trabajo: primero lo que se hace con un paciente
 * delante, después con quién se hace, después la red de afuera, después lo que
 * sostiene la práctica. Lo propio —«Mi cuenta»— no tiene zona: lo abre el
 * perfil (ver {@link GRUPOS_FUERA_DEL_ARBOL}).
 */
export const ACCESS_AREAS: readonly AccessArea[] = [
  {
    id: 'consulta',
    label: 'Consultas',
    tagline: 'Tu agenda, lo que escribís y el expediente de cada paciente.',
    icon: 'stethoscope',
    tone: 'info',
    // Tres y no diez (19/09/2026): lo que se abre con un paciente delante. El
    // resto de «Atención» está en SECCIONES_FUERA_DEL_ARBOL, que explica por
    // dónde se sigue llegando a cada una. `interventions` sale de `paths` pero
    // no del árbol: no la ve el médico —es de los cinco roles perioperatorios—
    // y le llega por el cajón, igual que «Mis visitas médicas» al visitador.
    paths: ['schedule', 'progress-notes', 'medical-records'],
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
  const candidatas = sections.filter(
    (s) => !SECCIONES_FUERA_DEL_ARBOL.includes(s.path) && !GRUPOS_FUERA_DEL_ARBOL.includes(s.group),
  );
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
 * agregar un grupo a {@link NAV_GROUPS} sin darle dueño —ni excluirlo a
 * propósito— rompa una prueba en vez
 * de esconder secciones en producción.
 */
export function gruposSinZona(): readonly NavGroup[] {
  const cubiertos = new Set([
    ...ACCESS_AREAS.flatMap((area) => area.catchAllGroups),
    ...GRUPOS_FUERA_DEL_ARBOL,
  ]);
  return NAV_GROUPS.filter((grupo) => !cubiertos.has(grupo));
}
