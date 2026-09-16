import {
  CADENAS_DEL_CORPUS,
  CATEGORIAS_DEL_CORPUS,
  ESTABLECIMIENTOS_DEL_CORPUS,
  PRUEBAS_DEL_CORPUS,
  RELACIONES_DEL_CORPUS,
  SUCURSALES_DEL_CORPUS,
  type EstablecimientoDelCorpus,
  type PrecisionDeUbicacion,
  type PruebaDelCorpus,
  type SucursalDelCorpus,
} from './bolivia-eje-central.generated';
import { avatarSvg, portadaSvg, uuid } from '../mock-store';

/* ============================================================================
    El corpus «Bolivia Salud · Eje Central», con la forma que piden las
    pantallas.

    Este archivo **indexa y deriva**; no declara contenido. Cada dato que se ve
    sale de `bolivia-eje-central.generated.ts`, que a su vez sale de
    `data/bolivia-salud-eje-central/`. Lo que acá se agrega es la traducción a
    los tipos del simulador y tres derivaciones, todas marcadas:

    1. **La identidad** (`uuid()` del id del corpus) — determinista, igual que
       en `conceptos.ts`: un enlace copiado sigue abriendo lo mismo.
    2. **Qué pruebas ofrece cada laboratorio.** Sólo Plexus publicó su
       catálogo; para el resto se deriva de los `services` que el propio
       corpus declara. La diferencia viaja en `evidenciaDeOferta` y las
       pantallas la dicen.
    3. **El estado de vigencia.** El corpus distingue lo verificado en 2026 de
       lo que es línea base histórica «con vigencia 2026 no inferida». Esa
       distinción no se pierde: llega a la ficha.

    Lo que NO se deriva, a propósito:

    · **Opiniones y puntuaciones.** Son establecimientos reales con nombre y
      apellido. Fabricarles una nota media es una afirmación sobre un negocio
      que existe, y eso no se hace ni en una maqueta. Van sin opiniones, y las
      pantallas ya saben dibujar «todavía sin opiniones».
    · **Precios.** El corpus no publica ninguno. Los que se ven los calcula el
      manejador y son maqueta declarada.
    · **Atención sin cita y órdenes externas.** El corpus no lo dice, así que
      viajan en `null` y el sello no se dibuja. «No lo sabemos» no es «no».
    ========================================================================== */

/* ---- vigencia ------------------------------------------------------------ */

/** Qué tan al día está el registro de una sucursal, según el propio corpus. */
export type VigenciaDeSucursal = 'VERIFICADA' | 'HISTORICA' | 'POR_RECONCILIAR';

/** Lo que se le muestra a una persona sobre esa vigencia. */
export const ETIQUETA_DE_VIGENCIA: Readonly<Record<VigenciaDeSucursal, string>> = {
  VERIFICADA: 'Verificada en 2026',
  HISTORICA: 'Registro histórico · vigencia no confirmada',
  POR_RECONCILIAR: 'Pendiente de reconciliar con el registro oficial',
};

/**
 * Traduce el `verificationState` del corpus a las tres vigencias.
 *
 * El corpus es explícito donde importa: 35 de las 50 sucursales de farmacia
 * llevan `vigencia_2026_no_inferida`, que quiere decir «esto estaba así, y no
 * afirmamos que siga abierto hoy». Esa frase no se puede perder por el camino:
 * una farmacia cerrada mostrada como abierta es un viaje en vano.
 */
export function vigenciaDe(sucursal: SucursalDelCorpus): VigenciaDeSucursal {
  if (sucursal.verificationState.startsWith('verificado_')) return 'VERIFICADA';
  if (sucursal.verificationState.includes('vigencia_2026_no_inferida')) return 'HISTORICA';
  return 'POR_RECONCILIAR';
}

/** Lo que se le muestra a una persona sobre la precisión del punto en el mapa. */
export const ETIQUETA_DE_PRECISION: Readonly<Record<PrecisionDeUbicacion, string>> = {
  direccion: 'Ubicación exacta',
  via: 'Ubicación sobre la vía',
  zona: 'Ubicación aproximada · zona',
  ciudad: 'Ubicación aproximada · centro de la ciudad',
};

