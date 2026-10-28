import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Subscription } from 'rxjs';

import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import { SurveysClient } from '../../../core/data-access/surveys/surveys.client';
import type { SurveyInsights } from '../../../core/data-access/surveys/surveys.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import type { MetricTone } from '../../../shared/components/molecules/metric-card/metric-card.types';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  barrasDeTendencia,
  combinarPorDimension,
  formatearNps,
  formatearPromedio,
  PERIODO_INICIAL,
  PERIODOS,
  preguntasGraficables,
  rangoDe,
  resumirAgregado,
  rotuloDeDimension,
  satisfaccionGlobal,
  segmentosNps,
  semaforoNps,
  tasaDeRespuesta,
  type PeriodoId,
} from './survey-insights.logic';

/** El valor de «sin filtro de servicio» en el selector. */
const TODOS = 'TODOS';

/** Cuántas preguntas se ven antes de pedir «Ver todas». */
const PREGUNTAS_VISIBLES = 6;

/** A dónde lleva el vacío cuando no hay nada que aflojar: la agenda del médico. */
const RUTA_AGENDA = '/schedule';

/** Una cifra de la fila de arriba. */
interface Kpi {
  readonly clave: string;
  readonly label: string;
  readonly valor: string | number | null;
  readonly hint: string;
  readonly tono: MetricTone;
  readonly icono: NavIconName;
}

/** Qué hace el botón del estado vacío. */
type AccionVacia = 'periodo' | 'servicio' | 'agenda';

/**
 * «Cómo le va»: el resumen general de todas las encuestas del profesional,
 * estilo resumen de Google Forms.
 *
 * ## Qué es y qué no es
 *
 * Es un **agregado**: totales, NPS, promedio y distribución por pregunta,
 * tendencia y comentarios sueltos. No hay una fila por paciente ni por reserva,
 * y el contrato de `GET /surveys/insights` tampoco las manda. El detalle de cada
 * respuesta sigue en la ficha de cada encuesta.
 *
 * ## `n` siempre a la vista, y el piso lo pone el servidor
 *
 * Cada cifra dice sobre cuántas respuestas se calculó. Con menos de
 * `privacy.minCohort` (5) respuestas en el alcance filtrado **la API devuelve
 * sólo los totales** (`privacy.suppressed`): con tan pocas personas, un promedio
 * o un comentario señalaría a alguien. La pantalla no calcula ese corte ni lo
 * esquiva: dice por qué no hay resumen, cuántas respuestas lleva y ofrece
 * ampliar el período. No dibuja gráficos vacíos que parezcan un resultado.
 *
 * El mismo criterio llega por pregunta (`suppressed`, sin promedio ni
 * distribución), al NPS (sin valor) y a los comentarios (sólo con 5 o más, y
 * sólo el texto: sin fecha ni mes): cada uno se muestra como «sin datos suficientes», nunca como un
 * hueco ni como un cero.
 *
 * ## Estados M34
 *
 * - **S2** esqueleto con la forma del contenido; los filtros ya están a la vista.
 * - **S3** «todavía no recibió respuestas», con la próxima acción que corresponda
 *   (ampliar el período, quitar el servicio o ir a la agenda).
 * - **S7** si actualizar falla con los mismos filtros, se conserva lo último
 *   visto y se dice de cuándo es.
 * - **S5/S8/S9** los traduce `errorToViewState` y el anfitrión los dibuja con
 *   reintento.
 *
 * ## Gráficos sin librería
 *
 * Barras de CSS con tokens. Cada barra lleva su cifra escrita al lado y la
 * tendencia tiene una tabla equivalente: nada depende sólo del color.
 */
