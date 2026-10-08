import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CenterScheduleClient } from '../../../../core/data-access/diagnostic-units/center-schedule.client';
import type {
  OrderAppointment,
  OrderBookingOption,
  OrderBookingOptions,
  StudyStart,
} from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Stepper } from '../../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../../shared/components/molecules/stepper/stepper.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/* ============================================================================
    Reservar el estudio de una orden médica.

    La orden ya dice qué estudio es, así que el paciente no escribe nada: elige
    el centro, elige el horario y confirma. Tres pasos y un botón. El turno
    queda confirmado en el acto (no hay un profesional que lo tenga que
    aceptar: lo que limita es el cupo del centro, que el simulador ya contó).

    Los horarios son los de ESE estudio en ESE centro: el horario propio del
    estudio si lo tiene, si no el de su modalidad, si no el general del
    centro; y el cupo de cada franja son los equipos operativos de la
    modalidad. Esa cuenta la hace el servidor (`center-schedule.rules.ts`).
    ========================================================================== */

export const MIS_ORDENES_ROUTE = '/my-account/diagnostic-orders';

type Paso = 'centro' | 'horario' | 'confirmar' | 'listo';
type Orden = 'pronto' | 'precio' | 'cerca';

/** Los horarios de un día, ya en palabras. */
interface DiaConHorarios {
  readonly clave: string;
  readonly titulo: string;
  readonly horarios: readonly StudyStart[];
}

const DIAS_A_MOSTRAR = 14;
/** Días con horarios que se ven de entrada; el resto, con «Ver más días». */
const DIAS_VISIBLES = 5;

interface Aviso {
  readonly tipo: 'ocupado' | 'ya-tiene-turno' | 'error';
  readonly titulo: string;
  readonly texto: string;
}

