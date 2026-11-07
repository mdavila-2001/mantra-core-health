import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';

import { RedClinicaAlertasLista } from '../../clinical-record/patient-chart/red-clinica/alertas/red-clinica-alertas-lista';
import { RedClinicaFiltros } from '../../clinical-record/patient-chart/red-clinica/filtros/red-clinica-filtros';
import {
  RedClinicaPanel,
  type PresentacionDelPanel,
} from '../../clinical-record/patient-chart/red-clinica/panel/red-clinica-panel';
import { alertasDeApoyo } from '../../clinical-record/patient-chart/red-clinica/red-clinica-alertas';
import { AHORA_DEMO, ARISTAS_DEMO, NODOS_DEMO } from '../../clinical-record/patient-chart/red-clinica/red-clinica.demo';
import { ENTRADA_DE_ALERTAS_DEMO } from '../../clinical-record/patient-chart/red-clinica/red-clinica.demo-alertas';
import { aplicarFiltro, FILTRO_VACIO, type FiltroDeRed } from '../../clinical-record/patient-chart/red-clinica/red-clinica-filtro';
import { ASPECTO_DE_TIPO, type NodoDeRed } from '../../clinical-record/patient-chart/red-clinica/red-clinica.types';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { outputsRecord } from './exit-log';
import type { ComponentScenario, ScenarioHost } from './scenario.types';

/* ============================================================================
    Scenarios of the clinical network (strip 3): panel, filters and alerts
    together.

    The three pieces are mounted as the chart mounts them: the bar on top, the
    alerts and the map on the left, the panel on the right. The «map» here is a
    list of nodes —a stand-in, labelled as such—: the real map is drawn by
    `recorrido-clinico/**` (strip 2) and is not imported so as not to tie this
    bench to it.

    The data is the demonstration story of `red-clinica.demo.ts`.
    ========================================================================== */

const SOURCE = 'src/app/features/component-stock/scenarios/red-clinica.scenarios.ts';
const KEY_PANEL = 'features/clinical-record/patient-chart/red-clinica/panel/red-clinica-panel';
const KEY_FILTROS = 'features/clinical-record/patient-chart/red-clinica/filtros/red-clinica-filtros';
const KEY_ALERTAS = 'features/clinical-record/patient-chart/red-clinica/alertas/red-clinica-alertas-lista';

export const RED_CLINICA_VARIANTS = [
  'estudio',
  'diagnostico',
  'derivacion',
  'reconsulta',
  'hoja',
  'filtros',
  'alertas',
  'alertas-vacias',
] as const;
export type RedClinicaVariant = (typeof RED_CLINICA_VARIANTS)[number];

const NODO_INICIAL: Readonly<Record<RedClinicaVariant, string | null>> = {
  estudio: 'e1',
  diagnostico: 'dx1',
  derivacion: 'd1',
  reconsulta: 'r1',
  hoja: 'e1',
  filtros: null,
  alertas: null,
  'alertas-vacias': null,
};

