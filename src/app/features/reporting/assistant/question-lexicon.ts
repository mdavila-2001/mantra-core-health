/* ============================================================================
    Léxico del asistente de reportes (MAQUETA).

    Todo está ya normalizado (minúsculas, sin tildes). Lo escribe una persona a
    mano porque el «traductor» de la maqueta es un resolvedor determinista sobre
    el catálogo, no un modelo de lenguaje: lo que no esté aquí ni en el título o
    la definición de una medida no se reconoce, y el asistente lo dice.
    ========================================================================== */

/**
 * Palabras que no distinguen una medida de otra: relleno de la pregunta y
 * palabras tan generales que casarían con todo el catálogo («total», «mes»).
 */
export const PALABRAS_VACIAS: ReadonlySet<string> = new Set([
  // artículos, preposiciones, conjunciones
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'al', 'del', 'de', 'en', 'por',
  'para', 'con', 'sin', 'sobre', 'entre', 'desde', 'hasta', 'y', 'o', 'u', 'e', 'a', 'que', 'se',
  'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  // interrogativos y verbos de pregunta
  'cual', 'cuales', 'cuanto', 'cuantos', 'cuanta', 'cuantas', 'como', 'quien', 'donde', 'cuando',
  'es', 'son', 'fue', 'fueron', 'ser', 'esta', 'estan', 'estoy', 'hay', 'hubo', 'tengo', 'tiene',
  'tienen', 'tenemos', 'tuvimos', 'dame', 'dime', 'muestrame', 'muestra', 'mostrar', 'ver', 'quiero',
  'saber', 'necesito', 'favor', 'porfa', 'puedes', 'podrias', 'hola', 'gracias',
  // genéricas del dominio (aparecen en casi todos los títulos)
  'total', 'totales', 'valor', 'numero', 'cantidad', 'mes', 'meses', 'este', 'esta', 'ese', 'esa',
  'ultimo', 'ultimos', 'ultima', 'ultimas', 'periodo', 'dia', 'dias', 'actual', 'hoy', 'ahora',
  'plataforma', 'organizacion', 'reporte', 'reportes', 'medida', 'indicador', 'kpi', 'dato', 'datos',
  'porcentaje', 'tasa', 'promedio', 'medio', 'cifra', 'resultado', 'general', 'todo', 'toda', 'todos',
  'todas', 'tan', 'alta', 'alto', 'altos', 'hemos', 'tuvo', 'hicimos', 'mas', 'menos', 'muy', 'bien', 'mal', 'si', 'no', 'ya', 'como', 'nos', 'me', 'te', 'le',
]);

/**
 * Familias de términos que significan lo mismo para quien pregunta. La clave
 * es el concepto; cada frase se compara por palabras (con tolerancia a erratas
 * leves en las de 5 letras o más), no por subcadena.
 */
