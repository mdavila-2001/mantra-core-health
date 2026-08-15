/* ============================================================================
    Marco público de REDSAT: el que ve alguien sin sesión.

    Cubre las 14 pantallas del buscador (V65). No hay nav lateral porque no hay
    organización activa todavía, y el pie con las cuatro declaraciones —quién
    paga, qué precio, qué no es diagnóstico, qué está verificado— va acá y no
    en cada vista: la ficha de la bóveda lo exige en TODA pantalla pública, y
    repetirlo por pantalla es garantizar que en alguna falte.
    ========================================================================== */

import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { RedsatThemeToggleDirective } from '@core/redsat/redsat-theme-toggle.directive';

import { RedsatDesignNotice } from './redsat-design-notice';

@Component({
  selector: 'app-redsat-public-shell',
  imports: [RedsatDesignNotice, RouterLink, RouterOutlet, RedsatThemeToggleDirective],
  templateUrl: './redsat-public-shell.html',
})
export class RedsatPublicShell {}
