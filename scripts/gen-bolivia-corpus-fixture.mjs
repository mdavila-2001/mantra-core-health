#!/usr/bin/env node
/**
 * Porta el corpus «Bolivia Salud · Eje Central» al simulador.
 *
 * ## Por qué existe
 *
 * Los directorios de laboratorios y de farmacias de la maqueta mostraban
 * **cinco centros y ocho farmacias escritos a mano**, con nombres inventados y
 * un catálogo de trece estudios sacado del value set de conceptos. Quien abría
 * «dónde me hago este análisis» veía una lista que no existe en Bolivia.
 *
 * El corpus de `data/bolivia-salud-eje-central/` es una investigación con
 * procedencia por registro: 10 laboratorios y centros, 5 cadenas de farmacia,
 * 71 sucursales con dirección y horario, y 1 035 pruebas médicas normalizadas
 * en 27 categorías. Cada uno declara de qué fuente salió y con qué grado de
 * verificación.
 *
 * Copiarlo a mano lo habría dejado desviarse en la primera corrección. Esto lo
 * lee de la fuente y lo escribe como fixture; la única forma de que se separen
 * es no volver a correrlo, y para eso está `bolivia-eje-central.spec.ts`, que
 * cuenta los registros contra el disco.
 *
 * ## Las coordenadas NO vienen del corpus
 *
 * El propio corpus declara «coordenadas» entre sus `criterios_no_inventar`
 * (`metadata/metodologia.json`): no publica ninguna. Pero los cuatro
 * directorios de la aplicación dibujan un mapa, y un mapa necesita un punto.
 *
 * La solución es una **capa derivada y etiquetada**: `ubicaciones.json` lo
 * produce `tools/geocode-bolivia-corpus.py` pidiéndole cada dirección a
 * Nominatim (OpenStreetMap, el mismo proveedor que ya usan los mapas de la
 * aplicación), y cada punto viaja con su `precision`:
 *
 * · `direccion` — Nominatim reconoció la dirección publicada.
 * · `via`       — reconoció la vía, sin el número.
 * · `zona`      — reconoció el barrio o la zona.
 * · `ciudad`    — no reconoció nada; es el centro de la ciudad, y la ficha lo
 *                 dice con todas las letras en vez de fingir precisión.
 *
 * Ninguna coordenada se escribe a mano. Lo que Nominatim no resuelve queda
 * marcado como aproximado, que es lo único honesto que se puede hacer.
 *
 * Uso: `yarn mock:bolivia`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEN = join(process.cwd(), 'data', 'bolivia-salud-eje-central');
const DESTINO = join(
  process.cwd(),
  'src',
  'app',
  'core',
  'mock',
  'fixtures',
  'bolivia-eje-central.generated.ts',
);

const leer = (...partes) => JSON.parse(readFileSync(join(ORIGEN, ...partes), 'utf8'));

const manifest = leer('manifest.json');
const metodologia = leer('metadata', 'metodologia.json');
const taxonomia = leer('metadata', 'taxonomia.json').categorias;
const fuentes = leer('metadata', 'fuentes.json').fuentes;
const laboratorios = leer('establecimientos', 'laboratorios.json').laboratorios;
const cadenas = leer('establecimientos', 'farmacias.json').cadenas_farmacias;
const pruebas = leer('analisis_medicos', 'catalogo_maestro.json').pruebas;
const paneles = leer('relaciones', 'paneles_perfiles.json').paneles;
const relaciones = leer('relaciones', 'establecimientos_pruebas.json').relaciones;
const ubicaciones = leer('ubicaciones.json');

const sucursales = ['santa_cruz', 'la_paz_el_alto', 'cochabamba'].flatMap(
  (archivo) => leer('sucursales', `${archivo}.json`).sucursales,
);

/* ---- comprobaciones que hacen fallar el generador antes de escribir -------
   Un fixture a medias es peor que ninguno: las pantallas se llenarían de
   huecos sin que nada avise. Se rompe acá, con el motivo. */

const problemas = [];

