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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
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
 * propietaria—; se llega desde la franja del panel de la aseguradora.
 */
@Component({
  selector: 'app-insurer-practitioner-requests',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    Card,
    DatePipe,
    PageHeader,
    StatusSeal,
    ViewStateHost,
  ],
  templateUrl: './practitioner-requests.html',
  styleUrl: './practitioner-requests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurerPractitionerRequests {
  private readonly client = inject(PractitionerInsurerRequestsClient);
  private readonly navigation = inject(NavigationService);
  private readonly dialogs = inject(DialogService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly sello = SELLO;
  protected readonly rotulo = ROTULO;

  protected readonly state = signal<ViewState<readonly ReceivedInsurerRequest[]>>(loading());

  protected readonly filas = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  /** Por decidir arriba, lo decidido debajo; un grupo vacío no se dibuja. */
  protected readonly grupos = computed(() =>
    [
      {
        clave: 'por-decidir',
        titulo: 'Por decidir',
        filas: this.filas().filter((f) => f.status === 'PENDING'),
      },
      {
        clave: 'decididas',
        titulo: 'Ya decididas',
        filas: this.filas().filter((f) => f.status !== 'PENDING'),
      },
    ].filter((g) => g.filas.length > 0),
  );

  protected readonly enviando = signal<string | null>(null);
  protected readonly aviso = signal<{
    tono: 'success' | 'warning' | 'error';
    texto: string;
  } | null>(null);

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

  /**
   * Rechazar pide el motivo en un diálogo, no desplegado en la fila
   * (composition-rules.md §6): la lista no cambia de alto según lo que se
   * tocó. El motivo es obligatorio acá aunque la API lo admita vacío: es lo
   * único que el profesional lee para saber qué hacer después.
   */
  protected async rechazar(fila: ReceivedInsurerRequest): Promise<void> {
    if (this.enviando() !== null) return;
    const quien = fila.practitionerName ?? 'el profesional';
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Rechazar la solicitud',
        message: `${quien} va a leer el motivo en su conversación y podrá volver a pedirlo más adelante.`,
        confirmLabel: 'Rechazar',
        cancelLabel: 'Volver',
        destructive: true,
      },
      {
        label: 'Motivo',
        hint: 'Lo lee el profesional, tal cual lo escriba.',
        minLength: 5,
        maxLength: MAX_MOTIVO,
      },
    );
    if (motivo === null) return;
    this.decidir(fila, () => this.client.reject(fila.id, motivo.trim()), 'rechazó');
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
        const hecho = `Se ${verbo} la solicitud de ${fila.practitionerName ?? 'el profesional'}.`;
        this.releer(
          { tono: 'success', texto: `${hecho} Ya lo ve en su conversación.` },
          `${hecho} No pudimos mostrar la bandeja actualizada: recárguela para verla.`,
        );
      },
      error: (error: unknown) => {
        // 422: la decidió otra persona o el profesional la retiró. Lo que se
        // ve está viejo; se relee para mostrar cómo quedó.
        if (error instanceof HttpErrorResponse && error.status === 422) {
          this.releer(
            {
              tono: 'warning',
              texto:
                'Esa solicitud ya fue decidida o el profesional la retiró: le mostramos cómo quedó.',
            },
            'Esa solicitud ya fue decidida o el profesional la retiró. Recargue la bandeja para ver cómo quedó.',
          );
          return;
        }
        this.enviando.set(null);
        this.aviso.set({
          tono: 'error',
          texto: 'No pudimos guardar la decisión. Revise su conexión y vuelva a intentarlo.',
        });
      },
    });
  }

  /**
   * Vuelve a leer la bandeja: lo que queda en pantalla es lo que la API
   * guardó. Si la decisión salió y la relectura no, se dice eso.
   */
  private releer(
    aviso: { tono: 'success' | 'warning'; texto: string },
    sinRelectura: string,
  ): void {
    this.client.listReceived().subscribe({
      next: (filas) => {
        this.state.set(ready(filas));
        this.enviando.set(null);
        this.aviso.set(aviso);
      },
      error: () => {
        this.enviando.set(null);
        this.aviso.set({ tono: 'warning', texto: sinRelectura });
      },
    });
  }
}
