import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  NewPatientProfile,
  PatientProfile,
} from '../../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../../shared/components/organisms/form-section/form-section';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { patientDetailRoute, PATIENTS_ROUTE } from '../patients.routes';

/** Largos que declara `CreatePatientDto`. */
const MAX_CODIGO = 100;
const MAX_NOMBRE = 300;
const MAX_MPI = 100;

/**
 * Alta de persona y perfil de paciente — vista **V05-01·F**
 * (`POST /profiles/patients`, UC-05-01).
 *
 * ## Una sola petición, y no por comodidad
 *
 * El backend crea persona, perfil de persona y perfil de paciente **en la misma
 * transacción** (regla 11 del modelo, registro CTI atómico). Encadenar llamadas
 * desde acá reintroduciría el estado intermedio de «persona sin perfil» que el
 * modelo prohíbe: o queda todo, o no queda nada.
 *
 * ## Los dos campos de catálogo, que estuvieron ausentes
 *
 * `administrativeGenderConceptId` y `sexAtBirthConceptId` **ya se ofrecen**.
 * Faltaron mientras no hubo forma de saber a qué conjunto de valores liga el
 * modelo cada columna: un campo `*ConceptId` sólo puede ser un selector poblado
 * desde terminología, y las alternativas eran pedir un uuid a mano o poblarlo
 * con una búsqueda libre —que dejaría elegir cualquier concepto del sistema y
 * rompería el vínculo que el modelo declara—.
 *
 * `GET /system-context/dynamic-enums?target=…` lo publicó, y `app-concept-select`
 * lo consume. Los dos siguen siendo opcionales en el contrato: sin elección, la
 * clave no viaja.
 */
@Component({
  selector: 'app-patient-new',
  imports: [
    Alert,
    AnnounceOnAppear,
    ConceptSelect,
    DatePicker,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    ReactiveFormsModule,
  ],
  templateUrl: './patient-new.html',
  styleUrl: './patient-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientNew {
  private readonly profiles = inject(ProfilesClient);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);

  /** El último escalón se reemplaza: desde el alta, se vuelve al listado. */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [...base.slice(0, -1), { label: ultimo.label, routerLink: PATIENTS_ROUTE }, { label: 'Nuevo' }];
  });

  protected readonly form = new FormGroup({
    patientCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO)],
    }),
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_NOMBRE)],
    }),
    masterPatientIndexCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_MPI)],
    }),
  });

  /**
   * La fecha va fuera del `FormGroup` porque el selector de fechas trabaja con
   * `Date | null` y el contrato pide texto ISO: convertir en un solo lugar, al
   * enviar, evita tener las dos formas dando vueltas por la pantalla.
   */
  protected readonly fechaDeNacimiento = signal<Date | null>(null);

  /**
   * Los dos campos de catálogo, fuera del `FormGroup` por lo mismo que la fecha:
   * su valor es un `conceptId` que el selector resuelve solo, y meterlo en el
   * grupo obligaría a validarlo contra una lista que la pantalla no conoce.
   */
  protected readonly generoAdministrativo = signal<string | null>(null);
  protected readonly sexoAlNacer = signal<string | null>(null);

  /**
   * Las palabras en español de cada código.
   *
   * El catálogo trae «Administrative gender female» porque es terminología
   * técnica, no copy. Se mapea por **código** y no por uuid: el código es la
   * identidad semántica del concepto y sobrevive a un re-seed.
   */
  protected readonly ETIQUETAS_DE_GENERO: Readonly<Record<string, string>> = {
    GENDER_MALE: 'Masculino',
    GENDER_FEMALE: 'Femenino',
    GENDER_OTHER: 'Otro',
    GENDER_UNKNOWN: 'Sin especificar',
  };

  protected readonly ETIQUETAS_DE_SEXO: Readonly<Record<string, string>> = {
    BIRTH_SEX_MALE: 'Masculino',
    BIRTH_SEX_FEMALE: 'Femenino',
    BIRTH_SEX_INTERSEX: 'Intersexual',
    BIRTH_SEX_UNKNOWN: 'Sin especificar',
  };

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'No tenés permiso para registrar pacientes.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /**
   * Si el fallo apunta al código de paciente.
   *
   * Es el único campo con clave única del formulario, así que un `409` sólo
   * puede venir de él. Señalarlo es lo que pide la ficha de la vista: «señalar
   * el campo en conflicto, no un error genérico».
   */
  protected readonly codigoEnConflicto = computed(() => {
    const state = this.state();
    return (
      state.status === 'validation' &&
      state.issues.some(
        (issue) => issue.code === 'CONFLICT' || issue.field === 'patientCode',
      )
    );
  });

  protected submit(): void {
    if (this.enviando()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.profiles.createPatient(this.datos()).subscribe({
      next: (perfil: PatientProfile) => {
        this.state.set(ready(null));
        // A la ficha recién creada y no de vuelta al listado: quien acaba de
        // registrar a alguien casi siempre sigue completando sus datos.
        void this.router.navigateByUrl(patientDetailRoute(perfil.profileId));
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected cancelar(): void {
    void this.router.navigateByUrl(PATIENTS_ROUTE);
  }

  /**
   * El cuerpo de la petición. Los opcionales vacíos **no se mandan**: el
   * backend valida con `forbidNonWhitelisted` y una cadena vacía no es «sin
   * dato», es un dato vacío.
   */
  private datos(): NewPatientProfile {
    const { patientCode, displayName, masterPatientIndexCode } = this.form.getRawValue();
    const fecha = this.fechaDeNacimiento();
    const genero = this.generoAdministrativo();
    const sexo = this.sexoAlNacer();

    return {
      patientCode: patientCode.trim(),
      ...(displayName.trim() === '' ? {} : { displayName: displayName.trim() }),
      ...(masterPatientIndexCode.trim() === ''
        ? {}
        : { masterPatientIndexCode: masterPatientIndexCode.trim() }),
      ...(fecha === null ? {} : { birthDate: isoDate(fecha) }),
      // Los conceptos son opcionales en el contrato: sin elección no se manda la
      // clave, en vez de mandarla vacía. `null` no es «sin especificar» — para
      // eso el catálogo tiene su propio concepto.
      ...(genero === null ? {} : { administrativeGenderConceptId: genero }),
      ...(sexo === null ? {} : { sexAtBirthConceptId: sexo }),
    };
  }
}

/**
 * La fecha en `YYYY-MM-DD`, **en hora local**.
 *
 * `toISOString()` convierte a UTC antes de recortar, así que una fecha elegida
 * como 1 de enero en un huso al oeste de Greenwich se enviaría como 31 de
 * diciembre. En una fecha de nacimiento eso es un día de diferencia en el
 * registro civil de alguien.
 */
function isoDate(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
