import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';

import { Select } from '../../atoms/select/select';
import type { SelectOption } from '../../atoms/select/select.types';
import {
  AFFILIATE_LABEL,
  OWN_OFFICE_KEY,
  OWN_OFFICE_LABEL,
  type OrganizationChoice,
  type PractitionerOrganization,
} from './organization-select.types';

/** La clave de la última opción: no es una organización, es la puerta para pedir una. */
const AFFILIATE_KEY = 'affiliate';

/**
 * Selector de **dónde** publica el médico: «Mi consultorio» primero y elegido
 * por omisión, después sus organizaciones, y al final «Afiliarme a otra
 * organización…».
 *
 * Es presentacional: no pide nada. Las organizaciones las trae
 * `OrganizationSelectContainer`, al lado de este archivo, o la pantalla que ya
 * las tenga.
 *
 * ## La última opción no es un valor
 *
 * Elegirla emite {@link affiliationRequested} y el desplegable vuelve a lo que
 * tenía. Pedir la afiliación no es publicar ahí: la solicitud queda pendiente
 * hasta que la organización la apruebe, y mientras tanto lo publicado tiene que
 * seguir yendo a donde iba.
 *
 * ## El nombre accesible
 *
 * Suelto, lo nombra `ariaLabel`. Dentro de un `app-form-field` lo nombra el
 * rótulo del campo: el `app-select` de adentro lo toma por inyección, igual que
 * si la pantalla lo hubiera puesto directo.
 */
@Component({
  selector: 'app-organization-select',
  imports: [Select],
  template: `
    <app-select
      data-testid="organization-select"
      placeholder="Elija la organización"
      [options]="options()"
      [value]="shownKey()"
      [disabled]="disabled()"
      [ariaLabel]="ariaLabel()"
      (valueChange)="pick($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationSelect {
  /** Las organizaciones del médico; la de `isOwnOffice` es «Mi consultorio». */
  readonly organizations = input<readonly PractitionerOrganization[]>([]);

  /** La clave elegida: {@link OWN_OFFICE_KEY} o un `practiceId`. */
  readonly value = input<string>(OWN_OFFICE_KEY);

  readonly disabled = input(false);
  readonly ariaLabel = input('Organización');

  /** El médico eligió dónde publicar. */
  readonly selected = output<OrganizationChoice>();

  /** El médico quiere afiliarse a otra organización. El valor no cambió. */
  readonly affiliationRequested = output<void>();

  private readonly select = viewChild.required<Select<string>>(Select);

  /**
   * Lo que muestra el desplegable: el `value` de afuera o, si la pantalla no lo
   * devuelve, lo último que se eligió acá.
   */
  protected readonly shownKey = linkedSignal(() => this.value());

  private readonly ownOffice = computed(
    () => this.organizations().find((organization) => organization.isOwnOffice) ?? null,
  );

  private readonly affiliated = computed(() =>
    this.organizations().filter((organization) => !organization.isOwnOffice),
  );

  protected readonly options = computed<readonly SelectOption<string>[]>(() => [
    this.ownOfficeOption(),
    ...this.affiliated().map((organization) => ({
      value: organization.practiceId,
      label: organization.name,
    })),
    { value: AFFILIATE_KEY, label: AFFILIATE_LABEL },
  ]);

  protected pick(key: string | null): void {
    if (key === AFFILIATE_KEY) {
      this.restoreShownKey();
      this.affiliationRequested.emit();
      return;
    }
    if (key === null || key === this.shownKey()) {
      return;
    }
    this.shownKey.set(key);
    this.selected.emit({ key, organization: this.organizationFor(key) });
  }

  /** Con el consultorio registrado, su nombre va en segunda línea. */
  private ownOfficeOption(): SelectOption<string> {
    const ownOffice = this.ownOffice();
    return ownOffice === null
      ? { value: OWN_OFFICE_KEY, label: OWN_OFFICE_LABEL }
      : { value: OWN_OFFICE_KEY, label: OWN_OFFICE_LABEL, description: ownOffice.name };
  }

  /**
   * `app-select` ya se quedó con la opción de afiliarse, y el enlace `[value]`
   * no lo corrige solo: `shownKey()` no cambió, y Angular no vuelve a mandar un
   * valor igual al anterior. Por eso se le devuelve a mano. El `valueChange`
   * que eso dispara vuelve a {@link pick} con la clave que ya estaba, y ahí
   * termina.
   */
  private restoreShownKey(): void {
    this.select().value.set(this.shownKey());
  }

  private organizationFor(key: string): PractitionerOrganization | null {
    if (key === OWN_OFFICE_KEY) {
      return this.ownOffice();
    }
    return this.affiliated().find((organization) => organization.practiceId === key) ?? null;
  }
}
