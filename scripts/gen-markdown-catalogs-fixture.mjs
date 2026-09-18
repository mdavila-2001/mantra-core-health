#!/usr/bin/env node
/**
 * Porta al simulador la red médica de las aseguradoras y los dos aranceles.
 *
 * ## Por qué existe
 *
 * El propietario entregó en `markdown_convertidos/` las listas que quería ver
 * en la maqueta. Cuatro no habían llegado nunca: el directorio mostraba 45
 * médicos inventados con faker y el nomenclador, veinte prestaciones
 * inventadas en bolivianos. `tools/extract-markdown-catalogs.py` las destila a
 * `data/insurer-networks/` y `data/fee-schedules/`; este guion las escribe como
 * TypeScript.
 *
 * Las filas viajan en JSON compacto: son ~5 000 y con sangría el archivo
 * pesaría el doble sin decir nada más. Se cargan con los manejadores, que el
 * interceptor importa perezosamente, así que no tocan el paquete inicial.
 *
 * Uso: `yarn mock:markdown-catalogs`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATOS = join(process.cwd(), 'data');
const FIXTURES = join(process.cwd(), 'src', 'app', 'core', 'mock', 'fixtures');

const leer = (ruta) => JSON.parse(readFileSync(join(DATOS, ruta), 'utf8'));
const compacto = (nombre, tipo, valor) =>
  `export const ${nombre}: ${tipo} = ${JSON.stringify(valor)};\n`;

/* ---- la red médica -------------------------------------------------------- */

const red = leer('insurer-networks/practitioners.json');
const redManifiesto = leer('insurer-networks/manifest.json');

writeFileSync(
  join(FIXTURES, 'insurer-network.generated.ts'),
  `/* ============================================================================
    Los médicos que Alianza Seguros y Nacional Seguros publican como habilitados
    en Santa Cruz.

    **GENERADO por \`scripts/gen-markdown-catalogs-fixture.mjs\`. No editar a mano.**
    La fuente es \`data/insurer-networks/\`, que destila
    \`tools/extract-markdown-catalogs.py\` de \`markdown_convertidos/\`.

    ${redManifiesto.counts.practitioners} médicos · ${redManifiesto.counts.offices} consultorios · ${redManifiesto.counts.locatedAtInstitution} ubicados en su clínica.

    ## Lo que NO trae

    · **Puntuación, opiniones ni agenda.** Son médicos reales: fabricarles una
      nota o unos horarios sería afirmar algo sobre alguien que existe.
    · **Coordenadas propias.** El punto de un consultorio es el de la clínica
      que su dirección nombra (\`precision: 'establecimiento'\`) o el centro de
      la ciudad (\`'ciudad'\`), y la diferencia viaja.
    Trae **todas** las filas de las dos redes, incluidos los consultorios de
    Montero, Puerto Suárez, Puerto Quijarro, Arroyo Concepción y Yacuses.

    Regenerar con \`yarn mock:markdown-catalogs\`.
    ========================================================================== */

/** Cómo se sacó el punto de un consultorio. */
export type InsurerNetworkPrecision = 'establecimiento' | 'ciudad';

export interface InsurerNetworkOffice {
  readonly address: string;
  readonly city: string;
  /** El municipio: Arroyo Concepción es de Puerto Quijarro, Yacuses de Puerto Suárez. */
  readonly municipality: string;
  readonly phones: readonly string[];
  readonly lat: number;
  readonly lng: number;
  readonly precision: InsurerNetworkPrecision;
  readonly institutionId: string | null;
}

export interface InsurerNetworkPractitioner {
  readonly id: string;
  readonly surnames: string;
  readonly givenNames: string;
  /** \`heuristic\`: la fuente no separa apellidos de nombres y se asumió. */
  readonly nameSplit: 'source' | 'heuristic';
  /** Tal como la escribe la aseguradora, en mayúsculas y sin tildes. */
  readonly specialties: readonly string[];
  readonly networks: readonly { readonly insurer: string; readonly plans: readonly string[] }[];
  readonly offices: readonly InsurerNetworkOffice[];
}

export const INSURER_NETWORK_META = ${JSON.stringify(
    {
      package: redManifiesto.package,
      extractedOn: redManifiesto.extractedOn,
      scope: redManifiesto.scope,
      sources: redManifiesto.sources.map(({ file, rows }) => ({ file, rows })),
      warnings: redManifiesto.warnings,
    },
    null,
    2,
  )} as const;

${compacto('INSURER_NETWORK_PRACTITIONERS', 'readonly InsurerNetworkPractitioner[]', red)}`,
  'utf8',
);

