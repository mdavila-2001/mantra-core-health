import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ConsentClient } from '../../../core/data-access/consent/consent.client';
import type {
  ConsentRecordState,
  MyConsent,
  MyHipaaAuthorization,
  MyObjection,
  MyTreatmentConsent,
} from '../../../core/data-access/consent/consent.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AccountClinicalAccess } from '../clinical-access/clinical-access';
import { LoadingState } from '../../../shared/components/molecules/loading-state/loading-state';
import { UxConsentPanel } from '../../ux-consent/ux-consent-panel';

/** Qué se ve mientras se leen las cuatro listas. */
type Estado =
  | { readonly status: 'cargando' }
  | { readonly status: 'listo' }
  | { readonly status: 'error'; readonly mensaje: string; readonly requestId: string | null };

/**
 * Las dos vistas de «Mi privacidad». Antes eran dos renglones del menú
 * («Mi privacidad» y «Quién ve mi historia») que respondían la misma pregunta
 * —quién puede ver o usar lo mío— desde dos lados. Ahora son una sola puerta.
 */
export type VistaPrivacidad = 'historia' | 'consentimientos';

// Sin ícono: con los dos rótulos completos el conmutador entra en un teléfono
// de 390 px; con ícono, el segundo se cortaba en «Mis consentimient…».
const VISTAS: readonly SegmentedOption<VistaPrivacidad>[] = [
  { value: 'historia', label: 'Quién ve mi historia' },
  { value: 'consentimientos', label: 'Mis consentimientos' },
];

function vistaDe(valor: string | null): VistaPrivacidad {
  return valor === 'consentimientos' ? 'consentimientos' : 'historia';
}

/** El rótulo de cada estado, en castellano y sin siglas. */
const ROTULO_DE_ESTADO: Readonly<Record<ConsentRecordState, string>> = {
  ACTIVE: 'Vigente',
  WITHDRAWN: 'Retirado',
  EXPIRED: 'Vencido',
  OTHER: 'Sin estado',
};

/**
 * **Mi privacidad** (BR-20 · CL-78 · CV-19): una sola puerta con dos vistas.
 *
 * - **Quién ve mi historia** (`?ver=historia`, la de entrada): la pantalla
 *   `AccountClinicalAccess` incrustada, sin su propio encabezado. La dirección
 *   vieja `/my-account/clinical-access` redirige acá.
 * - **Mis consentimientos** (`?ver=consentimientos`): los consentimientos que el titular dio, las
 * autorizaciones de divulgación, sus objeciones y los consentimientos informados
 * que firmó en sus consultas.
 *
 * Una sola tarjeta con pestañas, centrada y a lo ancho (regla del cliente §5).
 *
 * - **Retirar un consentimiento** pide confirmación, llama a
 *   `POST /consent/me/consents/:id/withdraw` y **relee** la lista: el registro no
 *   se borra, figura como «Retirado» con su fecha. Un toast no prueba nada; lo
 *   que prueba es la fila releída.
 * - Los estados son los del contrato M34: cargando, vacío, error con el
 *   identificador de la petición y, si la cuenta no es de paciente, sin permiso.
 *
 * No cita ninguna norma: el marco legal está sin confirmar y no se afirma en la
 * pantalla sin validación legal.
 */
