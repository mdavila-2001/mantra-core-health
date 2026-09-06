import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { MOCK_USERS } from './mock-session';

/**
 * El aviso de la rama `mockup`: recuerda que no hay API detrás y muestra las
 * cuentas con las que se puede entrar (cualquier contraseña sirve).
 */
@Component({
  selector: 'app-mock-banner',
  template: `
    <aside class="mock" [class.mock--plegado]="plegado()" aria-label="Modo de demostración">
      <button type="button" class="mock__boton" (click)="plegado.set(!plegado())">
        {{ plegado() ? 'Datos de prueba' : 'Ocultar' }}
      </button>
      @if (!plegado()) {
        <p class="mock__texto">
          <strong>Rama mockup:</strong> sin backend. Todo lo que ves sale de datos de prueba en memoria y
          los cambios duran mientras dure la pestaña. Cualquier contraseña sirve.
        </p>
        <ul class="mock__cuentas">
          @for (cuenta of cuentas; track cuenta.email) {
            <li><code>{{ cuenta.email }}</code> · {{ cuenta.rol }}</li>
          }
        </ul>
      }
    </aside>
  `,
  styles: `
    .mock {
      position: fixed;
      inset-inline-end: 12px;
      inset-block-end: 12px;
      z-index: 9999;
      max-inline-size: 22rem;
      padding: 10px 12px;
      border-radius: 10px;
      background: #1f2937;
      color: #f9fafb;
      font: 12px/1.4 system-ui, sans-serif;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
    }
    .mock--plegado {
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    .mock__boton {
      border: 0;
      border-radius: 999px;
      padding: 6px 12px;
      background: #f59e0b;
      color: #111827;
      font-weight: 600;
      cursor: pointer;
    }
    .mock__texto {
      margin: 10px 0 6px;
    }
    .mock__cuentas {
      margin: 0;
      padding-inline-start: 16px;
    }
    code {
      font-family: ui-monospace, monospace;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockBanner {
  protected readonly plegado = signal(true);
  protected readonly cuentas = MOCK_USERS.map((u) => ({
    email: u.email,
    rol: u.roles[0] === 'PRACTITIONER' ? 'médica' : u.roles[0] === 'PATIENT' ? 'paciente' : u.roles[0] === 'SUPERADMIN' ? 'superadmin' : u.roles[0] === 'MEDICAL_VISITOR' ? 'visitador médico' : 'administrador',
  }));
}
