import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { forkJoin, map, type Observable, type Subscription } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { PracticeSitesClient } from '@core/data-access/practice-sites/practice-sites.client';
import type { PracticeSite } from '@core/data-access/practice-sites/practice-sites.types';
import { AppButton } from '../../atoms/button/button';
import { Alert } from '../alert/alert';
import { OrganizationSelect } from './organization-select';
import { practitionerOrganizationsOf } from './organization-select.rules';
import {
  OWN_OFFICE_KEY,
  type OrganizationChoice,
  type PractitionerOrganization,
} from './organization-select.types';

/**
 * El selector de organización **con sus datos**: trae las organizaciones del
 * médico de la sesión y se las pasa a `app-organization-select`.
 *
 * Pide dos cosas que ya existen: sus afiliaciones
 * (`GET /practitioners/me/role-assignments`) y sus sedes
 * (`GET /practitioners/:profileId/sites`). La segunda es la única que dice
 * cuál es su consultorio propio (`isOwnSite`); sin ella, la afiliación de ese
 * consultorio aparecería como una organización más, al lado de «Mi
 * consultorio».
 *
 * ## «Afiliarme a otra organización…» se reenvía, no se abre acá
 *
 * El formulario de solicitud vive en `features/` y el diálogo con contenido es
 * un organismo: una molécula de `shared/` no puede importar ninguno de los dos
 * (`eslint.config.js`, fronteras de la arquitectura). La pantalla escucha
 * {@link affiliationRequested} y abre el formulario en su `app-content-dialog`.
 *
 * ## Si la carga falla, «Mi consultorio» sigue disponible
 *
 * No se inventan organizaciones: queda solo el consultorio, se avisa y se
 * ofrece reintentar.
 */
@Component({
  selector: 'app-organization-select-container',
  imports: [Alert, AppButton, OrganizationSelect],
  templateUrl: './organization-select-container.html',
  styleUrl: './organization-select-container.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationSelectContainer {
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly session = inject(SessionStore);

  /** La clave elegida: `OWN_OFFICE_KEY` o un `practiceId`. */
  readonly value = input<string>(OWN_OFFICE_KEY);
  readonly disabled = input(false);

  /** El médico eligió dónde publicar. */
  readonly selected = output<OrganizationChoice>();

  /** El médico quiere afiliarse a otra organización. El valor no cambió. */
  readonly affiliationRequested = output<void>();

  protected readonly organizations = signal<readonly PractitionerOrganization[]>([]);
  protected readonly failed = signal(false);

  private request: Subscription | null = null;

  constructor() {
    effect(() => {
      const profileId = this.session.practitionerProfileId();
      untracked(() => this.load(profileId));
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  protected retry(): void {
    this.load(this.session.practitionerProfileId());
  }

  /**
   * Sin perfil profesional en la sesión no se pide nada: la API responde las
   * afiliaciones solo a quien tiene uno, y queda «Mi consultorio». Si el perfil
   * llega después (la sesión se restaura en el navegador), el `effect` vuelve
   * a cargar.
   */
  private load(profileId: string | null): void {
    this.request?.unsubscribe();
    this.failed.set(false);
    this.organizations.set([]);
    if (profileId === null) {
      return;
    }
    this.request = forkJoin({
      assignments: this.practiceSites.listMyRoleAssignments(),
      ownSite: this.ownSiteOf(profileId),
    }).subscribe({
      next: ({ assignments, ownSite }) =>
        this.organizations.set(practitionerOrganizationsOf(assignments, ownSite)),
      error: () => this.failed.set(true),
    });
  }

  private ownSiteOf(profileId: string): Observable<PracticeSite | null> {
    return this.practiceSites
      .listSitesOfPractitioner(profileId)
      .pipe(map((page) => page.items.find((site) => site.isOwnSite === true) ?? null));
  }
}