@Component({
  selector: 'app-account-privacy',
  imports: [
    AccountClinicalAccess,
    AppButton,
    Alert,
    Badge,
    Card,
    DatePipe,
    EmptyState,
    PageHeader,
    SegmentedControl,
    Tab,
    Tabs,
    LoadingState,
    UxConsentPanel,
  ],
  templateUrl: './privacy.html',
  styleUrl: './privacy.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPrivacy {
  private readonly consent = inject(ConsentClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly vistas = VISTAS;
  /** La vista vive en el query (`?ver=`): un enlace guardado abre la misma. */
  protected readonly vista = signal<VistaPrivacidad>(
    vistaDe(this.route.snapshot.queryParamMap.get('ver')),
  );

  protected readonly estado = signal<Estado>({ status: 'cargando' });
  protected readonly sinPermiso = signal(false);

  /** El mensaje y el ID de la petición del estado de error (S9 del contrato M34). */
  protected readonly errorMensaje = computed(() => {
    const actual = this.estado();
    return actual.status === 'error' ? actual.mensaje : '';
  });
  protected readonly errorRequestId = computed(() => {
    const actual = this.estado();
    return actual.status === 'error' ? actual.requestId : null;
  });
  protected readonly consentimientos = signal<readonly MyConsent[]>([]);
  protected readonly autorizaciones = signal<readonly MyHipaaAuthorization[]>([]);
  protected readonly objeciones = signal<readonly MyObjection[]>([]);
  protected readonly informados = signal<readonly MyTreatmentConsent[]>([]);
  protected readonly retirando = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  protected elegirVista(vista: VistaPrivacidad): void {
    this.vista.set(vista);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ver: vista },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected cargar(): void {
    this.estado.set({ status: 'cargando' });
    this.sinPermiso.set(false);
    forkJoin({
      consentimientos: this.consent.listMyConsents(),
      autorizaciones: this.consent.listMyHipaaAuthorizations(),
      objeciones: this.consent.listMyObjections(),
      informados: this.consent.listMyTreatmentConsents().pipe(catchError(() => of([]))),
    }).subscribe({
      next: (datos) => {
        this.consentimientos.set(datos.consentimientos);
        this.autorizaciones.set(datos.autorizaciones);
        this.objeciones.set(datos.objeciones);
        this.informados.set(datos.informados);
        this.estado.set({ status: 'listo' });
      },
      error: (error: unknown) => {
        const vista = errorToViewState<null>(error);
        if (vista.status === 'forbidden') {
          this.sinPermiso.set(true);
        }
        this.estado.set({
          status: 'error',
          mensaje:
            vista.status === 'offline'
              ? 'No pudimos conectarnos. Revise su conexión y reintente.'
              : 'No pudimos traer su información de privacidad.',
          requestId: vista.status === 'error' ? vista.requestId : null,
        });
      },
    });
  }

  protected rotulo(estado: ConsentRecordState): string {
    return ROTULO_DE_ESTADO[estado];
  }

  protected propositoDe(propósito: { readonly name?: string; readonly code?: string }): string {
    return propósito.name ?? propósito.code ?? 'Propósito sin nombre';
  }

  protected decisionDe(decision: MyTreatmentConsent['decision']): string {
    switch (decision) {
      case 'ACCEPTED':
        return 'Aceptó el tratamiento';
      case 'DECLINED':
        return 'Rechazó el tratamiento';
      default:
        return 'Sin decisión registrada';
    }
  }

  /** Retira un consentimiento vigente, con confirmación, y relee la lista. */
  protected async retirar(consentimiento: MyConsent): Promise<void> {
    if (consentimiento.state !== 'ACTIVE' || this.retirando() !== null) {
      return;
    }
    const confirmado = await this.dialogs.confirm({
      title: 'Retirar el consentimiento',
      message:
        'Va a retirar este consentimiento. Los accesos que se apoyaban en él se cierran, y el registro queda guardado como «Retirado».',
      details: [{ label: 'Propósito', value: this.propositoDe(consentimiento.purpose) }],
      confirmLabel: 'Retirar',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }

    this.retirando.set(consentimiento.id);
    this.consent.withdrawMyConsent(consentimiento.id).subscribe({
      next: () => {
        this.retirando.set(null);
        this.toasts.success('Retiró el consentimiento.');
        this.cargar();
      },
      error: () => {
        this.retirando.set(null);
        this.toasts.warning('No pudimos retirar el consentimiento. Pruebe de nuevo.');
      },
    });
  }
}
