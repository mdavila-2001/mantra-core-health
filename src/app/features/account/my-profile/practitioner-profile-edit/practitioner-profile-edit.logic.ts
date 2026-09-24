import {
  OPCIONES_INSTITUCION_EDUCATIVA,
  UNIVERSIDADES_DEL_SISTEMA,
  UNIVERSIDADES_PRIVADAS,
} from '../../../../core/profesion/instituciones-educativas';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';

/*
 * La búsqueda y el filtro de las tablas del editor (D-10, ADR-0015 regla 5).
 *
 * `app-filter-bar` emite un único término bajo `q` y el código del filtro
 * elegido: buscar en varios campos a la vez y decidir qué fila pasa es trabajo
 * de quien muestra la tabla. Vive acá, como funciones sin estado, para que las
 * tres tablas —títulos, especialidades y matrículas— filtren con la misma regla.
 */

/** Quita tildes, espacios laterales y diferencias de mayúscula antes de comparar. */
export function normalizarParaBuscar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLocaleLowerCase('es').trim();
}

/**
 * Si alguno de los campos contiene lo buscado.
 *
 * Sin término no se filtra nada: una búsqueda que nadie escribió no esconde filas.
 */
export function coincideConLaBusqueda(termino: string, campos: readonly string[]): boolean {
  const buscado = normalizarParaBuscar(termino);
  if (buscado === '') {
    return true;
  }
  return campos.some((campo) => normalizarParaBuscar(campo).includes(buscado));
}

/** Los dos estados por los que se filtra: el trámite sigue abierto, o ya se revisó. */
export type EstadoDeVerificacion = 'pendiente' | 'verificado';

/**
 * Las opciones del filtro «Estado». Una lista cerrada: el filtro nunca es texto libre.
 * Dicen lo mismo que la columna, que muestra la etiqueta del estado: «Pendiente».
 */
export const OPCIONES_DE_ESTADO: readonly SelectOption<EstadoDeVerificacion>[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'verificado', label: 'Verificado' },
];

/**
 * Los códigos del estado de una matrícula que todavía se puede corregir.
 *
 * La matrícula no trae un sí/no de verificación, como la especialidad
 * (`verified`) o el título (`verifiedAt`): sólo el concepto de su estado. La API
 * lo llama `AUTH_PENDING` y el simulador, `ST-PENDING`. Cualquier otro estado
 * —activa, vencida— ya pasó por quien la revisó y no se corrige desde acá, igual
 * que un título verificado (decisión del 24/09/2026).
 */
const CODIGOS_DE_MATRICULA_PENDIENTE: ReadonlySet<string> = new Set(['AUTH_PENDING', 'ST-PENDING']);

/**
 * Si una matrícula todavía se puede corregir. Sin el código a la vista —las
 * etiquetas llegan después que el perfil, o no llegan— cuenta como pendiente,
 * que es lo que la fila dice mientras tanto.
 */
export function matriculaPendiente(codigoDelEstado: string | undefined): boolean {
  return codigoDelEstado === undefined || CODIGOS_DE_MATRICULA_PENDIENTE.has(codigoDelEstado);
}

/** Las mismas dos, en femenino: la tabla de especialidades dice «Verificada». */
export const OPCIONES_DE_ESTADO_DE_ESPECIALIDAD: readonly SelectOption<EstadoDeVerificacion>[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'verificado', label: 'Verificada' },
];

/**
 * Los estados que traen las filas, uno por concepto y en el orden en que
 * aparecen, con la etiqueta que muestra la tabla. Es la lista del filtro
 * «Estado» cuando el recurso no trae un sí/no de verificado, como la matrícula.
 */
export function estadosPresentes(
  filas: readonly { readonly estadoConceptId: string; readonly estado: string }[],
): readonly SelectOption<string>[] {
  const etiquetas = new Map<string, string>();
  for (const fila of filas) {
    if (!etiquetas.has(fila.estadoConceptId)) {
      etiquetas.set(fila.estadoConceptId, fila.estado);
    }
  }
  return [...etiquetas].map(([value, label]) => ({ value, label }));
}

/** Si una fila pasa un filtro por concepto. Sin filtro no se esconde nada. */
export function coincideConElConcepto(filtro: string | null, conceptId: string): boolean {
  return filtro === null || filtro === conceptId;
}

