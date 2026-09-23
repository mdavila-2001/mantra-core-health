import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { CLINICAL_RECORD_ROUTE } from '../clinical-record.routes';

/**
 * **Solicitar vinculación** (FT-07-R05) — el paso que faltaba entre encontrar
 * a alguien en `/medical-records` y poder leer su expediente sin un turno
 * confirmado el mismo día.
 *
 * No concede nada: crea la solicitud (`POST /authz/care-relationships/request`)
 * y el backend avisa al paciente. Qué especialidades autoriza lo decide el
 * paciente desde su propia bandeja (FT-07-R06) — esta pantalla sólo pide, y
 * por eso no ofrece elegirlas acá.
 */
@Component({
  selector: 'app-request-access',
  imports: [Alert, AppButton, FormField, PageHeader, Textarea],
  templateUrl: './request-access.html',
  styleUrl: './request-access.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestAccess {
  private readonly authz = inject(AuthzClient);
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfilesClient);
  private readonly navigation = inject(NavigationService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly profileId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('profileId') ?? '')),
    { initialValue: '' },
  );

  protected readonly nombrePaciente = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Sin organización activa no hay a nombre de quién pedir: el contrato exige `tenantId`. */
  protected readonly sinOrganizacion = computed(() => this.auth.activeTenantId() === null);

  protected readonly puedeEnviar = computed(
    () => this.profileId() !== '' && !this.sinOrganizacion() && !this.enviando(),
  );

  constructor() {
    const id = this.profileId();
    if (id !== '') {
      this.profiles.getPatient(id).subscribe({
        next: (paciente) => this.nombrePaciente.set(paciente.displayName ?? null),
        error: () => this.nombrePaciente.set(null),
      });
    }
  }

  protected enviar(): void {
    const patientProfileId = this.profileId();
    const tenantId = this.auth.activeTenantId();
    if (patientProfileId === '' || tenantId === null) return;

    const motivo = this.motivo().trim();
    this.enviando.set(true);
    this.error.set(null);
    this.authz
      .requestCareRelationship({
        tenantId,
        patientProfileId,
        ...(motivo === '' ? {} : { reasonText: motivo }),
      })
      .subscribe({
        next: () => {
          this.toasts.success('Solicitud enviada. El paciente va a decidir qué áreas te autoriza.');
          void this.router.navigate([CLINICAL_RECORD_ROUTE]);
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          const http = err instanceof HttpErrorResponse ? err.status : 0;
          if (http === 403) {
            this.error.set('No tenés permiso para pedir este vínculo.');
          } else if (http === 409) {
            // El backend rechaza por duplicado: ya hay un vínculo activo o un
            // pedido sin responder con esta persona.
            this.error.set(
              'Ya existe una solicitud pendiente o un vínculo activo con este paciente.',
            );
          } else if (http === 412) {
            this.error.set('Tu cuenta no tiene un perfil profesional propio para pedir el vínculo.');
          } else {
            this.error.set('No se pudo enviar la solicitud. Probá de nuevo en un momento.');
          }
        },
      });
  }
}
