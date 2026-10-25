import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../core/navigation/navigation.types';
import { seccionRolesGuard } from '../../core/navigation/section-roles.guard';
import { ErrorRecovery } from '../error-recovery/error-recovery';

/**
 * Las pantallas de grupos médicos (FT-21), para `app.routes.ts`.
 *
 * Viven en su propio archivo porque `app.routes.ts` tiene un techo de líneas
 * (`check-max-lines`) que no se sube. Si un fragmento no se descarga se muestra
 * la recuperación, que ofrece recargar (mismo criterio que `chunkFallido`).
 *
 * Los roles salen de la sección `schedule/medical-groups` del registro
 * (`navigation.map.ts`): `seccionRolesGuard` resuelve la sección por la
 * coincidencia más larga, así que el alta y la ficha heredan los de
 * `MedicalGroupsController` sin repetirlos. El guard sólo evita la pantalla
 * vacía; la autoridad es la API.
 *
 * **El orden importa:** `new` va antes que `:groupId`, que si no se lo tragaría.
 */
const recovery = (): Type<unknown> => ErrorRecovery;

export const MEDICAL_GROUPS = {
  /** La sección del listado: la pinta el registro, que pide este cargador. */
  list: (): Promise<Type<unknown>> =>
    import('./medical-groups-list').then((m) => m.MedicalGroupsList).catch(recovery),

  /** El alta y la ficha, que no son entradas de menú. */
  screens: [
    {
      path: 'schedule/medical-groups/new',
      title: `${APP_TITLE} - Nuevo grupo médico`,
      canActivate: [seccionRolesGuard],
      loadComponent: () =>
        import('./medical-group-form').then((m) => m.MedicalGroupForm).catch(recovery),
    },
    {
      path: 'schedule/medical-groups/:groupId',
      title: `${APP_TITLE} - Grupo médico`,
      canActivate: [seccionRolesGuard],
      loadComponent: () =>
        import('./medical-group-detail').then((m) => m.MedicalGroupDetail).catch(recovery),
    },
  ] satisfies Routes,
} as const;
