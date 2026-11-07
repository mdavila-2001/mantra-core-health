import { especialidadesDe, normalizarTexto, profesionalesDe, type FiltroDeRed } from '../red-clinica-filtro';
import { fecha } from '../red-clinica-alertas.plazos';
import { ASPECTO_DE_TIPO, type NodoDeRed } from '../red-clinica.types';

/**
 * Each criterion set in the bar, in words: «el hilo de Trastorno de ansiedad»,
 * «la búsqueda «pielo»». So a notice can say WHICH filter hides something
 * instead of «los filtros puestos», which the person has to go and find.
 */
export function filtrosNombrados(filtro: FiltroDeRed, nodos: readonly NodoDeRed[]): readonly string[] {
  const nombreDe = (lista: readonly { id: string; nombre: string }[], id: string) => lista.find((r) => r.id === id)?.nombre ?? id;
  const nombres: string[] = [];
  if (filtro.hiloDeDiagnosticoId !== null) {
    const dx = nodos.find((n) => n.id === filtro.hiloDeDiagnosticoId);
    nombres.push(`el hilo de ${dx?.titulo ?? 'un diagnóstico'}`);
  }
  if (normalizarTexto(filtro.texto) !== '') nombres.push(`la búsqueda «${filtro.texto.trim()}»`);
  if (filtro.especialidadId !== null) nombres.push(`la especialidad ${nombreDe(especialidadesDe(nodos), filtro.especialidadId)}`);
  if (filtro.profesionalId !== null) nombres.push(`el profesional ${nombreDe(profesionalesDe(nodos), filtro.profesionalId)}`);
  if (filtro.desde !== null && filtro.hasta !== null) nombres.push(`las fechas del ${fecha(filtro.desde)} al ${fecha(filtro.hasta)}`);
  else if (filtro.desde !== null) nombres.push(`las fechas desde el ${fecha(filtro.desde)}`);
  else if (filtro.hasta !== null) nombres.push(`las fechas hasta el ${fecha(filtro.hasta)}`);
  if (filtro.tipos.length > 0) nombres.push(`los tipos ${unirConY(filtro.tipos.map((t) => ASPECTO_DE_TIPO[t].plural))}`);
  return nombres;
}

/** «a», «a y b», «a, b y c». */
export function unirConY(partes: readonly string[]): string {
  return partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}
