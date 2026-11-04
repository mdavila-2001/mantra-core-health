import type {
  FitCheckStatus,
  FitDimension,
  FitSeverity,
} from '../../data-access/admin-portal/catalog-fit.types';

/* Comprobaciones sintéticas de la sonda de ajuste del catálogo (separadas de catalog-fit.handlers.ts por el techo de 600 líneas). */

export interface Semilla {
  readonly id: string;
  readonly dimension: FitDimension;
  readonly title: string;
  readonly severity: FitSeverity;
  readonly status: FitCheckStatus;
  readonly covered: number | null;
  readonly denominator: number | null;
  readonly hallazgos: readonly (readonly [string, string])[];
  readonly total?: number;
  readonly reason?: string;
  readonly remediation: string;
}

/* Las comprobaciones y sus ids son las de la API; los números y los sujetos, inventados. */
export const SEMILLAS: readonly Semilla[] = [
  {
    id: 'FIT-RUT-001',
    dimension: 'ROUTES',
    title: 'Toda ruta HTTP del código está en el inventario de operaciones',
    severity: 'ALTA',
    status: 'FALLA',
    covered: 1_616,
    denominator: 1_618,
    hallazgos: [
      [
        'GET /ejemplo/rutas-nuevas',
        'Simulado: ExampleController.list existe en el código y no está en el inventario',
      ],
      [
        'POST /ejemplo/rutas-nuevas/:p/cerrar',
        'Simulado: ExampleController.close existe en el código y no está en el inventario',
      ],
    ],
    remediation:
      'Regenerar el inventario (`yarn inventario:endpoints`) y, si la ruta sigue sin aparecer, revisar que su controlador esté registrado y documentado en el contrato.',
  },
  {
    id: 'FIT-RUT-002',
    dimension: 'ROUTES',
    title: 'Toda operación del inventario corresponde a una ruta real (sin huérfanas)',
    severity: 'ALTA',
    status: 'OK',
    covered: 1_618,
    denominator: 1_618,
    hallazgos: [],
    remediation:
      'Regenerar el inventario; si la operación sigue ahí, la ruta se borró o cambió de plantilla.',
  },
  {
    id: 'FIT-RUT-003',
    dimension: 'ROUTES',
    title: 'El inventario sólo lista rutas reales (sin métodos auxiliares con verbo desconocido)',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_698,
    denominator: 1_709,
    total: 11,
    hallazgos: [
      ['ExampleController_toInt', 'Simulado: entrada con verbo DESCONOCIDO: no es una ruta HTTP'],
    ],
    remediation:
      'Corregir el generador del inventario para que un método sin decorador HTTP no se registre como operación.',
  },
  {
    id: 'FIT-RUT-004',
    dimension: 'ROUTES',
    title: 'Toda ruta del inventario está publicada en el contrato OpenAPI',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_525,
    denominator: 1_618,
    total: 93,
    hallazgos: [
      [
        'GET /ejemplo/borrador',
        'Simulado: ExampleDraftController_list existe en el código y el contrato OpenAPI no la publica',
      ],
    ],
    remediation: 'Documentar el controlador para Swagger y regenerar `openapi/openapi.json`.',
  },
  {
    id: 'FIT-MOD-001',
    dimension: 'MODEL',
    title: 'Toda tabla del modelo existe en el catálogo vivo (escaneo)',
    severity: 'ALTA',
    status: 'OK',
    covered: 1_313,
    denominator: 1_313,
    hallazgos: [],
    remediation: 'Aplicar el DDL del modelo a la base y pedir un escaneo.',
  },
  {
    id: 'FIT-MOD-002',
    dimension: 'MODEL',
    title: 'Toda tabla observada en la base existe en el catálogo estático (modelo)',
    severity: 'ALTA',
    status: 'FALLA',
    covered: 1_312,
    denominator: 1_313,
    hallazgos: [['ejemplo.tabla_de_mas', 'Simulado: la base la tiene y el modelo no la declara']],
    remediation:
      'Declararla en el modelo y regenerar el inventario, o excluir su schema del escaneo.',
  },
  {
    id: 'FIT-MOD-003',
    dimension: 'MODEL',
    title: 'Toda columna del modelo existe en el catálogo vivo',
    severity: 'ALTA',
    status: 'OK',
    covered: 18_263,
    denominator: 18_263,
    hallazgos: [],
    remediation: 'Aplicar la migración del modelo a la base y reescanear.',
  },
  {
    id: 'FIT-MOD-004',
    dimension: 'MODEL',
    title: 'Toda columna observada en la base existe en el catálogo estático',
    severity: 'MEDIA',
    status: 'OK',
    covered: 18_263,
    denominator: 18_263,
    hallazgos: [],
    remediation: 'Declarar la columna en el modelo y regenerar el inventario.',
  },
  {
    id: 'FIT-MOD-005',
    dimension: 'MODEL',
    title: 'El ORM coincide con el modelo (entidades, columnas, nulabilidad y tipos)',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 3,
    denominator: 6,
    hallazgos: [
      [
        'entidadesSinTabla',
        'Simulado: entidades del ORM sin tabla en el modelo: 12 elemento(s) (ejemplo.a, ejemplo.b)',
      ],
      ['nulabilidad', 'Simulado: nulabilidad divergente: 4 elemento(s)'],
    ],
    remediation:
      'Regenerar las entidades desde el modelo; el esquema fluye modelo → entidades, nunca al revés.',
  },
  {
    id: 'FIT-MOD-006',
    dimension: 'MODEL',
    title:
      'El modelo coincide con la base contra la que se generó el inventario (foto de generación)',
    severity: 'MEDIA',
    status: 'SIN_DATO',
    covered: null,
    denominator: null,
    hallazgos: [],
    reason: 'Simulado: deriva modelo/base (inventario): falló la lectura (Error)',
    remediation: 'Regenerar la comparación contra una base con el DDL actual.',
  },
  {
    id: 'FIT-COM-001',
    dimension: 'COMPLETENESS',
    title: 'Toda operación declara las tablas que afecta (o por qué no toca ninguna)',
    severity: 'ALTA',
    status: 'OK',
    covered: 1_618,
    denominator: 1_618,
    hallazgos: [],
    remediation: 'Revisar la operación: si toca datos, el generador no resolvió la llamada.',
  },
  {
    id: 'FIT-COM-002',
    dimension: 'COMPLETENESS',
    title: 'Toda operación con cuerpo declara su DTO de entrada',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_007,
    denominator: 1_012,
    hallazgos: [
      [
        'POST /ejemplo/archivos',
        'Simulado: ExampleController_upload recibe cuerpo y no declara el DTO de entrada',
      ],
    ],
    remediation: 'Tipar el `@Body()` con una clase DTO validada y anotarla para el contrato.',
  },
  {
    id: 'FIT-COM-003',
    dimension: 'COMPLETENESS',
    title: 'Toda operación con respuesta declara su DTO de salida',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_446,
    denominator: 1_599,
    total: 153,
    hallazgos: [
      [
        'PATCH /ejemplo/activos/{id}',
        'Simulado: ExampleController_patch no declara el DTO de salida',
      ],
    ],
    remediation:
      'Anotar el handler con `@ApiResponse({ type: …Dto })`. Las respuestas 204 no cuentan.',
  },
  {
    id: 'FIT-COM-004',
    dimension: 'COMPLETENESS',
    title: 'Toda operación no pública declara los roles que la pueden llamar',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_256,
    denominator: 1_554,
    total: 298,
    hallazgos: [
      [
        'GET /ejemplo/contenido',
        'Simulado: ExampleController_content exige sesión pero ningún rol',
      ],
    ],
    remediation:
      'Declarar `@Roles(...)` o dejar escrito en el contrato que basta una sesión autenticada.',
  },
  {
    id: 'FIT-COM-005',
    dimension: 'COMPLETENESS',
    title: 'Toda tabla tiene descripción de sistema (modelo o comentario en la base)',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 1_259,
    denominator: 1_313,
    total: 54,
    hallazgos: [
      [
        'ejemplo.tabla_sin_descripcion',
        'Simulado: sin descripción de sistema ni en el modelo ni en la base',
      ],
    ],
    remediation: 'Documentar la tabla en el modelo y regenerar el inventario.',
  },
  {
    id: 'FIT-COM-006',
    dimension: 'COMPLETENESS',
    title: 'Toda tabla observada tiene ficha curada con descripción de negocio',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 212,
    denominator: 1_313,
    total: 1_101,
    hallazgos: [['ejemplo.tabla_sin_ficha', 'Simulado: sin ficha curada']],
    remediation: 'Completar la ficha del objeto y enviarla a revisión.',
  },
  {
    id: 'FIT-FRE-001',
    dimension: 'FRESHNESS',
    title: 'El último escaneo de la base no está vencido',
    severity: 'ALTA',
    status: 'OK',
    covered: 1,
    denominator: 1,
    hallazgos: [],
    remediation:
      'Ver los escaneos y comprobar que el worker `data_catalog` esté vivo en «Instancias».',
  },
  {
    id: 'FIT-FRE-002',
    dimension: 'FRESHNESS',
    title: 'La última importación del inventario corresponde al código desplegado (huella)',
    severity: 'ALTA',
    status: 'FALLA',
    covered: 0,
    denominator: 1,
    hallazgos: [
      [
        'huella',
        'Simulado: código aaaa111122223333 ≠ lo importado bbbb444455556666 (2 solo en el código, 0 solo en lo importado)',
      ],
    ],
    remediation: 'Pedir la importación con un inventario regenerado desde este código.',
  },
  {
    id: 'FIT-FRE-003',
    dimension: 'FRESHNESS',
    title: 'El inventario generado corresponde al código desplegado (huella)',
    severity: 'ALTA',
    status: 'FALLA',
    covered: 0,
    denominator: 1,
    hallazgos: [['huella', 'Simulado: código aaaa111122223333 ≠ el inventario bbbb444455556666']],
    remediation:
      'Regenerar el inventario en la imagen; uno viejo describe una API que ya no existe.',
  },
  {
    id: 'FIT-MUT-001',
    dimension: 'MUTABILITY',
    title:
      'Toda tabla declara su clasificación de mutabilidad (append-only, actualizable, soft-delete, purga, legal-hold)',
    severity: 'MEDIA',
    status: 'NO_DECLARADO',
    covered: null,
    denominator: null,
    hallazgos: [],
    reason:
      'Simulado: no hay una fuente de mutabilidad registrada: la taxonomía aún no existe, así que no se mide ni se inventa un cero.',
    remediation:
      'Al registrar la fuente de la taxonomía, esta comprobación pasa de «No declarado» a medir. Mientras tanto no falla el módulo.',
  },
  {
    id: 'FIT-SEN-001',
    dimension: 'SENSITIVITY',
    title: 'Toda tabla observada tiene su sensibilidad clasificada',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 901,
    denominator: 1_313,
    total: 412,
    hallazgos: [['ejemplo.tabla_sin_clasificar', 'Simulado: sensibilidad UNKNOWN']],
    remediation:
      'Clasificar la tabla en su ficha; `UNKNOWN` significa «sin clasificar», no «sin datos sensibles».',
  },
  {
    id: 'FIT-SEN-002',
    dimension: 'SENSITIVITY',
    title: 'Toda columna observada tiene su sensibilidad clasificada',
    severity: 'MEDIA',
    status: 'FALLA',
    covered: 17_100,
    denominator: 18_263,
    total: 1_163,
    hallazgos: [['ejemplo.tabla_sin_clasificar.columna', 'Simulado: sin ficha de columna']],
    remediation: 'Correr la clasificación automática y revisar a mano las columnas en duda.',
  },
  {
    id: 'FIT-SEN-003',
    dimension: 'SENSITIVITY',
    title:
      'Ninguna columna que parece dato personal, clínico o credencial está sin clasificar o por debajo de lo detectado',
    severity: 'ALTA',
    status: 'NO_APLICA',
    covered: null,
    denominator: null,
    hallazgos: [],
    reason: 'Simulado: no hay nada que comprobar: el universo está vacío',
    remediation: 'Subir la sensibilidad de la columna al nivel detectado.',
  },
];
