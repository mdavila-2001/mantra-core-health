import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { PractitionerInsurerRequestsClient } from '../../../core/data-access/insurance/practitioner-insurer-requests.client';
import type { ReceivedInsurerRequest } from '../../../core/data-access/insurance/practitioner-insurer-requests.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/** El motivo tiene el mismo tope que la API. */
const MAX_MOTIVO = 500;

const SELLO: Readonly<Record<ReceivedInsurerRequest['status'], StatusSealVariant>> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'unknown',
};

const ROTULO: Readonly<Record<ReceivedInsurerRequest['status'], string>> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  WITHDRAWN: 'Retirada',
};

/**
 * La bandeja de LA ASEGURADORA: los profesionales que piden trabajar con ella
 * (API v4.2.64, `GET /insurance/practitioner-requests`).
 *
 * Es la otra cara de «Mis verificaciones» del médico: aprobar acá es lo que le
 * pone el sello oficial a esa solicitud; rechazar, con un motivo opcional, es lo
 * que él lee en su conversación. La aseguradora sale del tenant activo y la
 * barrera la pone la API: esta pantalla no decide quién puede.
 *
 * Fuera del menú —el de la aseguradora es una lista cerrada que fijó la
 * propietaria—; se llega desde el encabezado de «Solicitudes recibidas».
 */
@Component({
  selector: 'app-insurer-practitioner-requests',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    Card,
    DatePipe,
    FormField,
    PageHeader,
    StatusSeal,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './practitioner-requests.html',
  styleUrl: './practitioner-requests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurerPractitionerRequests {
  private readonly client = inject(PractitionerInsurerRequestsClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly maxMotivo = MAX_MOTIVO;
  protected readonly sello = SELLO;
  protected readonly rotulo = ROTULO;

  protected readonly state = signal<ViewState<readonly ReceivedInsurerRequest[]>>(loading());

  protected readonly filas = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  protected readonly pendientes = computed(
    () => this.filas().filter((f) => f.status === 'PENDING').length,
  );

  /** La fila con el rechazo abierto, para escribir el motivo antes de confirmar. */
  protected readonly rechazando = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly enviando = signal<string | null>(null);
  protected readonly aviso = signal<{ tono: 'success' | 'error'; texto: string } | null>(null);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.listReceived().subscribe({
      next: (filas) =>
        this.state.set(
          filas.length === 0
            ? empty(
                {
                  label: 'Volver a «Solicitudes recibidas»',
                  route: '/administration/received-claims',
                },
                'Ningún profesional pidió todavía trabajar con su aseguradora.',
              )
            : ready(filas),
        ),
      error: (error: unknown) => this.state.set(errorToViewState(error)),
    });
  }

  protected aprobar(fila: ReceivedInsurerRequest): void {
    this.decidir(fila, () => this.client.approve(fila.id), 'aprobó');
  }

  protected abrirRechazo(fila: ReceivedInsurerRequest): void {
    this.rechazando.set(fila.id);
    this.motivo.set('');
  }

  protected cancelarRechazo(): void {
    this.rechazando.set(null);
  }

  protected rechazar(fila: ReceivedInsurerRequest): void {
    const motivo = this.motivo().trim().slice(0, MAX_MOTIVO);
    this.decidir(fila, () => this.client.reject(fila.id, motivo), 'rechazó');
  }

  /**
   * Escribe la decisión y **vuelve a leer la bandeja**: lo que queda en
   * pantalla es lo que la API guardó, no lo que se supuso.
   */
  private decidir(
    fila: ReceivedInsurerRequest,
    llamada: () => ReturnType<PractitionerInsurerRequestsClient['approve']>,
    verbo: string,
  ): void {
    if (this.enviando() !== null) return;
    this.enviando.set(fila.id);
    this.aviso.set(null);
    llamada().subscribe({
      next: () => {
        this.client.listReceived().subscribe({
          next: (filas) => {
            this.state.set(ready(filas));
            this.enviando.set(null);
            this.rechazando.set(null);
            this.aviso.set({
              tono: 'success',
              texto: `Se ${verbo} la solicitud de ${fila.practitionerName ?? 'el profesional'}. Ya lo ve en su conversación.`,
            });
          },
          error: (error: unknown) => this.fallo(error),
        });
      },
      error: (error: unknown) => this.fallo(error),
    });
  }

  private fallo(error: unknown): void {
    this.enviando.set(null);
    const yaDecidida = error instanceof HttpErrorResponse && error.status === 422;
    this.aviso.set({
      tono: 'error',
      texto: yaDecidida
        ? 'Esa solicitud ya fue decidida o el profesional la retiró. Recargue la bandeja.'
        : 'No pudimos guardar la decisión. Revise su conexión y vuelva a intentarlo.',
    });
  }
}
