import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';

import {
  empty,
  forbidden,
  loading,
  notFound,
  offline,
  ready,
  routeAuthPending,
  stale,
  unexpectedError,
  validation,
} from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { historialDeCursor } from '../../../shared/components/organisms/data-table/cursor-history';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  SortState,
} from '../../../shared/components/organisms/data-table/data-table.types';

import type { AnfitrionDeEscenario, EscenarioDeComponente } from './escenario.types';
import { registroDeSalidas } from './registro-de-salidas';

/* ============================================================================
    Escenarios de `DataTable<Row>`.

    El organismo pide tres cosas que ningún generador puede adivinar: un
    `ViewState<readonly Row[]>` de alguna de sus diez variantes, columnas con
    plantillas de celda, y una función de identidad. Acá se le dan de verdad,
    con filas sintéticas fijas —ni datos clínicos reales ni `faker`: el mismo
    escenario abierto dos veces se ve igual— y con el `historialDeCursor` que
    usan las pantallas reales, para que «Siguiente» y «Anterior» hagan lo que
    hacen en producción.
    ========================================================================== */

const CLAVE = 'shared/components/organisms/data-table/data-table';
const FUENTE = 'src/app/features/component-stock/escenarios/data-table.escenarios.ts';

interface PacienteDeMuestra {
  readonly id: string;
  readonly apellido: string;
  readonly nombre: string;
  readonly documento: string;
  /** ISO, para que la celda lo formatee con `DatePipe` como hace el producto. */
  readonly nacimiento: string;
  readonly fallecido: boolean;
}

interface PaginaDeMuestra {
  readonly filas: readonly PacienteDeMuestra[];
  readonly siguiente: string | null;
}

/** Tres páginas fijas: la paginación por cursor tiene que poder ir y volver. */
const PRIMERA_PAGINA: PaginaDeMuestra = {
  filas: [
    {
      id: 'p-01',
      apellido: 'Peña',
      nombre: 'Ana',
      documento: '4821133 LP',
      nacimiento: '1985-03-14',
      fallecido: false,
    },
    {
      id: 'p-02',
      apellido: 'Salas',
      nombre: 'Bruno',
      documento: '7233901 SC',
      nacimiento: '1972-11-02',
      fallecido: false,
    },
    {
      id: 'p-03',
      apellido: 'Quiroga',
      nombre: 'Celia',
      documento: '6104477 CB',
      nacimiento: '1990-07-21',
      fallecido: false,
    },
    {
      id: 'p-04',
      apellido: 'Mamani',
      nombre: 'Delia',
      documento: '3399120 LP',
      nacimiento: '1958-01-09',
      fallecido: true,
    },
    {
      id: 'p-05',
      apellido: 'Rojas',
      nombre: 'Esteban',
      documento: '8812004 OR',
      nacimiento: '2001-05-30',
      fallecido: false,
    },
    {
      id: 'p-06',
      apellido: 'Villca',
      nombre: 'Fátima',
      documento: '5560981 PT',
      nacimiento: '1966-09-17',
      fallecido: false,
    },
  ],
  siguiente: 'pag-2',
};

const PAGINAS_SIGUIENTES: Readonly<Record<string, PaginaDeMuestra>> = {
  'pag-2': {
    filas: [
      {
        id: 'p-07',
        apellido: 'Arce',
        nombre: 'Gonzalo',
        documento: '9021455 TJ',
        nacimiento: '1979-12-05',
        fallecido: false,
      },
      {
        id: 'p-08',
        apellido: 'Choque',
        nombre: 'Helena',
        documento: '4477018 LP',
        nacimiento: '1995-04-11',
        fallecido: false,
      },
      {
        id: 'p-09',
        apellido: 'Flores',
        nombre: 'Iván',
        documento: '6690233 SC',
        nacimiento: '1983-08-26',
        fallecido: false,
      },
    ],
    siguiente: 'pag-3',
  },
  'pag-3': {
    filas: [
      {
        id: 'p-10',
        apellido: 'Gutiérrez',
        nombre: 'Julia',
        documento: '7708812 CB',
        nacimiento: '1961-02-19',
        fallecido: false,
      },
    ],
    siguiente: null,
  },
};

