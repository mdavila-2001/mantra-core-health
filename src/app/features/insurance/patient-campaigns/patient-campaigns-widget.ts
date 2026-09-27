import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  CAMPAIGN_PARTNER_TYPE_LABELS,
  copayBonusLabel,
} from '../../../core/data-access/insurance/insurance-campaign.labels';
import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  PatientCampaign,
  PatientCampaignPartner,
} from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Card } from '../../../shared/components/molecules/card/card';
import {
  CAMPAIGN_PARAM,
  CAMPAIGN_TITLE_PARAM,
  MIS_TURNOS_ROUTE,
} from '../../account/appointments/appointments.routes';

/**
 * Los parámetros con los que se abre «Agendar una cita» ya orientada a un
 * laboratorio. Son literales y no las constantes de `appointments.ts`
 * (`RESOURCE_PARAM`, `LAB_RESOURCE`) a propósito: esa pantalla es un chunk
 * diferido y este widget viaja en el bundle inicial del panel del paciente, así
 * que importarla la metería adentro. El spec del widget compara los dos para que
 * no se desincronicen.
 */
const SECTION_PARAM = 'seccion';
const SECTION_REQUEST = 'pedir';
const RESOURCE_PARAM = 'resource';
const LAB_RESOURCE = 'lab';
const PHARMACIES_ROUTE = '/pharmacies-directory';

/** Lo que el botón de una tarjeta dice y a dónde lleva. */
export interface CampaignAction {
  readonly label: string;
  readonly route: string;
  readonly queryParams: Readonly<Record<string, string>>;
}

/** El botón según el tipo de campaña: agendar un estudio, o canjear en una farmacia. */
export function campaignAction(campaign: PatientCampaign): CampaignAction {
  switch (campaign.campaignType) {
    case 'PHARMACY':
      return {
        label: 'Canjear en farmacia',
        route: PHARMACIES_ROUTE,
        queryParams: { [CAMPAIGN_PARAM]: campaign.code },
      };
    case 'DIAGNOSTIC_IMAGING':
      return {
        label: 'Agendar estudio',
        route: MIS_TURNOS_ROUTE,
        queryParams: {
          [SECTION_PARAM]: SECTION_REQUEST,
          [RESOURCE_PARAM]: LAB_RESOURCE,
          [CAMPAIGN_PARAM]: campaign.code,
          [CAMPAIGN_TITLE_PARAM]: campaign.title,
        },
      };
    case 'VACCINATION':
      return {
        label: 'Agendar vacunación',
        route: MIS_TURNOS_ROUTE,
        queryParams: {
          [SECTION_PARAM]: SECTION_REQUEST,
          [CAMPAIGN_PARAM]: campaign.code,
          [CAMPAIGN_TITLE_PARAM]: campaign.title,
        },
      };
    case 'LABORATORY':
    default:
      return {
        label: 'Agendar chequeo preventivo',
        route: MIS_TURNOS_ROUTE,
        queryParams: {
          [SECTION_PARAM]: SECTION_REQUEST,
          [RESOURCE_PARAM]: LAB_RESOURCE,
          [CAMPAIGN_PARAM]: campaign.code,
          [CAMPAIGN_TITLE_PARAM]: campaign.title,
        },
      };
  }
}

/** Días que quedan, contando hoy: el último día de vigencia todavía vale. */
export function daysLeft(validTo: Date, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((validTo.getTime() - today.getTime()) / 86_400_000) + 1;
}

