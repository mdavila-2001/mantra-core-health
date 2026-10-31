import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, PLATFORM_ID, signal, type OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { AccessChallengeCancelledError, withAccessChallenge } from '../../../core/access-challenge/access-challenge';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportEngagement } from '../../../core/data-access/support-access/support-access.types';
import type { SupportInboxPage } from '../../../core/data-access/support-access/support-inbox.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { failureMessage } from './failure-message';
import { InboxList } from './inbox-list';
import { InboxTabs, type InboxTabOption } from './inbox-tabs';
import {
  doctorsWithConversations,
  filterInbox,
  INBOX_TABS,
  INBOX_TAB_LABELS,
  sortInbox,
  tabCounts,
  tabOf,
  type InboxTab,
} from './inbox-model';
import { SupportConversationView } from './support-conversation';

const SIN_FILTRO = '';

/** Cada cuánto envejecen los plazos en pantalla: un minuto. */
const TICK_MS = 60_000;

const VACIO_POR_PESTANA: Readonly<Record<InboxTab, string>> = {
  NEW: 'No hay conversaciones nuevas. Cuando un paciente escriba, aparece acá.',
  MINE: 'No tiene conversaciones en curso. Tome una de «Nuevos».',
  TEAM: 'Nadie más del equipo tiene conversaciones en curso.',
  WAITING_DOCTOR: 'Ninguna conversación espera la respuesta de un doctor.',
  RESOLVED: 'Todavía no hay conversaciones resueltas.',
};

/**
 * La **bandeja** de la persona de apoyo: los mensajes que los pacientes mandan
 * a los doctores que cubre, para atenderlos en equipo.
 *
 * - Pestañas **Nuevos / Míos / Del equipo / Esperando al doctor / Resueltos**,
 *   filtro por doctor y, si trabaja en varias organizaciones, un selector de
 *   organización: solo ve las de la que la vinculó.
 * - Lo más atrasado va arriba; cada fila dice su plazo de respuesta y si venció.
 * - Una conversación la tiene **una** persona. «Tomar» la deja en sus manos; las
 *   demás ven quién la tiene.
 *
 * La API decide qué llega y quién la tiene; acá solo se ordena y se pinta.
 */