/* ---- los aranceles -------------------------------------------------------- */

const medico = leer('fee-schedules/medical-santa-cruz-2025.json');
const odontologico = leer('fee-schedules/dental-2026.json');
const aranceles = leer('fee-schedules/manifest.json');
const [fuenteMedica, fuenteDental] = aranceles.sources;

writeFileSync(
  join(FIXTURES, 'fee-schedules.generated.ts'),
  `/* ============================================================================
    Los aranceles de referencia: el de honorarios médicos del Colegio Médico de
    Santa Cruz (2025, en UMA) y el odontológico 2026 (en dólares).

    **GENERADO por \`scripts/gen-markdown-catalogs-fixture.mjs\`. No editar a mano.**
    La fuente es \`data/fee-schedules/\`, que destila
    \`tools/extract-markdown-catalogs.py\` de \`markdown_convertidos/\`.

    ${fuenteMedica.items} prestaciones médicas —todas las filas de la hoja «Base de datos»—
    (${fuenteMedica.ocrSuspect} marcadas \`ocrSuspect\`) ·
    ${fuenteDental.items} odontológicas (${fuenteDental.withoutPrice} sin precio publicado).

    ## Lo que hay que saber antes de usarlos

    · **El médico es OCR de un PDF escaneado.** El texto no se corrigió: una
      fila dañada viaja como está y marcada, para que la pantalla lo diga.
    · **\`UMA\` no es una moneda.** Es la unidad de cuenta del Colegio, y su
      conversión a bolivianos no está declarada en ningún lado.
    · **Los códigos no son del Colegio.** La planilla de tres columnas no los
      trae; el código es la posición de la fila dentro de su especialidad.
    · **Sin precio es \`null\`**, nunca cero: «no publicado» no es «gratis».

    Regenerar con \`yarn mock:markdown-catalogs\`.
    ========================================================================== */

export interface FeeScheduleItem {
  readonly code: string;
  readonly display: string;
  readonly specialty: string;
  /** El subtítulo de la planilla que agrupa la fila («Examen clínico»), si hay. */
  readonly group?: string | null;
  readonly referencePrice: string | null;
  readonly priceUnit: 'UMA' | 'USD' | null;
  readonly ocrSuspect: boolean;
}

/** Una observación de la planilla odontológica, con su sección. */
export interface FeeScheduleNote {
  readonly section: string;
  readonly text: string;
}

export const FEE_SCHEDULES_META = ${JSON.stringify(
    {
      package: aranceles.package,
      extractedOn: aranceles.extractedOn,
      sources: aranceles.sources.map(({ sha256: _sha, ...fuente }) => fuente),
      warnings: aranceles.warnings,
    },
    null,
    2,
  )} as const;

${compacto('MEDICAL_FEE_SCHEDULE', 'readonly FeeScheduleItem[]', medico)}
${compacto('DENTAL_FEE_SCHEDULE', 'readonly FeeScheduleItem[]', odontologico)}
${compacto('DENTAL_FEE_SCHEDULE_NOTES', 'readonly FeeScheduleNote[]', leer('fee-schedules/dental-2026-notes.json'))}`,
  'utf8',
);


/* ---- farmacias, laboratorios, centros y primer nivel ---------------------- */

const instituciones = leer('markdown-institutions/pharmacies-and-labs.json');
const primerNivel = leer('markdown-institutions/primary-care.json');

