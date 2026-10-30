/* ============================================================================
    Inventario del sistema servido por la API (`/admin/portal/*`, módulo 67).

    Es lo que `tools/inventario` de la API detectó en el código, el contrato y el
    modelo; no es una ficha curada. Cada afirmación trae su `fuente`, y lo que
    el generador no pudo determinar viaja como `SIN_FUENTE`/`AUTO_DETECTADA` —
    esta capa no lo convierte en un dato.
    ========================================================================== */

export type Riesgo = 'ALTO' | 'MEDIO' | 'BAJO';
export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PortalPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly total: number;
}

export interface PortalVersion {
  readonly hash: string;
  readonly operaciones: number;
  readonly procesos: number;
  readonly tablas: number;
  readonly columnas: number;
  readonly origen: string;
}

export interface FlujoRef {
  readonly codigo: string;
  readonly nombre: string;
  readonly etapa: string;
  readonly agrupacion: string;
}

export interface OperacionResumen {
  readonly id: string;
  readonly metodo: MetodoHttp;
  readonly ruta: string;
  readonly modulo: string;
  readonly nombre: string | null;
  readonly origen: 'CONTRATO' | 'CONTRATO_AUSENTE';
  readonly riesgo: Riesgo;
  readonly publica: boolean;
  readonly roles: readonly string[];
  readonly tablas: number;
  readonly flujos: readonly FlujoRef[];
  readonly senales: readonly string[];
}

