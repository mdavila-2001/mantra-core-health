import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import {
  motivoDeDerivacion,
  type MotivoDeDerivacion,
} from '../../../../core/data-access/referrals/referrals.errors';
import {
  problemasDeDerivacion,
  REFERRAL_LIMITS,
  REFERRAL_TYPES,
  type CreateReferralInput,
  type ProblemaDeDerivacion,
  type Referral,
  type ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import type { DiagnosticoDelPlan } from '../care-plan-block/care-plan-block';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { mensajeDeEscritura } from '../../mensaje-de-escritura';
import { DestinoDeDerivacion, type DestinoElegido } from './referral-destination';
import { EJEMPLO_DE_SERVICIO, ETIQUETA_DE_TIPO, etiquetaDePrioridad } from './referral-labels';

/** El campo de catálogo de la prioridad. */
export const TARGET_PRIORIDAD = 'clinical_ext.referrals.priority_concept_id';


type Campo = ProblemaDeDerivacion['campo'];

interface OpcionDePrioridad {
  readonly value: string;
  readonly label: string;
}

/**
 * **Emitir una derivación** — el formulario de la pestaña «Nueva derivación».
 *
 * ## El orden es el de la decisión clínica
 *
 * Qué clase de derivación → a quién → qué servicio → por qué (lo clínico) →
 * con qué urgencia y hasta cuándo. De lo fácil a lo exigente: el resumen
 * clínico, que es lo que más cuesta escribir, llega cuando ya está claro a
 * quién va dirigido.
 *
 * ## Se valida al salir del campo, no a cada tecla
 *
 * Un error que aparece mientras se escribe la primera letra regaña antes de
 * dejar terminar. El campo se marca al perder el foco; al pulsar «Emitir
 * derivación» se marcan todos, se resume arriba y el foco va al primero.
 * Las reglas son las de la API ({@link problemasDeDerivacion}); la API vuelve
 * a validar y es la que decide.
 */
@Component({
  selector: 'app-referral-form',
  imports: [
    Alert,
    DatePicker,
    DestinoDeDerivacion,
    FormActions,
    FormField,
    Input,
    Radio,
    RadioGroup,
    Select,
    Textarea,
  ],
  templateUrl: './referral-form.html',
  styleUrl: './referral-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralForm {
  private readonly referrals = inject(ReferralsClient);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly patientProfileId = input.required<string>();
  readonly encounterId = input<string | null>(null);
  /**
   * Las citas de la persona: la derivación se ata a la consulta donde se
   * decidió (`sourceEncounterId`), y el consentimiento dirigido a ella también.
   */
  readonly citas = input<readonly CitaDelPaciente[]>([]);
  /** Los diagnósticos del expediente, para copiar uno al campo de diagnóstico. */
  readonly diagnosticos = input<readonly DiagnosticoDelPlan[]>([]);

  /** La derivación quedó emitida; el contenedor relee y ofrece el consentimiento. */
  readonly emitida = output<Referral>();

  protected readonly limites = REFERRAL_LIMITS;

  /* -- Lo cargado: en señales, para sobrevivir al cambio de pestaña -------- */
  protected readonly tipo = signal<ReferralType | null>(null);
  protected readonly destino = signal<DestinoElegido>({ modo: null });
  protected readonly servicio = signal('');
  protected readonly diagnostico = signal('');
  protected readonly resumen = signal('');
  protected readonly tratamiento = signal('');
  protected readonly motivo = signal('');
  protected readonly prioridad = signal<string | null>(null);
  protected readonly vigencia = signal<Date | null>(null);
  protected readonly citaElegida = signal<string | null>(null);

  protected readonly opcionesDeCita = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Sin consulta asociada' },
    ...this.citas().map((c) => ({ value: c.id, label: c.enCurso ? `${c.etiqueta} · en curso` : c.etiqueta })),
  ]);

  protected readonly opcionesDeTipo: readonly SelectOption<ReferralType>[] = REFERRAL_TYPES.map(
    (t) => ({ value: t, label: ETIQUETA_DE_TIPO[t] }),
  );

  protected readonly opcionesDeDiagnostico = computed(() =>
    this.diagnosticos().map((dx) => ({ value: dx.etiqueta, label: dx.etiqueta })),
  );

  /** Las prioridades del catálogo; `null` si el catálogo no respondió. */
  protected readonly prioridades = toSignal(
    inject(SystemContextClient)
      .dynamicEnum(TARGET_PRIORIDAD)
      .pipe(
        map((e): readonly OpcionDePrioridad[] | null =>
          [...e.options]
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((o) => ({ value: o.conceptId, label: etiquetaDePrioridad(o.code, o.display) })),
        ),
        catchError(() => of(null)),
      ),
    { initialValue: [] as readonly OpcionDePrioridad[] | null },
  );

  protected elegirPrioridad(valor: unknown): void {
    this.prioridad.set(typeof valor === 'string' ? valor : null);
  }

  protected readonly ejemploDeServicio = computed(() =>
    EJEMPLO_DE_SERVICIO[this.tipo() ?? 'CONSULTATION'],
  );

  /* -- Validación ---------------------------------------------------------- */

  private readonly tocados = signal<ReadonlySet<Campo>>(new Set());
  protected readonly intentoDeEnvio = signal(false);

  private readonly entrada = computed<Partial<CreateReferralInput>>(() => {
    const d = this.destino();
    return {
      patientProfileId: this.patientProfileId(),
      ...(this.tipo() === null ? {} : { referralType: this.tipo()! }),
      targetProfileId: d.modo === 'PROFESIONAL' ? d.profileId : undefined,
      targetTenantId: d.modo === 'ORGANIZACION' ? d.tenantId : undefined,
      targetBranchId: d.modo === 'ORGANIZACION' ? d.branchId : undefined,
      targetExternalName: d.modo === 'EXTERNO' ? d.nombre?.trim() : undefined,
      targetExternalContact: d.modo === 'EXTERNO' ? d.contacto?.trim() : undefined,
      requestedServiceText: this.servicio().trim(),
      diagnosisText: this.diagnostico().trim(),
      clinicalSummary: this.resumen().trim(),
      treatmentGivenText: this.tratamiento().trim(),
      reasonText: this.motivo().trim(),
      ...(this.prioridad() === null ? {} : { priorityConceptId: this.prioridad()! }),
      ...(this.vigencia() === null ? {} : { validUntil: this.vigencia()! }),
    };
  });

  protected readonly problemas = computed(() => problemasDeDerivacion(this.entrada()));

  /** Los problemas que ya corresponde mostrar: del campo tocado, o todos tras enviar. */
  protected readonly visibles = computed(() =>
    this.problemas().filter((p) => this.intentoDeEnvio() || this.tocados().has(p.campo)),
  );

  protected errorDe(campo: Campo): string {
    return this.visibles().find((p) => p.campo === campo)?.mensaje ?? '';
  }

  protected tocar(campo: Campo): void {
    if (!this.tocados().has(campo)) {
      this.tocados.update((s) => new Set([...s, campo]));
    }
  }

  /** Si un paso del formulario ya tiene lo que exige, para la marca de progreso. */
  protected pasoCompleto(campos: readonly Campo[]): boolean {
    return !this.problemas().some((p) => campos.includes(p.campo));
  }

  /* -- El envío ------------------------------------------------------------ */

  protected readonly emitiendo = signal(false);
  protected readonly envio = signal<ViewState<null>>(ready(null));
  /** El sub-código de la API (`reason`), si el rechazo trajo uno conocido. */
  private readonly motivoDelRechazo = signal<MotivoDeDerivacion | null>(null);
  protected readonly errorDelEnvio = computed(
    () =>
      this.motivoDelRechazo()?.mensaje ??
      mensajeDeEscritura(this.envio(), { accion: 'emitir la derivación' }),
  );

  protected emitir(): void {
    if (this.emitiendo()) {
      return;
    }
    this.intentoDeEnvio.set(true);
    const problemas = this.problemas();
    if (problemas.length > 0) {
      this.enfocar(problemas[0]!.campo);
      return;
    }
    const entrada = this.entrada() as CreateReferralInput;
    const encuentro = this.citaElegida() ?? this.encounterId();
    const autor = this.auth.practitionerProfileId();
    this.emitiendo.set(true);
    this.motivoDelRechazo.set(null);
    this.envio.set(loading());
    this.referrals
      .create({
        ...entrada,
        ...(encuentro === null ? {} : { sourceEncounterId: encuentro }),
        ...(autor === null ? {} : { referringProfileId: autor }),
      })
      .subscribe({
        next: (creada) => {
          this.emitiendo.set(false);
          this.envio.set(ready(null));
          this.limpiar();
          this.emitida.emit(creada);
        },
        error: (error: unknown) => {
          this.emitiendo.set(false);
          this.motivoDelRechazo.set(motivoDeDerivacion(error));
          this.envio.set(errorToViewState<null>(error));
        },
      });
  }

  /** Lleva el foco al primer control del campo con error. */
  private enfocar(campo: Campo): void {
    const contenedor = this.host.nativeElement.querySelector(`[data-campo="${campo}"]`);
    const control = contenedor?.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
    );
    control?.focus();
  }

  private limpiar(): void {
    this.tipo.set(null);
    this.destino.set({ modo: null });
    this.servicio.set('');
    this.diagnostico.set('');
    this.resumen.set('');
    this.tratamiento.set('');
    this.motivo.set('');
    this.prioridad.set(null);
    this.vigencia.set(null);
    this.citaElegida.set(null);
    this.tocados.set(new Set());
    this.intentoDeEnvio.set(false);
  }
}
