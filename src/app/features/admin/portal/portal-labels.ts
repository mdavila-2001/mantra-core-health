import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { Rotulo } from '../platform/platform-labels';

/* ============================================================================
    Rótulos y tonos del portal de inventario.

    Traducen los códigos que devuelve `/admin/portal/*` a texto y color. No
    deciden nada: un código que no está acá se muestra tal cual con tono neutro,
    nunca con un significado inventado. Y el color nunca va solo — todo rótulo
    trae su texto.
    ========================================================================== */

const NEUTRO = (code: string): Rotulo => ({ label: code, tone: 'secondary' });

/** Un rotulador que además sabe qué códigos conoce (para armar las opciones de un filtro). */
export type LabelTable = ((code: string | null | undefined) => Rotulo) & {
  readonly codes: readonly string[];
};

function tabla(entradas: Readonly<Record<string, Rotulo>>, vacio = 'Sin dato'): LabelTable {
  const rotular = (code: string | null | undefined): Rotulo =>
    code ? (entradas[code] ?? NEUTRO(code)) : { label: vacio, tone: 'secondary' };
  return Object.assign(rotular, { codes: Object.keys(entradas) });
}

/**
 * Las opciones de un filtro, sacadas de los códigos que la tabla conoce. Son los
 * mismos códigos que la API acepta como filtro; el texto es sólo presentación.
 */
export function optionsOf(table: LabelTable): readonly SelectOption<string>[] {
  return table.codes.map((code) => ({ value: code, label: table(code).label }));
}

export const metodoHttp = tabla({
  GET: { label: 'GET', tone: 'info' },
  POST: { label: 'POST', tone: 'success' },
  PUT: { label: 'PUT', tone: 'warning' },
  PATCH: { label: 'PATCH', tone: 'warning' },
  DELETE: { label: 'DELETE', tone: 'error' },
});

export const riesgo = tabla({
  ALTO: { label: 'Riesgo alto', tone: 'error' },
  MEDIO: { label: 'Riesgo medio', tone: 'warning' },
  BAJO: { label: 'Riesgo bajo', tone: 'success' },
});

export const severidad = tabla({
  ALTA: { label: 'Alta', tone: 'error' },
  MEDIA: { label: 'Media', tone: 'warning' },
  BAJA: { label: 'Baja', tone: 'info' },
  INFO: { label: 'Informativa', tone: 'secondary' },
});

/** Quién revisó lo que el generador detectó. `AUTO_DETECTADA` = nadie todavía. */
export const revisionInventario = tabla({
  AUTO_DETECTADA: { label: 'Auto-detectada', tone: 'secondary' },
  REVISADA: { label: 'Revisada', tone: 'success' },
});

export const datosPersonales = tabla({
  SIN_FUENTE: { label: 'Sin clasificar', tone: 'secondary' },
  SI: { label: 'Datos personales', tone: 'warning' },
  NO: { label: 'Sin datos personales', tone: 'success' },
});

export const estadoDeGobierno = tabla({
  SIN_FUENTE: { label: 'Sin fuente', tone: 'secondary' },
  NO_DECLARADO: { label: 'No declarado', tone: 'secondary' },
  DECLARADO: { label: 'Declarado', tone: 'success' },
});

export const confianza = tabla({
  DIRECTA: { label: 'Directa', tone: 'success' },
  POR_TIPO: { label: 'Por tipo', tone: 'info' },
  POR_REGISTRO: { label: 'Por registro', tone: 'info' },
  POR_SQL: { label: 'Por SQL', tone: 'warning' },
});

export const operacionSobreTabla = tabla({
  LEE: { label: 'Lee', tone: 'info' },
  ESCRIBE: { label: 'Escribe', tone: 'warning' },
  BORRA: { label: 'Borra', tone: 'error' },
});

/** Cómo toca la tabla un acceso concreto (`detalle` de la API); `LEE` repite el verbo de `operacionSobreTabla`. */
export const accionSobreTabla = tabla({
  LEE: { label: 'Lee', tone: 'info' },
  CREA: { label: 'Crea', tone: 'warning' },
  ACTUALIZA: { label: 'Actualiza', tone: 'warning' },
  GUARDA: { label: 'Guarda', tone: 'warning' },
  BORRA: { label: 'Borra', tone: 'error' },
});

export const estadoOrm = tabla({
  COINCIDE: { label: 'Coincide', tone: 'success' },
  DIVERGE: { label: 'Diverge', tone: 'warning' },
  SIN_ENTIDAD: { label: 'Sin entidad', tone: 'error' },
});

/** Señales del mapa de rutas: lo que el generador notó, no un veredicto. */
export const senal = tabla({
  SIN_PRUEBAS: { label: 'Sin pruebas', tone: 'warning' },
  ESCRIBE: { label: 'Escribe en la base', tone: 'info' },
  ESCRIBE_SIN_ROLES: { label: 'Escribe sin @Roles', tone: 'error' },
  PUBLICA: { label: 'Pública', tone: 'warning' },
  SIN_INTEGRACION: { label: 'Sin prueba de integración', tone: 'warning' },
  SIN_CONSUMIDOR_FRONT: { label: 'Ningún cliente del front la llama', tone: 'secondary' },
  CON_DECISIONES: { label: 'Con árbol de decisión', tone: 'info' },
  CONTRATO_AUSENTE: { label: 'Fuera del contrato OpenAPI', tone: 'warning' },
  SIN_TABLAS: { label: 'No toca tablas', tone: 'secondary' },
  EVENTO: { label: 'Emite eventos', tone: 'info' },
  MAQUINA_DE_ESTADOS: { label: 'Máquina de estados', tone: 'info' },
  ENCOLA_TRABAJO: { label: 'Encola trabajo', tone: 'info' },
});

