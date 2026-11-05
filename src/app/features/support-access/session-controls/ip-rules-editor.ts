import { ChangeDetectionStrategy, Component, computed, inject, input, signal, type OnInit } from '@angular/core';

import type { MyNetwork } from '../../../core/data-access/iam/iam-new-device';
import { AccountSecurityClient } from '../../../core/data-access/iam/account-security.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import { MAX_IP_RULES, activeRules, evaluateIpRules, isValidCidr, matchesCidr, parseIp, validateIpRules, type IpRuleProblem } from '../../../core/data-access/support-access/ip-rules';
import type { IpAccessRule, IpAccessRuleView, IpRuleType } from '../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { draftsOf, endDayOf, endIsoOf, nextUid, rulesOf, sameRules, startDayOf, startIsoOf, type RuleDraft } from './ip-rules-draft';
import { ipRulesFailureOf, type IpRulesFailure } from './ip-rules-failure';
import { networkWarning, ruleForMyIp } from './my-network';

const TIPOS: readonly SelectOption<IpRuleType>[] = [
  { value: 'ALLOW', label: 'Permitir esta red' },
  { value: 'DENY', label: 'Bloquear esta red' },
];

/**
 * **Redes de la organización**: desde qué direcciones puede entrar el personal.
 *
 * Es la pestaña «Redes» de «Controles de sesión»: ahí se enciende «Red de la
 * organización» por alcance y acá se dice **cuáles** son esas redes. Cada regla
 * permite o bloquea un rango de direcciones (CIDR), con una descripción y, si se
 * quiere, un período de vigencia. Guardar **reemplaza todo el conjunto**.
 *
 * Tres cosas se cuidan de cara a quien administra:
 *
 * - **Lenguaje simple.** Qué es una red, cómo se escribe un rango, qué gana cuando
 *   una dirección cae en dos reglas y que sin reglas no se restringe a nadie.
 * - **No encerrarse afuera.** La API no guarda un conjunto que deje fuera la red de
 *   quien lo guarda (`IP_RULES_WOULD_LOCK_OUT_ACTOR`): el aviso está a la vista
 *   antes de guardar y, si ocurre, se explica qué hacer. El navegador no conoce su
 *   propia dirección pública, así que no puede prevenirlo del todo: la API decide.
 * - **Vista previa.** Se escribe una dirección y se ve si entraría con lo que se
 *   está editando y por qué regla, con la misma evaluación que hace la API.
 *
 * La API es la autoridad: valida, guarda y hace cumplir en cada ingreso.
 */
