import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import type { InformedConsent } from '../../../../core/data-access/informed-consents/informed-consents.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { REFERRAL_TYPES_WITH_CONSENT } from '../../../../core/data-access/referrals/referrals.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import type { DiagnosticoDelPlan } from '../care-plan-block/care-plan-block';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { consentimientosDelPaciente } from '../informed-consent/consentimientos-del-paciente';
import { InformedConsentBadge } from '../informed-consent/informed-consent-badge';
import { ReferralDetail } from './referral-detail';
import { ReferralForm, TARGET_PRIORIDAD } from './referral-form';
import { destinoDe, estadoDe, etiquetaDePrioridad, etiquetaDeTipo, vencida } from './referral-labels';

/** Una fila de la lista, ya en palabras. */
export interface FilaDeDerivacion {
  readonly id: string;
  readonly tipo: string;
  readonly destino: string;
  readonly servicio: string;
  readonly prioridad: string;
  readonly estado: { readonly etiqueta: string; readonly tono: ReturnType<typeof estadoDe>['tono'] };
  readonly vigencia: Date | undefined;
  readonly vencida: boolean;
  readonly admiteConsentimiento: boolean;
  /** Lo que dice la API: hay un consentimiento ACEPTADO vinculado. */
  readonly consentimientoVinculado: boolean;
}

/**
 * **Derivaciones** del expediente: las que tiene la persona y la emisión de una
 * nueva, a un profesional, a una organización o sede, o fuera de la plataforma.
 *
 * ```html
 * <app-referral-block [patientProfileId]="id" [puedeEscribir]="true" [diagnosticos]="dx()" />
 * ```
 *
 * ## Una tarjeta, dos pestañas
 *
 * «Derivaciones» (la lista) y «Nueva derivación» (el formulario), en UNA
 * `app-card` con `app-tabs` (composition-rules §5). Lo escrito en el
 * formulario vive en señales del componente del formulario, que sigue vivo al
 * cambiar de pestaña.
 *
 * ## Emitida, se ofrece el consentimiento
 *
 * Al emitir una de tratamiento, procedimiento, estudio, terapia o internación,
 * se vuelve a la lista y se abre su detalle con el consentimiento informado
 * dirigido a ella: es el próximo paso, y la norma lo pide antes de enviar.
 */
