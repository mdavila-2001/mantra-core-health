#!/usr/bin/env node
/**
 * Genera los fixtures del catálogo de estudios del simulador DESDE los JSON
 * investigados (H0), nunca a mano:
 *
 *   src/app/core/mock/fixtures/study-catalog-lab.data.ts
 *   src/app/core/mock/fixtures/study-catalog-imaging.data.ts
 *
 * Fuente: docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo/
 *   laboratorio.json · imagenologia.json
 *
 * Es un subconjunto representativo (el catálogo completo tiene 532 análisis y
 * 475 estudios de imagen): los análisis enlazados a un código local de la API
 * (`codigo_api_existente`), Chagas, electrolitos, EGO y hemograma; los estudios
 * de imagen enlazados más todos los de mano, tórax, abdomen y rodilla. Las
 * modalidades, lateralidades, regiones y muestras van completas.
 *
 * Uso: node scripts/gen-study-catalog-fixtures.mjs [--check]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const FUENTE = join(
  RAIZ,
  'docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo',
);
const SALIDA = join(RAIZ, 'src/app/core/mock/fixtures');
const check = process.argv.includes('--check');

const lab = JSON.parse(readFileSync(join(FUENTE, 'laboratorio.json'), 'utf8'));
const img = JSON.parse(readFileSync(join(FUENTE, 'imagenologia.json'), 'utf8'));

const LAB_EXTRA = /^(CHAGAS_|ELECTROLITOS$|EGO$|HEMOGRAMA)/;
const REGIONES_COMPLETAS = new Set(['MANO', 'TORAX', 'ABDOMEN', 'RODILLA']);

/** `fuente` viene como texto o como lista; vacía = sin fuente. */
const fuente = (f) => {
  const t = Array.isArray(f) ? f.join(';') : f;
  return t ? t : null;
};

const analisis = lab.analisis
  .filter((a) => a.codigo_api_existente || LAB_EXTRA.test(a.codigo))
  .map((a) => ({
    code: a.codigo,
    name: a.nombre,
    synonyms: a.sinonimos ?? [],
    section: a.seccion,
    loinc: a.loinc ?? null,
    loincName: a.loinc_nombre ?? null,
    specimen: a.muestra ?? null,
    fasting: a.ayuno ?? null,
    turnaroundHours: a.tiempo_entrega_horas ?? null,
    isPanel: a.es_panel === true && (a.componentes ?? []).length > 0,
    legacyCode: a.codigo_api_existente ?? null,
    source: fuente(a.fuente),
    components: (a.componentes ?? []).map((c) => ({
      code: c.codigo,
      name: c.nombre,
      loinc: c.loinc ?? null,
      loincName: c.loinc_nombre ?? null,
      unit: c.unidad ?? null,
      byDefault: c.seleccionado_por_defecto !== false,
    })),
  }));

const secciones = lab.secciones.map((s) => ({ code: s.codigo, name: s.nombre }));
const muestras = lab.muestras.map((m) => ({
  code: m.codigo,
  name: m.nombre,
  hl7: m.hl7_0487 ?? null,
  snomed: m.snomed ?? null,
}));

const modalidades = img.modalidades.map((m) => ({ code: m.codigo, name: m.nombre, dicom: m.dicom ?? null }));
const lateralidades = img.lateralidades
  .filter((l) => l.codigo !== 'UNI')
  .map((l) => ({ code: l.codigo, name: l.nombre, dicom: l.dicom }));
const regiones = img.regiones.map((r) => ({
  code: r.codigo,
  name: r.nombre,
  parent: r.padre ?? null,
  type: r.tipo ?? null,
  paired: r.admite_lateralidad === true,
  snomed: r.snomed ?? null,
}));
const estudios = img.estudios
  .filter((e) => e.codigo_api_existente || REGIONES_COMPLETAS.has(e.region))
  .map((e) => ({
    code: e.codigo,
    name: e.nombre,
    modality: e.modalidad,
    region: e.region,
    projections: e.proyecciones ?? [],
    contrast: e.contraste,
    contrastRoute: e.via_contraste ?? null,
    requiresLaterality: e.requiere_lateralidad === true,
    preparation: e.preparacion ?? null,
    loinc: e.loinc ?? null,
    radlex: e.radlex_rpid ?? null,
    legacyCode: e.codigo_api_existente ?? null,
    source: fuente(e.fuente),
  }));

