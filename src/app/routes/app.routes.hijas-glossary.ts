import type { Routes } from '@angular/router';
import { APP_TITLE } from '../core/navigation/navigation.types';
import { seccionRolesGuard } from '../core/navigation/section-roles.guard';
import { chunkFallido } from './chunk-fallido';

/**
 * Pantallas hijas de reserva de turnos (schedule) y vistas avanzadas del glosario médico.
 */
export const PANTALLAS_HIJAS_GLOSSARY: Routes = [
  {
    path: 'schedule/book/:slotId',
    title: `${APP_TITLE} - Reservar una cita`,
    data: { entrada: 'DESK' },
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/agenda/booking-new/booking-new')
        .then((m) => m.BookingNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/appointments/book/:slotId',
    title: `${APP_TITLE} - Pedir una cita`,
    data: { entrada: 'PORTAL' },
    loadComponent: () =>
      import('../features/agenda/booking-new/booking-new')
        .then((m) => m.BookingNew)
        .catch(() => chunkFallido()),
  },
  {
    path: 'glossary/anatomy-atlas',
    title: `${APP_TITLE} - Atlas anatómico 3D`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/glossary/glossary-anatomy-atlas')
        .then((m) => m.GlossaryAnatomyAtlas)
        .catch(() => chunkFallido()),
  },
  {
    path: 'glossary/graph',
    title: `${APP_TITLE} - Árbol de términos médicos`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/glossary/glossary-graph')
        .then((m) => m.GlossaryGraph)
        .catch(() => chunkFallido()),
  },
  {
    path: 'glossary/network',
    title: `${APP_TITLE} - Mapa de relaciones del glosario`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/glossary/glossary-network')
        .then((m) => m.GlossaryNetwork)
        .catch(() => chunkFallido()),
  },
  {
    path: 'glossary/compare',
    title: `${APP_TITLE} - Comparar términos del glosario`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/glossary/glossary-compare')
        .then((m) => m.GlossaryCompare)
        .catch(() => chunkFallido()),
  },
  {
    path: 'glossary/:conceptId',
    title: `${APP_TITLE} - Término del glosario`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/glossary/glossary-term')
        .then((m) => m.GlossaryTerm)
        .catch(() => chunkFallido()),
  },
];