const idsEstablecimiento = new Set([...laboratorios, ...cadenas].map((e) => e.id));
for (const sucursal of sucursales) {
  if (!idsEstablecimiento.has(sucursal.parent_id)) {
    problemas.push(`la sucursal ${sucursal.id} cuelga de ${sucursal.parent_id}, que no existe`);
  }
  if (ubicaciones[sucursal.id] === undefined) {
    problemas.push(`la sucursal ${sucursal.id} no tiene ubicación en ubicaciones.json`);
  }
}

const idsPrueba = new Set(pruebas.map((p) => p.id));
for (const relacion of relaciones) {
  if (!idsPrueba.has(relacion.prueba_id)) {
    problemas.push(`la relación apunta a la prueba ${relacion.prueba_id}, que no existe`);
  }
  if (!idsEstablecimiento.has(relacion.establecimiento_id)) {
    problemas.push(`la relación apunta a ${relacion.establecimiento_id}, que no existe`);
  }
}

const idsFuente = new Set(fuentes.map((f) => f.id));
for (const registro of [...laboratorios, ...cadenas, ...sucursales]) {
  for (const fuente of registro.fuentes ?? []) {
    if (!idsFuente.has(fuente)) problemas.push(`${registro.id} cita la fuente ${fuente}, que no está en fuentes.json`);
  }
}

if (problemas.length > 0) {
  console.error('· gen-bolivia-corpus-fixture — el corpus no es consistente:');
  for (const problema of problemas.slice(0, 20)) console.error(`    ${problema}`);
  if (problemas.length > 20) console.error(`    … y ${problemas.length - 20} más`);
  process.exit(1);
}

/* ---- normalización -------------------------------------------------------
   Los identificadores pasan a inglés (regla 29) y se descarta lo que el
   corpus declara constante para las 1 035 pruebas: `uso_indicacion_clinica`,
   `tipo_resultado` y `requisitos_preanaliticos_conservacion` tienen uno, uno y
   tres valores distintos en todo el catálogo, así que repetirlos por registro
   serían 400 kB de la misma frase. Salen como constantes compartidas.

   `codigos` se descarta entero: LOINC y SNOMED vienen en `null` en los 1 035
   registros, porque el corpus prohíbe fabricarlos. Un campo que siempre es
   nulo no informa; lo que informa es esta frase. */

const nota = (valor) => (valor === null || valor === undefined || valor === '' ? null : valor);

const fuentesPortadas = fuentes.map((f) => ({
  id: f.id,
  organization: f.organizacion,
  kind: f.tipo,
  url: f.url,
  use: f.uso,
  verifiedAt: f.fecha_verificacion,
}));

const establecimientos = laboratorios.map((l) => ({
  id: l.id,
  name: l.nombre,
  kind: l.tipo,
  description: l.descripcion,
  cities: l.ciudades,
  services: l.servicios,
  sourceIds: l.fuentes,
}));

const cadenasPortadas = cadenas.map((c) => ({
  id: c.id,
  name: c.nombre,
  kind: c.tipo,
  description: c.descripcion,
  cities: c.cobertura,
  sourceIds: c.fuentes,
}));

const sucursalesPortadas = sucursales.map((s) => {
  const punto = ubicaciones[s.id];
  return {
    id: s.id,
    parentId: s.parent_id,
    name: s.nombre,
    // Sólo las 21 sucursales de laboratorio lo declaran; las 50 de farmacia no
    // lo necesitan, porque su cadena ya dice qué es.
    kind: nota(s.tipo),
    addressText: nota(s.direccion),
    zone: nota(s.zona),
    city: s.ciudad,
    department: s.departamento,
    phone: nota(s.telefono),
    openingHours: nota(s.horario),
    verificationState: s.estado_verificacion,
    sourceIds: s.fuentes,
    // Derivado, no del corpus. Ver la cabecera.
    lat: punto.lat,
    lng: punto.lng,
    locationPrecision: punto.precision,
  };
});

