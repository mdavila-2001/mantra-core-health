import { MOCK_USERS } from '../../core/simulator/simulator';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { ETIQUETA_DE_NIVEL, type NivelDeComponente } from './component-stock.types';
import type { ComponentScenario } from './scenarios/scenario.types';

/**
 * La opción del selector de escenarios que monta «a ciegas», con los valores
 * del generador. Sigue existiendo para comparar: es lo que se ve cuando nadie
 * escribió un anfitrión.
 */
export const VALORES_GENERADOS = 'valores-generados';

/** Los niveles en el orden en que se agrupan en el árbol de la izquierda. */
export const NIVELES: readonly NivelDeComponente[] = [
  'atomo',
  'molecula',
  'organismo',
  'pantalla',
  'maqueta',
  'otro',
];

/** Las cuentas de prueba como opciones del desplegable; el valor vacío es «sin sesión». */
export const OPCIONES_DE_CUENTA: readonly SelectOption<string>[] = [
  { value: '', label: 'Sin sesión' },
  ...MOCK_USERS.map((u) => ({ value: u.key, label: u.key })),
];

/** Los niveles como opciones del filtro del árbol, con «todos» al frente. */
export const OPCIONES_DE_NIVEL: readonly SelectOption<NivelDeComponente | 'todos'>[] = [
  { value: 'todos', label: 'Todos los niveles' },
  ...NIVELES.map((n) => ({ value: n, label: ETIQUETA_DE_NIVEL[n] })),
];

/**
 * Los escenarios escritos del componente, más el montaje a ciegas al final. El
 * id va de descripción: es lo que identifica al escenario en pruebas y en el
 * informe, y el buscador del desplegable también lo mira.
 */
export function opcionesDeEscenario(
  escenarios: readonly ComponentScenario[],
): readonly SelectOption<string>[] {
  return [
    ...escenarios.map((e) => ({ value: e.id, label: e.titulo, description: e.id })),
    { value: VALORES_GENERADOS, label: 'Valores generados (a ciegas)' },
  ];
}
