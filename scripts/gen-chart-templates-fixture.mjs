/**
 * Porta las fichas clínicas estándar del backend al simulador.
 *
 * ## Por qué existe
 *
 * El backend siembra **43 formularios** con procedencia documentada
 * (`mantra-core-health-api/src/common/seed/data/clinical-forms/`), y el
 * simulador servía **cuatro escritos a mano** con códigos que ni siquiera
 * coincidían. Para una doctora de medicina general, de neurología o de
 * odontología el catálogo de la maqueta estaba vacío: el bloque «Formulario
 * clínico» no tenía nada que ofrecer.
 *
 * Copiarlas a mano las habría dejado desviarse en la primera ficha nueva. Esto
 * las lee de la fuente y las escribe como fixture, así que la única forma de
 * que se separen es no volver a correrlo — y para eso está la prueba de deriva
 * de `plantillas-de-expediente.spec.ts`, que cuenta los archivos.
 *
 * Uso: `yarn mock:chart-templates`
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEN = join(
  process.cwd(),
  '..',
  'mantra-core-health-api',
  'src',
  'common',
  'seed',
  'data',
  'clinical-forms',
);
const DESTINO = join(
  process.cwd(),
  'src',
  'app',
  'core',
  'mock',
  'fixtures',
  'fichas-estandar.generated.ts',
);

const fichas = [];
for (const carpeta of readdirSync(ORIGEN, { withFileTypes: true })) {
  if (!carpeta.isDirectory()) continue;
  for (const archivo of readdirSync(join(ORIGEN, carpeta.name))) {
    if (!archivo.endsWith('.json')) continue;
    const ficha = JSON.parse(readFileSync(join(ORIGEN, carpeta.name, archivo), 'utf8'));
    fichas.push({
      code: ficha.code,
      name: ficha.name,
      specialty: ficha.specialty.code,
      ...(ficha.provenance === undefined ? {} : { provenance: ficha.provenance }),
      fields: ficha.fields.map((campo) => ({
        code: campo.code,
        name: campo.name,
        dataType: campo.dataType,
        required: campo.required ?? false,
        ...(campo.options === undefined
          ? {}
          : { options: campo.options, multiple: campo.multiple ?? false }),
      })),
    });
  }
}

fichas.sort((a, b) => a.code.localeCompare(b.code));

const cabecera = `/* ============================================================================
    Las fichas clínicas estándar, portadas del backend.

    **GENERADO por \`scripts/gen-chart-templates-fixture.mjs\`. No editar a mano.**
    La fuente son los ${fichas.length} JSON de
    \`mantra-core-health-api/src/common/seed/data/clinical-forms/\`, con su
    procedencia —norma, organismo, URL y licencia— tal como la declara cada uno.

    Regenerar con \`yarn mock:chart-templates\`.
    ========================================================================== */

`;

const tipos = `/** La procedencia de una ficha, tal como la declara su JSON. */
export interface ProcedenciaDeFicha {
  readonly sourceTitle: string;
  readonly organization: string;
  readonly url: string;
  readonly license: string;
  readonly sourceVersion?: string;
  readonly retrievedAt: string;
  readonly note?: string;
}

/** Un campo de la ficha. \`options\` sólo viene en los de lista cerrada. */
export interface CampoDeFicha {
  readonly code: string;
  readonly name: string;
  readonly dataType: string;
  readonly required: boolean;
  readonly options?: readonly string[];
  readonly multiple?: boolean;
}

/** Una ficha clínica estándar. */
export interface FichaEstandar {
  readonly code: string;
  readonly name: string;
  /** Código de \`VS_MEDICAL_SPECIALTY\`, o \`TRANSVERSAL\`. */
  readonly specialty: string;
  readonly provenance?: ProcedenciaDeFicha;
  readonly fields: readonly CampoDeFicha[];
}

`;

writeFileSync(
  DESTINO,
  `${cabecera}${tipos}export const FICHAS_ESTANDAR: readonly FichaEstandar[] = ${JSON.stringify(fichas, null, 2)};\n`,
);

const campos = fichas.reduce((suma, f) => suma + f.fields.length, 0);
process.stdout.write(`${fichas.length} fichas · ${campos} campos → ${DESTINO}\n`);
