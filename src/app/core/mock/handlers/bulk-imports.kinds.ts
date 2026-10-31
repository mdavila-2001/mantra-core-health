/* ============================================================================
    Tipos de carga masiva del backend simulado (`/admin/bulk-imports`).

    **DATOS SINTÉTICOS, DECLARADOS COMO TALES.** Los diez tipos y sus nombres
    son los de la API (`bulk_import/schema`), pero las columnas son un
    subconjunto compacto para poder ver la pantalla: la lista completa y su
    trazabilidad a los DTO la sirve la API. Ningún valor de ejemplo es de una
    persona real (`SINT-…`, `.invalid`).

    Ningún código clínico está escrito acá: las filas clínicas llevan
    `<campo>System` y `<campo>Code`, y quien los resuelve es la terminología de
    la API — que en esta maqueta, como hoy en la API, no está conectada.
    ========================================================================== */

import type { BulkImportGroup } from '../../data-access/admin-portal/bulk-imports.types';

export type TipoDeColumna = 'string' | 'text' | 'date' | 'datetime' | 'email' | 'phone' | 'decimal';

export interface ColumnaSimulada {
  readonly name: string;
  readonly type: TipoDeColumna;
  readonly required: boolean;
  readonly description: string;
  readonly example: string;
}

export interface TipoSimulado {
  readonly kind: string;
  readonly group: BulkImportGroup;
  readonly title: string;
  readonly description: string;
  readonly permission: 'bulk_import.users' | 'bulk_import.clinical';
  readonly columns: readonly ColumnaSimulada[];
  /** Columna cuyo valor no puede repetirse dentro del archivo. */
  readonly uniqueKey: string;
}

const col = (
  name: string,
  type: TipoDeColumna,
  required: boolean,
  description: string,
  example: string,
): ColumnaSimulada => ({ name, type, required, description, example });

const PERSONA: readonly ColumnaSimulada[] = [
  col('name', 'string', true, 'Nombre de pila', 'Persona'),
  col('lastName', 'string', true, 'Apellido paterno', 'Sintetico'),
  col('nationalId', 'string', true, 'Documento de identidad (letras, dígitos, punto y guion)', 'SINT-0001'),
  col('email', 'email', true, 'Correo electrónico', 'persona.sintetica@ejemplo.invalid'),
];

/** Quién es el paciente y cómo se llama la fila en el sistema de origen. */
const PACIENTE_REF: readonly ColumnaSimulada[] = [
  col('nationalId', 'string', true, 'Documento del paciente, que debe existir', 'SINT-0001'),
  col('birthDate', 'date', true, 'Fecha de nacimiento AAAA-MM-DD', '1990-01-15'),
  col('sourceRecordId', 'string', true, 'Identificador del registro en el sistema de origen', 'ORIGEN-0001'),
];

const CODIGO = (campo: string, que: string): readonly ColumnaSimulada[] => [
  col(`${campo}System`, 'string', true, `Sistema de codificación de ${que}`, 'sistema-demo'),
  col(`${campo}Code`, 'string', true, `Código de ${que} dentro de ese sistema`, 'SINT-0001'),
];

const clinico = (
  kind: string,
  title: string,
  description: string,
  extra: readonly ColumnaSimulada[],
): TipoSimulado => ({
  kind,
  group: 'CLINICAL',
  title,
  description,
  permission: 'bulk_import.clinical',
  columns: [...PACIENTE_REF, ...extra],
  uniqueKey: 'sourceRecordId',
});

