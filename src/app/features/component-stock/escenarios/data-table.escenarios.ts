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

/**
 * Valores límite: los bordes que una tabla real encuentra y que el camino feliz
 * de seis filas no ejercita. Todas sintéticas.
 */
const FILA_UNICA: readonly PacienteDeMuestra[] = [PRIMERA_PAGINA.filas[0]!];

const TEXTO_LARGO: readonly PacienteDeMuestra[] = [
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
const IDENTIDAD_REPETIDA: readonly PacienteDeMuestra[] = [
  PRIMERA_PAGINA.filas[0]!,
  { ...PRIMERA_PAGINA.filas[1]!, id: PRIMERA_PAGINA.filas[0]!.id },
  PRIMERA_PAGINA.filas[2]!,
];

/** Las variantes del escenario: las diez del `ViewState`, tres del contrato y los bordes. */
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
  'cero-filas',
  'una-fila',
  'texto-largo',
  'trackby-repetido',
] as const;
export type VarianteDeDataTable = (typeof VARIANTES_DE_DATA_TABLE)[number];

/** Las variantes de una sola página: sin cursor hacia adelante. */
const PAGINA_UNICA: ReadonlySet<VarianteDeDataTable> = new Set([
  'cero-filas',
  'una-fila',
  'texto-largo',
  'trackby-repetido',
]);

/** Las filas con las que arranca cada variante. */
export function filasDe(variante: VarianteDeDataTable): readonly PacienteDeMuestra[] {
  switch (variante) {
    case 'cero-filas':
      return [];
    case 'una-fila':
      return FILA_UNICA;
    case 'texto-largo':
      return TEXTO_LARGO;
    case 'trackby-repetido':
      return IDENTIDAD_REPETIDA;
    default:
      return PRIMERA_PAGINA.filas;
  }
}

/** La identidad de una fila: lo que el anfitrión le pasa a `trackBy`. */
export const identidadDePaciente = (fila: PacienteDeMuestra): string => fila.id;

/**
 * Las columnas del escenario sin sus plantillas de celda: la parte del
 * contrato que se puede comprobar antes de montar.
 */
export const COLUMNAS_DE_MUESTRA: readonly Omit<ColumnDef<PacienteDeMuestra>, 'cell'>[] = [
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
export function violacionesDelContratoDeTabla<Row>(
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
      [cursor]="cursor()"
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

  /** Las columnas del contrato, con sus plantillas de celda donde las hay. */
  protected readonly columnas = computed<readonly ColumnDef<PacienteDeMuestra>[]>(() => {
    const celdas: Partial<Record<string, TemplateRef<{ $implicit: PacienteDeMuestra }>>> = {
      nacimiento: this.celdaNacimiento(),
      fallecido: this.celdaEstado(),
    };
    return COLUMNAS_DE_MUESTRA.map((columna) => {
      const cell = celdas[columna.key];
      return cell === undefined ? columna : { ...columna, cell };
    });
  });

  protected readonly porId = identidadDePaciente;
  protected readonly nombreCompleto = (fila: PacienteDeMuestra): string =>
    `${fila.nombre} ${fila.apellido}`;

  protected readonly seleccionable = computed(() => this.variante() === 'ready-seleccionable');
  protected readonly navegable = computed(() => this.variante() === 'ready-navegable');

  protected readonly orden = signal<SortState | null>(null);
  /** Las filas visibles: arrancan con las de la variante y el cursor las cambia. */
  private readonly filas = linkedSignal(() => filasDe(this.variante()));

  /** Los bordes son de una sola página: sin «Siguiente» que prometa más filas. */
  protected readonly cursor = computed(() =>
    PAGINA_UNICA.has(this.variante()) ? {} : this.paginado.cursor(),
  );

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

/** El contrato de la tabla con los datos de una variante, antes de montar. */
const contratoDe = (variante: VarianteDeDataTable) => (): readonly string[] =>
  violacionesDelContratoDeTabla(filasDe(variante), identidadDePaciente, COLUMNAS_DE_MUESTRA);

/**
 * Un escenario de la tabla antes de sumarle su verificación de contrato. La
 * variante va tipada con las de este anfitrión: una mal escrita no compila.
 */
type EscenarioDeTabla = Omit<EscenarioDeComponente, 'verificarContrato' | 'variante'> & {
  readonly variante: VarianteDeDataTable;
};

const ESCENARIOS_BASE: readonly EscenarioDeTabla[] = [
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
  {
    id: `${CLAVE}#cero-filas`,
    clave: CLAVE,
    variante: 'cero-filas',
    titulo: 'Límite · listo con 0 filas',
    seVe: 'Un `ready([])`: no es el estado S3 «vacío» con próxima acción, es la tabla lista sin filas. Se ve lo que la tabla hace con eso, sin paginación.',
    interacciones: ['Tocar «Apellido» → sortChanged apellido asc aunque no haya filas.'],
    salidasEsperadas: ['sortChanged'],
    host: EscenarioDataTable,
    fuente: FUENTE,
    nivelDePrueba: 'limite',
  },
  {
    id: `${CLAVE}#una-fila`,
    clave: CLAVE,
    variante: 'una-fila',
    titulo: 'Límite · una sola fila',
    seVe: 'Una fila (Peña, Ana) con las cinco columnas y sin paginación: «Anterior» y «Siguiente» no se dibujan.',
    interacciones: ['Tocar «Apellido» dos veces → sortChanged apellido asc y luego desc; la fila no cambia.'],
    salidasEsperadas: ['sortChanged'],
    host: EscenarioDataTable,
    fuente: FUENTE,
    nivelDePrueba: 'limite',
  },
  {
    id: `${CLAVE}#texto-largo`,
    clave: CLAVE,
    variante: 'texto-largo',
    titulo: 'Límite · texto largo y columna fija',
    seVe: 'Un apellido de 50 caracteres (se envuelve) y una huella de documento de 71 sin espacios (no se envuelve) junto a otros de un carácter. En Tableta girada (1024) la tabla desborda y «Estado» (sticky: end) queda fija al borde derecho. Por debajo de 780 px las columnas de prioridad 2 se pliegan al detalle ▼.',
    interacciones: [
      'En Tableta girada (⟳, 1024) desplazar la tabla de costado → «Estado» no se va del borde.',
      'Tocar «Apellido» → sortChanged apellido asc.',
    ],
    salidasEsperadas: ['sortChanged'],
    host: EscenarioDataTable,
    fuente: FUENTE,
    nivelDePrueba: 'limite',
  },
  {
    id: `${CLAVE}#trackby-repetido`,
    clave: CLAVE,
    variante: 'trackby-repetido',
    titulo: 'Inválido · trackBy que repite identidad',
    seVe: 'NO se monta: el banco rechaza el contrato antes de montar, dice qué viola (dos filas con la identidad «p-01») y deja montado el último escenario válido.',
    interacciones: ['Elegirlo después de «Listado con orden y cursor» → el aviso aparece y la tabla de seis filas sigue ahí.'],
    salidasEsperadas: [],
    host: EscenarioDataTable,
    fuente: FUENTE,
    nivelDePrueba: 'invalido',
  },
];

export const ESCENARIOS_DE_DATA_TABLE: readonly EscenarioDeComponente[] = ESCENARIOS_BASE.map((escenario) => ({
  nivelDePrueba: 'correcto' as const,
  ...escenario,
  verificarContrato: contratoDe(escenario.variante),
}));
