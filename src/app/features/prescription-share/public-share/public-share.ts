import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import type { TenantTypeCode } from '../../../core/data-access/directory/directory.types';
import { PrescriptionSharesClient } from '../../../core/data-access/prescription-shares/prescription-shares.client';
import type {
  PrescriptionShareStatus,
  PublicPrescriptionShare,
} from '../../../core/data-access/prescription-shares/prescription-shares.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import type { AlertTone } from '../../../shared/components/molecules/alert/alert.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { markPageAsNoIndex } from '../no-index';
import { MY_PRESCRIPTIONS_ROUTE, PHARMACY_OPEN_PRESCRIPTION_ROUTE } from '../prescription-share.paths';
import { PRESCRIPTION_SHARE_TESTIDS } from '../prescription-share.testids';

/** Título y tono de cada estado del enlace (textos del paquete FAR-01). */
const STATUS_COPY: Readonly<Record<PrescriptionShareStatus, { title: string; tone: AlertTone }>> = {
  VALID: { title: 'Receta válida', tone: 'success' },
  EXPIRED: { title: 'Esta receta venció', tone: 'warning' },
  REVOKED: { title: 'El paciente dejó de compartir esta receta', tone: 'warning' },
};

/** El enlace terminó porque la receta dejó de valer antes de su plazo. */
const NOT_ACTIVE_COPY: { title: string; tone: AlertTone } = {
  title: 'Esta receta ya no está vigente',
  tone: 'warning',
};

/**
 * `/rx/:token` — a donde lleva el enlace (y el QR) que comparte el paciente
 * (FAR-01, `CONTRATO.md` §1 y S-4).
 *
 * ## Quién ve qué
 *
 * - **Una farmacia** (organización activa de tipo `PHARMACY`): se la lleva a
 *   «Abrir receta» de FAR-02 **antes de pedir nada**, porque ahí la API le da
 *   los ítems cruzados con su catálogo.
 * - **Un paciente**: se pregunta a la API si el enlace es suyo (D-1,
 *   `by-token`). Si lo es, va a «Mis recetas» con el enlace marcado; si la API
 *   dice que no (o falla), ve la vista pública como cualquiera.
 * - **El resto** —sin sesión, otra persona, una médica—: la vista pública.
 *   Si la receta vale, quién la emitió y cuándo, y cuántos ítems tiene. **Ni
 *   el paciente ni los fármacos**: la respuesta no los trae y el tipo no los
 *   declara.
 *
 * El front no decide el acceso: las dos redirecciones son atajos de
 * navegación. Lo que cada uno puede leer lo dice la API en la pantalla de
 * destino.
 *
 * ## Estados
 *
 * Pública, sin S1 (no hay autorización de ruta que esperar). S2 mientras se
 * consulta; el estado del enlace (válido, vencido, revocado) es dato, no
 * error; un token desconocido es S6 con texto propio; S4/S8/S9 por el mapeo
 * común. Un token que no llega en la dirección es el mismo S6, sin consultar.
 */
@Component({
  selector: 'app-public-share',
  imports: [Alert, AppButtonLink, DatePipe, RouterLink, ViewStateHost],
  templateUrl: './public-share.html',
  styleUrl: './public-share.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicShare {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly shares = inject(PrescriptionSharesClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  protected readonly testids = PRESCRIPTION_SHARE_TESTIDS;

  protected readonly state = signal<ViewState<PublicPrescriptionShare>>(loading());

  /** El enlace leído: la plantilla no estrecha la unión por `status`. */
  protected readonly share = computed(() => dataOf(this.state()));

  /**
   * Los datos de la receta y la entrada de la farmacia, solo con `VALID`.
   *
   * Revocada, la API no manda nada (todo `null`, `itemCount: 0`); vencida,
   * `itemCount` cuenta los ítems vigentes, que son cero. Pintarlos diría
   * «Sin registrar» o «0 medicamentos» de una receta que los tenía, y ofrecer
   * «Soy farmacia» llevaría a un 410: el estado con su texto alcanza.
   */
  protected readonly showsDetails = computed(() => this.share()?.status === 'VALID');

  protected readonly copy = computed(() => {
    const share = this.share();
    if (share === null) {
      return null;
    }
    // Una receta anulada, reemplazada o completada no «venció» (H12-09).
    return share.endedReason === 'PRESCRIPTION_NOT_ACTIVE' ? NOT_ACTIVE_COPY : STATUS_COPY[share.status];
  });

  /** Vuelve a esta misma página después del login: sirve a la farmacia que escaneó sin sesión. */
  protected readonly loginQuery = { returnUrl: `/rx/${encodeURIComponent(this.token)}` };

  constructor() {
    markPageAsNoIndex();

    if (this.token === '') {
      this.state.set(notFound());
      return;
    }

    // El tipo de organización que abre la receta con sus ítems (FAR-02),
    // anclado al catálogo de tipos (`TENANT_TYPE_CODES`).
    if (this.auth.activeTenantType() === ('PHARMACY' satisfies TenantTypeCode)) {
      void this.router.navigate([PHARMACY_OPEN_PRESCRIPTION_ROUTE, this.token], {
        replaceUrl: true,
      });
      return;
    }

    if (this.auth.patientProfileId() !== null) {
      this.openAsPossibleOwner();
      return;
    }

    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.shares
      .readPublic(this.token)
      .pipe(
        map((share) => ready(share)),
        catchError((error: unknown) => of(errorToViewState<PublicPrescriptionShare>(error))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.state.set(state));
  }

  /**
   * Si el enlace es del paciente, a «Mis recetas» con el enlace marcado.
   *
   * La dirección de destino no lleva el token: el `shareId` alcanza para
   * marcar el enlace y no sirve para abrirlo. Cualquier respuesta que no sea
   * 200 —el 404 de «no es suyo» o un fallo— deja la vista pública: no saber
   * si es el dueño no le quita a nadie lo que ve cualquiera.
   */
  private openAsPossibleOwner(): void {
    this.shares
      .resolveOwnership(this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ownership) =>
          void this.router.navigate([MY_PRESCRIPTIONS_ROUTE], {
            queryParams: { share: ownership.shareId },
            replaceUrl: true,
          }),
        error: () => this.load(),
      });
  }
}