export const TIPOS_SIMULADOS: readonly TipoSimulado[] = [
  {
    kind: 'usuario-paciente',
    group: 'USERS',
    title: 'Altas de pacientes',
    description:
      'Cuentas de pacientes en estado pendiente de activación, sin contraseña: cada titular activa la suya.',
    permission: 'bulk_import.users',
    columns: [
      ...PERSONA,
      col('phone', 'phone', true, 'Teléfono de contacto', '70000001'),
      col('birthDate', 'date', true, 'Fecha de nacimiento AAAA-MM-DD', '1990-01-15'),
    ],
    uniqueKey: 'nationalId',
  },
  {
    kind: 'usuario-profesional',
    group: 'USERS',
    title: 'Altas de profesionales',
    description: 'Cuentas de profesionales de la salud en estado pendiente de activación, sin contraseña.',
    permission: 'bulk_import.users',
    columns: [
      ...PERSONA,
      col('licenseNumber', 'string', true, 'Número de matrícula profesional', 'MAT-SINT-01'),
      col('professionalTitle', 'string', false, 'Título profesional', 'Titulo de ejemplo'),
    ],
    uniqueKey: 'nationalId',
  },
  {
    kind: 'usuario-personal-organizacion',
    group: 'USERS',
    title: 'Altas de personal de la organización',
    description: 'Personal administrativo o de apoyo de la organización activa, sin contraseña.',
    permission: 'bulk_import.users',
    columns: [
      col('displayName', 'string', true, 'Nombre con el que figura en el sistema', 'Persona Sintetica'),
      col('email', 'email', true, 'Correo electrónico', 'personal.sintetico@ejemplo.invalid'),
      col('phone', 'phone', false, 'Teléfono de contacto', '70000002'),
    ],
    uniqueKey: 'email',
  },
  clinico('hc-encuentro', 'Historia clínica · encuentros', 'Encuentros ya ocurridos de pacientes existentes.', [
    col('startAt', 'datetime', true, 'Inicio del encuentro (ISO 8601)', '2026-01-15T09:00:00Z'),
    col('endAt', 'datetime', false, 'Fin del encuentro (ISO 8601)', '2026-01-15T09:30:00Z'),
    col('reasonText', 'text', false, 'Motivo de la consulta', 'Control de rutina (ejemplo)'),
  ]),
  clinico('hc-diagnostico', 'Historia clínica · diagnósticos', 'Diagnósticos ya registrados en el sistema de origen.', [
    ...CODIGO('diagnosis', 'el diagnóstico'),
    col('onsetAt', 'date', false, 'Inicio AAAA-MM-DD', '2025-06-01'),
    col('noteText', 'text', false, 'Observación', 'Texto de ejemplo'),
  ]),
  clinico('hc-medicacion', 'Historia clínica · medicación', 'Medicación administrada, registrada en el origen.', [
    ...CODIGO('medication', 'el medicamento'),
    col('doseDecimal', 'decimal', false, 'Dosis en número', '1'),
    col('administeredAt', 'datetime', true, 'Cuándo se administró (ISO 8601)', '2026-01-15T09:10:00Z'),
  ]),
  clinico('hc-alergia', 'Historia clínica · alergias', 'Alergias e intolerancias registradas en el origen.', [
    ...CODIGO('allergen', 'el alérgeno'),
    col('noteText', 'text', false, 'Observación', 'Texto de ejemplo'),
  ]),
  clinico('hc-signo-vital', 'Historia clínica · signos vitales', 'Mediciones de signos vitales ya tomadas.', [
    ...CODIGO('vital', 'el signo vital'),
    col('value', 'decimal', true, 'Valor medido', '36.5'),
    col('effectiveAt', 'datetime', true, 'Cuándo se midió (ISO 8601)', '2026-01-15T09:05:00Z'),
  ]),
  clinico('hc-resultado', 'Historia clínica · resultados', 'Resultados de estudios ya informados.', [
    ...CODIGO('result', 'el estudio'),
    col('valueDecimal', 'decimal', false, 'Resultado numérico', '5.2'),
    col('valueText', 'text', false, 'Resultado en texto', 'Texto de ejemplo'),
    col('effectiveAt', 'datetime', true, 'Fecha del resultado (ISO 8601)', '2026-01-15T09:00:00Z'),
  ]),
  clinico('hc-nota', 'Historia clínica · notas', 'Notas clínicas de profesionales ya registradas.', [
    col('authorLicenseNumber', 'string', true, 'Matrícula de quien firmó la nota', 'MAT-SINT-01'),
    col('recordedAt', 'datetime', true, 'Cuándo se escribió (ISO 8601)', '2026-01-15T09:40:00Z'),
    col('noteText', 'text', true, 'Texto de la nota', 'Texto de ejemplo'),
  ]),
];

export function tipoSimulado(kind: string): TipoSimulado | undefined {
  return TIPOS_SIMULADOS.find((t) => t.kind === kind);
}