const pruebasPortadas = pruebas.map((p) => ({
  id: p.id,
  name: p.nombre_normalizado,
  synonyms: p.sinonimos_abreviaturas,
  kind: p.tipo_entidad === 'panel_perfil' ? 'PANEL' : 'TEST',
  categoryId: p.categoria,
  target: nota(p.analito_microorganismo_gen_diana),
  specimens: p.muestras_habituales,
  methods: p.metodologias_habituales,
  units: nota(p.unidades_tipicas),
  patientPreparation: nota(p.preparacion_paciente),
  availableInBolivia: p.disponibilidad_bolivia_verificada === true,
  availabilityEvidenceIds: p.evidencia_disponibilidad_bolivia,
  reviewedAt: p.fecha_revision,
}));

/** El nombre legible de cada categoría. El corpus da el identificador. */
const NOMBRE_DE_CATEGORIA = {
  alergologia: 'Alergología',
  anatomia_patologica_citologia: 'Anatomía patológica y citología',
  biologia_molecular: 'Biología molecular',
  coagulacion_hemostasia: 'Coagulación y hemostasia',
  embarazo_prenatal: 'Embarazo y control prenatal',
  endocrinologia: 'Endocrinología',
  fertilidad_andrologia: 'Fertilidad y andrología',
  genetica_citogenetica_genomica: 'Genética, citogenética y genómica',
  heces_coproparasitologia: 'Heces y coproparasitología',
  hematologia: 'Hematología',
  inmunohematologia_banco_sangre: 'Inmunohematología y banco de sangre',
  inmunologia_autoinmunidad: 'Inmunología y autoinmunidad',
  liquidos_biologicos: 'Líquidos biológicos',
  metabolismo_neonatal: 'Metabolismo neonatal',
  micologia: 'Micología',
  microbiologia_bacteriologia: 'Microbiología y bacteriología',
  monitoreo_terapeutico: 'Monitoreo terapéutico de fármacos',
  nutricion_vitaminas_oligoelementos: 'Nutrición, vitaminas y oligoelementos',
  ocupacional_otros: 'Salud ocupacional y otros',
  oncologia_marcadores: 'Oncología y marcadores tumorales',
  parasitologia: 'Parasitología',
  quimica_clinica: 'Química clínica',
  serologia_infecciosas: 'Serología de infecciosas',
  toxicologia_drogas: 'Toxicología y drogas',
  trasplantes_hla: 'Trasplantes y HLA',
  uroanalisis: 'Uroanálisis',
  virologia: 'Virología',
};

const sinNombre = taxonomia.filter((c) => NOMBRE_DE_CATEGORIA[c.id] === undefined);
if (sinNombre.length > 0) {
  console.error('· gen-bolivia-corpus-fixture — categorías sin nombre legible:');
  for (const c of sinNombre) console.error(`    ${c.id}`);
  console.error('  Agregalas a NOMBRE_DE_CATEGORIA en este script.');
  process.exit(1);
}

const categoriasPortadas = taxonomia.map((c) => ({
  id: c.id,
  name: NOMBRE_DE_CATEGORIA[c.id],
  count: c.conteo,
}));

const panelesPortados = paneles.map((p) => ({
  id: p.id,
  name: p.nombre,
  componentIds: p.componentes_ids,
  componentNames: p.componentes_nombres,
  sourceIds: p.fuentes,
}));

const relacionesPortadas = relaciones.map((r) => ({
  establishmentId: r.establecimiento_id,
  testId: r.prueba_id,
  state: r.estado,
  sourceId: r.fuente_id,
}));

/* ---- emisión ------------------------------------------------------------- */

const precisiones = sucursalesPortadas.reduce((cuenta, s) => {
  cuenta[s.locationPrecision] = (cuenta[s.locationPrecision] ?? 0) + 1;
  return cuenta;
}, {});

const constante = (nombre, tipo, valor) =>
  `export const ${nombre}: ${tipo} = ${JSON.stringify(valor, null, 2)};\n\n`;

