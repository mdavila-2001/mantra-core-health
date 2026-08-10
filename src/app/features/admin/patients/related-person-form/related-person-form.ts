import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type { NewRelatedPerson } from '../../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';

/** Largo que declara `AddRelatedPersonDto`. */
const MAX_NOMBRE = 300;

/**
 * Alta de una persona relacionada — vista **V05-05**
 * (`POST /profiles/patients/{profileId}/related-persons`, UC-05-10).
 *
 * Va como formulario dentro de la pestaña «Contactos» de la ficha, que es donde
 * el vault la ubica: «pestaña dentro de la ficha de Pacientes, no una entrada
 * de menú propia».
 *
 * ## Todos los campos son opcionales, y eso significa algo
 *
 * El contrato no exige ninguno. No es descuido: sin `personId` el backend
 * **crea** la persona con lo que se le mande, y con él reutiliza una existente.
 * Son dos casos de uso en un solo cuerpo.
 *
 * Acá se cubre el primero —crear— porque es el habitual: se registra al hijo,
 * al cónyuge o al vecino que acompaña, y esa persona no suele estar ya en el
 * sistema. **Reutilizar una persona existente exige un buscador de personas que
 * el backend no expone**: no hay `GET /profiles/persons`. Cuando exista, este
 * formulario suma el campo y no cambia nada más.
 *
 * Aun siendo todos opcionales, **el nombre se pide obligatorio en la interfaz**:
 * un contacto de emergencia sin nombre no es un contacto de emergencia, es una
 * fila. El backend lo aceptaría; la pantalla no tiene por qué.
 *
 * ## El parentesco queda afuera
 *
 * `relationshipConceptId` es un campo de catálogo y no hay conjunto de valores
 * sembrado para él — sólo un placeholder `DEFAULT_*`. Es el bloqueo general de
 * los `*_concept_id`, no algo propio de esta vista.
 */
@Component({
  selector: 'app-related-person-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    DatePicker,
    FormActions,
    FormField,
    Input,
    ReactiveFormsModule,
    Switch,
  ],
  templateUrl: './related-person-form.html',
  styleUrl: './related-person-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatedPersonForm {
  private readonly profiles = inject(ProfilesClient);

  /** Paciente al que se le agrega el contacto. */
  readonly profileId = input.required<string>();

  /**
   * Si el paciente ya tiene un tutor legal registrado. El modelo admite **uno
   * solo activo**, así que la pantalla lo advierte antes de que el backend lo
   * rechace.
   */
  readonly yaTieneTutor = input(false);

  /** Se registró el contacto: quien contenga esta pieza debe releer la ficha. */
  readonly registered = output<void>();

  readonly cancelled = output<void>();

  protected readonly form = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
  });

  /** Fuera del grupo: el selector trabaja con `Date | null` y el contrato pide texto. */
  protected readonly fechaDeNacimiento = signal<Date | null>(null);

  protected readonly esContactoDeEmergencia = signal(false);
  protected readonly esTutorLegal = signal(false);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  /** Elegir tutor cuando ya hay uno: se avisa antes de gastar el viaje. */
  protected readonly conflictoDeTutor = computed(
    () => this.esTutorLegal() && this.yaTieneTutor(),
  );

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'No tenés permiso para registrar contactos.';
    }
    if (state.status === 'not-found') {
      return 'El paciente ya no existe. Volvé al listado.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected submit(): void {
    if (this.enviando() || this.conflictoDeTutor()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.profiles.addRelatedPerson(this.profileId(), this.datos()).subscribe({
      next: () => {
        this.state.set(ready(null));
        this.limpiar();
        this.registered.emit();
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected cancelar(): void {
    this.limpiar();
    this.cancelled.emit();
  }

  private limpiar(): void {
    this.form.reset();
    this.fechaDeNacimiento.set(null);
    this.esContactoDeEmergencia.set(false);
    this.esTutorLegal.set(false);
    this.state.set(ready(null));
  }

  /**
   * El cuerpo de la petición.
   *
   * Los dos interruptores **siempre viajan**, incluso en `false`: el contrato
   * los declara con `default: false`, pero omitirlos deja que el valor lo
   * decida el servidor. Acá la persona ya decidió, y «no es tutor» es una
   * decisión, no una ausencia.
   */
  private datos(): NewRelatedPerson {
    const { displayName } = this.form.getRawValue();
    const fecha = this.fechaDeNacimiento();

    return {
      displayName: displayName.trim(),
      isEmergencyContact: this.esContactoDeEmergencia(),
      isLegalGuardian: this.esTutorLegal(),
      ...(fecha === null ? {} : { birthDate: isoDate(fecha) }),
    };
  }
}

/**
 * La fecha en `YYYY-MM-DD`, **en hora local**.
 *
 * `toISOString()` convierte a UTC antes de recortar, así que una fecha elegida
 * como 1 de enero en un huso al oeste de Greenwich se enviaría como 31 de
 * diciembre.
 */
function isoDate(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
