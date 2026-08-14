/* ============================================================================
    Marco de sesión de REDSAT: nav lateral + header + la pantalla adentro.

    En la bóveda este marco está copiado en las 111 maquetas de sesión, con el
    submenú de su módulo desplegado a mano en cada archivo. Acá va una sola vez
    y el submenú se resuelve contra la URL: el módulo activo es el primer
    segmento, y sus secciones salen de redsat-nav.data.ts, que se genera desde
    esas mismas maquetas.

    El orden de los diez módulos del nav es el de la bóveda y es normativo: se
    lee de arriba abajo como el recorrido de la plataforma, así que no se
    ordena alfabéticamente ni se esconden los que todavía no tienen pantallas.
    ========================================================================== */

import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { RedsatThemeToggleDirective } from '@core/redsat/redsat-theme-toggle.directive';

import { MODULO_POR_SEGMENTO, type SeccionRedsat } from '../redsat-nav.data';

/** Un módulo tal como aparece en el nav: rótulo, icono, y a qué segmento va. */
interface EntradaNav {
  readonly rotulo: string;
  readonly icono: string;
  readonly segmento: string;
}

const SIN_SECCIONES: readonly SeccionRedsat[] = [];

@Component({
  selector: 'app-redsat-shell',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    RedsatThemeToggleDirective,
  ],
  templateUrl: './redsat-shell.html',
})
export class RedsatShell {
  private readonly router = inject(Router);

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
     que devuelva el servicio y la plantilla no cambia. */
  readonly organizacion = signal('Clínica Los Olivos · La Paz');
  readonly sesion = signal('Rocío Salazar · Administración de seguridad');
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

  seccionesDe(segmento: string): readonly SeccionRedsat[] {
    return MODULO_POR_SEGMENTO.get(segmento)?.secciones ?? SIN_SECCIONES;
  }

  private primerSegmento(): string {
    return this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
  }
}
