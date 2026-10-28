import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { horaDeBolivia, momentoDeBolivia } from '../../../core/data-access/pharmacy/opening-hours';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  OpenNowMode,
  OpenNowPage,
  OpenNowSite,
} from '../../../core/data-access/pharmacy/opening-hours.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Card } from '../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/** Cuántas sedes trae cada página. */
const POR_PAGINA = 6;

const MODOS: readonly SegmentedOption<OpenNowMode>[] = [
  { value: 'any', label: 'Todas', description: 'Abiertas 24 h o de turno ahora' },
  { value: '24h', label: '24 horas' },
  { value: 'on-call', label: 'De turno' },
];

/**
 * **Abiertas ahora** — la sección del directorio de farmacias que responde la
 * pregunta del P34: qué farmacia está abierta a las 3 de la mañana.
 *
 * Sale de `GET /public/pharmacies/open-now`, que decide con el reloj del
 * servidor: un turno vencido nunca llega. La pantalla dice con qué hora se
 * decidió («a las 03:00, hora de Bolivia») y quién lo declaró: es la farmacia
 * la que carga su 24 h y su turno, no un rol oficial del colegio.
 *
 * Paginada con el cursor del servidor («Ver más»), sin pedir la lista entera.
 */
@Component({
  selector: 'app-open-now-pharmacies',
  imports: [AppButton, Badge, Card, RouterLink, SegmentedControl, ViewStateHost],
  templateUrl: './open-now-pharmacies.html',
  styleUrl: './open-now-pharmacies.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenNowPharmacies {
  private readonly pharmacy = inject(PharmacyClient);

  protected readonly modos = MODOS;
  protected readonly modo = signal<OpenNowMode>('any');
  protected readonly estado = signal<ViewState<readonly OpenNowSite[]>>(loading());
  protected readonly siguiente = signal<string | null>(null);
  protected readonly cargandoMas = signal(false);
  protected readonly asOf = signal<string | null>(null);
  protected readonly falloAlCargarMas = signal(false);

  protected readonly sedes = computed(() => {
    const estado = this.estado();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** «03:00»: la hora con que el servidor decidió qué estaba abierto. */
  protected readonly horaDeLaConsulta = computed(() => {
    const asOf = this.asOf();
    return asOf === null ? null : horaDeBolivia(asOf);
  });

  constructor() {
    this.cargar();
  }

  protected elegirModo(modo: OpenNowMode): void {
    if (modo === this.modo()) {
      return;
    }
    this.modo.set(modo);
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.siguiente.set(null);
    this.falloAlCargarMas.set(false);
    this.pharmacy.openNow({ mode: this.modo(), limit: POR_PAGINA }).subscribe({
      next: (pagina) => {
        this.recibir(pagina, []);
      },
      error: (error: unknown) => this.estado.set(errorToViewState<readonly OpenNowSite[]>(error)),
    });
  }

  protected verMas(): void {
    const cursor = this.siguiente();
    if (cursor === null || this.cargandoMas()) {
      return;
    }
    this.cargandoMas.set(true);
    this.falloAlCargarMas.set(false);
    this.pharmacy.openNow({ mode: this.modo(), limit: POR_PAGINA, cursor }).subscribe({
      next: (pagina) => {
        this.cargandoMas.set(false);
        this.recibir(pagina, this.sedes());
      },
      error: () => {
        // Lo ya mostrado se queda: sólo falló la página siguiente.
        this.cargandoMas.set(false);
        this.falloAlCargarMas.set(true);
      },
    });
  }

  protected rotuloDe(sede: OpenNowSite): string {
    if (sede.open24h) {
      return 'Abierta 24 h';
    }
    return sede.onCall === null ? '' : `De turno hasta el ${momentoDeBolivia(sede.onCall.endsAt)}`;
  }

  private recibir(pagina: OpenNowPage, previas: readonly OpenNowSite[]): void {
    const todas = [...previas, ...pagina.items];
    this.asOf.set(pagina.asOf);
    this.siguiente.set(pagina.nextCursor);
    this.estado.set(
      todas.length > 0
        ? ready(todas)
        : empty(
            { label: 'Busque en el directorio de abajo y llame antes de ir' },
            'Ninguna farmacia de la red declaró estar abierta las 24 h o de turno en este momento.',
          ),
    );
  }
}