const cabecera = `/* ============================================================================
    El corpus «Bolivia Salud · Eje Central», portado al simulador.

    **GENERADO por \`scripts/gen-bolivia-corpus-fixture.mjs\`. No editar a mano.**
    La fuente son los ${manifest.conteos.archivos_json} JSON de
    \`data/bolivia-salud-eje-central/\`, con su procedencia —fuente, URL y fecha
    de verificación— tal como la declara cada registro.

    Corte del corpus: ${manifest.fecha_corte}. Alcance: La Paz, El Alto,
    Cochabamba y Santa Cruz de la Sierra.

    ${establecimientos.length} laboratorios y centros · ${cadenasPortadas.length} cadenas de farmacia ·
    ${sucursalesPortadas.length} sucursales · ${pruebasPortadas.length} pruebas en ${categoriasPortadas.length} categorías ·
    ${panelesPortados.length} paneles · ${relacionesPortadas.length} relaciones establecimiento↔prueba ·
    ${fuentesPortadas.length} fuentes citadas.

    ## Lo que este archivo NO trae, y por qué

    · **Códigos LOINC y SNOMED.** El corpus los declara \`null\` en las ${pruebasPortadas.length}
      pruebas porque no los verificó una por una, y fabricarlos está prohibido.
      El campo se descarta entero: uno siempre nulo no informa.

    · **Precios.** El corpus no publica ninguno. Los que muestra la maqueta los
      calcula el manejador, y son maqueta declarada — no salen de acá.

    · **Qué prueba hace cada laboratorio, salvo uno.** Sólo \`lab_plexus\`
      publicó su catálogo (${relacionesPortadas.length} relaciones verificadas). Para el resto, el
      corpus declara \`services\`, y de ahí sale la oferta — derivada y marcada
      como tal, nunca presentada como catálogo verificado.

    ## Las coordenadas son una capa derivada

    El corpus declara «coordenadas» entre sus \`criterios_no_inventar\` y no
    publica ninguna. \`lat\`/\`lng\` salen de Nominatim (OpenStreetMap) y cada
    sucursal dice con qué precisión se resolvió:

${Object.entries(precisiones)
  .sort((a, b) => b[1] - a[1])
  .map(([clave, n]) => `      · \`${clave}\` — ${n}`)
  .join('\n')}

    \`ciudad\` significa que Nominatim no reconoció la dirección y el punto es
    el centro de la ciudad. Las pantallas lo dicen en vez de fingir precisión.

    Regenerar con \`yarn mock:bolivia\`.
    ========================================================================== */

/** Cómo se resolvió el punto de una sucursal. Ver la cabecera. */
export type PrecisionDeUbicacion = 'direccion' | 'via' | 'zona' | 'ciudad';

/** Una fuente citada por el corpus. */
export interface FuenteDelCorpus {
  readonly id: string;
  readonly organization: string;
  readonly kind: string;
  readonly url: string;
  readonly use: string;
  readonly verifiedAt: string;
}

/** Un laboratorio o centro de diagnóstico. */
export interface EstablecimientoDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly cities: readonly string[];
  readonly services: readonly string[];
  readonly sourceIds: readonly string[];
}

/** Una cadena de farmacias. No tiene \`services\`: el corpus no los declara. */
export interface CadenaDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly cities: readonly string[];
  readonly sourceIds: readonly string[];
}

/** Una sucursal, de laboratorio o de farmacia. */
export interface SucursalDelCorpus {
  readonly id: string;
  readonly parentId: string;
  readonly name: string;
  /** Sólo lo declaran las sucursales de laboratorio. */
  readonly kind: string | null;
  readonly addressText: string | null;
  readonly zone: string | null;
  readonly city: string;
  readonly department: string;
  readonly phone: string | null;
  readonly openingHours: string | null;
  readonly verificationState: string;
  readonly sourceIds: readonly string[];
  readonly lat: number;
  readonly lng: number;
  readonly locationPrecision: PrecisionDeUbicacion;
}

/** Una prueba médica normalizada, o un panel. */
export interface PruebaDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly synonyms: readonly string[];
  readonly kind: 'TEST' | 'PANEL';
  readonly categoryId: string;
  readonly target: string | null;
  readonly specimens: readonly string[];
  readonly methods: readonly string[];
  readonly units: string | null;
  readonly patientPreparation: string | null;
  /** \`true\` sólo si una fuente boliviana lo acredita. Ver \`availabilityEvidenceIds\`. */
  readonly availableInBolivia: boolean;
  readonly availabilityEvidenceIds: readonly string[];
  readonly reviewedAt: string;
}

/** Una de las ${categoriasPortadas.length} categorías del catálogo. */
export interface CategoriaDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

/** Un panel o perfil, con las pruebas que lo componen. */
export interface PanelDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly componentIds: readonly string[];
  readonly componentNames: readonly string[];
  readonly sourceIds: readonly string[];
}

/** Que un establecimiento ofrece una prueba, con el estado de la evidencia. */
export interface RelacionDelCorpus {
  readonly establishmentId: string;
  readonly testId: string;
  readonly state: string;
  readonly sourceId: string;
}

/**
 * Lo que el corpus declara igual para las ${pruebasPortadas.length} pruebas.
 *
 * No es relleno: es lo que el corpus decidió **no** particularizar, porque
 * depende del laboratorio ejecutor y afirmarlo por prueba sería inventar.
 */
export const TEXTO_COMUN_DE_PRUEBA = {
  clinicalUse: ${JSON.stringify(pruebas[0].uso_indicacion_clinica)},
  resultType: ${JSON.stringify(pruebas[0].tipo_resultado)},
  preanalytical: ${JSON.stringify(pruebas.find((p) => p.requisitos_preanaliticos_conservacion !== null).requisitos_preanaliticos_conservacion)},
} as const;

/** La procedencia del paquete, para mostrarla al pie de las pantallas. */
export const CORPUS_META = {
  package: ${JSON.stringify(manifest.package)},
  schemaVersion: ${JSON.stringify(manifest.schema_version)},
  cutoffDate: ${JSON.stringify(manifest.fecha_corte)},
  sourceHierarchy: ${JSON.stringify(metodologia.jerarquia_fuentes)},
  neverInvented: ${JSON.stringify(metodologia.criterios_no_inventar)},
} as const;

`;

