import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { IdentityClient } from '../../../core/data-access/identity/identity.client';
import type { VerificationCase } from '../../../core/data-access/identity/identity.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { toCaseStatusPresentation } from '../../identity-verification/case-status';

/** A dónde vuelve quien llegó a un caso que no existe o ya terminó de mirar. */
const LIST_ROUTE = '/identidad/casos';

/**
 * V27-01 · Ficha de un caso de verificación propio.
 *
 * `GET /identity/me/verification-cases/:caseId` — el backend solo entrega
 * casos del usuario autenticado, así que un caso ajeno responde como
 * inexistente y acá se ve el S6 sin revelar si existe.
 *
 * El contrato expone cuatro campos (id, estado, apertura, finalización); las
 * referencias y la auditoría que la ficha del vault imagina no tienen datos
 * de dónde salir todavía.
 */
@Component({
  selector: 'app-verification-case-detail',
  imports: [Card, DatePipe, Link, PageHeader, RouterLink, StatusSeal, ViewStateHost],
  templateUrl: './verification-case-detail.html',
  styleUrl: './verification-case-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationCaseDetail {
  private readonly identity = inject(IdentityClient);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly state = signal<ViewState<VerificationCase>>(loading());
  protected readonly listRoute = LIST_ROUTE;

  protected readonly caso = computed(() => dataOf(this.state()));
  protected readonly estado = computed(() => toCaseStatusPresentation(this.caso()?.status));

  private caseId: string | null = null;

  constructor() {
    // Por paramMap y no por snapshot: si el router reutiliza el componente
    // para otro caso, la pantalla recarga en vez de mostrar el anterior.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.caseId = params.get('caseId');
      this.cargar();
    });
  }

  protected cargar(): void {
    const caseId = this.caseId;
    if (caseId === null || caseId === '') {
      this.state.set(notFound({ label: 'Volver a mis verificaciones', route: LIST_ROUTE }));
      return;
    }
    this.state.set(loading());
    this.identity.getVerificationCase(caseId).subscribe({
      next: (caso) => this.state.set(ready(caso)),
      error: (error: unknown) => this.state.set(errorToViewState<VerificationCase>(error)),
    });
  }
}