/** La página que corresponde a un cursor; sin cursor es la primera. */
function paginaDe(cursor: string | undefined): PaginaDeMuestra {
  if (cursor === undefined) return PRIMERA_PAGINA;
  return PAGINAS_SIGUIENTES[cursor] ?? PRIMERA_PAGINA;
}

/** Fecha fija: un «ahora» real cambiaría la captura en cada corrida. */
const DATO_DE = new Date('2026-09-21T09:30:00-04:00');

/** Las variantes del escenario: las diez del `ViewState` y tres del contrato. */
export const VARIANTES_DE_DATA_TABLE = [
  'ready',
  'ready-seleccionable',
  'ready-navegable',
  'stale',
  'empty',
  'loading',
  'route-auth-pending',
  'validation',
  'forbidden',
  'not-found',
  'offline',
  'error',
] as const;
export type VarianteDeDataTable = (typeof VARIANTES_DE_DATA_TABLE)[number];

/**
 * Anfitrión de `DataTable` para el banco.
 *
 * Simula lo que en producción hace el contenedor: recibe `sortChanged` y
 * reordena las filas visibles, recibe `cursorChanged` y cambia de página con
 * el `historialDeCursor`. Todo síncrono y en memoria, que es lo que un banco
 * necesita para mostrar la interacción sin un backend detrás.
 */
