import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MOCK_USERS } from './mock-session';
import { environment } from '../../../environments/environment';

/**
 * El aviso de la rama `mockup`: recuerda que no hay API detrás y muestra las
 * cuentas con las que se puede entrar (cualquier contraseña sirve).
 */
@Component({
  selector: 'app-mock-banner',
  imports: [RouterLink],
  template: ``,

  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockBanner {
  /**
   * En backend real el banner de datos de prueba / demo se desactiva completamente.
   */
  protected readonly activo = false;
  protected readonly plegado = signal(true);
  protected readonly cuentas = MOCK_USERS.map((u) => ({
    email: u.email,
    rol: u.roles[0] === 'PRACTITIONER' ? 'médica' : u.roles[0] === 'PATIENT' ? 'paciente' : u.roles[0] === 'SUPERADMIN' ? 'superadmin' : u.roles[0] === 'MEDICAL_VISITOR' ? 'visitador médico' : 'administrador',
  }));
}