/**
 * Las filas de una página, contada desde 1.
 *
 * Una página fuera de rango se lleva a la última que existe, que es la que el
 * paginador dibuja: pasa al retirar la única fila de la última página, y sin
 * esto la tabla quedaría vacía debajo de un paginador que dice que hay filas.
 */
export function filasDeLaPagina<T>(
  filas: readonly T[],
  pagina: number,
  porPagina: number,
): readonly T[] {
  const tamano = Math.max(1, Math.trunc(porPagina));
  const ultima = Math.max(1, Math.ceil(filas.length / tamano));
  const actual = Math.min(ultima, Math.max(1, Math.trunc(pagina) || 1));
  const inicio = (actual - 1) * tamano;
  return filas.slice(inicio, inicio + tamano);
}

/**
 * Si una fila pasa el filtro de estado.
 *
 * `null` —o un código que no es ninguno de los dos, como el que dejaría una URL
 * escrita a mano— no filtra: mostrar todo es menos dañino que esconder filas por
 * un valor que nadie eligió.
 */
export function coincideConElEstado(filtro: string | null, pendiente: boolean): boolean {
  if (filtro === 'pendiente') {
    return pendiente;
  }
  if (filtro === 'verificado') {
    return !pendiente;
  }
  return true;
}

/*
 * La institución con su código (Q-8).
 *
 * El catálogo de `core/profesion/instituciones-educativas.ts` no tiene un campo
 * de código, y ninguna capa del proyecto tiene un padrón de instituciones con
 * id. Lo que sí tiene cada casa de estudios es su sigla dentro de la etiqueta,
 * entre paréntesis —«Universidad Mayor de San Andrés (UMSA) — La Paz»—. El
 * desplegable la pone adelante y la tabla al lado del nombre, y las dos la toman
 * de esa misma etiqueta, para que no puedan mostrar dos siglas distintas.
 */

/** Las instituciones que se eligen del desplegable, sin separadores de grupo. */
const INSTITUCIONES_DEL_CATALOGO = [...UNIVERSIDADES_DEL_SISTEMA, ...UNIVERSIDADES_PRIVADAS];

/** Lo que va entre paréntesis en la etiqueta de una institución del catálogo. */
const SIGLA_EN_LA_ETIQUETA = /\(([^()]+)\)/u;

/**
 * La sigla de una institución del catálogo, o `null` si la institución no está
 * en el catálogo o su etiqueta no trae sigla (como «Universidad NUR»).
 */
export function codigoDeInstitucion(institucion: string): string | null {
  const opcion = INSTITUCIONES_DEL_CATALOGO.find((candidata) => candidata.value === institucion);
  return opcion?.label.match(SIGLA_EN_LA_ETIQUETA)?.[1] ?? null;
}

/**
 * La institución como se lee en la tabla de títulos: con su sigla al lado, como
 * en el desplegable. Lo escrito a mano, fuera del catálogo o de antes de la
 * lista, se muestra tal cual: no se le adivina una sigla.
 */
export function institucionConCodigo(institucion: string): string {
  const codigo = codigoDeInstitucion(institucion);
  return codigo === null ? institucion : `${institucion} (${codigo})`;
}

/**
 * Una opción del desplegable con la sigla adelante: «UMSA · Universidad Mayor de
 * San Andrés — La Paz». Un `<select>` cerrado recorta lo que no entra, y a
 * 375 px cortaba justo la sigla, que es lo que tiene que leerse (Q-8). Adelante
 * se lee a cualquier ancho. Lo que no trae sigla —los separadores, «Universidad
 * NUR», la salida a texto libre— queda igual, y el valor no cambia nunca.
 */
export function conSiglaAdelante<T extends { readonly label: string }>(opcion: T): T {
  const sigla = opcion.label.match(SIGLA_EN_LA_ETIQUETA);
  if (sigla === null) return opcion;
  const nombre = opcion.label
    .replace(sigla[0], '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
  return { ...opcion, label: `${sigla[1]} · ${nombre}` };
}

/** El desplegable de institución del editor, con cada sigla adelante. */
export const OPCIONES_DE_INSTITUCION_CON_SIGLA =
  OPCIONES_INSTITUCION_EDUCATIVA.map(conSiglaAdelante);