@Component({
  selector: 'app-order-booking',
  imports: [RouterLink, PageHeader, ViewStateHost, Card, Stepper, SegmentedControl, AppButton, AppButtonLink, Alert],
  templateUrl: './order-booking.html',
  styleUrl: './order-booking.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderBooking implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly centros = inject(CenterScheduleClient);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly rutaDeOrdenes = MIS_ORDENES_ROUTE;
  private readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';

  protected readonly estado = signal<ViewState<OrderBookingOptions>>(loading());
  protected readonly paso = signal<Paso>('centro');
  protected readonly orden = signal<Orden>('pronto');
  protected readonly centro = signal<OrderBookingOption | null>(null);
  protected readonly horarios = signal<ViewState<readonly DiaConHorarios[]>>(loading());
  protected readonly horario = signal<StudyStart | null>(null);
  protected readonly diasVisibles = signal(DIAS_VISIBLES);
  protected readonly confirmando = signal(false);
  /** Un aviso que no saca al paciente del paso: el horario se ocupó, la orden ya tiene turno. */
  protected readonly aviso = signal<Aviso | null>(null);
  /**
   * La orden ya tenía turno (409 sin `slotTaken`): confirmar de nuevo choca
   * con lo mismo, así que el paso deja de ofrecerlo y lleva a «Mis órdenes».
   */
  protected readonly yaTieneTurno = computed(() => this.aviso()?.tipo === 'ya-tiene-turno');
  protected readonly turno = signal<OrderAppointment | null>(null);

  /**
   * Al cambiar de paso, el foco va al título del paso nuevo: sin esto, quien
   * usa lector de pantalla no se entera de que la pantalla cambió (ni de que
   * volvió a «Horario» porque el turno se ocupó). El primer paso no lo mueve.
   */
  private readonly enfocarPaso = effect(() => {
    const paso = this.paso();
    if (this.primerPaso) {
      this.primerPaso = false;
      return;
    }
    const id = { centro: 'reserva-centros', horario: 'reserva-horarios', confirmar: 'reserva-confirmar', listo: 'reserva-listo' }[paso];
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus(), { injector: this.injector });
  });
  private primerPaso = true;

  protected readonly opciones = computed<OrderBookingOptions | null>(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });

  protected readonly dias = computed<readonly DiaConHorarios[] | null>(() => {
    const e = this.horarios();
    return e.status === 'ready' ? e.data : null;
  });

  protected readonly ordenes: readonly SegmentedOption<Orden>[] = [
    // Rótulos cortos para que entren a 390 px sin cortarse; el nombre accesible
    // lleva la frase entera.
    { value: 'pronto', label: 'Pronto', description: 'Primero el turno más pronto' },
    { value: 'precio', label: 'Barato', description: 'Primero el más barato' },
    { value: 'cerca', label: 'Cerca', description: 'Primero el más cerca de su casa' },
  ];

  protected readonly centrosOrdenados = computed<readonly OrderBookingOption[]>(() => {
    const lista = [...(this.opciones()?.options ?? [])];
    const ultimo = Number.POSITIVE_INFINITY;
    switch (this.orden()) {
      case 'precio':
        return lista.sort((a, b) => (a.price ?? ultimo) - (b.price ?? ultimo));
      case 'cerca':
        return lista.sort((a, b) => (a.distanceKm ?? ultimo) - (b.distanceKm ?? ultimo));
      default:
        return lista.sort((a, b) => (a.nextStartAt ?? '9999').localeCompare(b.nextStartAt ?? '9999'));
    }
  });

  protected readonly pasos = computed<readonly StepperStep[]>(() => {
    const indice = { centro: 0, horario: 1, confirmar: 2, listo: 3 }[this.paso()];
    return ['Centro', 'Horario', 'Confirmar'].map((label, i) => ({
      label,
      status: i < indice ? 'complete' : i === indice ? 'current' : 'upcoming',
    }));
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.centros.getBookingOptions(this.orderId).subscribe({
      next: (opciones) =>
        this.estado.set(
          opciones.options.length === 0
            ? empty(
                { label: 'Volver a mis órdenes', route: MIS_ORDENES_ROUTE },
                `Todavía ningún centro de la red publica horarios para ${opciones.studyName}.`,
              )
            : ready(opciones),
        ),
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  protected elegirCentro(opcion: OrderBookingOption): void {
    this.centro.set(opcion);
    this.horario.set(null);
    this.aviso.set(null);
    this.paso.set('horario');
    this.cargarHorarios();
  }

  protected cargarHorarios(): void {
    const centro = this.centro();
    const opciones = this.opciones();
    if (centro === null || opciones === null) return;
    this.horarios.set(loading());
    this.diasVisibles.set(DIAS_VISIBLES);
    const desde = new Date();
    const hasta = new Date(desde.getTime() + DIAS_A_MOSTRAR * 86_400_000);
    this.centros.getStudyAvailability(centro.unitId, opciones.studyCode, desde, hasta).subscribe({
      next: ({ items }) =>
        this.horarios.set(
          items.length === 0
            ? empty(
                { label: 'Elija otro centro con «Cambiar de centro»' },
                `${centro.unitName} no tiene horarios libres para ${opciones.studyName} en las próximas dos semanas.`,
              )
            : ready(agruparPorDia(items)),
        ),
      error: (error: unknown) => this.horarios.set(errorToViewState(error)),
    });
  }

  protected verMasDias(): void {
    this.diasVisibles.update((n) => n + DIAS_VISIBLES);
  }

  protected elegirHorario(horario: StudyStart): void {
    this.horario.set(horario);
    this.aviso.set(null);
    this.paso.set('confirmar');
  }

  protected volverA(paso: 'centro' | 'horario'): void {
    this.aviso.set(null);
    this.paso.set(paso);
    if (paso === 'horario') this.cargarHorarios();
  }

  protected confirmar(): void {
    const centro = this.centro();
    const horario = this.horario();
    if (centro === null || horario === null || this.confirmando()) return;
    this.confirmando.set(true);
    this.centros.bookOrder(this.orderId, centro.unitId, horario.startAt).subscribe({
      next: (turno) => {
        this.confirmando.set(false);
        this.turno.set(turno);
        this.paso.set('listo');
      },
      error: (error: unknown) => {
        this.confirmando.set(false);
        if (error instanceof HttpErrorResponse && error.status === 409) {
          const ocupado = (error.error as { details?: { slotTaken?: boolean } } | null)?.details?.slotTaken === true;
          // Primero se vuelve a los horarios (que limpia el aviso anterior) y
          // después se avisa: al revés, el aviso se borraba al volver.
          if (ocupado) this.volverA('horario');
          this.aviso.set(
            ocupado
              ? { tipo: 'ocupado', titulo: 'Ese horario se ocupó', texto: 'Alguien lo tomó recién. Elija otro de la lista.' }
              : {
                  tipo: 'ya-tiene-turno',
                  titulo: 'Esta orden ya tiene turno',
                  texto: 'Para cambiarlo, cancele el turno actual desde «Mis órdenes» y vuelva a reservar.',
                },
          );
          return;
        }
        this.aviso.set({ tipo: 'error', titulo: 'No se confirmó el turno', texto: 'Pruebe de nuevo en un momento.' });
      },
    });
  }

  protected cambiarOrden(orden: Orden): void {
    this.orden.set(orden);
  }

  protected fechaLarga(instante: string): string {
    return new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(instante));
  }

  protected hora(instante: string): string {
    return new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(instante));
  }

  protected dinero(monto: number | null, moneda: string | null): string {
    if (monto === null) return 'Precio a confirmar en el centro';
    return `${monto.toFixed(2).replace('.', ',')} ${moneda === 'BOB' || moneda === null ? 'Bs' : moneda}`;
  }

  protected distancia(km: number | null): string {
    return km === null ? 'Distancia no disponible' : `a ${km.toString().replace('.', ',')} km de su casa`;
  }
}

function agruparPorDia(items: readonly StudyStart[]): readonly DiaConHorarios[] {
  const dias = new Map<string, StudyStart[]>();
  for (const item of items) {
    const d = new Date(item.startAt);
    const clave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dias.set(clave, [...(dias.get(clave) ?? []), item]);
  }
  const titulo = new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
  return [...dias.entries()].map(([clave, horarios]) => ({
    clave,
    titulo: titulo.format(new Date(horarios[0]!.startAt)),
    horarios,
  }));
}
