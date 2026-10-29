import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
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

import type { ScenarioHost, ComponentScenario } from './scenario.types';
import { outputsRecord } from './exit-log';

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

const KEY = 'shared/components/organisms/data-table/data-table';
const SOURCE = 'src/app/features/component-stock/scenarios/data-table.scenarios.ts';

interface SamplePatient {
  readonly id: string;
  readonly apellido: string;
  readonly nombre: string;
  readonly documento: string;
  /** ISO, para que la celda lo formatee con `DatePipe` como hace el producto. */
  readonly nacimiento: string;
  readonly fallecido: boolean;
}

interface SamplePage {
  readonly filas: readonly SamplePatient[];
  readonly siguiente: string | null;
}

/** Tres páginas fijas: la paginación por cursor tiene que poder ir y volver. */
const FIRST_PAGE: SamplePage = {
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

const NEXT_PAGES: Readonly<Record<string, SamplePage>> = {
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
function pageOf(cursor: string | undefined): SamplePage {
  if (cursor === undefined) return FIRST_PAGE;
  return NEXT_PAGES[cursor] ?? FIRST_PAGE;
}

/** Fecha fija: un «ahora» real cambiaría la captura en cada corrida. */
const DATA_OF = new Date('2026-09-21T09:30:00-04:00');

/**
 * Valores límite: los bordes que una tabla real encuentra y que el camino feliz
 * de seis filas no ejercita. Todas sintéticas.
 */
const UNIQUE_ROW: readonly SamplePatient[] = [FIRST_PAGE.filas[0]!];

const LONG_TEXT: readonly SamplePatient[] = [
  {
    id: 'l-01',
    apellido: 'Fernández de Córdova Villarroel Santa Cruz Arteaga',
    nombre: 'María de los Ángeles Guadalupe Esperanza',
    // Una huella sin espacios ni guiones: no se puede envolver, así que en
    // pantallas medianas la tabla desborda y la columna fija tiene que actuar.
    documento: 'sha256:9f2c4e1b7a3d5f60c8e2b1a4d7f3c6e9a0b5d2f8c1e4a7b3d6f9c2e5a8b1d4f7c0',
    nacimiento: '1948-06-30',
    fallecido: false,
  },
  {
    id: 'l-02',
    apellido: 'Quispe Mamani',
    nombre: 'Juan',
    documento: '1 LP',
    nacimiento: '2025-12-31',
    fallecido: true,
  },
];

/**
 * El caso inválido a propósito: dos filas con la misma identidad. El `trackBy`
 * del contrato promete «identidad estable»; con esto la tabla no puede saber
 * qué fila es cuál al ordenar, paginar o seleccionar.
 */
const REPEATED_IDENTITY: readonly SamplePatient[] = [
  FIRST_PAGE.filas[0]!,
  { ...FIRST_PAGE.filas[1]!, id: FIRST_PAGE.filas[0]!.id },
  FIRST_PAGE.filas[2]!,
];

/** Las variantes del escenario: las diez del `ViewState`, tres del contrato y los bordes. */
export const DATA_TABLE_VARIANTS = [
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
  'cero-filas',
  'una-fila',
  'texto-largo',
  'trackby-repetido',
] as const;
export type DataTableVariant = (typeof DATA_TABLE_VARIANTS)[number];

/** Las variantes de una sola página: sin cursor hacia adelante. */
const UNIQUE_PAGE: ReadonlySet<DataTableVariant> = new Set([
  'cero-filas',
  'una-fila',
  'texto-largo',
  'trackby-repetido',
]);

/** Las filas con las que arranca cada variante. */
export function rowsOf(variante: DataTableVariant): readonly SamplePatient[] {
  switch (variante) {
    case 'cero-filas':
      return [];
    case 'una-fila':
      return UNIQUE_ROW;
    case 'texto-largo':
      return LONG_TEXT;
    case 'trackby-repetido':
      return REPEATED_IDENTITY;
    default:
      return FIRST_PAGE.filas;
  }
}

/** La identidad de una fila: lo que el anfitrión le pasa a `trackBy`. */
export const patientIdentity = (fila: SamplePatient): string => fila.id;

/**
 * Las columnas del escenario sin sus plantillas de celda: la parte del
 * contrato que se puede comprobar antes de montar.
 */
export const SAMPLE_COLUMNS: readonly Omit<ColumnDef<SamplePatient>, 'cell'>[] = [
  { key: 'apellido', header: 'Apellido', priority: 1, sortable: true },
  { key: 'nombre', header: 'Nombre', priority: 1 },
  { key: 'documento', header: 'Documento', priority: 2, align: 'end' },
  { key: 'nacimiento', header: 'Nacimiento', priority: 2 },
  { key: 'fallecido', header: 'Estado', priority: 2, sticky: 'end' },
];

/**
 * Lo que el contrato de `DataTable` exige y un escenario puede violar: identidad
 * única por fila (`trackBy`), claves de columna únicas y cabeceras legibles.
 */
export function tableContractViolations<Row>(
  filas: readonly Row[],
  trackBy: (fila: Row) => string,
  columnas: readonly Pick<ColumnDef<Row>, 'key' | 'header'>[],
): readonly string[] {
  const violaciones: string[] = [];
  const vistas = new Map<string, number>();
  for (const fila of filas) vistas.set(trackBy(fila), (vistas.get(trackBy(fila)) ?? 0) + 1);
  for (const [identidad, veces] of vistas) {
    if (veces > 1) {
      violaciones.push(
        `trackBy repite la identidad «${identidad}» en ${veces} filas: la tabla no puede saber qué fila es cuál al ordenar, paginar o seleccionar.`,
      );
    }
  }
  const claves = new Set<string>();
  for (const columna of columnas) {
    if (claves.has(columna.key)) violaciones.push(`dos columnas con la clave «${columna.key}».`);
    claves.add(columna.key);
    if (columna.header.trim() === '') violaciones.push(`la columna «${columna.key}» no tiene cabecera legible.`);
  }
  return violaciones;
}

/**
 * Anfitrión de `DataTable` para el banco.
 *
 * Simula lo que en producción hace el contenedor: recibe `sortChanged` y
 * reordena las filas visibles, recibe `cursorChanged` y cambia de página con
 * el `historialDeCursor`. Todo síncrono y en memoria, que es lo que un banco
 * necesita para mostrar la interacción sin un backend detrás.
 */
@Component({
  selector: 'app-scenario-data-table',
  imports: [Badge, DataTable, DatePipe],
  template: `
    <app-data-table
      [state]="status()"
      [columns]="columns()"
      [trackBy]="byId"
      [rowLabel]="completeName"
      caption="Pacientes del servicio (escenario del banco)"
      [selectable]="selectable()"
      [rowNavigable]="navigable()"
      [sort]="order()"
      [cursor]="cursor()"
      (sortChanged)="sort($event)"
      (cursorChanged)="mover($event)"
      (selectionChanged)="record.anotar('selectionChanged', $event.length + ' fila(s)')"
      (rowActivated)="record.anotar('rowActivated', $event.id)"
      (retry)="record.anotar('retry')"
      (refresh)="record.anotar('refresh')"
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
export class ScenarioDataTable implements ScenarioHost {
  readonly variante = input<DataTableVariant>('ready');

  protected readonly record = outputsRecord();
  readonly outputs = this.record.salidas;

  /** El mismo paginado que usan las pantallas reales. */
  protected readonly paginated = historialDeCursor();

  private readonly celdaNacimiento =
    viewChild.required<TemplateRef<{ $implicit: SamplePatient }>>('celdaNacimiento');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: SamplePatient }>>('celdaEstado');

  /** Las columnas del contrato, con sus plantillas de celda donde las hay. */
  protected readonly columns = computed<readonly ColumnDef<SamplePatient>[]>(() => {
    const celdas: Partial<Record<string, TemplateRef<{ $implicit: SamplePatient }>>> = {
      nacimiento: this.celdaNacimiento(),
      fallecido: this.celdaEstado(),
    };
    return SAMPLE_COLUMNS.map((columna) => {
      const cell = celdas[columna.key];
      return cell === undefined ? columna : { ...columna, cell };
    });
  });

  protected readonly byId = patientIdentity;
  protected readonly completeName = (fila: SamplePatient): string =>
    `${fila.nombre} ${fila.apellido}`;

  protected readonly selectable = computed(() => this.variante() === 'ready-seleccionable');
  protected readonly navigable = computed(() => this.variante() === 'ready-navegable');

  protected readonly order = signal<SortState | null>(null);
  /** Las filas visibles: arrancan con las de la variante y el cursor las cambia. */
  private readonly rows = linkedSignal(() => rowsOf(this.variante()));

  /** Los bordes son de una sola página: sin «Siguiente» que prometa más filas. */
  protected readonly cursor = computed(() =>
    UNIQUE_PAGE.has(this.variante()) ? {} : this.paginated.cursor(),
  );

  constructor() {
    this.paginated.llego(FIRST_PAGE.siguiente);
  }

  private readonly sorted = computed(() => {
    const orden = this.order();
    if (orden === null) return this.rows();
    const signo = orden.direction === 'asc' ? 1 : -1;
    return [...this.rows()].sort((a, b) => {
      const clave = orden.key as keyof SamplePatient;
      return String(a[clave]).localeCompare(String(b[clave]), 'es') * signo;
    });
  });

  protected readonly status = computed<ViewState<readonly SamplePatient[]>>(() => {
    switch (this.variante()) {
      case 'stale':
        return stale(this.sorted(), DATA_OF);
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
          message: 'Su rol no alcanza para ver el listado de pacientes.',
          nextAction: { label: 'Verificar mi identidad', route: '/identity' },
        });
      case 'not-found':
        return notFound({ label: 'Volver al panel', route: '/dashboard' });
      case 'offline':
        return offline(DATA_OF);
      case 'error':
        return unexpectedError('req-7f3a1c9e', 'No pudimos leer el listado.');
      default:
        return ready(this.sorted());
    }
  });

  protected sort(orden: SortState): void {
    this.order.set(orden);
    this.record.anotar('sortChanged', `${orden.key} ${orden.direction}`);
  }

  protected mover(cursor: string): void {
    this.record.anotar('cursorChanged', cursor);
    this.paginated.mover(cursor);
    const pagina = pageOf(this.paginated.actual());
    this.rows.set(pagina.filas);
    this.paginated.llego(pagina.siguiente);
  }
}

const LISTING_OUTPUTS = ['sortChanged', 'cursorChanged', 'retry', 'refresh'];

const STATUSES_WITHOUT_ROWS: readonly {
  variante: DataTableVariant;
  titulo: string;
  seVe: string;
  salidas: readonly string[];
}[] = [
  {
    variante: 'stale',
    titulo: 'S7 · datos atrasados',
    seVe: 'La tabla con las seis filas y, arriba, el aviso «Información al 21/09/2026 09:30» con «Actualizar».',
    salidas: ['refresh', ...LISTING_OUTPUTS],
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
    seVe: 'La alerta «Revise lo ingresado» con el campo «documento» y su mensaje. El foco cae en la alerta.',
    salidas: [],
  },
  {
    variante: 'forbidden',
    titulo: 'S5 · prohibido, con puerta',
    seVe: '«No tiene acceso a esta sección» y el enlace «Verificar mi identidad»: es una puerta, no un muro.',
    salidas: [],
  },
  {
    variante: 'not-found',
    titulo: 'S6 · no encontrado',
    seVe: '«No encontramos lo que busca» con copy fijo —no dice si existe— y «Volver al panel».',
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

/** El contrato de la tabla con los datos de una variante, antes de montar. */
const contractOf = (variante: DataTableVariant) => (): readonly string[] =>
  tableContractViolations(rowsOf(variante), patientIdentity, SAMPLE_COLUMNS);

/**
 * Un escenario de la tabla antes de sumarle su verificación de contrato. La
 * variante va tipada con las de este anfitrión: una mal escrita no compila.
 */
type TableScenario = Omit<ComponentScenario, 'verificarContrato' | 'variante'> & {
  readonly variante: DataTableVariant;
};

const SCENARIOS_BASE: readonly TableScenario[] = [
  {
    id: `${KEY}#ready`,
    clave: KEY,
    variante: 'ready',
    titulo: 'Listado con orden y cursor',
    seVe: 'Seis pacientes; «Apellido» ordenable; «Documento», «Nacimiento» y «Estado» se pliegan al detalle en móvil; «Estado» fija al borde; «Siguiente» activo y «Anterior» apagado.',
    interacciones: [
      'Tocar «Apellido» → sortChanged apellido asc, y las filas se reordenan.',
      'Tocar «Siguiente» → cursorChanged pag-2, tres filas nuevas, «Anterior» se enciende.',
      'Tocar «Anterior» → cursorChanged anterior, vuelven las seis primeras.',
      'En móvil (390), tocar «Ver el detalle de …» despliega documento, nacimiento y estado.',
    ],
    salidasEsperadas: LISTING_OUTPUTS,
    host: ScenarioDataTable,
    fuente: SOURCE,
  },
  {
    id: `${KEY}#ready-seleccionable`,
    clave: KEY,
    variante: 'ready-seleccionable',
    titulo: 'Listado con selección de la página visible',
    seVe: 'Lo mismo que «ready», con una casilla por fila y una en la cabecera para la página visible.',
    interacciones: [
      'Marcar una fila → selectionChanged 1 fila(s).',
      'Marcar la cabecera → selectionChanged 6 fila(s); con selección parcial queda indeterminada.',
    ],
    salidasEsperadas: ['selectionChanged', ...LISTING_OUTPUTS],
    host: ScenarioDataTable,
    fuente: SOURCE,
  },
  {
    id: `${KEY}#ready-navegable`,
    clave: KEY,
    variante: 'ready-navegable',
    titulo: 'Filas que responden al clic',
    seVe: 'Lo mismo que «ready», con el cursor de puntero sobre cada fila.',
    interacciones: [
      'Clic en una fila → rowActivated con su id. Clic sobre un botón o una selección de texto NO emite.',
    ],
    salidasEsperadas: ['rowActivated', ...LISTING_OUTPUTS],
    host: ScenarioDataTable,
    fuente: SOURCE,
  },
  ...STATUSES_WITHOUT_ROWS.map((estado) => ({
    id: `${KEY}#${estado.variante}`,
    clave: KEY,
    variante: estado.variante,
    titulo: estado.titulo,
    seVe: estado.seVe,
    interacciones:
      estado.salidas.length === 0
        ? ['Nada que tocar: el estado no ofrece acciones.']
        : [`Tocar la acción del estado → ${estado.salidas[0]}.`],
    salidasEsperadas: estado.salidas,
    host: ScenarioDataTable,
    fuente: SOURCE,
  })),
  {
    id: `${KEY}#cero-filas`,
    clave: KEY,
    variante: 'cero-filas',
    titulo: 'Límite · listo con 0 filas',
    seVe: 'Un `ready([])`: no es el estado S3 «vacío» con próxima acción, es la tabla lista sin filas. Se ve lo que la tabla hace con eso, sin paginación.',
    interacciones: ['Tocar «Apellido» → sortChanged apellido asc aunque no haya filas.'],
    salidasEsperadas: ['sortChanged'],
    host: ScenarioDataTable,
    fuente: SOURCE,
    nivelDePrueba: 'limite',
  },
  {
    id: `${KEY}#una-fila`,
    clave: KEY,
    variante: 'una-fila',
    titulo: 'Límite · una sola fila',
    seVe: 'Una fila (Peña, Ana) con las cinco columnas y sin paginación: «Anterior» y «Siguiente» no se dibujan.',
    interacciones: ['Tocar «Apellido» dos veces → sortChanged apellido asc y luego desc; la fila no cambia.'],
    salidasEsperadas: ['sortChanged'],
    host: ScenarioDataTable,
    fuente: SOURCE,
    nivelDePrueba: 'limite',
  },
  {
    id: `${KEY}#texto-largo`,
    clave: KEY,
    variante: 'texto-largo',
    titulo: 'Límite · texto largo y columna fija',
    seVe: 'Un apellido de 50 caracteres (se envuelve) y una huella de documento de 71 sin espacios (no se envuelve) junto a otros de un carácter. En Tableta girada (1024) la tabla desborda y «Estado» (sticky: end) queda fija al borde derecho. Por debajo de 780 px las columnas de prioridad 2 se pliegan al detalle ▼.',
    interacciones: [
      'En Tableta girada (⟳, 1024) desplazar la tabla de costado → «Estado» no se va del borde.',
      'Tocar «Apellido» → sortChanged apellido asc.',
    ],
    salidasEsperadas: ['sortChanged'],
    host: ScenarioDataTable,
    fuente: SOURCE,
    nivelDePrueba: 'limite',
  },
  {
    id: `${KEY}#trackby-repetido`,
    clave: KEY,
    variante: 'trackby-repetido',
    titulo: 'Inválido · trackBy que repite identidad',
    seVe: 'NO se monta: el banco rechaza el contrato antes de montar, dice qué viola (dos filas con la identidad «p-01») y deja montado el último escenario válido.',
    interacciones: ['Elegirlo después de «Listado con orden y cursor» → el aviso aparece y la tabla de seis filas sigue ahí.'],
    salidasEsperadas: [],
    host: ScenarioDataTable,
    fuente: SOURCE,
    nivelDePrueba: 'invalido',
  },
];

export const DATA_TABLE_SCENARIOS: readonly ComponentScenario[] = SCENARIOS_BASE.map((escenario) => ({
  nivelDePrueba: 'correcto' as const,
  ...escenario,
  verificarContrato: contractOf(escenario.variante),
}));
