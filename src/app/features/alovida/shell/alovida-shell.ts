/* ============================================================================
    Marco de sesión de ALOVIDA: nav lateral + header + la pantalla adentro.

    En la bóveda este marco está copiado en las 111 maquetas de sesión, con el
    submenú de su módulo desplegado a mano en cada archivo. Acá va una sola vez
    y el submenú se resuelve contra la URL: el módulo activo es el primer
    segmento, y sus secciones salen de alovida-nav.data.ts, que se genera desde
    esas mismas maquetas.

    El orden de los diez módulos del nav es el de la bóveda y es normativo: se
    lee de arriba abajo como el recorrido de la plataforma, así que no se
    ordena alfabéticamente ni se esconden los que todavía no tienen pantallas.
    ========================================================================== */

import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { AlovidaThemeToggleDirective } from '@core/alovida/alovida-theme-toggle.directive';

import { MODULO_POR_SEGMENTO, type SeccionAlovida } from '../alovida-nav.data';
import { AlovidaDesignNotice } from './alovida-design-notice';

/** Un módulo tal como aparece en el nav: rótulo, icono, y a qué segmento va. */
interface EntradaNav {
  readonly rotulo: string;
  readonly icono: string;
  readonly segmento: string;
}

const SIN_SECCIONES: readonly SeccionAlovida[] = [];

@Component({
  selector: 'app-alovida-shell',
  imports: [
    NgTemplateOutlet,
    AlovidaDesignNotice,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AlovidaThemeToggleDirective,
  ],
  templateUrl: './alovida-shell.html',
  host: {
    /* Los dos desplegables del header se cierran al tocar fuera. Va acá y no
       en AlovidaRuntimeService porque estos dos los gobierna una señal, no el
       atributo `hidden`: el oyente global de los menús de la maqueta está
       acotado a `.menu-anclaje` justamente para no pisarse con casos así. */
    '(document:click)': 'alCerrarFuera($event)',
    '(document:keydown.escape)': 'cerrarDesplegables()',
  },
})
export class AlovidaShell {
  private readonly router = inject(Router);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Los diez módulos del nav, en el orden de la bóveda. */
  readonly navegacion: readonly EntradaNav[] = [
    { rotulo: 'Inicio', icono: 'inicio', segmento: 'inicio' },
    { rotulo: 'Identidad y accesos', icono: 'accesos', segmento: 'accesos' },
    { rotulo: 'Datos compartidos', icono: 'datos', segmento: 'datos-compartidos' },
    { rotulo: 'Terminología', icono: 'terminologia', segmento: 'terminologia' },
    { rotulo: 'Organizaciones', icono: 'organizaciones', segmento: 'directorio' },
    { rotulo: 'Personas', icono: 'personas', segmento: 'personas' },
    { rotulo: 'Agenda', icono: 'agenda', segmento: 'agenda' },
    { rotulo: 'Historia clínica', icono: 'historia', segmento: 'historia-clinica' },
    { rotulo: 'Facturación', icono: 'facturacion', segmento: 'facturacion' },
    { rotulo: 'Auditoría', icono: 'auditoria', segmento: 'auditoria' },
  ];

  /** Primer segmento de la URL: es el módulo que se está mirando. */
  readonly segmentoActivo = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.primerSegmento()),
      startWith(this.primerSegmento()),
    ),
    { initialValue: '' },
  );

  /* Identidad de la sesión. Hoy son los valores con los que está maquetada la
     bóveda; cuando el marco se enganche a la sesión real, se reemplazan por lo
     que devuelva el servicio y la plantilla no cambia.

     Llevan «(ejemplo)» desde el carril 01 y no es cosmética: estas rutas NO
     pasan por `authGuard`, así que el marco anunciaba una sesión abierta a
     quien no tiene ninguna. Un recorte de pantalla de esto era indistinguible
     del producto, que es justo lo que la corrección #7 prohíbe. El aviso de
     `AlovidaDesignNotice` lo dice en el cuerpo; esto lo dice también en el
     encabezado, que es lo que entra en una captura. */
  readonly organizacion = signal('Clínica Los Olivos · La Paz (ejemplo)');
  readonly sesion = signal('Rocío Salazar · Administración de seguridad (ejemplo)');
  readonly sinLeer = signal(3);

  readonly iniciales = computed(() =>
    this.sesion()
      .split('·')[0]
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join(''),
  );

  /* --------------------------------------------- los dos menús del header

     En la maqueta el selector de organización y la campana son dibujos: un
     botón con su flecha y un puntito rojo, sin nada detrás. Aparecen en las
     111 pantallas de sesión, así que eran los dos botones muertos más vistos
     de la rama.

     Lo que muestran sigue siendo el ejemplo con el que está maquetada la
     bóveda —y lo dicen, como el resto del marco—: acá no hay sesión, y un
     desplegable que fingiera organizaciones reales sería exactamente lo que
     prohíbe la corrección #7. Lo que se arregla es que el control responda y
     anuncie su estado, no que invente datos. */

  /** Cuál de los dos desplegables del header está abierto, si alguno. */
  readonly desplegable = signal<'organizacion' | 'avisos' | null>(null);

  readonly organizaciones: readonly string[] = [
    'Clínica Los Olivos · La Paz (ejemplo)',
    'Sucursal Miraflores (ejemplo)',
    'Sucursal El Alto (ejemplo)',
  ];

  readonly avisos: readonly string[] = [
    'Tres accesos clínicos caducan esta semana (ejemplo)',
    'Una organización hija espera verificación (ejemplo)',
    'La versión 2026-08 del catálogo quedó publicada (ejemplo)',
  ];

  alternarDesplegable(cual: 'organizacion' | 'avisos'): void {
    this.desplegable.update((abierto) => (abierto === cual ? null : cual));
  }

  cerrarDesplegables(): void {
    this.desplegable.set(null);
  }

  elegirOrganizacion(nombre: string): void {
    this.organizacion.set(nombre);
    this.cerrarDesplegables();
  }

  /** Un clic en cualquier parte que no sea el header cierra lo que esté abierto. */
  alCerrarFuera(evento: Event): void {
    if (!this.desplegable()) {
      return;
    }
    const objetivo = evento.target as Node | null;
    const header = this.anfitrion.nativeElement.querySelector('.app-header__derecha');
    if (objetivo && header?.contains(objetivo)) {
      return;
    }
    this.cerrarDesplegables();
  }

  seccionesDe(segmento: string): readonly SeccionAlovida[] {
    return MODULO_POR_SEGMENTO.get(segmento)?.secciones ?? SIN_SECCIONES;
  }

  private primerSegmento(): string {
    return this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
  }
}
