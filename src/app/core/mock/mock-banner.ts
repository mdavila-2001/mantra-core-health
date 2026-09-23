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
          <strong>Rama mockup:</strong> sin backend. Todo lo que ves sale de datos de prueba en memoria y
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
    /* Abajo a la IZQUIERDA, pegado al borde del contenido.

       Estaba abajo a la derecha, que es exactamente donde el chat clava su
       botón de enviar: el cartel se lo comía y en la maqueta no se podía
       mandar un mensaje. Es la única esquina que una pantalla puede reclamar
       —una acción fija al pie va a la derecha—, así que el cartel se corre.

       Se apoya después del menú para no taparle los ítems; en angosto, donde
       el menú no está fijo, vuelve al borde. */
    .mock {
      position: fixed;
      inset-inline-start: calc(var(--w-nav, 264px) + 12px);
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
    .mock__corto { display: none; }
    /* En angosto no hay esquina libre abajo: el chat clava ahí el campo de
       escribir de borde a borde y el cartel lo tapaba. Se va arriba, bajo el
       header de la aplicación, y a la derecha, que es la franja que las
       cabeceras dejan vacía. Achicado: en 390 px dos pastillas grandes son un
       cuarto del ancho. */
    @media (max-width: 60rem) {
      /* Plegado: una sola pastilla dentro de la barra de arriba, a la derecha
         de la hamburguesa, que es el único hueco que ninguna pantalla usa.
         Bajo el header tapaba el nombre de la conversación. */
      .mock {
        inset-inline-start: 60px;
        inset-inline-end: auto;
        inset-block-start: 14px;
        inset-block-end: auto;
        max-inline-size: calc(100vw - 16px);
      }
      /* Abierto, el panel baja del header y ocupa el ancho. */
      .mock:not(.mock--plegado) {
        inset-inline-start: 8px;
        inset-inline-end: 8px;
        inset-block-start: calc(var(--h-header, 64px) + 8px);
      }
      .mock__boton {
        padding: 5px 10px;
        font-size: 11px;
      }
      /* Plegado en angosto dice «Demo»: la pastilla completa (114 px) tapaba el
         final del saludo de la pantalla («…Pérez»); la corta (≈50 px) no llega. */
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
  protected readonly plegado = signal(true);
  protected readonly cuentas = MOCK_USERS.map((u) => ({
    email: u.email,
    rol: u.roles[0] === 'PRACTITIONER' ? 'médica' : u.roles[0] === 'PATIENT' ? 'paciente' : u.roles[0] === 'SUPERADMIN' ? 'superadmin' : u.roles[0] === 'MEDICAL_VISITOR' ? 'visitador médico' : 'administrador',
  }));
}
