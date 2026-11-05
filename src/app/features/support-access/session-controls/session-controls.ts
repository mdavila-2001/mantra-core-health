import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import {
  HOUR_CHOICES,
  IDLE_MINUTES_CHOICES,
  POLICY_ROLE_CODES,
  WEEK_ORDER,
  dayName,
  effectiveRules,
  explainPolicy,
  findPolicy,
  newPolicy,
  previewEffect,
  removePolicy,
  roleLabel,
  samePolicies,
  scopeLabel,
  upsertPolicy,
  validatePolicies,
  minutesOf,
  type Audience,
  type ControlExplanation,
} from '../../../core/data-access/support-access/session-policy';
import type { AllowedHours, SessionPolicy, SessionPolicyScope } from '../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { IpRulesEditor } from './ip-rules-editor';
import { sessionPolicyFailureOf } from './session-policy-failure';
import { WeeklyHoursEditor } from './weekly-hours-editor';

/** El alcance que muestra cada pestaña. */
const ALCANCES: readonly SessionPolicyScope[] = ['ALL_ACCOUNTS', 'ORG_STAFF', 'ROLE'];

const TEXTO_DEL_ALCANCE: Readonly<Record<SessionPolicyScope, { readonly titulo: string; readonly texto: string }>> = {
  ALL_ACCOUNTS: {
    titulo: 'Todas las cuentas',
    texto: 'Rige para cualquier persona que entre a la organización: el personal, pero también quien solo es paciente.',
  },
  ORG_STAFF: {
    titulo: 'Personal de la organización',
    texto: 'Rige para quien trabaja en la organización (tiene algún rol más allá de paciente). Se suma a la regla de todas las cuentas: rige lo más estricto de las dos.',
  },
  ROLE: {
    titulo: 'Por rol',
    texto: 'Rige para quien tiene ese rol, además de las reglas anteriores. Sirve para pedir más a un rol delicado, como quien administra la seguridad.',
  },
};

/**
 * **Controles de sesión** de la organización: cuándo se cierra la sesión, desde
 * dónde y en qué horario se puede entrar, y si se pide verificación en dos pasos.
 *
 * Una regla por alcance —todas las cuentas, el personal, un rol— y, para cada
 * una, cinco controles, **cada uno explicado en lenguaje simple** y con su efecto
 * en vivo. A la derecha, una **vista previa** del efecto combinado para esa
 * audiencia: qué rige al final (la más estricta de las reglas que la alcanzan) y
 * si alguien podría entrar un día y hora de prueba.
 *
 * Guardar pide confirmación, solo se habilita cuando algo cambió y vuelve a leer
 * lo guardado: lo que se ve es lo que la API tiene, no lo que se tocó. Esta
 * pantalla no cierra ni abre sesiones: lo hace la API al emitir cada token, desde
 * el próximo inicio de sesión de cada persona.
 */