/* ---- de servicio declarado a categoría del catálogo -----------------------
   La única forma de saber qué hace un laboratorio del que no tenemos el
   catálogo. No es adivinar: el corpus declara los `services` de cada uno, y
   las 27 categorías del catálogo de pruebas son las mismas áreas con otro
   nombre. Lo que esta tabla hace es traducir, y lo que no está en ella hace
   fallar la carga en vez de desaparecer en silencio. */

const CATEGORIAS_BASICAS = [
  'hematologia',
  'quimica_clinica',
  'uroanalisis',
  'heces_coproparasitologia',
  'coagulacion_hemostasia',
  'serologia_infecciosas',
] as const;

const CATEGORIAS_POR_SERVICIO: Readonly<Record<string, readonly string[]>> = {
  // Los genéricos abren el núcleo de rutina, que es lo que significan.
  'laboratorio clínico': CATEGORIAS_BASICAS,
  'laboratorio hospitalario': CATEGORIAS_BASICAS,
  diagnóstico: CATEGORIAS_BASICAS,
  referencia: CATEGORIAS_BASICAS,
  'referencia nacional': CATEGORIAS_BASICAS,
  'diagnóstico especializado': ['biologia_molecular', 'inmunologia_autoinmunidad', 'virologia'],
  'pruebas especializadas': ['endocrinologia', 'inmunologia_autoinmunidad', 'oncologia_marcadores'],
  // Los específicos, uno a uno.
  hematología: ['hematologia', 'coagulacion_hemostasia'],
  'bioquímica clínica': ['quimica_clinica'],
  'química clínica': ['quimica_clinica'],
  inmunología: ['inmunologia_autoinmunidad'],
  inmunogenética: ['trasplantes_hla', 'inmunologia_autoinmunidad'],
  alergología: ['alergologia'],
  microbiología: ['microbiologia_bacteriologia'],
  micología: ['micologia'],
  parasitología: ['parasitologia'],
  virología: ['virologia'],
  'biología molecular': ['biologia_molecular'],
  'genética molecular': ['biologia_molecular', 'genetica_citogenetica_genomica'],
  'paneles sindrómicos': ['biologia_molecular', 'microbiologia_bacteriologia'],
  citología: ['anatomia_patologica_citologia'],
  'toma ginecológica': ['anatomia_patologica_citologia', 'embarazo_prenatal'],
  'toma pediátrica': ['metabolismo_neonatal'],
  'marcadores tumorales': ['oncologia_marcadores'],
  'citometría de flujo': ['oncologia_marcadores', 'hematologia'],
  'medicina tropical': ['serologia_infecciosas', 'parasitologia', 'virologia'],
  'salud pública': ['serologia_infecciosas', 'microbiologia_bacteriologia'],
  // Modos de atención y misión, no áreas del catálogo. Se leen aparte.
  'toma a domicilio': [],
  'resultados en línea': [],
  investigación: [],
};

const TOMA_A_DOMICILIO = 'toma a domicilio';
const RESULTADOS_EN_LINEA = 'resultados en línea';

/* ---- índices del corpus -------------------------------------------------- */

const SUCURSALES_POR_PADRE = SUCURSALES_DEL_CORPUS.reduce<Map<string, SucursalDelCorpus[]>>(
  (mapa, sucursal) => {
    const previas = mapa.get(sucursal.parentId);
    if (previas === undefined) mapa.set(sucursal.parentId, [sucursal]);
    else previas.push(sucursal);
    return mapa;
  },
  new Map(),
);

const PRUEBA_POR_ID = new Map(PRUEBAS_DEL_CORPUS.map((prueba) => [prueba.id, prueba]));

export const NOMBRE_DE_CATEGORIA = new Map(
  CATEGORIAS_DEL_CORPUS.map((categoria) => [categoria.id, categoria.name]),
);

/** Las pruebas cuya disponibilidad en Bolivia acredita alguna fuente. */
const PRUEBAS_DISPONIBLES = PRUEBAS_DEL_CORPUS.filter((prueba) => prueba.availableInBolivia);

