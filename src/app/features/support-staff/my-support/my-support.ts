import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, type OnInit } from '@angular/core';
import { forkJoin, type Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  invitationsFor,
  pendingOnOthers,
  scopeOf,
  uniqueLinks,
} from '../../../core/data-access/support-staff/support-scope';
import { SupportStaffClient } from '../../../core/data-access/support-staff/support-staff.client';
import {
  awaitingText,
  targetLabel,
  type SupportAccess,
  type SupportCatalog,
  type SupportLink,
} from '../../../core/data-access/support-staff/support-staff.types';

/** Lo que lee la pantalla: sus vínculos (para decidir) y su acceso (para ver). */
export interface MySupportData {
  readonly links: readonly SupportLink[];
  readonly access: SupportAccess;
}
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
import { supportFailureMessage } from '../shared/support-failure';
import {
  EMPTY_SELECTION,
  isEmptySelection,
  SupportTargetPicker,
  targetsOf,
  type TargetSelection,
} from '../shared/target-picker/target-picker';

/** Las pestañas, en orden. */
export const MY_SUPPORT_TABS = { workplaces: 0, invitations: 1, request: 2, requests: 3 } as const;

/** Quién la invitó, en palabras. */
function invitedBy(link: SupportLink): string {
  return link.initiatedBy === 'PRACTITIONER' ? 'La invita el doctor' : 'La invita el hospital';
}

/**
 * **Mi trabajo de apoyo** — la pantalla de la secretaria (`/my-support`).
 *
 * Ve **sólo** sus hospitales, **sólo** sus doctores y **sólo** sus pisos, tal
 * como los devuelve `GET /me/support-access` (`scopeOf`). Donde sólo un doctor
 * la aceptó, ve a ese doctor y nada del hospital. La API filtra cada lectura
 * por lo mismo; esto no autoriza.
 *
 * Es además su mitad de la solicitud y aceptación: acepta o rechaza lo que un
 * hospital o un doctor le propone, pide más doctores o pisos donde ya trabaja
 * —lo acepta el hospital o el doctor— y retira lo que pidió. Después de
 * aceptar se renueva la sesión: el hospital llega con el token nuevo.
 */
@Component({
  selector: 'app-my-support',
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
    SupportTargetPicker,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './my-support.html',
  styleUrl: './my-support.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySupport implements OnInit {
  private readonly client = inject(SupportStaffClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly tabs = MY_SUPPORT_TABS;
  protected readonly tab = signal<number>(MY_SUPPORT_TABS.workplaces);
  protected readonly state = signal<ViewState<MySupportData>>(loading());
  private readonly data = computed<MySupportData>(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : { links: [], access: { tenants: [] } };
  });
  private readonly links = computed(() => this.data().links);
  private readonly scope = computed(() => scopeOf(this.data().access, this.links()));
  protected readonly workplaces = computed(() => this.scope().workplaces);
  /** Doctores que la aceptaron sin que el hospital la sume: sólo su agenda, nada del hospital. */
  protected readonly doctorsOnly = computed(() => this.scope().doctorsOnly);
  protected readonly invitations = computed(() => invitationsFor(this.links()));
  protected readonly requests = computed(() => pendingOnOthers(this.links()));

  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  /* pedir más doctores o pisos */
  protected readonly requestTenant = signal<string | null>(null);
  protected readonly requestCatalog = signal<SupportCatalog | null>(null);
  protected readonly catalogFailed = signal(false);
  protected readonly requestSelection = signal<TargetSelection>(EMPTY_SELECTION);
  protected readonly requestMessage = signal('');
  protected readonly sending = signal(false);

  protected readonly orgOptions = computed<readonly SelectOption<string>[]>(() =>
    this.workplaces().map((lugar) => ({ value: lugar.tenantId, label: lugar.organizationName })),
  );
  protected readonly canSendRequest = computed(
    () => this.requestTenant() !== null && !isEmptySelection(this.requestSelection()) && !this.sending(),
  );

  protected readonly targetLabel = targetLabel;
  protected readonly awaitingText = awaitingText;
  protected readonly invitedBy = invitedBy;

  constructor() {
    // El catálogo se pide al elegir el hospital: sólo de los hospitales donde ya trabaja.
    effect(() => {
      const tenantId = this.requestTenant();
      this.requestCatalog.set(null);
      this.catalogFailed.set(false);
      if (tenantId === null) return;
      this.client.getCatalogFor(tenantId).subscribe({
        next: (catalog) => this.requestCatalog.set(catalog),
        error: () => this.catalogFailed.set(true),
      });
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.state.set(loading());
    forkJoin({ mine: this.client.listMine(), access: this.client.getMyAccess() }).subscribe({
      next: ({ mine, access }) => {
        // Siempre `ready`, también vacío: la pestaña de invitaciones tiene que
        // estar a la vista justamente cuando todavía no trabaja en ningún lado.
        const links = uniqueLinks(mine.items, mine.requests);
        this.state.set(ready({ links, access }));
        if (this.requestTenant() === null) {
          const primero = scopeOf(access, links).workplaces[0];
          if (primero !== undefined) this.requestTenant.set(primero.tenantId);
        }
      },
      error: (failure: unknown) => this.state.set(errorToViewState<MySupportData>(failure)),
    });
  }

  protected accept(link: SupportLink): void {
    this.act(link, this.client.confirm(link.id), `Aceptó: ya trabaja con ${targetLabel(link)} en ${link.organizationName ?? 'el hospital'}.`, true);
  }

  protected decline(link: SupportLink): void {
    this.act(link, this.client.decline(link.id), 'Rechazó la invitación.');
  }

  protected withdraw(link: SupportLink): void {
    this.act(link, this.client.leave(link.id), 'Retiró la solicitud.');
  }

  protected sendRequest(): void {
    const tenantId = this.requestTenant();
    if (tenantId === null || !this.canSendRequest()) return;
    this.sending.set(true);
    this.error.set(null);
    this.notice.set(null);
    const message = this.requestMessage().trim();
    this.client
      .request({
        tenantId,
        roleTemplateCode: 'SECRETARY',
        ...(message === '' ? {} : { message }),
        items: targetsOf(this.requestSelection()),
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.requestSelection.set(EMPTY_SELECTION);
          this.requestMessage.set('');
          this.notice.set('Solicitud enviada. El hospital o el doctor la acepta o la rechaza.');
          this.tab.set(MY_SUPPORT_TABS.requests);
          this.reload();
        },
        error: (failure: unknown) => {
          this.sending.set(false);
          this.error.set(supportFailureMessage(failure));
        },
      });
  }

  private act(link: SupportLink, operation: Observable<SupportLink>, ok: string, refreshSession = false): void {
    if (this.busyId() !== null) return;
    this.busyId.set(link.id);
    this.error.set(null);
    this.notice.set(null);
    operation.subscribe({
      next: () => {
        this.busyId.set(null);
        this.notice.set(ok);
        if (refreshSession) {
          // El hospital entra a los `tenants` del token recién al renovarlo.
          this.auth.restoreSession().subscribe(() => this.reload());
        } else {
          this.reload();
        }
      },
      error: (failure: unknown) => {
        this.busyId.set(null);
        this.error.set(supportFailureMessage(failure));
      },
    });
  }
}