@Component({
  selector: 'app-support-inbox',
  imports: [Alert, Card, EmptyState, FormField, InboxList, InboxTabs, PageHeader, Select, SupportConversationView, ViewStateHost],
  templateUrl: './support-inbox.html',
  styleUrl: './support-inbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportInbox implements OnInit {
  private readonly support = inject(SupportAccessClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly organizaciones = signal<readonly SupportEngagement[]>([]);
  protected readonly organizacion = signal<string | null>(null);
  protected readonly pestana = signal<InboxTab>('NEW');
  protected readonly doctor = signal<string>(SIN_FILTRO);
  protected readonly state = signal<ViewState<SupportInboxPage>>(loading());
  protected readonly ahora = signal(new Date());
  protected readonly tomando = signal<string | null>(null);
  protected readonly fallo = signal<string | null>(null);
  protected readonly anuncio = signal('');

  /** La conversación abierta: vive en la dirección (`?c=`) para poder volver y compartirla. */
  protected readonly abierta = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('c'))), { initialValue: null });

  private readonly pagina = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });
  private readonly items = computed(() => this.pagina()?.items ?? []);
  protected readonly doctores = computed(() => this.pagina()?.doctors ?? []);

  protected readonly cuentas = computed(() => tabCounts(this.items()));
  protected readonly opcionesDePestana = computed<readonly InboxTabOption[]>(() =>
    INBOX_TABS.map((value) => ({ value, label: INBOX_TAB_LABELS[value], count: this.cuentas()[value] })),
  );
  protected readonly opcionesDeOrganizacion = computed<readonly SelectOption<string>[]>(() =>
    this.organizaciones().map((v) => ({ value: v.tenantId, label: v.organizationName })),
  );
  protected readonly opcionesDeDoctor = computed<readonly SelectOption<string>[]>(() => [
    { value: SIN_FILTRO, label: 'Todos los doctores' },
    ...doctorsWithConversations(this.doctores(), this.items()).map((d) => ({ value: d.practitionerProfileId, label: d.name })),
  ]);
  protected readonly nombreDeLaOrganizacion = computed(() => this.organizaciones().find((v) => v.tenantId === this.organizacion())?.organizationName ?? '');

  protected readonly visibles = computed(() => sortInbox(filterInbox(this.items(), { tab: this.pestana(), doctor: this.doctor() }), this.ahora()));
  protected readonly textoVacio = computed(() => (this.doctor() === SIN_FILTRO ? VACIO_POR_PESTANA[this.pestana()] : 'No hay conversaciones de este doctor en esta pestaña.'));

  constructor() {
    if (this.isBrowser) {
      const reloj = setInterval(() => this.ahora.set(new Date()), TICK_MS);
      this.destroyRef.onDestroy(() => clearInterval(reloj));
    }
  }

  ngOnInit(): void {
    this.support.listMyEngagements().subscribe({
      next: ({ engagements }) => {
        const activos = engagements.filter((v) => v.status === 'ACTIVE');
        const unicos = activos.filter((v, i) => activos.findIndex((o) => o.tenantId === v.tenantId) === i);
        this.organizaciones.set(unicos);
        if (unicos.length === 0) {
          this.state.set(empty({ label: 'Vea «Mis accesos» para unirse a una organización', route: '/my-support' }, 'No tiene un vínculo de apoyo activo, así que no hay bandeja que atender.'));
          return;
        }
        this.organizacion.set(unicos[0]!.tenantId);
        this.cargar();
      },
      error: (failure: unknown) => this.state.set(errorToViewState<SupportInboxPage>(failure)),
    });
  }

  protected cargar(): void {
    const org = this.organizacion();
    if (org === null) return;
    this.state.set(loading());
    this.leer(org);
  }

  /** Releer sin tapar la lista con el esqueleto: se usa después de cada acción. */
  protected refrescar(): void {
    const org = this.organizacion();
    if (org !== null) this.leer(org);
  }

  private leer(org: string): void {
    this.support.getSupportInbox({ org }).subscribe({
      next: (pagina) => {
        this.state.set(ready(pagina));
        // Si la conversación abierta cambió de pestaña (la tomé, la derivé…), la pestaña la sigue.
        const abierta = pagina.items.find((i) => i.conversationId === this.abierta());
        if (abierta !== undefined) this.pestana.set(tabOf(abierta));
      },
      error: (failure: unknown) => this.state.set(errorToViewState<SupportInboxPage>(failure)),
    });
  }

  /* ---- controles ---------------------------------------------------------------- */

  protected elegirOrganizacion(id: string | null): void {
    if (id === null || id === this.organizacion()) return;
    this.organizacion.set(id);
    this.doctor.set(SIN_FILTRO);
    this.pestana.set('NEW');
    this.cerrar();
    this.cargar();
  }

  protected elegirPestana(pestana: InboxTab): void {
    this.pestana.set(pestana);
  }

  protected elegirDoctor(id: string | null): void {
    this.doctor.set(id ?? SIN_FILTRO);
  }

  protected abrir(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { c: id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected cerrar(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { c: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** «Tomar» desde la lista: la conversación queda en sus manos y se abre. */
  protected tomar(id: string): void {
    const item = this.items().find((i) => i.conversationId === id);
    if (item === undefined || this.tomando() !== null) return;
    this.tomando.set(id);
    this.fallo.set(null);
    // Lo que la API pueda pedir antes de dejar tomarla (motivo, segundo paso, aprobación) se resuelve en un diálogo y se reintenta.
    const desafio = { context: withAccessChallenge({ actionLabel: `Tomar la conversación de ${item.patientLabel}`, approval: { tenantId: item.organizationId, atom: 'messages.conversation.assign' } }) };
    this.support.assignConversation(id, { practitionerProfileId: item.practitionerProfileId, status: 'TAKEN' }, desafio).subscribe({
      next: () => {
        this.tomando.set(null);
        this.anuncio.set('Conversación tomada.');
        this.toasts.success('La conversación quedó a su nombre.', 'Conversación tomada');
        this.abrir(id);
        this.refrescar();
      },
      error: (failure: unknown) => {
        this.tomando.set(null);
        this.fallo.set(failure instanceof AccessChallengeCancelledError ? 'No se tomó la conversación: usted canceló el paso adicional que se pedía.' : failureMessage(failure));
        this.refrescar();
      },
    });
  }
}