export const SINONIMOS: Readonly<Record<string, readonly string[]>> = {
  mrr: ['mrr', 'ingreso recurrente', 'ingresos recurrentes', 'ingreso mensual recurrente', 'recurrente mensual'],
  arr: ['arr', 'ingreso recurrente anual', 'ingresos recurrentes anuales'],
  churn: [
    'churn', 'baja', 'bajas', 'cancelacion', 'cancelaciones', 'cancelan', 'cancelaron', 'cancelado',
    'canceladas', 'abandono', 'abandonos', 'perdida de suscriptores',
  ],
  cac: ['cac', 'costo de adquisicion', 'costo por adquisicion', 'costo de captacion', 'costo por cliente nuevo'],
  roas: ['roas', 'retorno publicitario', 'retorno de inversion publicitaria', 'retorno de la publicidad'],
  ctr: ['ctr', 'clics sobre impresiones', 'porcentaje de clics', 'click through'],
  cpm: ['cpm', 'costo por mil', 'costo por mil impresiones'],
  cpc: ['cpc', 'costo por clic', 'costo por click'],
  'take-rate': [
    'take rate', 'takerate', 'comision de plataforma', 'comision de la plataforma',
    'comisiones de plataforma', 'comision retenida',
  ],
  'por-pagar': [
    'pendiente de pago', 'pendientes de pago', 'pendiente por pagar', 'por pagar', 'saldo por pagar',
    'deuda con actores', 'adeudado',
  ],
  payout: ['payout', 'payouts', 'pagos a actores', 'pagado a actores', 'desembolso', 'desembolsos', 'liquidacion', 'liquidaciones'],
  mora: ['mora', 'morosidad', 'moroso', 'morosos', 'vencido', 'vencidos', 'vencida', 'atrasado', 'atrasados', 'impago', 'impagos', 'cartera vencida'],
  conversion: ['conversion', 'conversiones', 'convierte', 'convirtieron', 'convertidos'],
  suscriptores: [
    'suscriptor', 'suscriptores', 'suscritos', 'doctores suscritos', 'base de suscriptores',
    'suscripciones activas', 'doctores activos',
  ],
  ingresos: ['ingreso', 'ingresos', 'facturacion', 'facturado', 'ventas', 'vendido', 'revenue'],
  arpu: ['arpu', 'ingreso por suscriptor', 'ingreso medio por suscriptor', 'ingreso por doctor', 'ticket promedio'],
  ltv: ['ltv', 'valor de vida', 'valor del cliente', 'lifetime value'],
  retencion: ['retencion', 'retenidos', 'permanencia'],
  gasto: ['gasto publicitario', 'gasto en publicidad', 'inversion publicitaria', 'inversion en pauta', 'spend', 'gastamos', 'invertimos'],
  impresiones: ['impresion', 'impresiones', 'alcance publicitario'],
  clics: ['clic', 'clics', 'click', 'clicks'],
  registros: ['registro', 'registros', 'altas', 'cuentas nuevas', 'nuevas cuentas', 'cuentas creadas'],
  calidad: ['completitud', 'calidad del dato', 'datos faltantes', 'datos incompletos'],
  cobros: ['cobro', 'cobros', 'cobranza', 'cobrado', 'caja'],
};

/**
 * Conceptos que nombran una población o un rubro (no una medida): aparecen en
 * muchos títulos, así que pesan menos que una medida con nombre propio
 * («churn», «CAC»). Sin esto, «churn de suscriptores» empata con «Doctores
 * suscritos activos».
 */
export const CONCEPTOS_GENERICOS: ReadonlySet<string> = new Set([
  'suscriptores',
  'ingresos',
  'impresiones',
  'clics',
  'registros',
  'cobros',
]);

/**
 * Preguntas que piden datos de personas o clínicos. Los reportes comerciales
 * no los tienen (son agregados de ventas) y el asistente tampoco debe
 * buscarlos: se rechaza antes de puntuar nada, aunque la frase mencione una
 * medida («MRR por paciente»).
 */
export const PEOPLE_PATTERNS: readonly RegExp[] = [
  /\bpacientes?\b/,
  /\bpersonas?\b/,
  /\bhistori(?:a|as) clinicas?\b/,
  // «clínico/clínicos» (datos clínicos). «Clínica(s)» es un tipo de organización y un anunciante legítimo.
  /\bclinicos?\b/,
  /\bdiagnostic\w*/,
  /\brecetas?\b/,
  /\bmedicament\w*/,
  /\btratamientos?\b/,
  /\benfermedad\w*/,
  /\bexpedientes?\b/,
  /\bcedula\b/,
  /\bdocumento de identidad\b/,
  /\bdatos personales\b/,
  /\b(?:telefono|correo|email|direccion|nombre) de(?:l| la| los| las)? \w+/,
];

/** Frases de arranque sugeridas (5). Se envían tal cual como pregunta. */
export const SUGERENCIAS_INICIALES: readonly string[] = [
  '¿Cuál es el MRR?',
  '¿Cuál es el churn de suscriptores?',
  '¿Cuál es el ROAS de las campañas?',
  '¿Cuánto hay pendiente de pago a actores?',
  '¿Cuál es el CAC?',
];
