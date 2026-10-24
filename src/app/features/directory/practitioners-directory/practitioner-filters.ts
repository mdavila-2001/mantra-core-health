import type { PractitionerListItem } from '../../../core/data-access/profiles/profiles.types';
import type { FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';

/*
 * Los cortes en memoria sobre la guía de médicos ya cargada (propietario,
 * 24/10/2026: «todos los filtros posibles»). Cada uno sale de un dato que la
 * fila ya trae; ninguno pide otra lectura. La especialidad no está acá: ésa
 * viaja al servidor y la arma el directorio con el recuento.
 */

const PARAM_VERIFICADO = 'verificado';
const PARAM_MODALIDAD = 'telemedicina';
const PARAM_SEDE = 'sede';
const PARAM_CALIFICACION = 'calificacion';

/** Cuántos médicos tiene que compartir una institución para ofrecerse. */
const MINIMO_PARA_INSTITUCION = 2;

/** Los topes de calificación que se ofrecen, de mayor a menor. */
const TOPES_DE_CALIFICACION: readonly { readonly valor: number; readonly rotulo: string }[] = [
  { valor: 4.5, rotulo: '4,5 o más' },
  { valor: 4, rotulo: '4 o más' },
  { valor: 3, rotulo: '3 o más' },
];

/** Los cortes presentes en la URL (o en lo que emitió la barra), por clave. */
export type CortesDeLaGuia = Readonly<Record<string, string>>;

/** Los cortes en memoria presentes en un conjunto de parámetros. */
export function cortesDe(params: Readonly<Record<string, unknown>>): CortesDeLaGuia {
  const cortes: Record<string, string> = {};
  for (const clave of [PARAM_VERIFICADO, PARAM_MODALIDAD, PARAM_SEDE, PARAM_CALIFICACION]) {
    const valor = params[clave];
    if (typeof valor === 'string' && valor !== '') {
      cortes[clave] = valor;
    }
  }
  return cortes;
}

/** La nota que cuenta: sin reseñas no hay nota, por más que el campo venga. */
function notaDe(fila: PractitionerListItem): number {
  return (fila.ratingCount ?? 0) > 0 ? (fila.ratingAverage ?? 0) : 0;
}

/**
 * Los filtros que salen de la guía cargada, con cuántos trae cada opción. Una
 * opción que devolvería cero no se ofrece, salvo que ya esté puesta: quitarla
 * de la columna dejaría un filtro activo sin forma de verlo.
 */
export function filtrosDeLaGuia(
  filas: readonly PractitionerListItem[],
  cortes: CortesDeLaGuia,
): readonly FilterDef[] {
  const filtros: FilterDef[] = [];

  const verificados = filas.filter((fila) => fila.verified).length;
  if (verificados > 0 || cortes[PARAM_VERIFICADO]) {
    filtros.push({
      key: PARAM_VERIFICADO,
      label: 'Verificación',
      icon: 'shield',
      asChips: true,
      options: [{ value: 'true', label: `Matrícula verificada (${verificados})` }],
    });
  }

  const remotos = filas.filter((fila) => fila.telehealthAvailable).length;
  if (remotos > 0 || cortes[PARAM_MODALIDAD]) {
    filtros.push({
      key: PARAM_MODALIDAD,
      label: 'Modalidad',
      icon: 'monitor',
      asChips: true,
      options: [{ value: 'true', label: `Telemedicina (${remotos})` }],
    });
  }

  const notas = filas.map(notaDe);
  const topes = TOPES_DE_CALIFICACION.filter(({ valor }) => notas.some((nota) => nota >= valor));
  if (topes.length > 0 || cortes[PARAM_CALIFICACION]) {
    filtros.push({
      key: PARAM_CALIFICACION,
      label: 'Calificación',
      icon: 'star',
      asChips: true,
      options: topes.map(({ valor, rotulo }) => ({ value: String(valor), label: rotulo })),
    });
  }

  // La institución o red donde atiende. `workplaces` mezcla el nombre de la
  // organización —que comparten muchos— con la dirección del consultorio —que
  // es de uno solo—, y no dice cuál es cuál: se ofrecen sólo las que comparten
  // al menos dos médicos, que es lo que sirve para acotar.
  const porSede = new Map<string, number>();
  for (const fila of filas) {
    for (const sede of new Set(fila.workplaces ?? [])) {
      porSede.set(sede, (porSede.get(sede) ?? 0) + 1);
    }
  }
  const compartidas = [...porSede.entries()].filter(
    ([sede, cuantos]) => cuantos >= MINIMO_PARA_INSTITUCION || sede === cortes[PARAM_SEDE],
  );
  if (compartidas.length > 1 || cortes[PARAM_SEDE]) {
    filtros.push({
      key: PARAM_SEDE,
      label: 'Institución',
      icon: 'building',
      asChips: true,
      options: compartidas
        .sort(([a, n], [b, m]) => m - n || a.localeCompare(b, 'es'))
        .map(([sede, cuantos]) => ({ value: sede, label: `${sede} (${cuantos})` })),
    });
  }
  return filtros;
}

/** Si la fila pasa los cortes que están puestos. */
export function pasaLosCortes(fila: PractitionerListItem, cortes: CortesDeLaGuia): boolean {
  const minima = Number(cortes[PARAM_CALIFICACION]);
  const sede = cortes[PARAM_SEDE];
  return (
    (cortes[PARAM_VERIFICADO] !== 'true' || fila.verified) &&
    (cortes[PARAM_MODALIDAD] !== 'true' || fila.telehealthAvailable) &&
    (sede === undefined || (fila.workplaces ?? []).includes(sede)) &&
    (!(minima > 0) || notaDe(fila) >= minima)
  );
}
