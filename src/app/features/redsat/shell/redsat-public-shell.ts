/* ============================================================================
    Marco público de REDSAT: el que ve alguien sin sesión.

    Cubre las 14 pantallas del buscador (V65). No hay nav lateral porque no hay
    organización activa todavía, y el pie con las cuatro declaraciones —quién
    paga, qué precio, qué no es diagnóstico, qué está verificado— va acá y no
    en cada vista: la ficha de la bóveda lo exige en TODA pantalla pública, y
    repetirlo por pantalla es garantizar que en alguna falte.
    ========================================================================== */

import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { RedsatThemeToggleDirective } from '@core/redsat/redsat-theme-toggle.directive';

import { RedsatDesignNotice } from './redsat-design-notice';

@Component({
  selector: 'app-redsat-public-shell',
  imports: [RedsatDesignNotice, RouterLink, RouterOutlet, RedsatThemeToggleDirective],
  templateUrl: './redsat-public-shell.html',
})
export class RedsatPublicShell {
  private readonly router = inject(Router);

  /**
   * Manda lo escrito en el buscador del marco a la búsqueda unificada.
   *
   * ## Por qué es un `<form>` y no un `input` que navega al teclear
   *
   * Porque este buscador vive en el marco de **las catorce** pantallas
   * públicas, incluidas las fichas de perfil. Navegar al teclear sacaría a
   * alguien de la ficha que está leyendo en la primera letra que escriba.
   * Con un formulario, la búsqueda ocurre cuando la persona la pide —Enter o
   * el botón de búsqueda que el teclado móvil ya dibuja para `type="search"`—,
   * que además es lo que un lector de pantalla anuncia como tal.
   *
   * Va siempre a `/buscar` y no al vertical en el que se esté: quien escribe
   * en la caja del marco no está acotando la lista que ve, está empezando otra
   * búsqueda.
   */
  protected buscar(evento: Event): void {
    evento.preventDefault();
    const formulario = evento.target as HTMLFormElement;
    const q = new FormData(formulario).get('q');
    const texto = typeof q === 'string' ? q.trim() : '';
    void this.router.navigate(['/buscar'], {
      queryParams: { q: texto === '' ? null : texto },
    });
  }
}
