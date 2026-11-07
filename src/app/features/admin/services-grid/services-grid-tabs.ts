import type { ServicesGridKind } from '../../../core/data-access/admin-portal/services-grid.types';
import { empty } from '../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../core/view-state/view-state.types';

/** Static definition of a tab: label, column wording and the S3 empty state. */
export interface ServicesGridTab {
  readonly kind: ServicesGridKind;
  readonly label: string;
  readonly groupHeader: string;
  readonly codeHeader: string;
  readonly hasPrice: boolean;
  readonly source: string;
}

export const SERVICES_GRID_TABS: readonly ServicesGridTab[] = [
  { kind: 'doctor', label: 'Médico', groupHeader: 'Tipo de organización', codeHeader: 'Código', hasPrice: true, source: 'GET /admin/catalogs/services' },
  { kind: 'laboratory', label: 'Laboratorio', groupHeader: 'Clase', codeHeader: 'Código', hasPrice: true, source: 'GET /diagnostics/lab/services' },
  { kind: 'hospital', label: 'Hospital', groupHeader: '', codeHeader: '', hasPrice: false, source: '' },
  { kind: 'pharmacy', label: 'Farmacia / vademécum', groupHeader: 'Forma y concentración', codeHeader: 'Registro', hasPrice: false, source: 'GET /pharmacy/catalog-products' },
];

/** S3 per kind: the next action only points at screens that already exist. */
export function emptyStateFor(kind: ServicesGridKind): EmptyViewState {
  switch (kind) {
    case 'doctor':
      return empty(
        { label: 'Abrir el editor de catálogos', route: '/superadmin/catalog-editor' },
        'Ninguna práctica tiene servicios publicados todavía. Los servicios se cargan en el editor de catálogos.',
        'Sin servicios médicos',
      );
    case 'laboratory':
      return empty(
        { label: 'Abrir los precios del laboratorio', route: '/administration/laboratory-prices' },
        'Este laboratorio no tiene estudios publicados. Se cargan uno a uno o por importación desde los precios.',
        'Sin estudios de laboratorio',
      );
    default:
      return empty(
        { label: 'Cada farmacia pide las altas desde su portal' },
        'El registro de medicamentos está vacío: todavía no se importó ningún registro sanitario.',
        'Sin medicamentos en el vademécum',
      );
  }
}