/** Señales que merecen atención: las que el mapa cuenta como «roto» o «sin cobertura». */
export const SENALES_DE_ATENCION: readonly string[] = [
  'ESCRIBE_SIN_ROLES',
  'SIN_PRUEBAS',
  'CONTRATO_AUSENTE',
];

export const agrupacion = tabla({
  CASO_DE_USO_README: { label: 'Caso de uso del README', tone: 'success' },
  AGRUPACION_POR_CONTROLADOR: { label: 'Agrupado por controlador', tone: 'secondary' },
  CURADO_EN_DOCUMENTO: { label: 'Curado en un documento', tone: 'info' },
  MIXTO: { label: 'Mixto', tone: 'info' },
});

export const tipoDeNodo = tabla({
  ETAPA: { label: 'Etapa', tone: 'secondary' },
  OPERACION: { label: 'Operación', tone: 'info' },
  ACTOR: { label: 'Actor', tone: 'success' },
  TABLA: { label: 'Tabla', tone: 'warning' },
  DOMINIO: { label: 'Dominio', tone: 'primary' },
});

/** De dónde sale una operación: del contrato publicado o sólo del código. */
export const operationOrigin = tabla({
  CONTRATO: { label: 'En el contrato', tone: 'success' },
  CONTRATO_AUSENTE: { label: 'Fuera del contrato', tone: 'warning' },
});

export const processKind = tabla({
  MODULO: { label: 'Módulo', tone: 'secondary' },
  CRITICO: { label: 'Flujo crítico', tone: 'warning' },
});

/** Los pasos de un árbol de decisión, tal como los nombra el generador. */
export const decisionStep = tabla({
  ACCESO: { label: 'Acceso', tone: 'info' },
  SI: { label: 'Condición', tone: 'info' },
  LLAMADA: { label: 'Llamada', tone: 'secondary' },
  EFECTO: { label: 'Efecto', tone: 'warning' },
  TRANSACCION: { label: 'Transacción', tone: 'primary' },
  BUCLE: { label: 'Repetición', tone: 'secondary' },
  INTENTAR: { label: 'Intento', tone: 'secondary' },
  ERROR: { label: 'Error', tone: 'error' },
  RESPUESTA: { label: 'Respuesta', tone: 'success' },
});

/** Dónde declara el modelo una tabla que el ORM sí tiene. */
export const ddlSource = tabla({
  SIN_DDL: { label: 'En ninguna fuente del modelo', tone: 'error' },
  PARCHE: { label: 'Sólo en un parche', tone: 'warning' },
  NOSQL: { label: 'Almacén no relacional', tone: 'info' },
});

/** Cómo está el propósito de una tabla: quién lo escribió y si alguien lo revisó. */
export const purposeState = tabla({
  DOMAIN_CURATED_DRAFT: { label: 'Borrador curado por dominio', tone: 'info' },
});

/** Una columna frente a su propiedad en la entidad del ORM. */
export const columnOrmState = tabla({
  COINCIDE: { label: 'Coincide', tone: 'success' },
  AUSENTE_EN_ORM: { label: 'Falta en la entidad', tone: 'error' },
  NULABILIDAD_DIVERGE: { label: 'Nulabilidad distinta', tone: 'warning' },
});

/** Cómo se resolvió una relación entre tablas. */
export const relationResolution = tabla({
  DECLARED_FK: { label: 'Clave foránea declarada', tone: 'success' },
});

/** Los atributos de gobierno de una tabla, por su clave en la ficha. */
export const GOVERNANCE_ATTRIBUTES: Readonly<Record<string, string>> = {
  responsable: 'Responsable',
  pii: 'Datos personales',
  financiera: 'Información financiera',
  criticaParaAuditoria: 'Crítica para auditoría',
  retencion: 'Retención',
  appendOnly: 'Sólo admite altas (append-only)',
};

/** Un identificador de operación (`Clase_método`) legible: el método sin su clase. */
export function nombreDeOperacion(id: string): string {
  const i = id.indexOf('_');
  return i < 0 ? id : id.slice(i + 1);
}

/** `scheduling.slot_holds` → `{ schema, tabla }`; `null` si no tiene esa forma. */
export function partirTabla(qualified: string): { schema: string; tabla: string } | null {
  const i = qualified.indexOf('.');
  if (i <= 0 || i === qualified.length - 1) return null;
  return { schema: qualified.slice(0, i), tabla: qualified.slice(i + 1) };
}

/** Texto de «Página x de y · n registros» para un listado paginado por cursor con total. */
export function resumenDePagina(pagina: number, limite: number, total: number): string {
  const paginas = Math.max(1, Math.ceil(total / Math.max(1, limite)));
  const registros = total === 1 ? '1 registro' : `${total.toLocaleString('es-BO')} registros`;
  return `Página ${Math.min(pagina, paginas)} de ${paginas.toLocaleString('es-BO')} · ${registros}`;
}