const cuerpo =
  constante('FUENTES_DEL_CORPUS', 'readonly FuenteDelCorpus[]', fuentesPortadas) +
  constante('ESTABLECIMIENTOS_DEL_CORPUS', 'readonly EstablecimientoDelCorpus[]', establecimientos) +
  constante('CADENAS_DEL_CORPUS', 'readonly CadenaDelCorpus[]', cadenasPortadas) +
  constante('SUCURSALES_DEL_CORPUS', 'readonly SucursalDelCorpus[]', sucursalesPortadas) +
  constante('CATEGORIAS_DEL_CORPUS', 'readonly CategoriaDelCorpus[]', categoriasPortadas) +
  constante('PRUEBAS_DEL_CORPUS', 'readonly PruebaDelCorpus[]', pruebasPortadas) +
  constante('PANELES_DEL_CORPUS', 'readonly PanelDelCorpus[]', panelesPortados) +
  constante('RELACIONES_DEL_CORPUS', 'readonly RelacionDelCorpus[]', relacionesPortadas);

writeFileSync(DESTINO, cabecera + cuerpo, 'utf8');

console.log('· gen-bolivia-corpus-fixture');
console.log(
  `  ${establecimientos.length} centros · ${cadenasPortadas.length} cadenas · ${sucursalesPortadas.length} sucursales · ` +
    `${pruebasPortadas.length} pruebas · ${categoriasPortadas.length} categorías · ${panelesPortados.length} paneles · ` +
    `${relacionesPortadas.length} relaciones · ${fuentesPortadas.length} fuentes`,
);
console.log(
  `  ubicaciones: ${Object.entries(precisiones)
    .sort((a, b) => b[1] - a[1])
    .map(([clave, n]) => `${clave} ${n}`)
    .join(' · ')}`,
);
console.log(`  → ${DESTINO.replace(process.cwd() + '/', '')}`);
