import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Avatar } from '../../../../../shared/components/atoms/avatar/avatar';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { StatusSeal } from '../../../../../shared/components/organisms/status-seal/status-seal';
import type { PerfilProfesionalVisible } from './practitioner-profile-view.types';

/**
 * **La vista del perfil profesional** — presentacional pura.
 *
 * ## Por qué existe (carril R2-4)
 *
 * El perfil del doctor rebotó dos rondas seguidas («está pésimo»), y la guía de
 * profesionales (carril R2-1) necesita pintar el perfil de OTRO doctor. Antes
 * este dibujo vivía dentro del contenedor de «Mi perfil», que inyecta
 * `ProfilesClient` y pide `me/summary` — imposible de reusar sin duplicarlo, y
 * dos perfiles de doctor con dos criterios distintos es exactamente el tipo de
 * cosa que generó el reclamo.
 *
 * Ahora el dato entra por `input()` ya resuelto (ver
 * `practitioner-profile-view.types.ts`) y esta vista no sabe de dónde salió:
 * la usan el contenedor propio y el detalle de la guía, y cualquier mejora
 * visual les llega a los dos a la vez.
 *
 * ## La jerarquía, que es lo que cambió a los ojos del cliente
 *
 * Antes: seis tarjetas `outlined` idénticas apiladas — todo pesaba lo mismo,
 * nada resaltaba. Ahora:
 *
 * 1. **La portada es la única tarjeta `elevated`** y concentra la identidad:
 *    foto (si hay), nombre, título, habilitación, disponibilidad y las
 *    acciones del dueño.
 * 2. **Presentación y actividad** siguen siendo contexto y van después,
 *    livianas.
 * 3. **Las credenciales van agrupadas en pestañas** (Especialidades ·
 *    Formación · Matrículas) dentro de UNA tarjeta: son la misma pregunta
 *    —«¿qué lo habilita?»— contada tres veces, no tres temas distintos.
 *
 * ## `esPropio`
 *
 * Con `true` (Mi perfil) aparecen las acciones de dueño —configurar, vista
 * pública, artículos, trayectoria— y la actividad se rotula «Tu actividad».
 * Con `false` (la guía) no hay botones ni tuteo: es la ficha de un colega.
 */
@Component({
  selector: 'app-practitioner-profile-view',
  imports: [Avatar, Badge, AppButtonLink, Card, Chip, DatePipe, RouterLink, StatusSeal, Tabs, Tab],
  templateUrl: './practitioner-profile-view.html',
  styleUrl: './practitioner-profile-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfileView {
  /** El perfil, ya resuelto por el contenedor. */
  readonly perfil = input.required<PerfilProfesionalVisible>();

  /** Si es el perfil de quien mira: habilita las acciones de dueño. */
  readonly esPropio = input(false);
}