writeFileSync(
  join(FIXTURES, 'markdown-institutions.generated.ts'),
  `/* ============================================================================
    Farmacias, laboratorios, centros de análisis y centros de salud de primer
    nivel de Santa Cruz, tal como los listó el propietario.

    **GENERADO por \`scripts/gen-markdown-catalogs-fixture.mjs\`. No editar a mano.**
    La fuente es \`data/markdown-institutions/\`, que destila
    \`tools/extract-markdown-catalogs.py\` de \`markdown_convertidos/\`.

    ${instituciones.length} farmacias, laboratorios y centros · ${primerNivel.length} centros de primer nivel.

    El punto de cada uno dice cómo se sacó (\`precision\`): la dirección
    (\`direccion\`), el centro de la ciudad porque la planilla no trae dirección o
    Nominatim no la reconoce (\`ciudad\`) o el centro del municipio
    (\`municipio\`, los de primer nivel, con direcciones rurales).

    Regenerar con \`yarn mock:markdown-catalogs\`.
    ========================================================================== */

export type MarkdownInstitutionPrecision = 'direccion' | 'ciudad' | 'municipio';

export interface PharmacyOrLab {
  readonly id: string;
  readonly kind: 'PHARMACY' | 'LABORATORY' | 'DIAGNOSTIC_CENTER';
  readonly name: string;
  readonly legalName: string | null;
  readonly taxId: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly city: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: MarkdownInstitutionPrecision;
}

export interface PrimaryCareCenter {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly municipality: string;
  readonly department: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: MarkdownInstitutionPrecision;
}

${compacto('PHARMACIES_AND_LABS', 'readonly PharmacyOrLab[]', instituciones)}
${compacto('PRIMARY_CARE_CENTERS', 'readonly PrimaryCareCenter[]', primerNivel)}`,
  'utf8',
);

/* ---- las personas de las planillas de usuarios ---------------------------- */

const personas = leer('registered-people/manifest.json');
const medicosUsuarios = leer('registered-people/practitioners.json');
const pacientesUsuarios = leer('registered-people/patients.json');

writeFileSync(
  join(FIXTURES, 'registered-people.generated.ts'),
  `/* ============================================================================
    Las personas de \`USUARIO_MEDICOS_1.md\` y \`USUARIO_PACIENTES_1.md\`.

    **GENERADO por \`scripts/gen-markdown-catalogs-fixture.mjs\`. No editar a mano.**

    ${medicosUsuarios.length} médicos y ${pacientesUsuarios.length} pacientes: **todas** las filas con una persona
    (el resto de las planillas son filas vacías de la plantilla).

    ## Lo que NO trae, a propósito

    Cédula, emisión, fecha de nacimiento, celular, correo y domicilio. Son
    personas reales —hay menores de edad— y este repositorio es **público**:
    lo que se sube acá lo puede leer cualquiera. Quedaron afuera estos valores:
    ${JSON.stringify(personas.sources.map(({ file, withheldValues }) => ({ file, withheldValues })))}

    Regenerar con \`yarn mock:markdown-catalogs\`.
    ========================================================================== */

export interface RegisteredPerson {
  readonly sourceRow: number;
  readonly givenName: string | null;
  readonly middleName: string | null;
  readonly surname: string | null;
  readonly motherSurname: string | null;
  readonly occupation: string | null;
  readonly specialty?: string | null;
  readonly healthMinistryLicense?: string | null;
  readonly healthMinistryLicenseDate?: string | null;
  readonly dentalCollegeRegistration?: string | null;
  readonly sedesRegistration?: string | null;
  readonly sedesRegistrationDate?: string | null;
  readonly municipality?: string | null;
  readonly department?: string | null;
}

${compacto('REGISTERED_PRACTITIONERS', 'readonly RegisteredPerson[]', medicosUsuarios)}
${compacto('REGISTERED_PATIENTS', 'readonly RegisteredPerson[]', pacientesUsuarios)}`,
  'utf8',
);

console.log(
  `red: ${red.length} médicos · aranceles: ${medico.length} + ${odontologico.length} · instituciones: ${instituciones.length} + ${primerNivel.length} · personas: ${medicosUsuarios.length} + ${pacientesUsuarios.length}`,
);