const cabecera = (que, version) => `/* ============================================================================
    ${que}

    GENERADO por scripts/gen-study-catalog-fixtures.mjs desde
    docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo/ (versión ${version}).
    No editar a mano: es un subconjunto representativo del catálogo investigado.
    Los códigos LOINC / RadLex / DICOM / SNOMED vienen verificados en la fuente.
    ========================================================================== */
/* eslint-disable */
`;
const dato = (nombre, tipo, valor) =>
  `export const ${nombre}: ${tipo} = ${JSON.stringify(valor)};\n`;

const labTs =
  cabecera('Catálogo de laboratorio del simulador (subconjunto)', lab.version) +
  `
export interface LabComponentRow {
  readonly code: string;
  readonly name: string;
  readonly loinc: string | null;
  readonly loincName: string | null;
  readonly unit: string | null;
  readonly byDefault: boolean;
}
export interface LabAnalysisRow {
  readonly code: string;
  readonly name: string;
  readonly synonyms: readonly string[];
  readonly section: string;
  readonly loinc: string | null;
  readonly loincName: string | null;
  readonly specimen: string | null;
  readonly fasting: boolean | null;
  readonly turnaroundHours: number | null;
  readonly isPanel: boolean;
  readonly legacyCode: string | null;
  readonly source: string | null;
  readonly components: readonly LabComponentRow[];
}
export interface LabSpecimenRow {
  readonly code: string;
  readonly name: string;
  readonly hl7: string | null;
  readonly snomed: string | null;
}
export interface LabSectionRow {
  readonly code: string;
  readonly name: string;
}

` +
  dato('LAB_SECTIONS', 'readonly LabSectionRow[]', secciones) +
  dato('LAB_SPECIMENS', 'readonly LabSpecimenRow[]', muestras) +
  dato('LAB_ANALYSES', 'readonly LabAnalysisRow[]', analisis);

const imgTs =
  cabecera('Catálogo de imagenología del simulador (subconjunto)', img.version) +
  `
export interface ImagingModalityRow {
  readonly code: string;
  readonly name: string;
  readonly dicom: string | null;
}
export interface ImagingLateralityRow {
  readonly code: string;
  readonly name: string;
  readonly dicom: string;
}
export interface ImagingRegionRow {
  readonly code: string;
  readonly name: string;
  readonly parent: string | null;
  readonly type: string | null;
  /** La región es par: admite lateralidad. */
  readonly paired: boolean;
  readonly snomed: string | null;
}
export interface ImagingStudyRow {
  readonly code: string;
  readonly name: string;
  readonly modality: string;
  readonly region: string;
  readonly projections: readonly string[];
  readonly contrast: 'sin' | 'con' | 'sin_y_con';
  readonly contrastRoute: string | null;
  readonly requiresLaterality: boolean;
  readonly preparation: string | null;
  readonly loinc: string | null;
  readonly radlex: string | null;
  readonly legacyCode: string | null;
  readonly source: string | null;
}

` +
  dato('IMAGING_MODALITIES', 'readonly ImagingModalityRow[]', modalidades) +
  dato('IMAGING_LATERALITIES', 'readonly ImagingLateralityRow[]', lateralidades) +
  dato('IMAGING_REGIONS', 'readonly ImagingRegionRow[]', regiones) +
  dato('IMAGING_STUDIES', 'readonly ImagingStudyRow[]', estudios);

let desviado = false;
for (const [nombre, texto] of [
  ['study-catalog-lab.data.ts', labTs],
  ['study-catalog-imaging.data.ts', imgTs],
]) {
  const ruta = join(SALIDA, nombre);
  if (check) {
    if (!existsSync(ruta) || readFileSync(ruta, 'utf8') !== texto) {
      console.error(`✗ ${nombre} no coincide con los JSON: regenerá con node scripts/gen-study-catalog-fixtures.mjs`);
      desviado = true;
    }
  } else {
    writeFileSync(ruta, texto);
    console.log(`✓ ${nombre} (${texto.length} bytes)`);
  }
}
console.log(`  laboratorio: ${analisis.length} análisis, ${muestras.length} muestras · imagen: ${estudios.length} estudios, ${regiones.length} regiones, ${modalidades.length} modalidades`);
if (desviado) process.exit(1);