export interface OperacionesQuery {
  readonly q?: string;
  readonly modulo?: string;
  readonly riesgo?: Riesgo;
  readonly metodo?: MetodoHttp;
  readonly origen?: 'CONTRATO' | 'CONTRATO_AUSENTE';
  readonly senal?: string;
  readonly flujo?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface Requerimiento {
  readonly tipo: string;
  readonly detalle: string;
  readonly fuente: string;
}

export interface Parametro {
  readonly nombre: string;
  readonly en: string;
  readonly obligatorio: boolean;
  readonly tipo: string;
  readonly descripcion: string | null;
}

export interface Campo {
  readonly campo: string;
  readonly tipo: string;
  readonly obligatorio: boolean;
  readonly restricciones: readonly string[];
  readonly descripcion: string | null;
  readonly ejemplo?: unknown;
  readonly fuente?: string | null;
}

export interface Cuerpo {
  readonly dto: string | null;
  readonly contentType: string | null;
  readonly obligatorio: boolean | null;
  readonly campos: readonly Campo[];
  readonly payloadMinimo: unknown;
}

export interface RespuestaContrato {
  readonly tipoRetorno: string | null;
  readonly dto: string | null;
  readonly httpCode: string | null;
  readonly campos: readonly Campo[];
}

export interface RespuestaPosible {
  readonly estado: number;
  readonly codigo: string | null;
  readonly causas: readonly string[];
}

export interface TablaOperacion {
  readonly schema: string;
  readonly tabla: string;
  readonly operacion: 'LEE' | 'ESCRIBE' | 'BORRA' | string;
  readonly detalle: string;
  readonly confianza: string;
  readonly via: readonly string[];
  readonly fuente: string;
  readonly catalogada: boolean;
}

export interface Prueba {
  readonly tipo: string;
  readonly archivo: string;
  readonly linea: number;
}

export interface ExplicacionNegocio {
  readonly texto: string | null;
  readonly estado: string;
  readonly fuentes: readonly { readonly tipo: string; readonly referencia: string }[];
}

export interface OperacionDetalle extends OperacionResumen {
  readonly bloque: string | null;
  readonly codigo: string | null;
  readonly negocio: ExplicacionNegocio;
  readonly sistema: string;
  readonly razonesDeRiesgo: readonly string[];
  readonly requerimientos: readonly Requerimiento[];
  readonly parametros: readonly Parametro[];
  readonly cuerpo: Cuerpo | null;
  readonly respuesta: RespuestaContrato;
  readonly respuestasPosibles: readonly RespuestaPosible[];
  readonly datos: readonly TablaOperacion[];
  readonly eventos: readonly string[];
  readonly trabajos: readonly string[];
  readonly noResuelto: readonly string[];
  readonly sinTablas: string | null;
  readonly pruebas: readonly Prueba[];
  readonly revision: string;
  readonly datosPersonales: string;
}

/** Nodo de un árbol de decisión; los campos varían por `tipo`. */
export interface NodoArbol {
  readonly tipo: string;
  readonly txt?: string;
  readonly corto?: string;
  readonly detalle?: string;
  readonly destino?: string;
  readonly tabla?: string;
  readonly operacion?: string;
  readonly confianza?: string;
  readonly excepcion?: string;
  readonly estado?: number;
  readonly codigo?: string | null;
  readonly mensaje?: string;
  readonly falla?: { readonly estado: number; readonly codigo: string };
  readonly f?: string;
  readonly hijos?: readonly NodoArbol[];
  readonly entonces?: readonly NodoArbol[];
  readonly sino?: readonly NodoArbol[];
}

export interface Arbol {
  readonly id: string;
  readonly nodos: readonly NodoArbol[];
  readonly respuestas: readonly RespuestaPosible[];
  readonly truncado: boolean;
}

export interface ProcesoResumen {
  readonly codigo: string;
  readonly tipo: 'MODULO' | 'CRITICO' | string;
  readonly nombre: string;
  readonly modulo: string | null;
  readonly bloque: string | null;
  readonly agrupacion: string;
  readonly actores: readonly string[];
  readonly operaciones: number;
  readonly etapas: number;
  readonly maquinas: readonly string[];
  readonly revision: string;
}

export interface ProcesosQuery {
  readonly q?: string;
  readonly tipo?: 'MODULO' | 'CRITICO';
  readonly modulo?: string;
  readonly agrupacion?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface OperacionDeEtapa {
  readonly operacionId: string;
  readonly metodo: string;
  readonly ruta: string;
  readonly quienActua: string;
  readonly queHace: string;
  readonly riesgo: Riesgo;
  readonly efectos: {
    readonly tablas: readonly {
      readonly tabla: string;
      readonly operacion: string;
      readonly detalle: string;
    }[];
    readonly eventos: readonly string[];
    readonly trabajos: readonly string[];
  };
}

export interface Etapa {
  readonly codigo: string;
  readonly nombre: string;
  readonly fuente: string | null;
  readonly agrupacion?: string;
  readonly operaciones: readonly OperacionDeEtapa[];
}

export interface Maquina {
  readonly codigo: string;
  readonly fuente: string;
  readonly estados: readonly string[];
  readonly transiciones: readonly { readonly de: string; readonly a: string }[];
  readonly iniciales: readonly string[];
  readonly terminales: readonly string[];
  readonly operaciones: readonly unknown[];
}

export interface ProcesoDetalle extends ProcesoResumen {
  readonly paraQueSirve: string | null;
  readonly paraQueSirveFuente: string | null;
  readonly flujoGeneral: string | null;
  readonly detalleDeEtapas: readonly Etapa[];
  readonly maquinasDeEstado: readonly Maquina[];
  readonly fuentes: readonly string[];
}

export interface NodoGrafo {
  readonly id: string;
  readonly tipo: string;
  readonly etiqueta: string;
  readonly operacionId?: string;
  readonly riesgo?: Riesgo;
  readonly etapa?: string;
}

export interface AristaGrafo {
  readonly de: string;
  readonly a: string;
  readonly tipo: string;
}

export interface Grafo {
  readonly proceso: string;
  readonly nombre: string;
  readonly roles: readonly string[];
  readonly nodos: readonly NodoGrafo[];
  readonly aristas: readonly AristaGrafo[];
}

export interface MapaFila {
  readonly id: string;
  readonly metodo: MetodoHttp;
  readonly ruta: string;
  readonly flujos: readonly {
    readonly codigo: string;
    readonly nombre: string;
    readonly etapa: string;
  }[];
  readonly modulo: string;
  readonly riesgo: Riesgo;
  readonly autorizacion: string;
  readonly llamadaPor: readonly string[] | null;
  readonly senales: readonly string[];
}

export interface HallazgoResumen {
  readonly id: string;
  readonly severidad: 'ALTA' | 'MEDIA' | 'BAJA' | string;
  readonly titulo: string;
  readonly queHacer: string;
  readonly cuenta: number;
}

export interface HallazgoDetalle extends HallazgoResumen {
  readonly items: readonly Readonly<Record<string, unknown>>[];
  readonly nextCursor: string | null;
  readonly limit: number;
}

export interface TablaResumen {
  readonly id: string;
  readonly schema: string;
  readonly tabla: string;
  readonly dominio: string | null;
  readonly columnas: number;
  readonly indices: number;
  readonly operaciones: number;
  readonly orm: string;
  readonly appendOnly: boolean;
}

export interface TablasQuery {
  readonly schema?: string;
  readonly q?: string;
  readonly orm?: string;
  readonly appendOnly?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Un atributo de gobierno: su `estado` dice si hay fuente (`SIN_FUENTE` = nadie lo declaró). */
export interface AtributoDeGobierno {
  readonly estado: string;
  readonly valor?: unknown;
  readonly fuente?: string;
}

export interface ColumnaDeTabla {
  readonly nombre: string;
  readonly ordinal: number;
  readonly tipo: string;
  readonly nulable: boolean;
  readonly defecto: string | null;
  readonly pk: boolean;
  readonly fk: readonly unknown[];
  readonly uk: readonly unknown[];
  readonly restricciones: string;
  readonly rol: readonly string[];
  readonly descripcion: {
    readonly texto: string | null;
    readonly tipo?: string;
    readonly fuente?: string;
  } | null;
  readonly clasificacion: AtributoDeGobierno;
  readonly orm: { readonly estado: string; readonly propiedad?: string };
  readonly fuente: string;
}

export interface RelacionDeTabla {
  readonly constraint: string;
  readonly resolucion: string;
  readonly fuente: string;
  readonly columnas: readonly string[];
  readonly hacia?: {
    readonly schema: string;
    readonly tabla: string;
    readonly columnas: readonly string[];
  };
  readonly desde?: {
    readonly schema: string;
    readonly tabla: string;
    readonly columnas: readonly string[];
  };
}

export interface IndiceDeTabla {
  readonly nombre: string;
  readonly unico: boolean;
  readonly columnas: readonly { readonly columna: string }[];
  readonly predicado: string | null;
  readonly metodo: string | null;
  readonly origen: string;
  readonly paraQue: readonly {
    readonly tipo: string;
    readonly texto: string;
    readonly fuente?: string;
  }[];
}

export interface OperacionDeTabla {
  readonly operacionId: string;
  readonly metodo: string;
  readonly ruta: string;
  readonly operacion: string;
  readonly detalle: string;
  readonly confianza: string;
}

export interface TablaFicha {
  readonly id: string;
  readonly schema: string;
  readonly tabla: string;
  readonly dominio: string | null;
  readonly diagrama: string;
  readonly ddl: string;
  readonly proposito: string | null;
  readonly propositoEstado: string;
  readonly propositoFuente: string | null;
  readonly entidadOrm: string | null;
  readonly gobierno: Readonly<Record<string, AtributoDeGobierno>>;
  readonly columnas: readonly ColumnaDeTabla[];
  readonly relaciones: {
    readonly salientes: readonly RelacionDeTabla[];
    readonly entrantes: readonly RelacionDeTabla[];
  };
  readonly indices: readonly IndiceDeTabla[];
  readonly restricciones: readonly {
    readonly nombre: string;
    readonly tipo: string;
    readonly columnas: string;
    readonly definicion: string;
  }[];
  readonly operaciones: readonly OperacionDeTabla[];
  readonly deriva: Readonly<Record<string, unknown>>;
  readonly revision: string;
}

export interface DerivaCatalogo {
  readonly resumen: Readonly<Record<string, unknown>>;
  readonly deriva: Readonly<Record<string, unknown>>;
}

export interface LinajeDominio {
  readonly id: string;
  readonly etiqueta: string;
  readonly tablas: number;
}

export interface Linaje {
  readonly metricas: Readonly<Record<string, number | string>>;
  readonly dominios: readonly LinajeDominio[];
}

/**
 * Una operación en el linaje de una tabla. No es `OperacionDeTabla`: la API la
 * arma desde las aristas del grafo de linaje (`linajeDeTabla`), así que trae la
 * etiqueta del nodo (`GET /ruta`), su id y el efecto (`LEE`/`ESCRIBE`/`BORRA`).
 */
export interface LineageOperation {
  readonly operacion: string;
  readonly id: string;
  readonly efecto: string;
}

export interface LinajeTabla {
  readonly id: string;
  readonly operaciones: readonly LineageOperation[];
  readonly referencia: readonly string[];
  readonly referenciadaPor: readonly string[];
}

export interface TerminoGlosario {
  readonly termino: string;
  readonly definicion: string;
  readonly fuente: string;
  readonly tablasRelacionadas: readonly string[];
}

export interface BusquedaQuery {
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
}
