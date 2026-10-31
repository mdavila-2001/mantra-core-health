import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { catchError, of } from 'rxjs';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import type {
  NormalizeEngagementPlan,
  NormalizeLegacyResponse,
  RevertNormalizeResponse,
} from '../../../core/data-access/access-governance/governance-rules.types';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import { atomMeta } from '../../../core/data-access/support-access/support-atoms';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AccessChallengeService } from '../access-challenge/access-challenge.service';

/** En qué paso está la persona: sin simulacro, con el simulacro a la vista, aplicado, o revertido. */
type Fase = 'INICIO' | 'SIMULACRO' | 'APLICADO' | 'REVERTIDO';

/**
 * **Permisos antiguos → permisos precisos** (`POST /org/governance/normalize-legacy`, CONTRATO-GOBIERNO §2.5).
 *
 * Tres pasos que se ven como tales: *simulacro* (no cambia nada: dice qué pasaría con cada persona), *aplicar* (con el
 * reconocimiento explícito de lo que **exige más** a alguien, si lo hay) y *revertir* el lote. Cada paso pide el segundo paso
 * cuando la API lo exige. Lo que se muestra de cada permiso sale de lo que la API calculó, no de lo que la pantalla supone.
 */
@Component({
  selector: 'app-normalize-legacy',
  imports: [Alert, AppButton, Badge, Checkbox],
  templateUrl: './normalize-legacy.html',
  styleUrl: './normalize-legacy.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NormalizeLegacy implements OnInit {
  private readonly client = inject(AccessGovernanceClient);
  private readonly engagements = inject(SupportAccessClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly fase = signal<Fase>('INICIO');
  protected readonly plan = signal<NormalizeLegacyResponse | null>(null);
  protected readonly aplicado = signal<NormalizeLegacyResponse | null>(null);
  protected readonly revertido = signal<RevertNormalizeResponse | null>(null);
  protected readonly reconocido = signal(false);
  protected readonly trabajando = signal<'simulacro' | 'aplicar' | 'revertir' | null>(null);
  protected readonly fallo = signal<string | null>(null);
  protected readonly anuncio = signal('');
  private readonly nombres = signal<Readonly<Record<string, string>>>({});

  protected readonly cuantasPersonas = computed(() => this.plan()?.engagements.length ?? 0);
  protected readonly estrechamientos = computed(
    () => this.plan()?.engagements.reduce((n, e) => n + e.tightening.length, 0) ?? 0,
  );
  protected readonly puedeAplicar = computed(() => {
    const p = this.plan();
    return (
      p !== null && p.engagements.length > 0 && (!p.requiresAcknowledgement || this.reconocido())
    );
  });

  ngOnInit(): void {
    this.engagements
      .listEngagements()
      .pipe(catchError(() => of({ items: [] as readonly { id: string; personName: string }[] })))
      .subscribe((page) =>
        this.nombres.set(Object.fromEntries(page.items.map((e) => [e.id, e.personName]))),
      );
  }

  protected persona(e: NormalizeEngagementPlan): string {
    return this.nombres()[e.engagementId] ?? 'Una persona del equipo';
  }

  protected nombreDelPermiso(code: string): string {
    return atomMeta(code)?.name ?? code;
  }

  protected resumen(r: NormalizeLegacyResponse): string {
    const personas = r.engagements.length;
    const permisos = r.totals['grants'] ?? r.engagements.reduce((n, e) => n + e.grants.length, 0);
    if (personas === 0) return 'No hay permisos antiguos que convertir.';
    return `${personas} ${personas === 1 ? 'persona' : 'personas'} y ${permisos} ${permisos === 1 ? 'permiso' : 'permisos'}.`;
  }

  private decir(texto: string): void {
    this.anuncio.set(texto);
  }

  private falloComoTexto(failure: unknown, respaldo: string): string | null {
    if (failure instanceof AccessChallengeCancelledError) return null;
    return accessFailureOf(failure)?.message ?? respaldo;
  }

  protected simular(): void {
    if (this.trabajando() !== null) return;
    this.trabajando.set('simulacro');
    this.fallo.set(null);
    this.challenges
      .run(() => this.client.normalizeLegacy({ dryRun: true }), {
        actionLabel: 'Hacer un simulacro: no cambia nada',
      })
      .subscribe({
        next: (respuesta) => {
          this.trabajando.set(null);
          this.plan.set(respuesta);
          this.reconocido.set(false);
          this.fase.set('SIMULACRO');
          this.decir(`Simulacro listo. ${this.resumen(respuesta)}`);
        },
        error: (failure: unknown) => {
          this.trabajando.set(null);
          this.fallo.set(
            this.falloComoTexto(failure, 'No pudimos hacer el simulacro. Intente de nuevo.'),
          );
        },
      });
  }

  protected async aplicar(): Promise<void> {
    const plan = this.plan();
    if (plan === null || this.trabajando() !== null || !this.puedeAplicar()) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Aplicar el cambio',
      message: `Se convierten los permisos antiguos de ${this.resumen(plan).replace(/\.$/, '')}. Puede revertir el lote después.`,
      confirmLabel: 'Aplicar el cambio',
      cancelLabel: 'Todavía no',
    });
    if (!confirmado) return;
    this.trabajando.set('aplicar');
    this.fallo.set(null);
    this.challenges
      .run(
        () =>
          this.client.normalizeLegacy({
            dryRun: false,
            ...(plan.requiresAcknowledgement ? { acknowledgeTightening: true } : {}),
          }),
        { actionLabel: 'Pasar los permisos antiguos a permisos precisos' },
      )
      .subscribe({
        next: (respuesta) => {
          this.trabajando.set(null);
          this.aplicado.set(respuesta);
          this.fase.set('APLICADO');
          this.toasts.success('Permisos convertidos.');
          this.decir(`Cambio aplicado. ${this.resumen(respuesta)}`);
        },
        error: (failure: unknown) => {
          this.trabajando.set(null);
          this.fallo.set(
            this.falloComoTexto(failure, 'No pudimos aplicar el cambio. Nada se modificó.'),
          );
        },
      });
  }

  protected async revertir(): Promise<void> {
    const lote = this.aplicado()?.batchId;
    if (lote === undefined || this.trabajando() !== null) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Revertir el lote',
      message: 'Los permisos vuelven a ser los antiguos que eran antes de aplicar el cambio.',
      confirmLabel: 'Revertir el lote',
      cancelLabel: 'Conservar el cambio',
      destructive: true,
    });
    if (!confirmado) return;
    this.trabajando.set('revertir');
    this.fallo.set(null);
    this.challenges
      .run(() => this.client.revertNormalize(lote), { actionLabel: 'Revertir el lote de permisos' })
      .subscribe({
        next: (respuesta) => {
          this.trabajando.set(null);
          this.revertido.set(respuesta);
          this.fase.set('REVERTIDO');
          this.toasts.success('Lote revertido.');
          this.decir(
            `Lote revertido. Se restauraron ${respuesta.restoredAliasRows} permisos antiguos.`,
          );
        },
        error: (failure: unknown) => {
          this.trabajando.set(null);
          const f = accessFailureOf(failure);
          this.fallo.set(
            f?.status === 404
              ? 'Ese lote ya no existe o ya se revirtió.'
              : this.falloComoTexto(failure, 'No pudimos revertir el lote. Intente de nuevo.'),
          );
        },
      });
  }

  protected volverAEmpezar(): void {
    this.fase.set('INICIO');
    this.plan.set(null);
    this.aplicado.set(null);
    this.revertido.set(null);
    this.reconocido.set(false);
    this.fallo.set(null);
  }
}
