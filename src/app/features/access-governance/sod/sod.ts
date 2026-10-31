import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import type {
  FourEyesRequested,
  SodException,
  SodFinding,
  SodRule,
} from '../../../core/data-access/access-governance/governance-rules.types';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Link } from '../../../shared/components/atoms/link/link';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
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
import {
  atomLabel,
  describeSodRule,
  exceptionStatusText,
  exceptionStatusTone,
  findingOutcomeText,
  findingOutcomeTone,
  formatDay,
  isRevocable,
  maxExceptionDate,
  sodActionConsequence,
  sodActionText,
  sodActionTone,
  sodScopeText,
} from './sod-labels';
import { SodRuleForm, type SodRuleSubmission } from './sod-rule-form';

/** Lo que la pantalla muestra: las tres listas y quién es quién (para nombrar a las personas). */
export interface SodData {
  readonly rules: readonly SodRule[];
  readonly findings: readonly SodFinding[];
  readonly exceptions: readonly SodException[];
  /** Nombre de la persona por vínculo; vacío si quien mira no puede listar los vínculos. */
  readonly people: Readonly<Record<string, string>>;
}

/** El cuatro ojos que quedó pendiente al pedir una excepción, para decir «queda pendiente de…». */
interface PedidoHecho {
  readonly persona: string;
  readonly regla: string;
  readonly aprobador: string;
}

const APROBADORES: Readonly<Record<string, string>> = {
  SECOND_APPROVER: 'un segundo administrador',
  DOCTOR: 'el doctor',
  SERVICE_HEAD: 'la jefatura del servicio',
};

const MINIMO_JUSTIFICACION = 40;

/**
 * **Separación de funciones** (CONTRATO-GOBIERNO §6.3, §9.3 fila 6): tres pestañas en una sola tarjeta.
 *
 * - *Reglas*: las de la plataforma (solo lectura) y las propias, cada una en una oración, con su consecuencia.
 * - *Conflictos de hoy*: quién reúne funciones incompatibles; «Pedir excepción» crea un cuatro ojos que decide otra persona.
 * - *Excepciones*: las vigentes, las que vencen pronto, y revocar.
 *
 * Quien lee con el átomo de auditoría solo lee; las escrituras piden segundo paso (`AccessChallengeService`) y la API
 * decide: esta pantalla no concede nada.
 */