/* ---- laboratorios -------------------------------------------------------- */

/** De dónde sale la oferta de pruebas de un laboratorio. */
export type EvidenciaDeOferta = 'CATALOGO_PUBLICADO' | 'DERIVADA_DE_SERVICIOS';

/** Una sede real, con su dirección, su horario y la precisión de su punto. */
export interface SedeDelCorpus {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly addressText: string | null;
  readonly city: string;
  readonly department: string;
  readonly phone: string | null;
  readonly openingHours: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly locationPrecision: PrecisionDeUbicacion;
  readonly vigencia: VigenciaDeSucursal;
}

/** Un laboratorio del corpus, listo para el directorio de diagnóstico. */
export interface LaboratorioDelCorpus {
  readonly id: string;
  readonly corpusId: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly kind: 'LABORATORY';
  readonly cities: readonly string[];
  readonly services: readonly string[];
  readonly homeCollection: boolean;
  readonly onlineResults: boolean;
  readonly verified: boolean;
  readonly sites: readonly SedeDelCorpus[];
  readonly lat: number;
  readonly lng: number;
  readonly locationPrecision: PrecisionDeUbicacion;
  readonly testIds: readonly string[];
  readonly evidenciaDeOferta: EvidenciaDeOferta;
  readonly sourceIds: readonly string[];
}

