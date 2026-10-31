import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { deniedTenantMessage, tenantDenialHint } from '../../../core/data-access/iam/tenant-denial';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';

/**
 * **Aviso no bloqueante** de las organizaciones que no dejan actuar ahora a la persona: «La organización X no le permite
 * entrar ahora: motivo».
 *
 * La política de sesión de una organización rige solo en ella. Si una niega (horario, red, segundo factor, inactividad),
 * la persona entra igual a las demás y esa organización viene en `deniedTenants` del token, con su motivo. Acá se le
 * dice cuál y por qué, sin cerrarle nada: «Entendido» lo oculta hasta que el token traiga otra lista.
 *
 * El token no trae el **nombre** de las organizaciones que niegan (solo las que dejan entrar): se completa con
 * `GET /tenants/me`, y si no se puede leer, el aviso dice «una de sus organizaciones».
 */
@Component({
  selector: 'app-denied-tenants-banner',
  imports: [Alert, AppButton, AppButtonLink, RouterLink],
  templateUrl: './denied-tenants-banner.html',
  styleUrl: './denied-tenants-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeniedTenantsBanner {
  private readonly session = inject(SessionStore);
  private readonly directory = inject(DirectoryClient);

  private readonly nombres = signal<Readonly<Record<string, string>>>({});
  private readonly ocultaPara = signal<string | null>(null);

  protected readonly avisos = computed(() =>
    this.session.deniedTenants().map((d) => ({
      tenantId: d.tenantId,
      reason: d.reason,
      mensaje: deniedTenantMessage(this.nombres()[d.tenantId] ?? 'una de sus organizaciones', d.reason).replace('La organización una de sus organizaciones', 'Una de sus organizaciones'),
      indicacion: tenantDenialHint(d.reason),
    })),
  );

  /** La llave de lo que se está avisando: si el token trae otra lista, el aviso vuelve a salir. */
  private readonly llave = computed(() => this.session.deniedTenants().map((d) => `${d.tenantId}:${d.reason}`).join('|'));
  protected readonly visible = computed(() => this.avisos().length > 0 && this.ocultaPara() !== this.llave());
  protected readonly pideFactor = computed(() => this.avisos().some((a) => a.reason === 'MFA_ENROLLMENT_REQUIRED'));

  constructor() {
    effect(() => {
      const pendientes = this.session.deniedTenants();
      untracked(() => {
        if (pendientes.length === 0) return;
        this.directory.listMyOrganizations().subscribe({
          next: (lista) => this.nombres.set(Object.fromEntries(lista.map((o) => [o.id, o.tradeName ?? o.legalName]))),
          error: () => undefined,
        });
      });
    });
  }

  protected entendido(): void {
    this.ocultaPara.set(this.llave());
  }
}