/**
 * Beneficios preventivos de la aseguradora del afiliado (Tarea 4 · M-06).
 *
 * Vive en el panel del paciente y en la pestaña de seguros de «Mi cuenta». Sólo
 * llegan campañas activas, dentro de su vigencia y de la aseguradora de una
 * cobertura vigente propia: el filtro lo hace la API, no esta pantalla.
 *
 * ## Qué muestra cuando no hay nada
 *
 * Depende de dónde vive. En el panel principal, **nada**: una tarjeta que dice
 * «no hay campañas» es ruido en la primera pantalla de casi todos. En la
 * pestaña de seguros, donde la persona vino a mirar su seguro, sí dice que hoy no
 * hay (`emptyMessage`) y ofrece reintentar si la consulta falló.
 *
 * ## Qué no hace
 *
 * No agenda ni canjea: lleva a la pantalla que lo hace, con la campaña como
 * contexto. La patología que previene la campaña se muestra como descripción;
 * nunca se cruza con la historia clínica de quien la ve.
 */
@Component({
  selector: 'app-patient-campaigns-widget',
  imports: [AppButton, AppButtonLink, Badge, Card, DatePipe, RouterLink],
  templateUrl: './patient-campaigns-widget.html',
  styleUrl: './patient-campaigns-widget.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientCampaignsWidget {
  private readonly insurance = inject(InsuranceClient);

  /** Perfil del afiliado (claim `pid`). La API exige que sea el del titular. */
  readonly patientProfileId = input.required<string>();

  /**
   * Qué decir cuando no hay campañas o la consulta falla. Con `null` el widget
   * no ocupa lugar en esos casos (panel principal).
   */
  readonly emptyMessage = input<string | null>(null);

  protected readonly state = signal<ViewState<readonly PatientCampaign[]>>(loading());
  private readonly attempt = signal(0);

  protected readonly campaigns = computed<readonly PatientCampaign[]>(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : [];
  });

  /** ¿Hay algo que decir? En el panel principal, sólo si hay tarjetas. */
  protected readonly visible = computed(() => {
    const status = this.state().status;
    if (status === 'ready') return true;
    return this.emptyMessage() !== null && status !== 'loading';
  });

  protected readonly failed = computed(() => {
    const status = this.state().status;
    return status !== 'ready' && status !== 'loading' && status !== 'empty';
  });

  constructor() {
    effect((onCleanup) => {
      const profileId = this.patientProfileId();
      this.attempt();
      this.state.set(loading());
      const subscription = this.insurance.getActivePatientCampaigns(profileId).subscribe({
        next: (items) =>
          this.state.set(
            items.length > 0
              ? ready(items)
              : empty({ label: 'Ver mi seguro' }, 'Hoy tu seguro no tiene campañas activas.'),
          ),
        error: (error: unknown) =>
          this.state.set(errorToViewState<readonly PatientCampaign[]>(error)),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected retry(): void {
    this.attempt.update((value) => value + 1);
  }

  protected badgeLabel(campaign: PatientCampaign): string {
    return copayBonusLabel(campaign.copayBonusPercentage);
  }

  protected badgeTone(campaign: PatientCampaign): 'success' | 'info' {
    return campaign.copayBonusPercentage >= 100 ? 'success' : 'info';
  }

  protected actionOf(campaign: PatientCampaign): CampaignAction {
    return campaignAction(campaign);
  }

  /** Donde el afiliado se atiende: laboratorios, farmacias y centros aliados. */
  protected providersOf(campaign: PatientCampaign): readonly PatientCampaignPartner[] {
    return campaign.partners.filter((partner) => partner.role === 'PROVIDER');
  }

  /** Quién financia la campaña: importadoras y fabricantes de medicamentos. */
  protected sponsorsOf(campaign: PatientCampaign): readonly PatientCampaignPartner[] {
    return campaign.partners.filter((partner) => partner.role === 'SPONSOR');
  }

  protected partnerNames(partners: readonly PatientCampaignPartner[]): string {
    return partners.map((partner) => partner.name).join(', ');
  }

  protected partnerTypeLabel(partner: PatientCampaignPartner): string {
    return CAMPAIGN_PARTNER_TYPE_LABELS[partner.type];
  }

  protected remainingText(campaign: PatientCampaign): string {
    const days = daysLeft(campaign.validTo);
    if (days <= 1) return 'Último día';
    return `Quedan ${days} días`;
  }
}
