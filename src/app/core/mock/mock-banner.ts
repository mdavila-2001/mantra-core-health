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
    /* En escritorio, abajo a la izquierda: sobre el pie del menú lateral,
       que es la única franja que ninguna pantalla usa. Arriba a la derecha
       quedaba encima del contenido —tapaba la portada del panel del paciente
       (propietario, 27/10/2026)— y abajo a la derecha, el campo de síntomas.
       En angosto se conserva la ubicación responsive existente. */
    .mock {
      position: fixed;
      inset-inline-start: 12px;
      inset-inline-end: auto;
      inset-block-start: auto;
      inset-block-end: 12px;
      z-index: 9999;
      max-inline-size: 22rem;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--brand-primary);
      color: var(--text-inverse);
      font: 12px/1.4 system-ui, sans-serif;
      box-shadow: var(--shadow-lg);
    }
    .mock__corto { display: none; }
    /* Plegado entra en el ancho del menú lateral (240 px): no se mete en el
       contenido. */
    .mock--plegado .mock__boton {
      padding: 5px 9px;
      font-size: 11px;
    }
    /* En angosto no hay esquina libre abajo: el chat clava ahí el campo de
       escribir de borde a borde y el cartel lo tapaba. Se va arriba, bajo el
       header de la aplicación, y a la derecha, que es la franja que las
       cabeceras dejan vacía. Achicado: en 390 px dos pastillas grandes son un
       cuarto del ancho. */
    @media (max-width: 60rem) {
      /* Plegado: bajo el header, no adentro. Vivió pegado a la barra de
         arriba —112 px de margen calculado para esquivar la hamburguesa y la
         flecha de «Volver»— hasta que N-01 (2026-09-22) le agregó Tutoriales
         y Chats a la cabecera: seis íconos a la derecha ya no dejan ese hueco
         libre a 375 px, y el cartel les quedaba encima. Un offset fijo en
         píxeles no sobrevive a que la cabecera siga creciendo, así que baja
         del header entero —el mismo lugar donde ya vivía el panel abierto—
         en vez de perseguir el próximo hueco.

         Plegado va a la DERECHA y sin ocupar el ancho completo (doble
         revisión, H4.S1.M5): a la izquierda tapaba el título de la pantalla
         («Hola, Ana Lucía…» en el panel del paciente) — hallazgo real de la
         primera versión de este arreglo. A la derecha, bajo el header, no hay
         título de pantalla en ninguna de las rutas recorridas. */
      .mock {
        inset-inline-start: auto;
        inset-inline-end: 8px;
        inset-block-start: calc(var(--h-header, 56px) + 8px);
        inset-block-end: auto;
        max-inline-size: calc(100vw - 16px);
      }
      /* Abierto, el panel baja del header y ocupa el ancho completo: ahí sí
         hace falta el espacio para el texto y la lista de cuentas. */
      .mock:not(.mock--plegado) {
        inset-inline-start: 8px;
      }
      .mock--plegado {
        inset-block-start: calc(var(--h-header, 56px) + 2px);
      }
      .mock__boton {
        padding: 5px 10px;
        font-size: 11px;
      }
      .mock--plegado .mock__boton {
        padding: 2px 8px;
        font-size: 10px;
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
    @media (max-width: 640px) {
      /* En teléfono, el título y su bajada ocupan el primer bloque debajo del
         header. Esta franja separa esa presentación de las secciones de cada
         pantalla y mantiene la pastilla fuera de ambos. */
      .mock,
      .mock--plegado {
        inset-block-start: calc(var(--h-header, 56px) + 180px);
      }
    }
    @media (max-width: 360px) {
      /* En el ancho mínimo título y bajada envuelven más líneas. */
      .mock,
      .mock--plegado {
        inset-block-start: calc(var(--h-header, 56px) + 204px);
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
    rol: u.roles[0] === 'PRACTITIONER' ? 'médica' : u.roles[0] === 'PATIENT' ? 'paciente' : u.roles[0] === 'SUPERADMIN' ? 'superadmin' : u.roles[0] === 'MEDICAL_VISITOR' ? 'visitador médico' : 'administrador',
  }));
}

