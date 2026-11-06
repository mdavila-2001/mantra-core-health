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
import {
  AHORA_DEMO,
  ARISTAS_DEMO,
  ENTRADA_DE_ALERTAS_DEMO,
  NODOS_DEMO,
} from '../../clinical-record/patient-chart/red-clinica/red-clinica.demo';
import { aplicarFiltro, FILTRO_VACIO, type FiltroDeRed } from '../../clinical-record/patient-chart/red-clinica/red-clinica-filtro';
import { ASPECTO_DE_TIPO, type NodoDeRed } from '../../clinical-record/patient-chart/red-clinica/red-clinica.types';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { outputsRecord } from './exit-log';
import type { ComponentScenario, ScenarioHost } from './scenario.types';

/* ============================================================================
    Escenarios de la red clínica (franja 3): panel, filtros y alertas juntos.

    Las tres piezas se montan como las montará el expediente: la barra arriba,
    las alertas y el mapa a la izquierda, el panel a la derecha. El «mapa» de
    acá es una lista de nodos —un sustituto, rotulado como tal—: el mapa real
    lo dibuja `recorrido-clinico/**` (franja 2) y no se importa para no atar
    este banco a una franja que todavía se está escribiendo.

    Los datos son la historia de demostración de `red-clinica.demo.ts`.
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
  template: `
    <div class="red" data-testid="escenario-red-clinica">
      <app-red-clinica-filtros
        class="red__filtros"
        [nodos]="nodos"
        [(filtro)]="filtro"
        [visibles]="visibles().length"
        (filtroChange)="record.anotar('filtroChange', resumen($event))"
      />
      <div class="red__cuerpo" [class.red__cuerpo--con-panel]="abierto() !== null && presentacion() !== 'hoja'">
        <div class="red__izquierda">
          <app-red-clinica-alertas-lista
            [alertas]="alertas()"
            (nodoElegido)="record.anotar('nodoElegido', $event); abrir($event)"
            (resaltar)="resaltados.set($event)"
          />
          <section class="red__mapa" aria-labelledby="red-mapa-titulo">
            <h2 id="red-mapa-titulo" class="red__mapa-titulo">Nodos de la red</h2>
            <p class="red__mapa-nota">Sustituto del mapa para el banco: el mapa lo dibuja el recorrido clínico.</p>
            <ul class="red__nodos">
              @for (n of visibles(); track n.id) {
                <li>
                  <button
                    type="button"
                    class="red__nodo"
                    data-testid="escenario-nodo"
                    [class.red__nodo--resaltado]="resaltados().includes(n.id)"
                    [class.red__nodo--abierto]="abierto()?.id === n.id"
                    [attr.aria-pressed]="abierto()?.id === n.id"
                    (click)="abrir(n.id)"
                  >
                    <app-nav-icon [name]="aspecto[n.tipo].icono" />
                    <span class="red__nodo-tipo">{{ aspecto[n.tipo].singular }}</span>
                    <span class="red__nodo-titulo">{{ n.titulo }}</span>
                  </button>
                </li>
              } @empty {
                <li class="red__mapa-nota">Ningún registro coincide con los filtros.</li>
              }
            </ul>
          </section>
        </div>
        <app-red-clinica-panel
          class="red__panel"
          [nodo]="abierto()"
          [nodos]="nodos"
          [aristas]="aristas"
          [ahora]="ahora"
          [presentacion]="presentacion()"
          (nodoElegido)="record.anotar('nodoElegido', $event); abrir($event)"
          (cerrado)="record.anotar('cerrado'); abierto.set(null)"
        />
      </div>
    </div>
  `,
  styles: `
    .red {
      display: grid;
      gap: var(--sp-4);
    }
    .red__cuerpo {
      display: grid;
      gap: var(--sp-4);
      align-items: start;
    }
    @media (min-width: 780px) {
      .red__cuerpo--con-panel {
        grid-template-columns: minmax(0, 1fr) minmax(20rem, 28rem);
      }
    }
    .red__izquierda {
      display: grid;
      gap: var(--sp-4);
      min-inline-size: 0;
    }
    .red__mapa {
      display: grid;
      gap: var(--sp-2);
      padding: var(--sp-4);
      border: 1px dashed var(--border-default);
      border-radius: var(--r-card);
    }
    .red__mapa-titulo {
      margin: 0;
      font-size: var(--fs-body-lg);
      font-weight: 600;
    }
    .red__mapa-nota {
      margin: 0;
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .red__nodos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: var(--sp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .red__nodo {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0 var(--sp-2);
      align-items: center;
      inline-size: 100%;
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--r-md);
      background: var(--bg-surface);
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .red__nodo app-nav-icon {
      grid-row: span 2;
      inline-size: 1.25rem;
      block-size: 1.25rem;
      color: var(--text-secondary);
    }
    .red__nodo:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
    .red__nodo--resaltado {
      border-color: var(--st-warning-bd);
      background: var(--st-warning-bg);
    }
    .red__nodo--abierto {
      border-color: var(--brand-primary);
      box-shadow: inset 0 0 0 1px var(--brand-primary);
    }
    .red__nodo-tipo {
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .red__nodo-titulo {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
  `,
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
    seVe: 'Búsqueda, «Solo el hilo de este diagnóstico», especialidad, profesional, desde/hasta y chips de tipos; «14 registros en la historia».',
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
