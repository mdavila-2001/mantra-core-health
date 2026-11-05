import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type {
  DiagnosticAccreditation,
  DiagnosticEquipment,
  DiagnosticUnitDetail,
} from '../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { SectionHeading } from '../../../../shared/components/molecules/section-heading/section-heading';
import { formatDate, isOperational } from '../study-format';

/** Which collection of the unit this grid draws. */
export type FacilityKind = 'equipment' | 'sites' | 'accreditations';

/**
 * The equipment, sites or accreditations of a diagnostic unit, as cards of the
 * shared grid: what explains the catalogue, behind the Studies tab.
 */
@Component({
  selector: 'app-lab-facility-grid',
  imports: [Badge, NavIcon, SectionHeading],
  templateUrl: './facility-grid.html',
  styleUrls: ['../../../../shared/styles/card-grid.css', '../../../../shared/styles/public-sheet.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabFacilityGrid {
  readonly kind = input.required<FacilityKind>();
  readonly unit = input.required<DiagnosticUnitDetail>();

  protected readonly date = formatDate;

  /** Manufacturer and model on one line, or `null` if neither was declared. */
  protected model(equipment: DiagnosticEquipment): string | null {
    const model = [equipment.manufacturer, equipment.model].filter((part) => !!part).join(' ');
    return model === '' ? null : model;
  }

  /** Status tone: three known cases, anything else `info` (no meaning nobody decided). */
  protected statusTone(code: string): BadgeVariant {
    if (isOperational(code)) return 'success';
    if (code === 'MAINTENANCE') return 'warning';
    if (code === 'OUT_OF_SERVICE') return 'error';
    return 'info';
  }

  /** «Vigente del 13/08/2025 al 13/08/2027», with whatever dates exist. */
  protected validity(accreditation: DiagnosticAccreditation): string | null {
    const from = formatDate(accreditation.validFrom);
    const to = formatDate(accreditation.validTo);
    if (from !== null && to !== null) return `Vigente del ${from} al ${to}`;
    if (to !== null) return `Vigente hasta el ${to}`;
    if (from !== null) return `Vigente desde el ${from}`;
    return null;
  }

  /** The site name, only when the centre has more than one: otherwise it tells nothing. */
  protected siteIfSeveral(siteId: string | null): string | null {
    const sites = this.unit().sites;
    if (sites.length < 2 || siteId === null) return null;
    return sites.find((site) => site.id === siteId)?.name ?? null;
  }
}
