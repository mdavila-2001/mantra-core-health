import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { forkJoin } from 'rxjs';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import type {
  GovernanceRule,
  GovernanceRuleKind,
  GovernanceSettingsResponse,
  NewGovernanceRule,
} from '../../../core/data-access/access-governance/governance-rules.types';
import { SUPPORT_ROLE_TEMPLATE_CODES } from '../../../core/data-access/support-access/support-access.types';
import {
  ATOM_CATEGORY_CODES,
  ATOM_CATEGORY_LABELS,
  type AtomCategoryCode,
} from '../../../core/data-access/support-access/support-atoms';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AccessChallengeService } from '../access-challenge/access-challenge.service';
import { GovernanceSettingsPanel } from './governance-settings';
import { NormalizeLegacy } from './normalize-legacy';
import { RuleBuilder } from './rule-builder';
import {
  ceilingCell,
  describeRule,
  kindText,
  platformNeverAssignable,
  ruleStatusText,
  ruleStatusTone,
  templateName,
} from './rule-labels';

export interface RulesData {
  readonly rules: readonly GovernanceRule[];
  readonly settings: GovernanceSettingsResponse;
}

/** Una celda de la matriz de techos con su fila y columna, para el lector de pantalla. */
interface CeldaDeTecho {
  readonly categoria: AtomCategoryCode;
  readonly kind: 'NONE' | 'LIMITED' | 'BLOCKED';
  readonly text: string;
}

/**
 * **Barandillas de la organización** (CONTRATO-GOBIERNO §4.3, §9.3 fila 7): una sola tarjeta con cuatro pestañas.
 *
 * - *Barandillas*: las reglas propias (nadie puede, exigir una condición, limitar lo que se ve), con constructor guiado y
 *   «a cuántas personas alcanza» antes de guardar.
 * - *Techos por plantilla*: lo máximo que cada rol puede tener; el de la plataforma se lee y no se edita.
 * - *Ajustes*: plazos y umbrales de gobierno (son datos).
 * - *Permisos antiguos*: simulacro, aplicar y revertir la conversión a permisos precisos.
 *
 * Las barandillas solo restringen (L1 sobre L0); guardar o retirar pide el segundo paso. La autoridad es la API.
 */
