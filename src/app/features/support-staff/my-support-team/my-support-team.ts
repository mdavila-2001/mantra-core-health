import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { catchError, of, type Observable } from 'rxjs';

import { PracticeSitesClient } from '../../../core/data-access/practice-sites/practice-sites.client';
import { ROLE_ASSIGNMENT_STATUS } from '../../../core/data-access/practice-sites/role-assignment-concepts';
import type { MyRoleAssignment } from '../../../core/data-access/practice-sites/practice-sites.types';
import { roleAssignmentState } from '../../../core/data-access/role-assignments/role-assignment-status';
import { SupportStaffClient } from '../../../core/data-access/support-staff/support-staff.client';
import { awaitingText, type SupportLink } from '../../../core/data-access/support-staff/support-staff.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { soloLetrasYNumeros } from '../../../shared/forms/input-filters';
import { supportFailureMessage } from '../shared/support-failure';

const DOCUMENTO = /^[A-Za-z0-9]{4,20}$/;

/** Si la vinculación del doctor con el hospital está activa: sólo ahí puede sumar a su secretaria. */
export function isActiveAffiliation(row: MyRoleAssignment): boolean {
  return row.status === ROLE_ASSIGNMENT_STATUS.ACTIVE || row.status === 'ACTIVE' || roleAssignmentState(row.statusCode ?? '') === 'ACTIVE';
}

/**
 * **Mi secretaría** — el equipo de apoyo del doctor (`/my-support-team`).
 *
 * Quién lleva su agenda y recibe a sus pacientes, en qué hospital, y su mitad de
 * la solicitud y aceptación: acepta o rechaza a la secretaria que pidió
 * trabajar con él (`POST /practitioner-delegates/:id/accept|reject`) e invita a
 * la suya por documento en uno de sus hospitales
 * (`POST /me/practitioner/support-invitations`). Hasta que la otra parte acepta,
 * nadie actúa en su nombre.
 */
@Component({
  selector: 'app-my-support-team',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    AppInput,
    Badge,
    Card,
    DatePipe,
    FormField,
    PageHeader,
    Select,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './my-support-team.html',
  styleUrl: '../support-staff-admin/support-staff-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySupportTeam implements OnInit {
  private readonly client = inject(SupportStaffClient);
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly tab = signal(0);
  protected readonly state = signal<ViewState<readonly SupportLink[]>>(loading());
  protected readonly links = computed<readonly SupportLink[]>(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data.filter((l) => l.status === 'ACTIVE' || l.status === 'PENDING') : [];
  });
  protected readonly toDecide = computed(() => this.links().filter((l) => l.awaiting === 'PRACTITIONER').length);
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  /* invitar */
  protected readonly affiliations = signal<readonly SelectOption<string>[]>([]);
  protected readonly affiliation = signal<string | null>(null);
  protected readonly nationalId = signal('');
  protected readonly sending = signal(false);
  protected readonly canInvite = computed(
    () => this.affiliation() !== null && DOCUMENTO.test(this.nationalId().trim()) && !this.sending(),
  );
  protected readonly soloAlfanumerico = soloLetrasYNumeros;
  protected readonly awaitingText = awaitingText;

  ngOnInit(): void {
    this.reload();
    this.practiceSites
      .listMyRoleAssignments()
      .pipe(catchError(() => of([] as readonly MyRoleAssignment[])))
      .subscribe((rows) => {
        const opciones = [
          ...new Map(rows.filter(isActiveAffiliation).map((row) => [row.id, { value: row.id, label: row.practiceName }])).values(),
        ];
        this.affiliations.set(opciones);
        if (opciones.length > 0) this.affiliation.set(opciones[0]!.value);
      });
  }

  protected reload(): void {
    this.state.set(loading());
    this.client.getMyTeam().subscribe({
      next: (links) => this.state.set(ready(links)),
      error: (failure: unknown) => this.state.set(errorToViewState<readonly SupportLink[]>(failure)),
    });
  }

  protected accept(link: SupportLink): void {
    this.act(link, this.client.acceptAsPractitioner(link.id), `Aceptó a ${link.personName ?? 'la secretaria'}: ya puede llevar su agenda.`);
  }

  protected reject(link: SupportLink): void {
    this.act(link, this.client.rejectAsPractitioner(link.id), 'Rechazó la solicitud.');
  }

  protected end(link: SupportLink): void {
    this.act(link, this.client.endAsPractitioner(link.id), `Dejó de trabajar con ${link.personName ?? 'la secretaria'}.`);
  }

  protected invite(): void {
    const affiliation = this.affiliation();
    if (affiliation === null || !this.canInvite()) return;
    this.sending.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.client.inviteAsPractitioner({ nationalId: this.nationalId().trim(), practitionerRoleAssignmentId: affiliation }).subscribe({
      next: () => {
        this.sending.set(false);
        this.nationalId.set('');
        this.notice.set('Invitación enviada: la secretaria la acepta en «Mi trabajo de apoyo».');
        this.tab.set(0);
        this.reload();
      },
      error: (failure: unknown) => {
        this.sending.set(false);
        this.error.set(supportFailureMessage(failure));
      },
    });
  }

  private act(link: SupportLink, operation: Observable<SupportLink>, ok: string): void {
    if (this.busyId() !== null) return;
    this.busyId.set(link.id);
    this.error.set(null);
    this.notice.set(null);
    operation.subscribe({
      next: () => {
        this.busyId.set(null);
        this.notice.set(ok);
        this.reload();
      },
      error: (failure: unknown) => {
        this.busyId.set(null);
        this.error.set(supportFailureMessage(failure));
      },
    });
  }
}