/** `lab_plexus` → `PLEXUS`. El código que se ve en la ficha y en el buscador. */
function codigoDe(corpusId: string): string {
  return corpusId.replace(/^(lab|farm)_/, '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function sedeDe(sucursal: SucursalDelCorpus, orden: number): SedeDelCorpus {
  return {
    id: uuid(`corpus-site-${sucursal.id}`),
    code: `${codigoDe(sucursal.parentId).slice(0, 6)}-${orden + 1}`,
    name: sucursal.name,
    addressText: sucursal.addressText,
    city: sucursal.city,
    department: sucursal.department,
    phone: sucursal.phone,
    openingHours: sucursal.openingHours,
    lat: sucursal.lat,
    lng: sucursal.lng,
    locationPrecision: sucursal.locationPrecision,
    vigencia: vigenciaDe(sucursal),
  };
}

/**
 * Las pruebas que ofrece un laboratorio, y con qué respaldo.
 *
 * Plexus publicó su catálogo y el corpus lo recogió en `RELACIONES_DEL_CORPUS`:
 * esas son sus pruebas, sin más. Los otros nueve no publicaron ninguno, así que
 * su oferta se **deriva** de los `services` que sí declaran, acotada a las
 * pruebas que alguna fuente acredita como disponibles en Bolivia.
 *
 * Es una derivación, no un catálogo, y por eso vuelve acompañada de su
 * `EvidenciaDeOferta`: la ficha lo dice antes de listar nada.
 */
function ofertaDe(establecimiento: EstablecimientoDelCorpus): {
  readonly testIds: readonly string[];
  readonly evidencia: EvidenciaDeOferta;
} {
  const publicadas = RELACIONES_DEL_CORPUS.filter(
    (relacion) => relacion.establishmentId === establecimiento.id,
  );
  if (publicadas.length > 0) {
    return { testIds: publicadas.map((relacion) => relacion.testId), evidencia: 'CATALOGO_PUBLICADO' };
  }

  const categorias = new Set(
    establecimiento.services.flatMap((servicio) => {
      const traduccion = CATEGORIAS_POR_SERVICIO[servicio];
      if (traduccion === undefined) {
        throw new Error(
          `El corpus declara el servicio «${servicio}» en ${establecimiento.id} y ` +
            'CATEGORIAS_POR_SERVICIO no sabe a qué categoría del catálogo corresponde. ' +
            'Agregalo en bolivia-eje-central.ts.',
        );
      }
      return traduccion;
    }),
  );

  return {
    testIds: PRUEBAS_DISPONIBLES.filter((prueba) => categorias.has(prueba.categoryId)).map(
      (prueba) => prueba.id,
    ),
    evidencia: 'DERIVADA_DE_SERVICIOS',
  };
}

export const LABORATORIOS_DEL_CORPUS: readonly LaboratorioDelCorpus[] =
  ESTABLECIMIENTOS_DEL_CORPUS.map((establecimiento) => {
    const sucursales = SUCURSALES_POR_PADRE.get(establecimiento.id) ?? [];
    const sedes = sucursales.map(sedeDe);
    const principal = sedes[0];
    const { testIds, evidencia } = ofertaDe(establecimiento);

    if (principal === undefined) {
      throw new Error(`El establecimiento ${establecimiento.id} no tiene ninguna sucursal.`);
    }

    return {
      id: uuid(`corpus-unit-${establecimiento.id}`),
      corpusId: establecimiento.id,
      tenantId: uuid(`corpus-tenant-${establecimiento.id}`),
      code: codigoDe(establecimiento.id),
      name: establecimiento.name,
      description: establecimiento.description,
      // Los diez son laboratorios: el corpus no investigó centros de imagen, y
      // los de imagenología de la maqueta siguen siendo los de siempre.
      kind: 'LABORATORY',
      cities: establecimiento.cities,
      services: establecimiento.services,
      homeCollection: establecimiento.services.includes(TOMA_A_DOMICILIO),
      onlineResults: establecimiento.services.includes(RESULTADOS_EN_LINEA),
      verified: sedes.every((sede) => sede.vigencia === 'VERIFICADA'),
      sites: sedes,
      lat: principal.lat,
      lng: principal.lng,
      locationPrecision: principal.locationPrecision,
      testIds,
      evidenciaDeOferta: evidencia,
      sourceIds: establecimiento.sourceIds,
    };
  });

/** Una prueba del catálogo, por su id del corpus. */
export function pruebaDelCorpus(id: string): PruebaDelCorpus | undefined {
  return PRUEBA_POR_ID.get(id);
}

/* ---- farmacias ----------------------------------------------------------- */

/**
 * Una sucursal de farmacia. A diferencia de los laboratorios, acá la unidad
 * que le sirve a una persona **es la sucursal**, no la cadena: quien busca
 * dónde comprar una receta busca un mostrador con una dirección, no una marca.
 */
export interface FarmaciaDelCorpus {
  readonly id: string;
  readonly corpusId: string;
  readonly tenantId: string;
  readonly siteId: string;
  readonly code: string;
  readonly slug: string;
  /** «Farmacorp · San Miguel»: la cadena y la sucursal, que es como se la nombra. */
  readonly name: string;
  readonly chainId: string;
  readonly chainName: string;
  readonly siteName: string;
  readonly addressText: string | null;
  readonly city: string;
  readonly department: string;
  readonly phone: string | null;
  readonly openingHours: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly locationPrecision: PrecisionDeUbicacion;
  readonly vigencia: VigenciaDeSucursal;
  readonly sourceIds: readonly string[];
}

const CADENA_POR_ID = new Map(CADENAS_DEL_CORPUS.map((cadena) => [cadena.id, cadena]));

/** `farm_suc_farmacorp_001` → `farmacorp-san-miguel`, estable y legible. */
function slugDe(cadena: string, sucursal: string): string {
  const limpio = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${limpio(cadena)}-${limpio(sucursal)}`;
}

export const FARMACIAS_DEL_CORPUS: readonly FarmaciaDelCorpus[] = SUCURSALES_DEL_CORPUS.filter(
  (sucursal) => CADENA_POR_ID.has(sucursal.parentId),
).map((sucursal) => {
  const cadena = CADENA_POR_ID.get(sucursal.parentId)!;
  return {
    id: uuid(`corpus-pharmacy-${sucursal.id}`),
    corpusId: sucursal.id,
    tenantId: uuid(`corpus-tenant-${sucursal.parentId}`),
    siteId: uuid(`corpus-pharmacy-site-${sucursal.id}`),
    code: `${codigoDe(sucursal.parentId).slice(0, 6)}_${sucursal.id.slice(-3)}`,
    slug: slugDe(cadena.name, sucursal.name),
    name: `${cadena.name} · ${sucursal.name}`,
    chainId: cadena.id,
    chainName: cadena.name,
    siteName: sucursal.name,
    addressText: sucursal.addressText,
    city: sucursal.city,
    department: sucursal.department,
    phone: sucursal.phone,
    openingHours: sucursal.openingHours,
    lat: sucursal.lat,
    lng: sucursal.lng,
    locationPrecision: sucursal.locationPrecision,
    vigencia: vigenciaDe(sucursal),
    sourceIds: sucursal.sourceIds,
  };
});

/* ---- vitrinas ------------------------------------------------------------
   Las fichas públicas: lo que devuelven `/public/search/*` y `/public/nearby`.
   Se construyen acá y las consume `comunidad.ts`, que es quien las junta con
   las de siempre. La dirección de la importación importa: este archivo no
   conoce a `comunidad.ts`, así que no hay ciclo. */

/** La forma mínima de una vitrina. `comunidad.ts` la completa. */
export interface SemillaDeVitrina {
  readonly clave: string;
  readonly kind: 'DIAGNOSTIC_UNIT' | 'PHARMACY';
  readonly tenantId: string;
  readonly targetId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string;
  readonly biography: string;
  readonly city: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly verified: boolean;
  readonly color: string;
}

/** El titular de un laboratorio: dónde está y en qué trabaja. */
function titularDeLaboratorio(laboratorio: LaboratorioDelCorpus): string {
  const areas = laboratorio.services
    .filter((servicio) => servicio !== TOMA_A_DOMICILIO && servicio !== RESULTADOS_EN_LINEA)
    .slice(0, 3)
    .join(', ');
  const sedes =
    laboratorio.sites.length === 1 ? '1 sede' : `${laboratorio.sites.length} sedes`;
  return areas === '' ? `Laboratorio · ${sedes}` : `Laboratorio · ${areas} · ${sedes}`;
}

export const SEMILLAS_DE_VITRINA: readonly SemillaDeVitrina[] = [
  ...LABORATORIOS_DEL_CORPUS.map((laboratorio) => ({
    clave: `corpus-${laboratorio.corpusId}`,
    kind: 'DIAGNOSTIC_UNIT' as const,
    tenantId: laboratorio.tenantId,
    targetId: laboratorio.id,
    slug: slugDe(laboratorio.name, laboratorio.cities[0] ?? 'bolivia'),
    displayName: laboratorio.name,
    headline: titularDeLaboratorio(laboratorio),
    biography: laboratorio.description,
    city: laboratorio.sites[0]!.city,
    address: laboratorio.sites[0]!.addressText ?? '',
    lat: laboratorio.lat,
    lng: laboratorio.lng,
    verified: laboratorio.verified,
    color: '#4f46e5',
  })),
  ...FARMACIAS_DEL_CORPUS.map((farmacia) => ({
    clave: `corpus-${farmacia.corpusId}`,
    kind: 'PHARMACY' as const,
    tenantId: farmacia.tenantId,
    targetId: farmacia.id,
    slug: farmacia.slug,
    displayName: farmacia.name,
    headline:
      farmacia.openingHours === null
        ? `Farmacia · ${farmacia.city}`
        : `Farmacia · ${farmacia.openingHours}`,
    biography: `${farmacia.chainName}, sucursal ${farmacia.siteName}. ${ETIQUETA_DE_VIGENCIA[farmacia.vigencia]}.`,
    city: farmacia.city,
    address: farmacia.addressText ?? '',
    lat: farmacia.lat,
    lng: farmacia.lng,
    verified: farmacia.vigencia === 'VERIFICADA',
    color: '#16a34a',
  })),
];

/** El avatar y la portada de una vitrina del corpus, para no repetirlo. */
export function imagenesDeVitrina(semilla: SemillaDeVitrina): {
  readonly avatarUrl: string;
  readonly coverUrl: string;
} {
  return {
    avatarUrl: avatarSvg(semilla.displayName, semilla.color),
    coverUrl: portadaSvg(semilla.color),
  };
}
