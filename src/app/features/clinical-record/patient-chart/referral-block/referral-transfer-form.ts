import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

import {
  DEPARTURE_CONDITIONS,
  isUnstable,
  TRANSPORT_MODES,
  type DepartureCondition,
  type TransferField,
  type TransportMode,
  type TransferIssue,
  type VitalKey,
} from '../../../../core/data-access/referrals/referral-transfer.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import {
  AMBULANCE_MODE_LIST,
  CONDITION_LABELS,
  DEPARTURE_CONDITION_LIST,
  OTHER_MODE_LIST,
  TRANSPORT_MODE_LABELS,
  VITAL_FIELDS,
  type TransferDraft,
} from './referral-transfer.model';

/**
 * **Traslado** de una derivación: si el paciente viaja, en qué, con quién,
 * en qué estado sale y con qué signos vitales, si se avisó al receptor y
 * cuándo sale (Norma Nacional de Referencia y Contrarreferencia).
 *
 * Presentacional: el borrador vive en quien lo monta (`[(draft)]`), porque
 * `app-tab` no dibuja el panel cerrado y lo escrito no puede perderse al
 * cambiar de pestaña. Las reglas también vienen de afuera (`issues`), las
 * mismas que aplica la API (`transferIssues`); acá sólo se decide cuándo
 * mostrarlas: al salir del campo o al intentar enviar.
 *
 * Lo usan el alta (pestaña «Traslado» del bloque) y «Completar traslado» en
 * el detalle.
 */
@Component({
  selector: 'app-referral-transfer-form',
  imports: [Alert, AppInput, DatePicker, FormField, Radio, RadioGroup, Switch],
  templateUrl: './referral-transfer-form.html',
  styleUrl: './referral-transfer-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralTransferForm {
  /** Lo cargado. Vive afuera para no perderse al cambiar de pestaña. */
  readonly draft = model.required<TransferDraft>();
  /** Los problemas de `transferIssues` sobre el borrador. */
  readonly issues = input<readonly TransferIssue[]>([]);
  /** Se intentó enviar: todos los errores a la vista, toquen o no. */
  readonly showAll = input(false);

  protected readonly ambulanceModes = AMBULANCE_MODE_LIST;
  protected readonly otherModes = OTHER_MODE_LIST;
  protected readonly modeLabels = TRANSPORT_MODE_LABELS;
  protected readonly conditions = DEPARTURE_CONDITION_LIST;
  protected readonly conditionLabels = CONDITION_LABELS;
  protected readonly vitalFields = VITAL_FIELDS;

  protected readonly unstable = computed(() => isUnstable(this.draft().departureCondition ?? undefined));

  /** Por qué se exige lo que se exige, en una línea que se lee antes de completar. */
  protected readonly why = computed(() => {
    const condition = this.draft().departureCondition;
    if (condition === 'UNSTABLE' || condition === 'CRITICAL') {
      return `Con el paciente ${CONDITION_LABELS[condition].toLowerCase()}, la norma de referencia exige que viaje en ambulancia, acompañado por personal de salud que pueda atenderlo en el trayecto, y que el establecimiento receptor esté avisado antes de la salida para que lo espere preparado.`;
    }
    return null;
  });

  private readonly touched = signal<ReadonlySet<TransferField>>(new Set());

  protected errorFor(field: TransferField): string {
    if (!this.showAll() && !this.touched().has(field)) return '';
    return this.issues().find((i) => i.field === field)?.message ?? '';
  }

  protected touch(field: TransferField): void {
    if (this.touched().has(field)) return;
    this.touched.update((all) => new Set([...all, field]));
  }

  protected set<K extends keyof TransferDraft>(key: K, value: TransferDraft[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected setText(key: TextKey, value: string | number | null): void {
    this.draft.update((d) => ({ ...d, [key]: String(value ?? '') }));
  }

  protected setVital(key: VitalKey, value: string | number | null): void {
    this.draft.update((d) => ({ ...d, vitals: { ...d.vitals, [key]: String(value ?? '') } }));
  }

  /** Elegir un estado ya es la interacción completa: se valida en el acto. */
  protected chooseCondition(value: unknown): void {
    if (!(DEPARTURE_CONDITIONS as readonly unknown[]).includes(value)) return;
    this.set('departureCondition', value as DepartureCondition);
    this.touch('departureCondition');
  }

  protected chooseMode(value: unknown): void {
    if (!(TRANSPORT_MODES as readonly unknown[]).includes(value)) return;
    this.set('transportMode', value as TransportMode);
    this.touch('transportMode');
  }
}

type TextKey =
  | 'transportDetail'
  | 'companionName'
  | 'companionRelationship'
  | 'companionPhone'
  | 'escortProfessionalName'
  | 'escortProfessionalRole'
  | 'receiverContactName';