@Component({
  selector: 'app-escenario-data-table',
  imports: [Badge, DataTable, DatePipe],
  template: `
    <app-data-table
      [state]="estado()"
      [columns]="columnas()"
      [trackBy]="porId"
      [rowLabel]="nombreCompleto"
      caption="Pacientes del servicio (escenario del banco)"
      [selectable]="seleccionable()"
      [rowNavigable]="navegable()"
      [sort]="orden()"
      [cursor]="paginado.cursor()"
      (sortChanged)="ordenar($event)"
      (cursorChanged)="mover($event)"
      (selectionChanged)="registro.anotar('selectionChanged', $event.length + ' fila(s)')"
      (rowActivated)="registro.anotar('rowActivated', $event.id)"
      (retry)="registro.anotar('retry')"
      (refresh)="registro.anotar('refresh')"
    />

    <ng-template #celdaNacimiento let-paciente>
      <span class="tabular-nums">{{ paciente.nacimiento | date: 'dd/MM/yyyy' }}</span>
    </ng-template>

    <ng-template #celdaEstado let-paciente>
      @if (paciente.fallecido) {
        <app-badge variant="warning" value="Fallecido/a" />
      } @else {
        <app-badge variant="success" value="Activo/a" />
      }
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EscenarioDataTable implements AnfitrionDeEscenario {
  readonly variante = input<VarianteDeDataTable>('ready');

  protected readonly registro = registroDeSalidas();
  readonly salidas = this.registro.salidas;

  /** El mismo paginado que usan las pantallas reales. */
  protected readonly paginado = historialDeCursor();

  private readonly celdaNacimiento =
    viewChild.required<TemplateRef<{ $implicit: PacienteDeMuestra }>>('celdaNacimiento');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: PacienteDeMuestra }>>('celdaEstado');

  protected readonly columnas = computed<readonly ColumnDef<PacienteDeMuestra>[]>(() => [
    { key: 'apellido', header: 'Apellido', priority: 1, sortable: true },
    { key: 'nombre', header: 'Nombre', priority: 1 },
    { key: 'documento', header: 'Documento', priority: 2, align: 'end' },
    { key: 'nacimiento', header: 'Nacimiento', priority: 2, cell: this.celdaNacimiento() },
    { key: 'fallecido', header: 'Estado', priority: 2, sticky: 'end', cell: this.celdaEstado() },
  ]);

  protected readonly porId = (fila: PacienteDeMuestra): string => fila.id;
  protected readonly nombreCompleto = (fila: PacienteDeMuestra): string =>
    `${fila.nombre} ${fila.apellido}`;

  protected readonly seleccionable = computed(() => this.variante() === 'ready-seleccionable');
  protected readonly navegable = computed(() => this.variante() === 'ready-navegable');

  protected readonly orden = signal<SortState | null>(null);
  private readonly filas = signal<readonly PacienteDeMuestra[]>(PRIMERA_PAGINA.filas);

  constructor() {
    this.paginado.llego(PRIMERA_PAGINA.siguiente);
  }

  private readonly ordenadas = computed(() => {
    const orden = this.orden();
    if (orden === null) return this.filas();
    const signo = orden.direction === 'asc' ? 1 : -1;
    return [...this.filas()].sort((a, b) => {
      const clave = orden.key as keyof PacienteDeMuestra;
      return String(a[clave]).localeCompare(String(b[clave]), 'es') * signo;
    });
  });

  protected readonly estado = computed<ViewState<readonly PacienteDeMuestra[]>>(() => {
    switch (this.variante()) {
      case 'stale':
        return stale(this.ordenadas(), DATO_DE);
      case 'empty':
        return empty(
          { label: 'Registrar un paciente', route: '/administration/patients/new' },
          'Todavía no hay pacientes registrados en esta organización.',
        );
      case 'loading':
        return loading();
      case 'route-auth-pending':
        return routeAuthPending();
      case 'validation':
        return validation([
          { field: 'documento', message: 'El documento ya está registrado en otra persona.' },
        ]);
      case 'forbidden':
        return forbidden({
          message: 'Tu rol no alcanza para ver el listado de pacientes.',
          nextAction: { label: 'Verificar mi identidad', route: '/identity' },
        });
      case 'not-found':
        return notFound({ label: 'Volver al panel', route: '/dashboard' });
      case 'offline':
        return offline(DATO_DE);
      case 'error':
        return unexpectedError('req-7f3a1c9e', 'No pudimos leer el listado.');
      default:
        return ready(this.ordenadas());
    }
  });

  protected ordenar(orden: SortState): void {
    this.orden.set(orden);
    this.registro.anotar('sortChanged', `${orden.key} ${orden.direction}`);
  }

  protected mover(cursor: string): void {
    this.registro.anotar('cursorChanged', cursor);
    this.paginado.mover(cursor);
    const pagina = paginaDe(this.paginado.actual());
    this.filas.set(pagina.filas);
    this.paginado.llego(pagina.siguiente);
  }
}

const SALIDAS_DE_LISTADO = ['sortChanged', 'cursorChanged', 'retry', 'refresh'];

const ESTADOS_SIN_FILAS: readonly {
  variante: VarianteDeDataTable;
  titulo: string;
  seVe: string;
  salidas: readonly string[];
}[] = [
  {
    variante: 'stale',
    titulo: 'S7 · datos atrasados',
    seVe: 'La tabla con las seis filas y, arriba, el aviso «Información al 21/09/2026 09:30» con «Actualizar».',
    salidas: ['refresh', ...SALIDAS_DE_LISTADO],
  },
  {
    variante: 'empty',
    titulo: 'S3 · vacío con próxima acción',
    seVe: 'Sin tabla. «Todavía no hay nada acá», el motivo, y el enlace «Registrar un paciente».',
    salidas: [],
  },
  {
    variante: 'loading',
    titulo: 'S2 · cargando',
    seVe: 'Solo el esqueleto de tres líneas. Ni tabla ni paginación.',
    salidas: [],
  },
  {
    variante: 'route-auth-pending',
    titulo: 'S1 · autorización pendiente',
    seVe: 'Un spinner con «Verificando permisos…». NUNCA un esqueleto: todavía no se sabe si hay algo que ver.',
    salidas: [],
  },
  {
    variante: 'validation',
    titulo: 'S4 · validación',
    seVe: 'La alerta «Revisá lo ingresado» con el campo «documento» y su mensaje. El foco cae en la alerta.',
    salidas: [],
  },
  {
    variante: 'forbidden',
    titulo: 'S5 · prohibido, con puerta',
    seVe: '«No tenés acceso a esta sección» y el enlace «Verificar mi identidad»: es una puerta, no un muro.',
    salidas: [],
  },
  {
    variante: 'not-found',
    titulo: 'S6 · no encontrado',
    seVe: '«No encontramos lo que buscás» con copy fijo —no dice si existe— y «Volver al panel».',
    salidas: [],
  },
  {
    variante: 'offline',
    titulo: 'S8 · sin conexión',
    seVe: '«Sin conexión» y el botón «Reintentar».',
    salidas: ['retry'],
  },
  {
    variante: 'error',
    titulo: 'S9 · error con código de soporte',
    seVe: '«Algo salió mal», el código «req-7f3a1c9e» copiable, y «Reintentar».',
    salidas: ['retry'],
  },
];

export const ESCENARIOS_DE_DATA_TABLE: readonly EscenarioDeComponente[] = [
  {
    id: `${CLAVE}#ready`,
    clave: CLAVE,
    variante: 'ready',
    titulo: 'Listado con orden y cursor',
    seVe: 'Seis pacientes; «Apellido» ordenable; «Documento», «Nacimiento» y «Estado» se pliegan al detalle en móvil; «Estado» fija al borde; «Siguiente» activo y «Anterior» apagado.',
    interacciones: [
      'Tocar «Apellido» → sortChanged apellido asc, y las filas se reordenan.',
      'Tocar «Siguiente» → cursorChanged pag-2, tres filas nuevas, «Anterior» se enciende.',
      'Tocar «Anterior» → cursorChanged anterior, vuelven las seis primeras.',
      'En móvil (390), tocar «Ver el detalle de …» despliega documento, nacimiento y estado.',
    ],
    salidasEsperadas: SALIDAS_DE_LISTADO,
    host: EscenarioDataTable,
    fuente: FUENTE,
  },
  {
    id: `${CLAVE}#ready-seleccionable`,
    clave: CLAVE,
    variante: 'ready-seleccionable',
    titulo: 'Listado con selección de la página visible',
    seVe: 'Lo mismo que «ready», con una casilla por fila y una en la cabecera para la página visible.',
    interacciones: [
      'Marcar una fila → selectionChanged 1 fila(s).',
      'Marcar la cabecera → selectionChanged 6 fila(s); con selección parcial queda indeterminada.',
    ],
    salidasEsperadas: ['selectionChanged', ...SALIDAS_DE_LISTADO],
    host: EscenarioDataTable,
    fuente: FUENTE,
  },
  {
    id: `${CLAVE}#ready-navegable`,
    clave: CLAVE,
    variante: 'ready-navegable',
    titulo: 'Filas que responden al clic',
    seVe: 'Lo mismo que «ready», con el cursor de puntero sobre cada fila.',
    interacciones: [
      'Clic en una fila → rowActivated con su id. Clic sobre un botón o una selección de texto NO emite.',
    ],
    salidasEsperadas: ['rowActivated', ...SALIDAS_DE_LISTADO],
    host: EscenarioDataTable,
    fuente: FUENTE,
  },
  ...ESTADOS_SIN_FILAS.map((estado) => ({
    id: `${CLAVE}#${estado.variante}`,
    clave: CLAVE,
    variante: estado.variante,
    titulo: estado.titulo,
    seVe: estado.seVe,
    interacciones:
      estado.salidas.length === 0
        ? ['Nada que tocar: el estado no ofrece acciones.']
        : [`Tocar la acción del estado → ${estado.salidas[0]}.`],
    salidasEsperadas: estado.salidas,
    host: EscenarioDataTable,
    fuente: FUENTE,
  })),
];