@Component({
  selector: 'app-ip-rules-editor',
  imports: [Alert, AppButton, FormField, Input, Select, ViewStateHost],
  templateUrl: './ip-rules-editor.html',
  styleUrl: './ip-rules-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IpRulesEditor implements OnInit {
  private readonly client = inject(SupportAccessClient);
  private readonly security = inject(AccountSecurityClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  /** En qué alcances de la política de sesión se exige hoy la red (de lo que se está editando arriba). */
  readonly exigidaEn = input<readonly string[]>([]);

  protected readonly tipos = TIPOS;
  protected readonly maximo = MAX_IP_RULES;

  protected readonly state = signal<ViewState<readonly IpAccessRuleView[]>>(loading());
  protected readonly guardado = signal<readonly IpAccessRule[]>([]);
  protected readonly borrador = signal<readonly RuleDraft[]>([]);
  protected readonly intento = signal(false);
  protected readonly guardando = signal(false);
  protected readonly fallo = signal<IpRulesFailure | null>(null);
  protected readonly direccionDePrueba = signal('');
  /** Cómo ve la API esta conexión (`GET /iam/me/network`); `null` mientras no llegó o si no se pudo leer. */
  protected readonly miRed = signal<MyNetwork | null>(null);
  protected readonly avisoDeRed = computed(() => {
    const red = this.miRed();
    return red === null ? null : networkWarning(red);
  });
  /** La regla que propone «Usar mi IP», o `null` si ya está cargada o la API no leyó la dirección. */
  protected readonly reglaDeMiIp = computed(() => {
    const red = this.miRed();
    const regla = red === null ? null : ruleForMyIp(red);
    return regla === null || this.reglas().some((r) => r.cidr === regla.cidr) ? null : regla;
  });

  protected readonly reglas = computed(() => rulesOf(this.borrador()));
  protected readonly hayCambios = computed(() => !sameRules(this.guardado(), this.reglas()));
  protected readonly problemas = computed(() => validateIpRules(this.reglas()));
  protected readonly llena = computed(() => this.borrador().length >= MAX_IP_RULES);

  protected readonly permitidas = computed(() => this.reglas().filter((r) => r.type === 'ALLOW').length);
  protected readonly bloqueadas = computed(() => this.reglas().filter((r) => r.type === 'DENY').length);

  /** Qué dice el conjunto en una frase, para quien no quiere leer renglón por renglón. */
  protected readonly resumen = computed(() => {
    const permitidas = this.permitidas();
    const bloqueadas = this.bloqueadas();
    if (permitidas === 0 && bloqueadas === 0) return 'Sin redes: no se restringe a nadie por su dirección.';
    const partes: string[] = [];
    if (permitidas > 0) partes.push(`solo se entra desde ${permitidas === 1 ? 'la red permitida' : `las ${permitidas} redes permitidas`}`);
    if (bloqueadas > 0) partes.push(`${bloqueadas === 1 ? 'una red queda bloqueada' : `${bloqueadas} redes quedan bloqueadas`}`);
    const frase = partes.join(' y ');
    return `${frase.charAt(0).toLocaleUpperCase('es')}${frase.slice(1)}.`;
  });

  /** El veredicto sobre la dirección de prueba, con la regla que lo decide. */
  protected readonly prueba = computed(() => {
    const texto = this.direccionDePrueba().trim();
    if (texto === '') return null;
    if (parseIp(texto) === null) {
      return { entra: false, valida: false, lineas: ['No es una dirección válida. Ejemplos: 190.129.77.12 o 2001:db8::1.'] };
    }
    const vigentes = activeRules(this.reglas()).filter((r) => isValidCidr(r.cidr));
    const veredicto = evaluateIpRules(texto, vigentes);
    const quien = (r: IpAccessRule): string => (r.description === undefined ? r.cidr : `${r.cidr} (${r.description})`);
    if (veredicto === 'NO_RULES') return { entra: true, valida: true, lineas: ['No hay redes cargadas, así que no se restringe a nadie por su dirección.'] };
    const bloqueo = vigentes.find((r) => r.type === 'DENY' && matchesCidr(texto, r.cidr));
    if (bloqueo !== undefined) return { entra: false, valida: true, lineas: [`Cae en una red bloqueada: ${quien(bloqueo)}. Bloquear gana siempre, aunque también esté permitida.`] };
    const permiso = vigentes.find((r) => r.type === 'ALLOW' && matchesCidr(texto, r.cidr));
    if (permiso !== undefined) return { entra: true, valida: true, lineas: [`Cae en una red permitida: ${quien(permiso)}.`] };
    if (veredicto === 'ALLOWED') return { entra: true, valida: true, lineas: ['No cae en ninguna red bloqueada y no hay redes permitidas, así que puede entrar.'] };
    return { entra: false, valida: true, lineas: ['No cae en ninguna red permitida. Con redes permitidas cargadas, solo se entra desde ellas.'] };
  });

  protected readonly sinReglasQueLaExijan = computed(() => this.exigidaEn().length === 0);
  protected readonly exigidaTexto = computed(() => this.exigidaEn().join(', '));

  ngOnInit(): void {
    this.cargar();
    // Antes de escribir reglas se muestra con qué dirección ve la API a quien las escribe. Si no se puede leer, la pestaña sigue sin ese dato.
    this.security.getMyNetwork().subscribe({ next: (red) => this.miRed.set(red), error: () => this.miRed.set(null) });
  }

  /** «Usar mi IP»: agrega un renglón que permite **solo** esta conexión (/32 o /128), para que quien guarda no se quede afuera. */
  protected usarMiIp(): void {
    const regla = this.reglaDeMiIp();
    if (regla === null || this.llena()) return;
    this.borrador.update((actual) => [...actual, { uid: nextUid(), type: regla.type, cidr: regla.cidr, description: regla.description ?? '' }]);
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.getIpAccessRules().subscribe({
      next: ({ rules }) => {
        this.guardado.set(rules);
        this.borrador.set(draftsOf(rules));
        this.fallo.set(null);
        this.intento.set(false);
        this.state.set(ready(rules));
      },
      error: (failure: unknown) => this.state.set(errorToViewState<readonly IpAccessRuleView[]>(failure)),
    });
  }

  /* ---- edición ------------------------------------------------------------ */

  protected agregar(tipo: IpRuleType): void {
    if (this.llena()) return;
    this.borrador.update((actual) => [...actual, { uid: nextUid(), type: tipo, cidr: '', description: '' }]);
  }

  protected quitar(uid: string): void {
    this.borrador.update((actual) => actual.filter((r) => r.uid !== uid));
  }

  private cambiar(uid: string, cambios: Partial<RuleDraft>): void {
    this.borrador.update((actual) => actual.map((r) => (r.uid === uid ? { ...r, ...cambios } : r)));
  }

  protected cambiarTipo(uid: string, tipo: IpRuleType | null): void {
    if (tipo !== null) this.cambiar(uid, { type: tipo });
  }

  protected cambiarRango(uid: string, valor: string | number | null): void {
    this.cambiar(uid, { cidr: `${valor ?? ''}` });
  }

  protected cambiarDescripcion(uid: string, valor: string | number | null): void {
    this.cambiar(uid, { description: `${valor ?? ''}` });
  }

  /** Cambiar el día reescribe el instante; dejarlo como está conserva el que vino de la API. */
  protected cambiarDesde(regla: RuleDraft, valor: string | number | null): void {
    const iso = startIsoOf(`${valor ?? ''}`);
    const { validFrom: _viejo, ...resto } = regla;
    this.borrador.update((actual) => actual.map((r) => (r.uid === regla.uid ? { ...resto, ...(iso === undefined ? {} : { validFrom: iso }) } : r)));
  }

  protected cambiarHasta(regla: RuleDraft, valor: string | number | null): void {
    const iso = endIsoOf(`${valor ?? ''}`);
    const { validTo: _viejo, ...resto } = regla;
    this.borrador.update((actual) => actual.map((r) => (r.uid === regla.uid ? { ...resto, ...(iso === undefined ? {} : { validTo: iso }) } : r)));
  }

  protected diaDesde = (regla: RuleDraft): string => startDayOf(regla.validFrom);
  protected diaHasta = (regla: RuleDraft): string => endDayOf(regla.validTo);

  protected descartar(): void {
    this.borrador.set(draftsOf(this.guardado()));
    this.fallo.set(null);
    this.intento.set(false);
  }

  /** Lo que está mal del renglón `indice` en el campo, para decirlo junto a él (solo después del primer intento de guardar). */
  protected problemaDe(indice: number, campo: IpRuleProblem['field']): string {
    if (!this.intento()) return '';
    return this.problemas().find((p) => p.index === indice && p.field === campo)?.message ?? '';
  }

  /* ---- guardar ------------------------------------------------------------ */

  protected async guardar(): Promise<void> {
    this.intento.set(true);
    if (!this.hayCambios() || this.guardando()) return;
    if (this.problemas().length > 0) return;
    const confirmado = await this.dialogs.confirmarCambios({
      title: '¿Confirma las redes de la organización?',
      message:
        'Se reemplazan todas las reglas de red por las que ve en pantalla. Si alguna deja fuera la red desde la que está trabajando, no se guarda nada y se lo avisamos. Las reglas rigen desde el próximo ingreso de cada persona.',
    });
    if (!confirmado) return;
    this.guardando.set(true);
    this.fallo.set(null);
    this.client.putIpAccessRules(this.reglas()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.toasts.success('Guardamos las redes de la organización.');
        // Se vuelve a leer: lo que queda en pantalla es lo que la API guardó.
        this.cargar();
      },
      error: (failure: unknown) => {
        this.guardando.set(false);
        this.fallo.set(ipRulesFailureOf(failure));
      },
    });
  }
}