@Component({
  selector: 'app-rules',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    Checkbox,
    FormField,
    GovernanceSettingsPanel,
    NormalizeLegacy,
    PageHeader,
    RuleBuilder,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './rules.html',
  styleUrl: './rules.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rules implements OnInit {
  private readonly client = inject(AccessGovernanceClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<ViewState<RulesData>>(loading());
  protected readonly pestana = signal(0);
  protected readonly anuncio = signal('');
  protected readonly verRetiradas = signal(false);

  /* ---- constructor ---- */
  protected readonly constructorAbierto = signal<GovernanceRuleKind | null>(null);
  protected readonly guardando = signal(false);
  protected readonly falloDeGuardado = signal<string | null>(null);

  /* ---- editar el mensaje ---- */
  protected readonly editando = signal<GovernanceRule | null>(null);
  protected readonly mensajeNuevo = signal('');
  protected readonly guardandoMensaje = signal(false);
  protected readonly falloDeMensaje = signal<string | null>(null);
  protected readonly retirando = signal<string | null>(null);
  protected readonly falloDeRetiro = signal<string | null>(null);

  protected readonly datos = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });
  private readonly todas = computed(() => this.datos()?.rules ?? []);
  protected readonly barandillas = computed(() =>
    this.todas().filter(
      (r) => r.kind !== 'CEILING' && (this.verRetiradas() || r.status === 'ACTIVE'),
    ),
  );
  protected readonly techos = computed(() =>
    this.todas().filter(
      (r) => r.kind === 'CEILING' && (this.verRetiradas() || r.status === 'ACTIVE'),
    ),
  );
  protected readonly hayRetiradas = computed(() => this.todas().some((r) => r.status !== 'ACTIVE'));

  protected readonly categorias = ATOM_CATEGORY_CODES.map((codigo) => ({
    codigo,
    nombre: ATOM_CATEGORY_LABELS[codigo],
  }));
  protected readonly plantillas = SUPPORT_ROLE_TEMPLATE_CODES;
  protected readonly nuncaDa = platformNeverAssignable();
  protected readonly matriz = computed<
    readonly { readonly plantilla: string; readonly celdas: readonly CeldaDeTecho[] }[]
  >(() =>
    SUPPORT_ROLE_TEMPLATE_CODES.map((plantilla) => ({
      plantilla: templateName(plantilla) ?? plantilla,
      celdas: ATOM_CATEGORY_CODES.map((categoria) => ({
        categoria,
        ...ceilingCell(this.todas(), plantilla, categoria),
      })),
    })),
  );

  protected readonly describir = describeRule;
  protected readonly tipoTexto = kindText;
  protected readonly estadoTexto = ruleStatusText;
  protected readonly estadoTono = ruleStatusTone;
  protected readonly nombreDePlantilla = templateName;

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const previo = this.datos();
    if (previo === null) this.state.set(loading());
    forkJoin({ rules: this.client.listRules(), settings: this.client.getSettings() }).subscribe({
      next: ({ rules, settings }) =>
        this.state.set(ready<RulesData>({ rules: rules.items, settings })),
      error: (failure: unknown) =>
        this.state.set(
          previo === null ? errorToViewState<RulesData>(failure) : stale(previo, new Date()),
        ),
    });
  }

  private falloComoTexto(failure: unknown, respaldo: string): string | null {
    if (failure instanceof AccessChallengeCancelledError) return null;
    return accessFailureOf(failure)?.message ?? respaldo;
  }

  protected ajustesGuardados(respuesta: GovernanceSettingsResponse): void {
    const actual = this.datos();
    if (actual === null) return;
    this.state.set(ready<RulesData>({ rules: actual.rules, settings: respuesta }));
    this.anuncio.set('Ajustes guardados.');
  }

  /* ---- crear ---- */

  protected abrirConstructor(kind: GovernanceRuleKind): void {
    this.falloDeGuardado.set(null);
    this.constructorAbierto.set(kind);
  }

  protected cerrarConstructor(): void {
    this.constructorAbierto.set(null);
    this.falloDeGuardado.set(null);
  }

  protected crear(regla: NewGovernanceRule): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.falloDeGuardado.set(null);
    this.challenges
      .run(() => this.client.createRule(regla), {
        actionLabel: 'Guardar la barandilla de la organización',
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarConstructor();
          this.toasts.success('Barandilla guardada.');
          this.anuncio.set('Barandilla guardada. Ya rige para toda la organización.');
          this.cargar();
        },
        error: (failure: unknown) => {
          this.guardando.set(false);
          this.falloDeGuardado.set(
            this.falloComoTexto(
              failure,
              'No pudimos guardar la barandilla. Revise lo elegido e intente de nuevo.',
            ),
          );
        },
      });
  }

  /* ---- editar el mensaje ---- */

  protected editarMensaje(regla: GovernanceRule): void {
    this.editando.set(regla);
    this.mensajeNuevo.set(regla.message ?? '');
    this.falloDeMensaje.set(null);
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.falloDeMensaje.set(null);
  }

  protected guardarMensaje(): void {
    const regla = this.editando();
    if (regla === null || this.guardandoMensaje()) return;
    this.guardandoMensaje.set(true);
    this.falloDeMensaje.set(null);
    this.challenges
      .run(
        () =>
          this.client.updateRule(regla.id, {
            expectedRowVersion: regla.rowVersion,
            message: this.mensajeNuevo().trim(),
          }),
        { actionLabel: 'Cambiar el mensaje de la barandilla' },
      )
      .subscribe({
        next: () => {
          this.guardandoMensaje.set(false);
          this.editando.set(null);
          this.toasts.success('Mensaje actualizado.');
          this.anuncio.set('Mensaje actualizado.');
          this.cargar();
        },
        error: (failure: unknown) => {
          this.guardandoMensaje.set(false);
          this.falloDeMensaje.set(this.falloComoTexto(failure, 'No pudimos guardar el mensaje.'));
          // Si otra persona la cambió, lo que se ve ya no es lo vigente: se relee.
          if (accessFailureOf(failure)?.reason === 'ROW_VERSION_CONFLICT') this.cargar();
        },
      });
  }

  /* ---- retirar ---- */

  protected async retirar(regla: GovernanceRule): Promise<void> {
    if (this.retirando() !== null) return;
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Retirar la barandilla',
        message: `Deja de regir: ${this.describir(regla)} Nunca se borra; queda en el historial.`,
        confirmLabel: 'Retirar la barandilla',
        cancelLabel: 'Conservarla',
        destructive: true,
      },
      { label: 'Motivo', hint: 'Queda registrado.', minLength: 5, maxLength: 300 },
    );
    if (motivo === null) return;
    this.retirando.set(regla.id);
    this.falloDeRetiro.set(null);
    this.challenges
      .run(() => this.client.retireRule(regla.id, motivo), { actionLabel: 'Retirar la barandilla' })
      .subscribe({
        next: () => {
          this.retirando.set(null);
          this.toasts.success('Barandilla retirada.');
          this.anuncio.set('Barandilla retirada. Ya no rige.');
          this.cargar();
        },
        error: (failure: unknown) => {
          this.retirando.set(null);
          this.falloDeRetiro.set(this.falloComoTexto(failure, 'No pudimos retirar la barandilla.'));
        },
      });
  }
}
