import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { APP_SECTIONS } from '../../../core/navigation/navigation.map';
import { isVisibleTo } from '../../../core/navigation/navigation.types';
import { AppVisible } from '../../../core/visibility/visible.directive';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { TutorialTarget } from '../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import { DASHBOARD_UI } from '../dashboard.ui-elements';
import { firstNameOf, greetingFor } from '../patient-home/patient-home.copy';
import { PRACTITIONER_SHORTCUTS } from './practitioner-welcome.copy';

/** Cuánto lleva del alta: las etapas cumplidas y el total. */
export interface OnboardingProgress {
  readonly completed: number;
  readonly total: number;
}

/**
 * La portada de quien atiende (01/11/2026).
 *
 * El panel del médico abría con un aviso marrón, un encabezado de listado y una
 * franja gris: tres piezas que hablaban del sistema antes que de su día. El
 * paciente, en cambio, entra por una portada que lo saluda y le pregunta qué le
 * pasa. Ésta es la misma idea para el médico:
 *
 * 1. **Un saludo suyo** — según la hora, con su nombre de pila y la fecha.
 * 2. **«¿Qué necesita hacer ahora?»** — cuatro atajos con ícono, filtrados con la
 *    misma regla que el menú.
 * 3. **Su perfil, al costado** — el avance del alta como anillo, con un único
 *    botón para seguir, y la puerta a «Mis verificaciones».
 *
 * No pide nada: el avance del alta lo lee el panel, que es quien ya lo hacía.
 */
@Component({
  selector: 'app-practitioner-welcome',
  imports: [DatePipe, RouterLink, AppButtonLink, NavIcon, AppVisible, TutorialTarget],
  templateUrl: './practitioner-welcome.html',
  styleUrls: ['./practitioner-welcome.css', './practitioner-welcome-aside.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerWelcome {
  private readonly auth = inject(AuthService);

  /** El avance del alta, o `null` si está completa, no aplica o no se pudo leer. */
  readonly onboarding = input<OnboardingProgress | null>(null);

  /** Si se ofrece «Mis verificaciones» (lo decide el panel con su regla de rol). */
  readonly showVerifications = input(false);

  protected readonly ui = DASHBOARD_UI;

  /** Nombres sin apellidos: «Buenos días, Luis Alberto» es cercano sin ser informal. */
  protected readonly firstName = computed(() => firstNameOf(this.auth.displayName() ?? ''));

  /** Se resuelve en el navegador: el servidor no conoce la hora de quien mira. */
  protected readonly greeting = signal('Hola');
  protected readonly today = signal<Date | null>(null);

  /** Los atajos que el menú también le muestra a esta sesión. */
  protected readonly shortcuts = computed(() => {
    const roles = this.auth.roles();
    const tenants = this.auth.tenants();
    const tenantType = this.auth.activeTenantType();
    return PRACTITIONER_SHORTCUTS.filter((atajo) => {
      const section = APP_SECTIONS.find((s) => s.path === atajo.sectionPath);
      return section !== undefined && isVisibleTo(section, roles, tenants, tenantType);
    });
  });

  /** Porcentaje del alta para el anillo; 0 si no hay etapas. */
  protected readonly percent = computed(() => {
    const avance = this.onboarding();
    if (avance === null || avance.total === 0) return 0;
    return Math.round((avance.completed / avance.total) * 100);
  });

  /** Cuántas etapas le quedan, para decirlo en palabras. */
  protected readonly remaining = computed(() => {
    const avance = this.onboarding();
    return avance === null ? 0 : Math.max(avance.total - avance.completed, 0);
  });

  constructor() {
    afterNextRender(() => {
      const now = new Date();
      this.greeting.set(greetingFor(now));
      this.today.set(now);
    });
  }
}
