import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { ObservabilityClient } from '@core/data-access/observability/observability.client';
import type { ErrorGroupDetail, ErrorGroupState } from '@core/data-access/observability/observability.types';
import { NO_DATA } from '@core/data-access/reporting/reporting-format';
import { SessionStore } from '@core/auth/session.store';
import { rolesAlcanzan } from '@core/navigation/navigation.types';
import { dataOf } from '@core/view-state/view-state';
import { AppButton } from '@shared/components/atoms/button/button';
import { Select } from '@shared/components/atoms/select/select';
import type { SelectOption } from '@shared/components/atoms/select/select.types';
import { Textarea } from '@shared/components/atoms/textarea/textarea';
import { Alert } from '@shared/components/molecules/alert/alert';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { ChartPanel } from '@shared/components/organisms/chart-panel';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { readApiError } from '@core/http/api-error';
import { ObservabilityContextStore } from '../state/observability-context.store';
import { WidgetState } from '../state/widget-state';
import { ROLES_CAMBIO_ESTADO } from './sistema-access';
import { ESTADO_GRUPO, estadosElegibles, motivoValido, pideMotivo, textoAfectados } from './error-rows';
import { fechaHoraCompleta, textoDuracion, textoEntero } from './obs-format';
import { specErroresPorModulo, specErroresSerie } from './obs-mappers';

/**
 * Detalle de un grupo de errores: qué es, cuántas veces, en qué módulos, los últimos eventos con su
 * `requestId`, y el cambio de estado con motivo. El cambio se demuestra por la lectura que sigue a la
 * escritura (UI → PATCH → respuesta → recarga → UI), no por un aviso.
 */
@Component({
  selector: 'app-obs-error-detalle',
  imports: [ViewStateHost, ChartPanel, Select, Textarea, FormField, AppButton, Alert],
  templateUrl: './error-detalle.html',
  styleUrls: ['./tab-layout.css', './error-detalle.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObsErrorDetalle {
  private readonly api = inject(ObservabilityClient);
  private readonly sesion = inject(SessionStore);
  protected readonly store = inject(ObservabilityContextStore);

  readonly id = input.required<string>();
  readonly cerrar = output<void>();
  /** El estado cambió: la lista de grupos debe volver a leerse. */
  readonly cambio = output<void>();

  protected readonly detalle = new WidgetState<ErrorGroupDetail>();
  protected readonly estadoDe = ESTADO_GRUPO;
  protected readonly sinDato = NO_DATA;

  protected readonly puedeCambiar = computed(() => rolesAlcanzan(ROLES_CAMBIO_ESTADO, this.sesion.roles()));
  protected readonly datos = computed(() => dataOf(this.detalle.state()));
  protected readonly specSerie = computed(() => {
    const d = this.datos();
    return d === null ? null : specErroresSerie(d, this.store.zona());
  });
  protected readonly specModulos = computed(() => {
    const d = this.datos();
    return d === null ? null : specErroresPorModulo(d);
  });

  /* ---- formulario de cambio de estado ---- */
  protected readonly destino = signal<ErrorGroupState | null>(null);
  protected readonly nota = signal('');
  protected readonly enviando = signal(false);
  protected readonly resultado = signal<{ tono: 'success' | 'error' | 'warning'; texto: string; conflicto?: boolean } | null>(null);

  protected readonly opciones = computed<readonly SelectOption<ErrorGroupState>[]>(() => {
    const d = this.datos();
    return d === null ? [] : estadosElegibles(d.state).map((e) => ({ value: e, label: ESTADO_GRUPO[e].texto }));
  });
  protected readonly pideNota = computed(() => {
    const d = this.destino();
    return d !== null && pideMotivo(d);
  });
  protected readonly puedeEnviar = computed(() => {
    const d = this.destino();
    return d !== null && !this.enviando() && motivoValido(d, this.nota());
  });

  protected readonly fecha = (iso: string | null): string => fechaHoraCompleta(iso, this.store.zona());
  protected readonly duracion = textoDuracion;
  protected readonly entero = textoEntero;
  protected readonly afectados = textoAfectados;

  constructor() {
    effect(() => {
      const id = this.id();
      this.store.version();
      untracked(() => {
        this.resultado.set(null);
        this.destino.set(null);
        this.nota.set('');
        this.cargar(id);
      });
    });
  }

  protected cargar(id: string = this.id()): void {
    const { from, to, tz } = this.store.consulta();
    this.detalle.cargar(this.api.errorGroup(id, { ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }), ...(tz === undefined ? {} : { tz }), interval: 'hour' }));
  }

  protected copiar(texto: string): void {
    void navigator.clipboard?.writeText(texto);
  }

  protected guardar(): void {
    const d = this.datos();
    const destino = this.destino();
    if (d === null || destino === null || !this.puedeEnviar()) return;
    this.enviando.set(true);
    this.resultado.set(null);
    const nota = this.nota().trim();
    this.api.changeErrorGroupState(d.id, { state: destino, expectedVersion: d.rowVersion, ...(nota === '' ? {} : { note: nota }) }).subscribe({
      next: (g) => {
        this.enviando.set(false);
        this.resultado.set({ tono: 'success', texto: `El estado quedó en «${ESTADO_GRUPO[g.state].texto}». Se volvió a leer el grupo para confirmarlo.` });
        this.destino.set(null);
        this.nota.set('');
        this.cargar();
        this.cambio.emit();
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.resultado.set(this.traducir(e));
      },
    });
  }

  /** 409 = alguien cambió el grupo antes (recargar); 403/400 = esta cuenta no puede mutar; 422 = lo que la API pida corregir. */
  private traducir(e: unknown): { tono: 'error' | 'warning'; texto: string; conflicto?: boolean } {
    if (!(e instanceof HttpErrorResponse)) return { tono: 'error', texto: 'No se pudo guardar el cambio. Intente de nuevo.' };
    const cuerpo = readApiError(e);
    const id = cuerpo?.correlationId ?? e.headers?.get('x-request-id') ?? null;
    const codigo = id === null ? '' : ` Código de soporte: ${id}.`;
    if (e.status === 409) return { tono: 'warning', conflicto: true, texto: `El grupo cambió desde que lo abrió. Recargue y vuelva a intentar.${codigo}` };
    if (e.status === 403) return { tono: 'error', texto: `Su cuenta no puede cambiar el estado de un grupo (la API lo negó).${codigo}` };
    if (e.status === 422 || e.status === 400) return { tono: 'error', texto: `${cuerpo?.message ?? 'La API rechazó el cambio.'}${codigo}` };
    return { tono: 'error', texto: `No se pudo guardar el cambio.${codigo}` };
  }
}
