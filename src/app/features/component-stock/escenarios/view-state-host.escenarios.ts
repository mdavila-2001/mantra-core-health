import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

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
import type { ViewState, ViewStateStatus } from '../../../core/view-state/view-state.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import type { AnfitrionDeEscenario, EscenarioDeComponente } from './escenario.types';
import { registroDeSalidas } from './registro-de-salidas';

/* ============================================================================
    Escenarios de `ViewStateHost`.

    Es el organismo del que dependen la tabla, el directorio y 68 pantallas:
    los nueve estados del M34 dibujados una sola vez. El generador le daba
    `state = ''` y el `@switch` caía en la rama por defecto, así que la ficha
    mostraba «ready» siempre y ninguno de los otros nueve. Acá se le da cada
    variante con su payload obligatorio: `nextAction` en S3, `asOf` en S7,
    `requestId` en S9.
    ========================================================================== */

const CLAVE = 'shared/components/organisms/view-state-host/view-state-host';
const FUENTE = 'src/app/features/component-stock/escenarios/view-state-host.escenarios.ts';

interface ResumenDeMuestra {
  readonly titulo: string;
  readonly detalle: string;
}

const RESUMEN: ResumenDeMuestra = {
  titulo: 'Ocupación de camas',
  detalle: '18 de 24 camas ocupadas · 3 altas previstas para hoy',
};

const DATO_DE = new Date('2026-09-21T09:30:00-04:00');

const ESTADOS: Readonly<Record<ViewStateStatus, ViewState<ResumenDeMuestra>>> = {
  'route-auth-pending': routeAuthPending(),
  loading: loading(),
  empty: empty(
    { label: 'Registrar la primera internación', route: '/clinical-record' },
    'Todavía no hay internaciones en este servicio.',
  ),
  ready: ready(RESUMEN),
  validation: validation(
    [
      { field: 'fecha', message: 'La fecha de alta no puede ser anterior al ingreso.' },
      { message: 'Otra persona modificó este registro: volvé a cargarlo.', code: 'CONFLICT' },
    ],
    30,
  ),
  forbidden: forbidden({
    message: 'Tu propósito de uso declarado no alcanza para ver este resumen.',
    nextAction: { label: 'Declarar propósito de uso', route: '/clinical-record/request-access' },
  }),
  'not-found': notFound({ label: 'Volver al panel', route: '/dashboard' }),
  stale: stale(RESUMEN, DATO_DE),
  offline: offline(DATO_DE),
  error: unexpectedError('req-2b91d4f0', 'No pudimos leer el resumen del servicio.'),
};

export const VARIANTES_DE_VIEW_STATE_HOST = Object.keys(ESTADOS) as readonly ViewStateStatus[];

@Component({
  selector: 'app-escenario-view-state-host',
  imports: [ViewStateHost],
  template: `
    <app-view-state-host
      [state]="estado()"
      (retry)="registro.anotar('retry')"
      (refresh)="registro.anotar('refresh')"
    >
      <article class="escenario__contenido" data-testid="escenario-contenido">
        <h2 class="escenario__titulo">{{ resumen.titulo }}</h2>
        <p class="escenario__detalle">{{ resumen.detalle }}</p>
      </article>
    </app-view-state-host>
  `,
  styles: `
    .escenario__contenido {
      padding: var(--sp-4);
      border: 1px dashed var(--border-default, #ccc);
      border-radius: var(--r-md, 8px);
    }
    .escenario__titulo {
      margin: 0 0 var(--sp-1);
      font-size: var(--fs-h4, 1.1rem);
    }
    .escenario__detalle {
      margin: 0;
      color: var(--text-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EscenarioViewStateHost implements AnfitrionDeEscenario {
  readonly variante = input<ViewStateStatus>('ready');

  protected readonly registro = registroDeSalidas();
  readonly salidas = this.registro.salidas;

  protected readonly resumen = RESUMEN;
  protected readonly estado = computed(() => ESTADOS[this.variante()]);
}

const FICHAS: Readonly<
  Record<ViewStateStatus, { titulo: string; seVe: string; salidas: readonly string[] }>
> = {
  'route-auth-pending': {
    titulo: 'S1 · autorización pendiente',
    seVe: 'Spinner y «Verificando permisos…». Nunca un esqueleto con la forma del contenido.',
    salidas: [],
  },
  loading: {
    titulo: 'S2 · cargando',
    seVe: 'El esqueleto de tres líneas por omisión.',
    salidas: [],
  },
  empty: {
    titulo: 'S3 · vacío con próxima acción',
    seVe: '«Todavía no hay nada acá», el motivo y el enlace «Registrar la primera internación».',
    salidas: [],
  },
  ready: {
    titulo: 'Camino feliz',
    seVe: 'Solo el contenido proyectado: el resumen de camas.',
    salidas: [],
  },
  validation: {
    titulo: 'S4 · validación y conflicto',
    seVe: 'La alerta con dos problemas —uno anclado a «fecha»— y «Reintentá en 30 segundos». El foco cae en la alerta.',
    salidas: [],
  },
  forbidden: {
    titulo: 'S5 · prohibido, con puerta',
    seVe: 'La alerta de acceso y el enlace «Declarar propósito de uso».',
    salidas: [],
  },
  'not-found': {
    titulo: 'S6 · no encontrado',
    seVe: 'Copy fijo que no confirma existencia, y «Volver al panel».',
    salidas: [],
  },
  stale: {
    titulo: 'S7 · datos atrasados',
    seVe: 'El aviso «Información al 21/09/2026 09:30» SIEMPRE visible, «Actualizar», y debajo el contenido.',
    salidas: ['refresh'],
  },
  offline: {
    titulo: 'S8 · sin conexión',
    seVe: '«Sin conexión» y «Reintentar».',
    salidas: ['retry'],
  },
  error: {
    titulo: 'S9 · error con código',
    seVe: '«Algo salió mal», el código «req-2b91d4f0» copiable, «Copiar código» y «Reintentar».',
    salidas: ['retry'],
  },
};

export const ESCENARIOS_DE_VIEW_STATE_HOST: readonly EscenarioDeComponente[] =
  VARIANTES_DE_VIEW_STATE_HOST.map((variante) => ({
    id: `${CLAVE}#${variante}`,
    clave: CLAVE,
    variante,
    titulo: FICHAS[variante].titulo,
    seVe: FICHAS[variante].seVe,
    interacciones:
      FICHAS[variante].salidas.length === 0
        ? ['Nada que tocar: el estado no ofrece acciones propias.']
        : [`Tocar la acción del estado → ${FICHAS[variante].salidas[0]}.`],
    salidasEsperadas: FICHAS[variante].salidas,
    host: EscenarioViewStateHost,
    fuente: FUENTE,
  }));
