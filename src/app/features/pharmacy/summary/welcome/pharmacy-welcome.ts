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

import { AuthService } from '../../../../core/auth/auth.service';
import { APP_SECTIONS } from '../../../../core/navigation/navigation.map';
import { isVisibleTo } from '../../../../core/navigation/navigation.types';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { greetingFor } from '../../../dashboard/patient-home/patient-home.copy';
import { CounterToday } from '../counter-today/counter-today';
import { PHARMACY_SHORTCUTS } from './pharmacy-welcome.copy';

/**
 * Pharmacy home (2026-11-04): greeting, the day's shortcuts and, on the side,
 * how the counter is doing right now.
 *
 * Same piece as the practitioner welcome (it shares its stylesheet), with what
 * a pharmacy comes to do: serve pickup requests, keep the catalog, run
 * promotions and keep its on-call shifts.
 */
@Component({
  selector: 'app-pharmacy-welcome',
  imports: [DatePipe, RouterLink, NavIcon, CounterToday],
  templateUrl: './pharmacy-welcome.html',
  styleUrls: [
    '../../../dashboard/practitioner-welcome/practitioner-welcome.css',
    './pharmacy-welcome.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyWelcome {
  private readonly auth = inject(AuthService);

  /** Name of the selected pharmacy; empty while unknown. */
  readonly pharmacyName = input('');

  /** Pharmacy name, else the account name (an organization, so shown in full). */
  protected readonly name = computed(() => this.pharmacyName() || (this.auth.displayName() ?? ''));

  /** Resolved in the browser: the server does not know the viewer's local time. */
  protected readonly greeting = signal('Hola');
  protected readonly today = signal<Date | null>(null);

  /** Only the shortcuts whose section the menu also shows to this session. */
  protected readonly shortcuts = computed(() => {
    const roles = this.auth.roles();
    const tenants = this.auth.tenants();
    const tenantType = this.auth.activeTenantType();
    return PHARMACY_SHORTCUTS.filter((shortcut) => {
      const section = APP_SECTIONS.find((s) => s.path === shortcut.sectionPath);
      return section !== undefined && isVisibleTo(section, roles, tenants, tenantType);
    });
  });

  constructor() {
    afterNextRender(() => {
      const now = new Date();
      this.greeting.set(greetingFor(now));
      this.today.set(now);
    });
  }
}
