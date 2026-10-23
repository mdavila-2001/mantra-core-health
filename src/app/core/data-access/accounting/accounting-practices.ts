import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { SessionStore } from '../../auth/session.store';
import { PracticeSitesClient } from '../practice-sites/practice-sites.client';
import { ROLE_ASSIGNMENT_STATUS } from '../practice-sites/role-assignment-concepts';
import { AccountingClient } from './accounting.client';
import type { Practice } from './accounting.types';
import { empty } from '../../view-state/view-state';

/**
 * S3 de las pantallas de contabilidad cuando el usuario no tiene ninguna
 * práctica activa: dice qué falta y adónde ir, en vez de un esqueleto de carga
 * que no termina.
 */
export const NO_ACTIVE_PRACTICE = empty(
  { label: 'Agregar lugar de atención', route: '/my-account/edit', queryParams: { pestana: '3' } },
  'Todavía no tiene un lugar de atención activo. Cuando agregue su consultorio o lo aprueben en una organización, acá va a ver su contabilidad.',
);

/**
 * Las prácticas cuya contabilidad el usuario puede leer.
 *
 * `GET /practices` devuelve **todas** las prácticas de la organización activa.
 * Un médico que todavía no tiene consultorio propio vive en la organización
 * compartida, así que esa lista trae prácticas de otras personas. Las pantallas
 * de contabilidad tomaban la primera y la API respondía 422 («El profesional no
 * tiene una vinculación activa con esa práctica»): cuatro pantallas en error
 * para cualquier médico nuevo (auditoría contra la API real, 2026-10-23).
 *
 * Acá se aplica **la misma regla** que la API (`assertPracticeAccess` en
 * `accounting-read.service.ts`):
 * - `SECURITY_ADMIN` o `ACCOUNTING_APPROVER` → todas las prácticas;
 * - sin rol `PRACTITIONER` → todas (la API no filtra);
 * - `PRACTITIONER` → sólo las prácticas con una vinculación **activa**.
 *
 * La autorización sigue siendo de la API; esto sólo evita ofrecer en pantalla una
 * práctica que la API va a rechazar.
 */
@Injectable({ providedIn: 'root' })
export class AccountingPractices {
  private readonly accounting = inject(AccountingClient);
  private readonly sites = inject(PracticeSitesClient);
  private readonly session = inject(SessionStore);

  list(): Observable<readonly Practice[]> {
    const roles = this.session.roles();
    const seesEveryPractice =
      roles.includes('SECURITY_ADMIN') ||
      roles.includes('ACCOUNTING_APPROVER') ||
      !roles.includes('PRACTITIONER');
    if (seesEveryPractice) return this.accounting.listPractices();

    return forkJoin([this.accounting.listPractices(), this.sites.listMyRoleAssignments()]).pipe(
      map(([practices, assignments]) => {
        const active = new Set(
          assignments
            .filter((assignment) => assignment.status === ROLE_ASSIGNMENT_STATUS.ACTIVE)
            .map((assignment) => assignment.practiceId),
        );
        return practices.filter((practice) => active.has(practice.id));
      }),
    );
  }
}