@Component({
  selector: 'app-session-controls',
  imports: [Alert, AppButton, Card, IpRulesEditor, NgTemplateOutlet, PageHeader, Select, Switch, Tab, Tabs, ViewStateHost, WeeklyHoursEditor],
  templateUrl: './session-controls.html',
  styleUrl: './session-controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionControls implements OnInit {
  private readonly client = inject(SupportAccessClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<ViewState<readonly SessionPolicy[]>>(loading());
  /** Lo que la API tiene guardado. */
  protected readonly guardado = signal<readonly SessionPolicy[]>([]);
  /** Lo que se está editando. */
  protected readonly borrador = signal<readonly SessionPolicy[]>([]);
  protected readonly pestana = signal(0);
  protected readonly rolElegido = signal<string | null>(POLICY_ROLE_CODES[0] ?? null);
  protected readonly guardando = signal(false);
  protected readonly falloDeGuardado = signal<string | null>(null);

  /** La prueba de la vista previa. */
  protected readonly diaDePrueba = signal(6);
  protected readonly horaDePrueba = signal('21:00');

  protected readonly opcionesDeInactividad: readonly SelectOption<number>[] = IDLE_MINUTES_CHOICES.map((m) => ({ value: m, label: `${m} minutos` }));
  protected readonly opcionesDeRol: readonly SelectOption<string>[] = POLICY_ROLE_CODES.map((code) => ({ value: code, label: roleLabel(code) }));
  protected readonly opcionesDeDia: readonly SelectOption<number>[] = WEEK_ORDER.map((d) => ({ value: d, label: dayName(d).charAt(0).toLocaleUpperCase('es') + dayName(d).slice(1) }));
  protected readonly opcionesDeHora: readonly SelectOption<string>[] = HOUR_CHOICES.map((h) => ({ value: h, label: h }));

  /** La pestaña de las redes viene después de las tres de alcance y no es una regla de sesión. */
  protected readonly pestanaDeRedes = ALCANCES.length;
  protected readonly enRedes = computed(() => this.pestana() === this.pestanaDeRedes);

  protected readonly alcance = computed<SessionPolicyScope>(() => ALCANCES[this.pestana()] ?? 'ALL_ACCOUNTS');

  /** En qué alcances se exige hoy la red, según lo que se está editando: lo que ve la pestaña de redes. */
  protected readonly alcancesConRed = computed<readonly string[]>(() =>
    this.borrador()
      .filter((p) => p.enforceIpRules)
      .map((p) => scopeLabel(p)),
  );
  protected readonly textoDelAlcance = computed(() => TEXTO_DEL_ALCANCE[this.alcance()]);

  /** La regla que muestra la pestaña actual, o `undefined` si todavía no tiene una propia. */
  protected readonly regla = computed<SessionPolicy | undefined>(() => {
    const alcance = this.alcance();
    return findPolicy(this.borrador(), alcance, alcance === 'ROLE' ? (this.rolElegido() ?? undefined) : undefined);
  });

  protected readonly explicaciones = computed<Readonly<Record<string, ControlExplanation>>>(() => {
    const regla = this.regla();
    return regla === undefined ? {} : Object.fromEntries(explainPolicy(regla).map((e) => [e.id, e]));
  });

  protected readonly hayCambios = computed(() => !samePolicies(this.guardado(), this.borrador()));
  protected readonly problemas = computed(() => validatePolicies(this.borrador()));

  /* ---- vista previa ------------------------------------------------------- */

  protected readonly audiencia = computed<Audience>(() => {
    switch (this.alcance()) {
      case 'ALL_ACCOUNTS':
        return { kind: 'ACCOUNT' };
      case 'ORG_STAFF':
        return { kind: 'STAFF' };
      case 'ROLE':
        return { kind: 'ROLE', roleCode: this.rolElegido() ?? '' };
    }
  });

  protected readonly tituloDeVistaPrevia = computed(() => {
    const alcance = this.alcance();
    return scopeLabel({ scope: alcance, ...(alcance === 'ROLE' && this.rolElegido() !== null ? { roleCode: this.rolElegido()! } : {}) });
  });

  protected readonly reglasQueRigen = computed(() => effectiveRules(this.borrador(), this.audiencia()));

  protected readonly prueba = computed(() => previewEffect(this.reglasQueRigen(), this.diaDePrueba(), minutesOf(this.horaDePrueba())));

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.getSessionPolicies().subscribe({
      next: ({ policies }) => {
        this.guardado.set(policies);
        this.borrador.set(policies);
        this.falloDeGuardado.set(null);
        this.state.set(ready(policies));
      },
      error: (failure: unknown) => this.state.set(errorToViewState<readonly SessionPolicy[]>(failure)),
    });
  }

  /* ---- edición ------------------------------------------------------------ */

  private reemplazar(siguiente: SessionPolicy): void {
    this.borrador.update((actual) => upsertPolicy(actual, siguiente));
  }

  protected crearRegla(): void {
    const alcance = this.alcance();
    this.reemplazar(newPolicy(alcance, alcance === 'ROLE' ? (this.rolElegido() ?? undefined) : undefined));
  }

  protected quitarRegla(): void {
    const alcance = this.alcance();
    this.borrador.update((actual) => removePolicy(actual, alcance, alcance === 'ROLE' ? (this.rolElegido() ?? undefined) : undefined));
  }

  protected cambiarInactividad(minutos: number | null): void {
    const regla = this.regla();
    if (regla === undefined || minutos === null) return;
    this.reemplazar({ ...regla, idleTimeoutMinutes: minutos });
  }

  protected cambiarAviso(activo: boolean): void {
    const regla = this.regla();
    if (regla !== undefined) this.reemplazar({ ...regla, newDeviceAlert: activo });
  }

  protected irARedes(): void {
    this.pestana.set(this.pestanaDeRedes);
  }

  protected cambiarRed(activo: boolean): void {
    const regla = this.regla();
    if (regla !== undefined) this.reemplazar({ ...regla, enforceIpRules: activo });
  }

  protected cambiarDosPasos(activo: boolean): void {
    const regla = this.regla();
    if (regla !== undefined) this.reemplazar({ ...regla, requireMfa: activo });
  }

  protected cambiarHorario(horario: AllowedHours | undefined): void {
    const regla = this.regla();
    if (regla === undefined) return;
    const { allowedHours: _anterior, ...resto } = regla;
    this.reemplazar(horario === undefined ? resto : { ...resto, allowedHours: horario });
  }

  protected elegirRol(code: string | null): void {
    this.rolElegido.set(code);
  }

  protected cambiarDiaDePrueba(dia: number | null): void {
    if (dia !== null) this.diaDePrueba.set(dia);
  }

  protected cambiarHoraDePrueba(hora: string | null): void {
    if (hora !== null) this.horaDePrueba.set(hora);
  }

  protected descartar(): void {
    this.borrador.set(this.guardado());
    this.falloDeGuardado.set(null);
  }

  /* ---- guardar ------------------------------------------------------------ */

  protected async guardar(): Promise<void> {
    if (!this.hayCambios() || this.problemas().length > 0 || this.guardando()) return;
    const confirmado = await this.dialogs.confirmarCambios({
      title: '¿Confirma los nuevos controles de sesión?',
      message:
        'Rigen desde el próximo inicio de sesión de cada persona. Quien ya tiene la sesión abierta conserva su plazo hasta que la renueve; el horario y la verificación en dos pasos se piden al entrar.',
    });
    if (!confirmado) return;
    this.guardando.set(true);
    this.falloDeGuardado.set(null);
    this.client.putSessionPolicies({ policies: this.borrador() }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.toasts.success('Guardamos los controles de sesión.');
        // Se vuelve a leer: lo que queda en pantalla es lo que la API guardó.
        this.cargar();
      },
      error: (failure: unknown) => {
        this.guardando.set(false);
        this.falloDeGuardado.set(sessionPolicyFailureOf(failure, 'No pudimos guardar los controles. Vuelva a intentarlo.'));
      },
    });
  }
}