@Component({
  selector: 'app-survey-insights',
  imports: [
    AppButton,
    Card,
    EmptyState,
    MetricCard,
    Select,
    SegmentedControl,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './survey-insights.html',
  styleUrl: './survey-insights.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyInsightsPanel {
  private readonly surveys = inject(SurveysClient);
  private readonly scheduling = inject(SchedulingClient);
  private readonly router = inject(Router);

  protected readonly periodo = signal<PeriodoId>(PERIODO_INICIAL);
  /** `TODOS` o un `billing.service_catalog.id`. */
  protected readonly servicio = signal<string>(TODOS);

  private readonly estado = signal<ViewState<SurveyInsights>>(loading());
  protected readonly vista = this.estado.asReadonly();

  /** Lo último que se leyó bien, con su filtro: es lo que S7 conserva. */
  private ultimo: { readonly clave: string; readonly datos: SurveyInsights; readonly en: Date } | null = null;
  private pedido: Subscription | null = null;

  protected readonly periodos: readonly SegmentedOption<PeriodoId>[] = PERIODOS.map((p) => ({
    value: p.value,
    label: p.label,
    description: p.descripcion,
  }));

  /** Los servicios que el médico ofrece, sin repetir el del catálogo. */
  private readonly servicios = signal<readonly { readonly id: string; readonly nombre: string; readonly activo: boolean }[]>([]);

  protected readonly opcionesServicio = computed<readonly SelectOption<string>[]>(() => [
    { value: TODOS, label: 'Todas mis consultas', description: 'Sin filtrar por servicio' },
    ...this.servicios().map((s) => ({
      value: s.id,
      label: s.nombre,
      ...(s.activo ? {} : { description: 'Desactivado' }),
    })),
  ]);

  protected readonly datos = computed(() => {
    const actual = this.estado();
    return actual.status === 'ready' || actual.status === 'stale' ? actual.data : null;
  });

  /* -- lo que se dibuja, derivado de los datos ------------------------------ */

  protected readonly respondidas = computed(() => this.datos()?.totals.answered ?? 0);
  protected readonly enviadas = computed(() => this.datos()?.totals.issued ?? 0);
  protected readonly tasa = computed(() => {
    const d = this.datos();
    return d ? tasaDeRespuesta(d.totals) : null;
  });
  protected readonly nps = computed(() => this.datos()?.nps ?? null);
  protected readonly semaforo = computed(() => semaforoNps(this.nps()?.value ?? null));
  protected readonly npsTexto = computed(() => formatearNps(this.nps()?.value ?? null));
  protected readonly segmentos = computed(() => {
    const n = this.nps();
    return n ? segmentosNps(n) : [];
  });
  protected readonly npsDescripcion = computed(() =>
    this.segmentos()
      .map((s) => `${s.etiqueta} ${s.cantidad}`)
      .join(', '),
  );
  protected readonly satisfaccion = computed(() => {
    const d = this.datos();
    return d ? satisfaccionGlobal(d.byQuestion) : null;
  });
  protected readonly satisfaccionTexto = computed(() => {
    const s = this.satisfaccion();
    return s ? `${formatearPromedio(s.promedio)} / 5` : null;
  });

  /** Las cinco cifras de arriba, ya con el `n` en la pista de cada una. */
  protected readonly kpis = computed<readonly Kpi[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const tasa = this.tasa();
    const sat = this.satisfaccion();
    const semaforo = this.semaforo();
    const totales: readonly Kpi[] = [
      {
        clave: 'respuestas',
        label: 'Respuestas',
        valor: d.totals.answered,
        hint: `de ${d.totals.issued} ${d.totals.issued === 1 ? 'enviada' : 'enviadas'}`,
        tono: 'primary',
        icono: 'survey',
      },
      {
        clave: 'tasa',
        label: 'Tasa de respuesta',
        valor: tasa === null ? null : `${tasa}%`,
        hint: tasa === null ? 'Todavía no se envió ninguna' : `${d.totals.answered} de ${d.totals.issued}`,
        tono: 'info',
        icono: 'chart',
      },
    ];
    // Suprimido: los totales son lo único que el servidor mandó.
    if (d.privacy.suppressed) return totales;
    return [
      ...totales,
      {
        clave: 'nps',
        label: 'NPS',
        valor: d.nps.value === null ? null : this.npsTexto(),
        hint: d.nps.value === null ? 'Sin datos suficientes' : `${semaforo.palabra} · n\u00A0=\u00A0${d.nps.n}`,
        tono: semaforo.tono,
        icono: 'heart',
      },
      {
        clave: 'satisfaccion',
        label: 'Satisfacción global',
        valor: sat ? this.satisfaccionTexto() : null,
        hint: sat ? `Promedio de 1 a 5 · n\u00A0=\u00A0${sat.n}` : 'Sin datos suficientes',
        tono: 'primary',
        icono: 'star',
      },
      {
        clave: 'alertas',
        label: 'Alertas de seguridad',
        valor: d.safetyAlerts.n,
        hint:
          d.safetyAlerts.n === 0
            ? `Nadie reportó problemas · n\u00A0=\u00A0${d.totals.answered}`
            : `${d.safetyAlerts.n === 1 ? 'respuesta pide' : 'respuestas piden'} seguimiento · n\u00A0=\u00A0${d.totals.answered}`,
        tono: d.safetyAlerts.n > 0 ? 'error' : 'success',
        icono: 'shield',
      },
    ];
  });

  /** El NPS llegó sin valor: no hay suficientes respuestas a esa pregunta. */
  protected readonly npsSinDatos = computed(() => this.nps()?.value === null);

  /** El servidor suprimió el resumen: hay respuestas, pero no las suficientes para mostrarlo. */
  protected readonly suprimido = computed(() => this.datos()?.privacy.suppressed === true);

  /** El mensaje del estado suprimido, con el mínimo que declara el servidor y cuántas lleva. */
  protected readonly mensajeSuprimido = computed(() => {
    const d = this.datos();
    if (!d) return '';
    const minimo = d.privacy.minCohort;
    return `Todavía no hay suficientes respuestas para mostrar el resumen: se necesitan al menos ${minimo} en este período para proteger la privacidad de sus pacientes; llevan ${d.totals.answered}.`;
  });

  /** Cuántas se enviaron en un período sin respuestas (el S3 no transporta datos). */
  private readonly enviadasEnElVacio = signal(0);

  protected readonly promedioTexto = formatearPromedio;
  protected readonly preguntasVisibles = PREGUNTAS_VISIBLES;

  protected readonly verTodas = signal(false);

  private readonly graficables = computed(() => {
    const d = this.datos();
    return d ? preguntasGraficables(d.byQuestion) : [];
  });

  private readonly combinadas = computed(() => combinarPorDimension(this.graficables()));

  protected readonly totalPreguntas = computed(() => this.combinadas().length);

  protected readonly preguntas = computed(() => {
    const todas = this.combinadas();
    const visibles = this.verTodas() ? todas : todas.slice(0, PREGUNTAS_VISIBLES);
    return visibles.map(({ pregunta, combinada }) => ({
      pregunta,
      combinada,
      rotulo: rotuloDeDimension(pregunta.dimension),
      // Una pregunta suprimida no trae nada que resumir.
      resumen: pregunta.suppressed ? null : resumirAgregado(pregunta),
    }));
  });

  protected readonly tendencia = computed(() => {
    const d = this.datos();
    return d ? barrasDeTendencia(d.trend) : [];
  });

  protected readonly comentarios = computed(() => {
    const d = this.datos();
    // Sólo el texto, en el orden en que llega (mezclado): ninguna fecha, ningún orden implícito.
    return (d?.comments ?? []).map((c) => ({ texto: c.text }));
  });

  /** El texto del S3, desenvuelto del estado (el vacío se proyecta sin bloque de control). */
  protected readonly mensajeVacio = computed(() => {
    const actual = this.estado();
    return actual.status === 'empty' ? (actual.message ?? '') : '';
  });

  /** El motivo del vacío y la acción que lo resuelve. */
  protected readonly vacio = computed<{ mensaje: string; etiqueta: string; accion: AccionVacia }>(() => {
    const enviadas = this.enviadasEnElVacio();
    const mensaje =
      enviadas > 0
        ? `Se enviaron ${enviadas} ${enviadas === 1 ? 'encuesta' : 'encuestas'} en este período y todavía nadie respondió. Las encuestas se envían solas al terminar cada consulta.`
        : 'Las encuestas se envían solas al terminar cada consulta: apenas sus pacientes respondan, verá acá cómo le va.';
    if (this.periodo() !== '12m') {
      return { mensaje, etiqueta: 'Ver los últimos 12 meses', accion: 'periodo' };
    }
    if (this.servicio() !== TODOS) {
      return { mensaje, etiqueta: 'Ver todas mis consultas', accion: 'servicio' };
    }
    return { mensaje, etiqueta: 'Ir a mi agenda', accion: 'agenda' };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pedido?.unsubscribe());
    this.cargarServicios();
    this.cargar();
  }

  protected elegirPeriodo(periodo: PeriodoId): void {
    if (periodo === this.periodo()) return;
    this.periodo.set(periodo);
    this.cargar();
  }

  protected elegirServicio(valor: string | null): void {
    const nuevo = valor ?? TODOS;
    if (nuevo === this.servicio()) return;
    this.servicio.set(nuevo);
    this.cargar();
  }

  protected alternarPreguntas(): void {
    this.verTodas.update((v) => !v);
  }

  protected ejecutarAccionVacia(): void {
    switch (this.vacio().accion) {
      case 'periodo':
        this.elegirPeriodo('12m');
        break;
      case 'servicio':
        this.elegirServicio(TODOS);
        break;
      case 'agenda':
        void this.router.navigateByUrl(RUTA_AGENDA);
        break;
    }
  }

  /** Pide el resumen con los filtros puestos; una respuesta tardía de otro filtro se descarta. */
  protected cargar(): void {
    const rango = rangoDe(this.periodo());
    const serviceId = this.servicio() === TODOS ? undefined : this.servicio();
    const clave = `${rango.from}|${rango.to}|${serviceId ?? ''}`;

    this.pedido?.unsubscribe();
    // Sólo se conserva lo último visto si es del MISMO filtro: mostrar el
    // período anterior como «atrasado» bajo otro período sería mentir.
    if (this.ultimo?.clave !== clave) this.estado.set(loading());

    this.pedido = this.surveys
      .getInsights(serviceId === undefined ? rango : { ...rango, serviceId })
      .subscribe({
        next: (datos) => {
          this.ultimo = { clave, datos, en: new Date() };
          // Sin ninguna respuesta es un vacío (S3), con o sin supresión. Con
          // alguna pero menos de las necesarias NO es un vacío: hay totales que
          // mostrar y un motivo que explicar (`privacy.suppressed`).
          if (datos.totals.answered === 0) {
            // En S3 no hay `datos()`: los envíos se guardan aparte para que el
            // mensaje diga si se mandó algo que nadie respondió todavía.
            this.enviadasEnElVacio.set(datos.totals.issued);
            this.estado.set(empty({ label: this.vacio().etiqueta }, this.vacio().mensaje));
            return;
          }
          this.estado.set(ready(datos));
        },
        error: (error: unknown) => {
          this.estado.set(
            this.ultimo?.clave === clave && this.ultimo.datos.totals.answered > 0
              ? stale(this.ultimo.datos, this.ultimo.en)
              : errorToViewState(error),
          );
        },
      });
  }

  private cargarServicios(): void {
    this.scheduling.listServiceOfferings().subscribe({
      next: (ofertas) => {
        const vistos = new Map<string, { id: string; nombre: string; activo: boolean }>();
        for (const oferta of ofertas) {
          // El destino de la encuesta es el servicio del catálogo, no la oferta
          // (ver `surveys-targets.ts`): dos ofertas del mismo servicio son una.
          if (!vistos.has(oferta.serviceCatalogId)) {
            vistos.set(oferta.serviceCatalogId, {
              id: oferta.serviceCatalogId,
              nombre: oferta.serviceName,
              activo: oferta.isActive,
            });
          }
        }
        this.servicios.set([...vistos.values()]);
      },
      // Sin la lista, el filtro sigue sirviendo con «Todas»: no es un error de
      // la pantalla, es una opción que no se pudo ofrecer.
      error: () => this.servicios.set([]),
    });
  }
}