@Component({
  selector: 'app-scenario-red-clinica',
  imports: [NavIcon, RedClinicaAlertasLista, RedClinicaFiltros, RedClinicaPanel],
  templateUrl: './red-clinica.scenarios.html',
  styleUrl: './red-clinica.scenarios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenarioRedClinica implements ScenarioHost {
  readonly variante = input<RedClinicaVariant>('estudio');

  protected readonly record = outputsRecord();
  readonly outputs = this.record.salidas;

  protected readonly nodos = NODOS_DEMO;
  protected readonly aristas = ARISTAS_DEMO;
  protected readonly ahora = AHORA_DEMO;
  protected readonly aspecto = ASPECTO_DE_TIPO;

  protected readonly filtro = signal<FiltroDeRed>(FILTRO_VACIO);
  protected readonly abierto = signal<NodoDeRed | null>(null);
  protected readonly resaltados = signal<readonly string[]>([]);

  protected readonly visibles = computed(() => aplicarFiltro(this.nodos, this.filtro(), this.aristas));
  protected readonly alertas = computed(() =>
    this.variante() === 'alertas-vacias' ? [] : alertasDeApoyo(ENTRADA_DE_ALERTAS_DEMO),
  );
  protected readonly presentacion = computed<PresentacionDelPanel>(() =>
    this.variante() === 'hoja' ? 'hoja' : 'auto',
  );

  constructor() {
    effect(() => {
      const inicial = NODO_INICIAL[this.variante()];
      untracked(() => {
        this.filtro.set(FILTRO_VACIO);
        this.abierto.set(inicial === null ? null : (this.nodos.find((n) => n.id === inicial) ?? null));
      });
    });
  }

  protected abrir(id: string): void {
    this.abierto.set(this.nodos.find((n) => n.id === id) ?? null);
  }

  protected resumen(f: FiltroDeRed): string {
    const partes = [
      f.texto && `texto=${f.texto}`,
      f.tipos.length > 0 && `tipos=${f.tipos.join(',')}`,
      f.especialidadId && `especialidad=${f.especialidadId}`,
      f.profesionalId && `profesional=${f.profesionalId}`,
      f.hiloDeDiagnosticoId && `hilo=${f.hiloDeDiagnosticoId}`,
      f.desde && `desde=${f.desde.toISOString().slice(0, 10)}`,
      f.hasta && `hasta=${f.hasta.toISOString().slice(0, 10)}`,
    ].filter(Boolean);
    return partes.length === 0 ? '(vacío)' : partes.join(' · ');
  }
}

const comun = { host: ScenarioRedClinica, fuente: SOURCE } as const;

export const RED_CLINICA_SCENARIOS: readonly ComponentScenario[] = [
  {
    ...comun,
    id: `${KEY_PANEL}#estudio`,
    clave: KEY_PANEL,
    variante: 'estudio',
    titulo: 'Panel abierto en un estudio con resultado liberado',
    seVe: 'Columna a la derecha del mapa: MAPA con tres valores, dos marcados «↑ Alto» con texto y fondo, rango de referencia con unidad, conclusión y botón de descarga del PDF; vínculos con «inferido» donde corresponde.',
    interacciones: [
      'Un vínculo → nodoElegido y el panel pasa a ese nodo; el foco va al nuevo título.',
      'Escape dentro del panel o «Cerrar el detalle» → cerrado; el foco vuelve al nodo que lo abrió.',
      'Otro nodo de la lista → el panel cambia sin cerrarse (el mapa no se tapa).',
    ],
    salidasEsperadas: ['nodoElegido', 'cerrado', 'filtroChange'],
  },
  {
    ...comun,
    id: `${KEY_PANEL}#diagnostico`,
    clave: KEY_PANEL,
    variante: 'diagnostico',
    titulo: 'Panel en un diagnóstico descartado y reemplazado',
    seVe: 'Razonamiento: certeza «Descartado», hallazgos, quién y cuándo lo descartó, motivo, evidencia navegable y «Se descartó en favor de Hipertensión arterial esencial».',
    interacciones: ['«Hipertensión arterial esencial» → nodoElegido dx2.'],
    salidasEsperadas: ['nodoElegido', 'cerrado'],
  },
  {
    ...comun,
    id: `${KEY_PANEL}#derivacion`,
    clave: KEY_PANEL,
    variante: 'derivacion',
    titulo: 'Panel en una derivación aceptada sin contrarreferencia',
    seVe: 'Motivo, resumen clínico, respuesta «Aceptada», llegada con enlace a la atención de destino y «El destino todavía no devolvió su informe» destacado.',
    interacciones: ['«Ver la atención de llegada» → nodoElegido a3.'],
    salidasEsperadas: ['nodoElegido', 'cerrado'],
  },
  {
    ...comun,
    id: `${KEY_PANEL}#reconsulta`,
    clave: KEY_PANEL,
    variante: 'reconsulta',
    titulo: 'Panel en una reconsulta: origen y continuidad',
    seVe: '«Origen y continuidad» con «→ Reconsulta de · Consulta de medicina general» bajo «Viene de».',
    interacciones: ['El origen → nodoElegido c1, y ahí «Siguió con» muestra la reconsulta.'],
    salidasEsperadas: ['nodoElegido', 'cerrado'],
  },
  {
    ...comun,
    id: `${KEY_PANEL}#hoja`,
    clave: KEY_PANEL,
    variante: 'hoja',
    titulo: 'Panel como hoja inferior modal (forzado)',
    seVe: 'El mismo detalle en un <dialog> modal anclado abajo con velo; el foco queda atrapado en la hoja. Es lo que se ve en el teléfono con «auto».',
    interacciones: ['Escape → cerrado y la hoja desaparece.'],
    salidasEsperadas: ['nodoElegido', 'cerrado'],
  },
  {
    ...comun,
    id: `${KEY_FILTROS}#filtros`,
    clave: KEY_FILTROS,
    variante: 'filtros',
    titulo: 'Barra de filtros sobre la historia de demostración',
    seVe: 'Búsqueda, el selector «Hilo», especialidad, profesional, desde/hasta y chips de tipos; «14 registros en la historia».',
    interacciones: [
      'Un chip o un criterio → filtroChange con el resumen; la lista de nodos se acota y la cuenta dice «N de 14».',
      '«Limpiar filtros» → filtroChange (vacío).',
    ],
    salidasEsperadas: ['filtroChange', 'nodoElegido'],
  },
  {
    ...comun,
    id: `${KEY_ALERTAS}#alertas`,
    clave: KEY_ALERTAS,
    variante: 'alertas',
    titulo: 'Alertas de apoyo de la historia de demostración',
    seVe: 'Siete alertas (tres de prioridad alta), las cinco primeras a la vista; cada una con prioridad en texto, qué quedó abierto y desde cuándo.',
    interacciones: [
      'Pasar el puntero o el foco → los nodos de la alerta se resaltan en la lista.',
      'Clic → nodoElegido y el panel abre ese nodo.',
    ],
    salidasEsperadas: ['nodoElegido'],
  },
  {
    ...comun,
    id: `${KEY_ALERTAS}#alertas-vacias`,
    clave: KEY_ALERTAS,
    variante: 'alertas-vacias',
    titulo: 'Sin alertas',
    seVe: '«Nada abierto en los registros a la vista…» y el pie que aclara que no sugieren diagnósticos.',
    interacciones: ['No hay nada que tocar en la lista; los nodos siguen abriendo el panel.'],
    salidasEsperadas: ['nodoElegido'],
    nivelDePrueba: 'limite',
  },
];
