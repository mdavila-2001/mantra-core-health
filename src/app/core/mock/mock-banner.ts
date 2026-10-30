import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MOCK_USERS } from './mock-session';

/**
 * El aviso de la rama `mockup`: recuerda que no hay API detrás y muestra las
 * cuentas con las que se puede entrar (cualquier contraseña sirve).
 */
@Component({
  selector: 'app-mock-banner',
  imports: [RouterLink],
  template: `
    <aside class="mock" [class.mock--plegado]="plegado()" aria-label="Modo de demostración">
      <div class="mock__botones">
        <button
          type="button"
          class="mock__boton"
          [attr.aria-label]="plegado() ? 'Datos de prueba' : 'Ocultar'"
          (click)="plegado.set(!plegado())"
        >
          @if (plegado()) {
            <span class="mock__largo">Datos de prueba</span><span class="mock__corto" aria-hidden="true">Demo</span>
          } @else {
            Ocultar
          }
        </button>
        <!-- El acceso al stock de componentes. Vive acá y no en el menú porque
             el panel ya está en todas las pantallas y no pide sesión: se llega
             desde donde uno esté, que es como se usa una herramienta. -->
        <a class="mock__boton mock__boton--stock" routerLink="/design-system/stock">
          Ver componentes
        </a>
      </div>
      @if (!plegado()) {
        <p class="mock__texto">
          <strong>Modo demo:</strong> sin backend. Todo lo que ve sale de datos de prueba en memoria y
          los cambios duran mientras dure la pestaña. Cualquier contraseña sirve.
        </p>
        <p class="mock__texto">
          <strong>Ver componentes</strong> abre el stock: los 444 componentes del proyecto, uno por
          uno, montados con datos generados y con lo que cada uno tiene mal.
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
    /* El aviso no flota: va al final de la página, alineado a la derecha.
       Fijo no había rincón que no tapara algo —arriba a la derecha la
       portada del panel (propietario, 27/10/2026), abajo a la izquierda el
       menú lateral, abajo a la derecha el campo de síntomas, en el teléfono
       el del chat— y cada offset calculado se rompía cuando la cabecera o la
       portada crecían. En el flujo no tapa nada por construcción; se llega a
       él desplazando hasta abajo, que para una herramienta de demo alcanza.
       «fit-content» y margen automático: ocupa sólo su ancho, a la derecha,
       lejos del menú lateral. */
    :host {
      display: block;
    }
    .mock {
      inline-size: fit-content;
      max-inline-size: min(22rem, calc(100% - 24px));
      margin: 8px 12px 12px auto;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--brand-primary);
      color: var(--text-inverse);
      font: 12px/1.4 system-ui, sans-serif;
      box-shadow: var(--shadow-lg);
    }
    .mock__corto { display: none; }
    .mock--plegado .mock__boton {
      padding: 5px 9px;
      font-size: 11px;
    }
    /* En angosto: pastillas más chicas, y plegado dice «Demo». */
    @media (max-width: 60rem) {
      .mock__boton {
        padding: 5px 10px;
        font-size: 11px;
      }
      /* Plegado dice «Demo»: es lo que basta para saber que el modo está
         encendido. */
      .mock__largo { display: none; }
      .mock__corto { display: inline; }
      /* El stock de componentes es una herramienta de escritorio. */
      .mock--plegado .mock__boton--stock {
        display: none;
      }
    }
    .mock--plegado {
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    .mock__botones {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .mock__boton {
      border: 0;
      border-radius: 999px;
      padding: 6px 12px;
      background: #f59e0b;
      color: #111827;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
    }
    .mock__boton:hover {
      filter: brightness(0.94);
    }
    .mock__boton:focus-visible {
      outline: 3px solid #fff;
      outline-offset: 3px;
      box-shadow: 0 0 0 5px #111827;
    }
    .mock__boton--stock {
      background: #38bdf8;
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
  /**
   * En backend real el banner de datos de prueba / demo se desactiva completamente.
   */
  protected readonly activo = false;
  protected readonly plegado = signal(true);
  protected readonly cuentas = MOCK_USERS.map((u) => ({
    email: u.email,
    rol: u.roles[0] === 'PRACTITIONER' ? 'médica' : u.roles[0] === 'PATIENT' ? 'paciente' : u.roles[0] === 'SUPERADMIN' ? 'superadmin' : u.roles[0] === 'MEDICAL_VISITOR' ? 'visitador médico' : u.roles[0] === 'PHARMACY_STAFF' ? 'mostrador de farmacia' : 'administrador',
  }));
}