@Component({
  selector: 'app-sod',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    FormField,
    Input,
    Link,
    PageHeader,
    RouterLink,
    SodRuleForm,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './sod.html',
  styleUrl: './sod.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sod implements OnInit {
  private readonly client = inject(AccessGovernanceClient);
  private readonly route = inject(ActivatedRoute);
  private readonly engagements = inject(SupportAccessClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<ViewState<SodData>>(loading());
  protected readonly pestana = signal(0);
  protected readonly ahora = signal(new Date());
  /** Lo último que se dijo, para el lector de pantalla. */
  protected readonly anuncio = signal('');

  /* ---- reglas ---- */
  protected readonly formularioAbierto = signal(false);
  protected readonly reglaEnEdicion = signal<SodRule | null>(null);
  protected readonly guardandoRegla = signal(false);
  protected readonly falloDeRegla = signal<string | null>(null);

  /* ---- excepciones ---- */
  protected readonly pidiendo = signal<SodFinding | null>(null);
  protected readonly justificacion = signal('');
  protected readonly hasta = signal('');
  protected readonly intentoDePedido = signal(false);
  protected readonly enviandoPedido = signal(false);
  protected readonly falloDePedido = signal<string | null>(null);
  protected readonly pedidoHecho = signal<PedidoHecho | null>(null);
  protected readonly revocando = signal<string | null>(null);
  protected readonly falloDeRevocacion = signal<string | null>(null);

  protected readonly datos = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });
  protected readonly reglasDePlataforma = computed(() =>
    (this.datos()?.rules ?? []).filter((r) => r.platform),
  );
  protected readonly reglasPropias = computed(() =>
    (this.datos()?.rules ?? []).filter((r) => !r.platform),
  );
  protected readonly conflictos = computed(
    () => (this.datos()?.findings ?? []).filter((f) => f.outcome !== 'EXCEPTION_ACTIVE').length,
  );
  protected readonly justificacionCorta = computed(
    () => this.justificacion().trim().length < MINIMO_JUSTIFICACION,
  );
  protected readonly maximoDeFecha = computed(() => {
    const regla =
      this.pidiendo() === null
        ? undefined
        : (this.datos()?.rules ?? []).find((r) => r.code === this.pidiendo()!.ruleCode);
    return maxExceptionDate(regla, this.ahora());
  });

  protected readonly atomLabel = atomLabel;
  protected readonly describir = describeSodRule;
  protected readonly accionTexto = sodActionText;
  protected readonly accionTono = sodActionTone;
  protected readonly alcanceTexto = sodScopeText;
  protected readonly consecuencia = sodActionConsequence;
  protected readonly resultadoTexto = findingOutcomeText;
  protected readonly resultadoTono = findingOutcomeTone;
  protected readonly dia = formatDay;
  protected readonly revocable = isRevocable;

  ngOnInit(): void {
    // El tablero enlaza con `?tab=exceptions` («Excepciones vigentes»): abre la pestaña de las excepciones.
    if (this.route.snapshot.queryParamMap.get('tab') === 'exceptions') this.pestana.set(2);
    this.cargar();
  }

  protected cargar(): void {
    const previo = this.datos();
    if (previo === null) this.state.set(loading());
    forkJoin({
      rules: this.client.listSodRules(),
      findings: this.client.listSodFindings(),
      exceptions: this.client.listSodExceptions(),
      people: this.engagements
        .listEngagements()
        .pipe(catchError(() => of({ items: [] as readonly { id: string; personName: string }[] }))),
    }).subscribe({
      next: ({ rules, findings, exceptions, people }) => {
        this.ahora.set(new Date());
        this.state.set(
          ready<SodData>({
            rules: rules.items,
            findings: findings.items,
            exceptions: exceptions.items,
            people: Object.fromEntries(people.items.map((e) => [e.id, e.personName])),
          }),
        );
      },
      error: (failure: unknown) => {
        // Si ya se veía algo, se conserva y se avisa que puede estar atrasado (S7); si no, el estado que corresponda al error.
        this.state.set(
          previo === null ? errorToViewState<SodData>(failure) : stale(previo, this.ahora()),
        );
      },
    });
  }

  protected persona(engagementId: string, respaldo: string): string {
    return this.datos()?.people[engagementId] ?? respaldo;
  }

  protected reglaDe(code: string): SodRule | undefined {
    return (this.datos()?.rules ?? []).find((r) => r.code === code);
  }

  protected nombreDeRegla(code: string, respaldo?: string): string {
    return this.reglaDe(code)?.name ?? respaldo ?? code;
  }

  protected estadoDeExcepcion(e: SodException): string {
    return exceptionStatusText(e, this.ahora());
  }

  protected tonoDeExcepcion(e: SodException): ReturnType<typeof exceptionStatusTone> {
    return exceptionStatusTone(e, this.ahora());
  }

  private decir(texto: string): void {
    this.anuncio.set(texto);
  }

  private falloComoTexto(failure: unknown, respaldo: string): string | null {
    if (failure instanceof AccessChallengeCancelledError) return null;
    return accessFailureOf(failure)?.message ?? respaldo;
  }

  /* ---- reglas propias ----------------------------------------------------------------- */

  protected nuevaRegla(): void {
    this.reglaEnEdicion.set(null);
    this.falloDeRegla.set(null);
    this.formularioAbierto.set(true);
  }

  protected editarRegla(regla: SodRule): void {
    this.reglaEnEdicion.set(regla);
    this.falloDeRegla.set(null);
    this.formularioAbierto.set(true);
  }

  protected cerrarFormulario(): void {
    this.formularioAbierto.set(false);
    this.reglaEnEdicion.set(null);
    this.falloDeRegla.set(null);
  }

  protected guardarRegla(envio: SodRuleSubmission): void {
    if (this.guardandoRegla()) return;
    this.guardandoRegla.set(true);
    this.falloDeRegla.set(null);
    const nombre = envio.mode === 'create' ? envio.rule.name : (envio.change.name ?? 'la regla');
    const trabajo = this.challenges.run(
      () =>
        envio.mode === 'create'
          ? this.client.createSodRule(envio.rule)
          : this.client.updateSodRule(envio.ruleId, envio.change),
      {
        actionLabel:
          envio.mode === 'create' ? `Crear la regla «${nombre}»` : `Cambiar la regla «${nombre}»`,
      },
    );
    trabajo.subscribe({
      next: () => {
        this.guardandoRegla.set(false);
        this.cerrarFormulario();
        const texto =
          envio.mode === 'create' ? `Regla «${nombre}» creada.` : `Regla «${nombre}» actualizada.`;
        this.toasts.success(texto);
        this.decir(texto);
        this.cargar();
      },
      error: (failure: unknown) => {
        this.guardandoRegla.set(false);
        this.falloDeRegla.set(
          this.falloComoTexto(
            failure,
            'No pudimos guardar la regla. Revise lo escrito e intente de nuevo.',
          ),
        );
      },
    });
  }

  /* ---- pedir una excepción -------------------------------------------------------------- */

  protected abrirPedido(f: SodFinding): void {
    this.pidiendo.set(f);
    this.justificacion.set('');
    this.hasta.set(this.maximoDeFecha());
    this.intentoDePedido.set(false);
    this.falloDePedido.set(null);
    this.pedidoHecho.set(null);
  }

  protected cancelarPedido(): void {
    this.pidiendo.set(null);
    this.falloDePedido.set(null);
  }

  protected enviarPedido(): void {
    const f = this.pidiendo();
    if (f === null || this.enviandoPedido()) return;
    this.intentoDePedido.set(true);
    if (this.justificacionCorta() || this.hasta() === '') return;
    this.enviandoPedido.set(true);
    this.falloDePedido.set(null);
    const persona = this.persona(f.engagementId, 'la persona');
    this.challenges
      .run(
        () =>
          this.client.requestSodException({
            engagementId: f.engagementId,
            ruleCode: f.ruleCode,
            justification: this.justificacion().trim(),
            validTo: this.hasta(),
          }),
        {
          actionLabel: `Pedir una excepción a «${f.ruleName}» para ${persona}`,
        },
      )
      .subscribe({
        next: (pedido: FourEyesRequested) => {
          this.enviandoPedido.set(false);
          this.pidiendo.set(null);
          const aprobador = APROBADORES[pedido.approverKind] ?? 'otra persona autorizada';
          this.pedidoHecho.set({ persona, regla: f.ruleName, aprobador });
          this.decir(`Pedido enviado. Queda pendiente de ${aprobador}.`);
          this.cargar();
        },
        error: (failure: unknown) => {
          this.enviandoPedido.set(false);
          this.falloDePedido.set(
            this.falloComoTexto(failure, 'No pudimos enviar el pedido. Intente de nuevo.'),
          );
        },
      });
  }

  /* ---- revocar una excepción -------------------------------------------------------------- */

  protected async revocar(e: SodException): Promise<void> {
    if (this.revocando() !== null) return;
    const regla = this.nombreDeRegla(e.ruleCode);
    const persona = this.persona(e.engagementId, 'la persona');
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Revocar la excepción',
        message: `${persona} vuelve a estar sujeta a «${regla}». Si hoy incumple la regla, el conflicto reaparece.`,
        confirmLabel: 'Revocar la excepción',
        cancelLabel: 'Conservarla',
        destructive: true,
      },
      { label: 'Motivo', hint: 'Queda registrado.', minLength: 10, maxLength: 300 },
    );
    if (motivo === null) return;
    this.revocando.set(e.id);
    this.falloDeRevocacion.set(null);
    this.challenges
      .run(() => this.client.revokeSodException(e.id, motivo), {
        actionLabel: `Revocar la excepción de ${persona}`,
      })
      .subscribe({
        next: () => {
          this.revocando.set(null);
          const texto = `Excepción de ${persona} revocada.`;
          this.toasts.success(texto);
          this.decir(texto);
          this.cargar();
        },
        error: (failure: unknown) => {
          this.revocando.set(null);
          this.falloDeRevocacion.set(
            this.falloComoTexto(failure, 'No pudimos revocar la excepción.'),
          );
        },
      });
  }
}