@Component({
  selector: 'app-referral-block',
  imports: [
    AppButton,
    Badge,
    Card,
    ContentDialog,
    DataTable,
    DatePipe,
    InformedConsentBadge,
    ReferralDetail,
    ReferralForm,
    Tab,
    Tabs,
  ],
  templateUrl: './referral-block.html',
  styleUrl: './referral-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralBlock {
  private readonly referrals = inject(ReferralsClient);
  private readonly toasts = inject(ToastService);
  private readonly profiles = inject(ProfilesClient);

  readonly patientProfileId = input.required<string>();
  readonly encounterId = input<string | null>(null);
  /** Si esta sesión puede escribir en la historia (la API vuelve a decidir). */
  readonly puedeEscribir = input(false);
  readonly diagnosticos = input<readonly DiagnosticoDelPlan[]>([]);
  /** Las citas de la persona, para atar el consentimiento a una atención. */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  protected readonly pestana = signal(0);

  /* -- La lista -------------------------------------------------------------- */

  private readonly version = signal(0);
  protected readonly lectura = signal<ViewState<readonly Referral[]>>(loading());

  constructor() {
    effect((onCleanup) => {
      const paciente = this.patientProfileId();
      this.version();
      if (paciente === '') return;
      untracked(() => this.lectura.set(loading()));
      const sub = this.referrals.listByPatient(paciente).subscribe({
        next: (filas) => {
          this.lectura.set(ready(filas));
          this.resolverNombres(filas);
        },
        error: (error: unknown) => this.lectura.set(errorToViewState(error)),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  /**
   * Los nombres de los profesionales destino.
   *
   * `ReferralResponseDto` resuelve organización y sede pero no al profesional:
   * se leen acá, uno por id distinto y una sola vez
   * (`GET /profiles/practitioners/:id/summary`). Si no se puede, la fila dice
   * «Profesional de la plataforma» — nunca el uuid.
   */
  private readonly nombresDeProfesional = signal<ReadonlyMap<string, string>>(new Map());
  private readonly pedidos = new Set<string>();

  private resolverNombres(filas: readonly Referral[]): void {
    for (const id of new Set(filas.map((r) => r.targetProfileId).filter((v): v is string => v !== undefined))) {
      if (this.pedidos.has(id)) continue;
      this.pedidos.add(id);
      this.profiles
        .getPractitionerProfile(id)
        .pipe(catchError(() => of(null)))
        .subscribe((perfil) => {
          const nombre = perfil?.displayName;
          if (nombre) {
            this.nombresDeProfesional.update((m) => new Map([...m, [id, nombre]]));
          }
        });
    }
  }

  protected recargar(): void {
    this.version.update((v) => v + 1);
    this.consentimientos.recargar();
  }

  protected readonly consentimientos = consentimientosDelPaciente(() => this.patientProfileId());

  private readonly prioridades = toSignal(
    inject(SystemContextClient)
      .dynamicEnum(TARGET_PRIORIDAD)
      .pipe(
        map((e) => new Map(e.options.map((o) => [o.conceptId, o] as const))),
        catchError(() => of(new Map<string, DynamicEnumOption>())),
      ),
    { initialValue: new Map<string, DynamicEnumOption>() },
  );

  private readonly derivaciones = computed<readonly Referral[]>(() => {
    const estado = this.lectura();
    const filas = estado.status === 'ready' || estado.status === 'stale' ? estado.data : [];
    const nombres = this.nombresDeProfesional();
    return filas.map((r) =>
      r.targetProfileId !== undefined && r.targetProfileName === undefined && nombres.has(r.targetProfileId)
        ? { ...r, targetProfileName: nombres.get(r.targetProfileId) }
        : r,
    );
  });

  protected readonly cantidad = computed(() => this.derivaciones().length);

  private filaDe(r: Referral): FilaDeDerivacion {
    const prioridad = r.priorityConceptId === undefined ? undefined : this.prioridades().get(r.priorityConceptId);
    return {
      id: r.id,
      tipo: etiquetaDeTipo(r.referralType),
      destino: destinoDe(r),
      servicio: r.requestedServiceText ?? r.reasonText ?? 'Sin detallar',
      prioridad: prioridad === undefined ? 'Rutina' : etiquetaDePrioridad(prioridad.code, prioridad.display),
      estado: estadoDe(r),
      vigencia: r.validUntil,
      vencida: vencida(r),
      admiteConsentimiento:
        r.referralType !== undefined && REFERRAL_TYPES_WITH_CONSENT.has(r.referralType),
      consentimientoVinculado: r.informedConsentId !== undefined,
    };
  }

  /** S2/S4–S9 los resuelve la tabla; el vacío trae su próxima acción (S3). */
  protected readonly estadoDeLaTabla = computed<ViewState<readonly FilaDeDerivacion[]>>(() => {
    const estado = this.lectura();
    if (estado.status !== 'ready' && estado.status !== 'stale') {
      return estado as ViewState<readonly FilaDeDerivacion[]>;
    }
    if (estado.data.length === 0) {
      return empty(
        {
          label: this.puedeEscribir()
            ? 'Emití la primera en la pestaña «Nueva derivación»'
            : 'Las derivaciones que se emitan aparecen acá',
        },
        'Esta persona todavía no tiene derivaciones.',
      );
    }
    return ready(this.derivaciones().map((r) => this.filaDe(r)));
  });

  private readonly celdaEstado = viewChild.required<TemplateRef<{ $implicit: FilaDeDerivacion }>>('celdaEstado');
  private readonly celdaVigencia = viewChild.required<TemplateRef<{ $implicit: FilaDeDerivacion }>>('celdaVigencia');
  private readonly celdaConsentimiento =
    viewChild.required<TemplateRef<{ $implicit: FilaDeDerivacion }>>('celdaConsentimiento');
  private readonly celdaVer = viewChild.required<TemplateRef<{ $implicit: FilaDeDerivacion }>>('celdaVer');

  protected readonly columnas = computed<readonly ColumnDef<FilaDeDerivacion>[]>(() => [
    { key: 'tipo', header: 'Tipo', priority: 1 },
    { key: 'destino', header: 'Destino', priority: 1 },
    { key: 'servicio', header: 'Servicio pedido', priority: 2 },
    { key: 'prioridad', header: 'Prioridad', priority: 3 },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'vigencia', header: 'Vigencia', priority: 3, cell: this.celdaVigencia() },
    { key: 'consentimiento', header: 'Consentimiento', priority: 2, cell: this.celdaConsentimiento() },
    { key: 'ver', header: '', priority: 1, align: 'end', cell: this.celdaVer() },
  ]);

  protected readonly porFila = (fila: FilaDeDerivacion): string => fila.id;

  /* -- El detalle ------------------------------------------------------------ */

  protected readonly abiertaId = signal<string | null>(null);
  protected readonly recienEmitida = signal(false);
  protected readonly abierta = computed(
    () => this.derivaciones().find((r) => r.id === this.abiertaId()) ?? this.pendienteDeLista(),
  );

  /** La recién emitida, hasta que la relectura la traiga. */
  private readonly pendienteDeLista = signal<Referral | null>(null);

  protected ver(fila: FilaDeDerivacion): void {
    this.recienEmitida.set(false);
    this.pendienteDeLista.set(null);
    this.abiertaId.set(fila.id);
  }

  protected cerrarDetalle(): void {
    this.abiertaId.set(null);
    this.pendienteDeLista.set(null);
    this.recienEmitida.set(false);
  }

  /**
   * El panel registró o revocó un consentimiento de ESTA derivación.
   *
   * El vínculo lo escribe la API (`informedConsentId`): se relee la derivación
   * (`GET /referrals/:id`) y la fila muestra lo que el servidor dice, no lo que
   * el panel supone.
   */
  protected alCambiarConsentimiento(referralId: string, consent: InformedConsent | null): void {
    this.consentimientos.incorporar(consent);
    this.referrals.get(referralId).subscribe({
      next: (releida) => {
        this.lectura.update((estado) =>
          estado.status === 'ready'
            ? ready(estado.data.map((r) => (r.id === releida.id ? releida : r)))
            : estado,
        );
        if (this.pendienteDeLista()?.id === releida.id) {
          this.pendienteDeLista.set(releida);
        }
      },
      // Si la relectura falla, la lista se relee entera: no se inventa el vínculo.
      error: () => this.recargar(),
    });
  }

  protected alEmitir(creada: Referral): void {
    this.pestana.set(0);
    this.recargar();
    const conConsentimiento =
      creada.referralType !== undefined && REFERRAL_TYPES_WITH_CONSENT.has(creada.referralType);
    this.toasts.success(
      conConsentimiento
        ? 'Próximo paso: registrá el consentimiento informado de la persona.'
        : 'Queda en la lista de derivaciones, pendiente de respuesta del destino.',
      'Derivación emitida',
    );
    if (conConsentimiento) {
      this.pendienteDeLista.set(creada);
      this.recienEmitida.set(true);
      this.abiertaId.set(creada.id);
    }
  }
}
