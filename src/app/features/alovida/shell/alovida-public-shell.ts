/* ============================================================================
    Marco público de ALOVIDA: el que ve alguien sin sesión.

    Cubre las 14 pantallas del buscador (V65). No hay nav lateral porque no hay
    organización activa todavía, y el pie con las cuatro declaraciones —quién
    paga, qué precio, qué no es diagnóstico, qué está verificado— va acá y no
    en cada vista: la ficha de la bóveda lo exige en TODA pantalla pública, y
    repetirlo por pantalla es garantizar que en alguna falte.
    ========================================================================== */

import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { PublicNavRail } from '@shared/components/organisms/public-nav-rail/public-nav-rail';
import { AlovidaThemeToggleDirective } from '@core/alovida/alovida-theme-toggle.directive';

import { AlovidaDesignNotice } from './alovida-design-notice';

@Component({
  selector: 'app-alovida-public-shell',
  imports: [
    PublicNavRail,
    AlovidaDesignNotice,
    RouterLink,
    RouterOutlet,
    AlovidaThemeToggleDirective,
  ],
  templateUrl: './alovida-public-shell.html',
})
export class AlovidaPublicShell {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /**
   * Si quien mira tiene sesión abierta.
   *
   * El marco nació para «alguien sin sesión» —lo dice su propio encabezado— y
   * esa suposición dejó de valer cuando el nav de la app empezó a enlazar a las
   * fichas públicas: las guías de clínicas y de farmacias viven DENTRO del
   * armazón autenticado, pero la ficha de cada una cuelga de `/o` y `/f`, que
   * son rutas públicas. El resultado era que abrir una clínica desde el menú
   * cambiaba de marco, ofrecía «Entrar» a quien ya había entrado, y el logo
   * llevaba al buscador público. La sesión nunca se perdía; todo lo que se veía
   * decía que sí.
   */
  protected readonly conSesion = this.auth.isAuthenticated;

  /**
   * A dónde vuelve la marca del encabezado.
   *
   * Con sesión, al panel —el mismo destino que `homeGuard` elige para la raíz—;
   * sin sesión, al buscador público. Antes iba siempre a `/search`, así que el
   * gesto más natural para volver era justamente el que sacaba de la app.
   */
  protected readonly rutaDeLaMarca = computed(() =>
    this.conSesion() ? '/dashboard' : '/search',
  );

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
   * Va siempre a `/search` y no al vertical en el que se esté: quien escribe
   * en la caja del marco no está acotando la lista que ve, está empezando otra
   * búsqueda.
   */
  protected buscar(evento: Event): void {
    evento.preventDefault();
    const formulario = evento.target as HTMLFormElement;
    const q = new FormData(formulario).get('q');
    const texto = typeof q === 'string' ? q.trim() : '';
    void this.router.navigate(['/search'], {
      queryParams: { q: texto === '' ? null : texto },
    });
  }
}
