/* ============================================================================
    ESPEJO DE LA API (copia, no se edita a mano).

    Este archivo es la copia de `mantra-core-health-api/src/modules/clinical_import/clinical-import.template.ts`.
    La maqueta valida y genera plantillas con el MISMO código que la API, para
    que lo que se ve en pantalla (vista previa, errores por fila, plantillas
    CSV y JSON) sea lo que dirá la API. Si cambia el esquema en la API, se
    vuelve a copiar; no se corrige acá.
    ========================================================================== */

import { kindSpec, type KindSpec } from './clinical-imports.schema';
import type { ImportFormat } from './clinical-imports.model';

/* ============================================================================
    Plantillas descargables (T1): CSV y JSON, del MISMO esquema que valida.

    - CSV: encabezado con todas las columnas del tipo y una fila de ejemplo.
    - JSON: esquema (columnas con tipo, obligatoriedad, descripción y la
      entidad de destino) + `rows` con la fila de ejemplo. Como el cargador lee
      `rows`, el JSON de la plantilla es también un archivo cargable.

    Los ejemplos son sintéticos; `buildTemplate` no sabe de ellos: los toma del
    esquema, igual que lo hace la prueba que exige que la fila pase.
    ========================================================================== */

export interface TemplateFile {
  readonly fileName: string;
  readonly contentType: string;
  readonly content: string;
}

function csvCell(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exampleRow(spec: KindSpec): Readonly<Record<string, string>> {
  return Object.fromEntries(spec.columns.map((c) => [c.name, c.example]));
}

export function buildTemplate(
  kind: string,
  format: ImportFormat,
): TemplateFile | null {
  const spec = kindSpec(kind);
  if (spec === undefined) return null;
  const fileName = `plantilla-${spec.kind}-v${spec.version}.${format}`;

  if (format === 'csv') {
    const header = spec.columns.map((c) => csvCell(c.name)).join(',');
    const example = spec.columns.map((c) => csvCell(c.example)).join(',');
    return {
      fileName,
      contentType: 'text/csv; charset=utf-8',
      content: `${header}\n${example}\n`,
    };
  }

  const document = {
    kind: spec.kind,
    version: spec.version,
    title: spec.title,
    description: spec.description,
    target: spec.target,
    columns: spec.columns.map((c) => ({
      name: c.name,
      type: c.type,
      required: c.required,
      description: c.description,
      example: c.example,
      source: c.source,
      ...(c.max === undefined ? {} : { maxLength: c.max }),
      ...(c.concept === undefined
        ? {}
        : { conceptGroup: c.concept.group, conceptPart: c.concept.part }),
    })),
    rules: [
      'Formatos admitidos: csv y json. El JSON admite un arreglo de filas o un objeto con `rows`.',
      'Cada fila se enlaza a un paciente que YA existe por documento y fecha de nacimiento; sin una única coincidencia se rechaza.',
      'Cada concepto clínico va como par `<campo>System` y `<campo>Code` y se resuelve contra la terminología: no se aceptan códigos que no existan.',
      'Sólo se agrega: un registro idéntico de este origen se omite y uno distinto se informa como conflicto, nunca se sobrescribe.',
      'La fila de ejemplo es SINTÉTICA: reemplácela por sus datos antes de cargar.',
      ...spec.rules.map((r) => `${r.field}: ${r.message}.`),
    ],
    rows: [exampleRow(spec)],
  };
  return {
    fileName,
    contentType: 'application/json; charset=utf-8',
    content: `${JSON.stringify(document, null, 2)}\n`,
  };
}
