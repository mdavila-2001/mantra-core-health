import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  PatientRegistration,
  PractitionerRegistration,
} from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** `Date` → ISO `YYYY-MM-DD`, tal como lo esperan los DTO del backend. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Mínimos que exigen los DTO del backend. */
const MIN_PASSWORD = 8;
const MIN_DOCUMENTO = 4;

/** Sólo letras, dígitos, punto y guion — el mismo `@Matches` del backend. */
const DOCUMENTO_VALIDO = /^[A-Za-z0-9.-]+$/;

/** Quién se está registrando. Define qué endpoint y qué campos. */
type TipoCuenta = 'paciente' | 'profesional';

/**
 * Registro público, para los dos perfiles que la API permite dar de alta sin
 * intervención de un administrador.
 *
 * Son **dos altas distintas**, no una con campos extra:
 *
 * - El **paciente** entra con su documento; el correo es opcional y no
 *   condiciona el acceso.
 * - El **profesional** entra con su correo, y necesita matrícula y número de
 *   colegio: sin habilitación comprobable no hay alta.
 *
 * Por eso hay dos formularios en vez de uno condicional: los campos
 * obligatorios no se solapan y mezclarlos obligaría a validar «obligatorio si
 * el tipo es…», que es de donde salen los formularios que mienten.
 */
@Component({
  selector: 'app-register-patient',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppButton,
    DatePicker,
    Input,
    Link,
    Select,
    FormField,
    Alert,
    AuthSplit, AnnounceOnAppear],
  templateUrl: './register-patient.html',
  styleUrl: './register-patient.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPatient {
  private readonly auth = inject(AuthService);
  private readonly iam = inject(IamClient);
  private readonly router = inject(Router);

  readonly tipo = signal<TipoCuenta>('paciente');

  readonly formPaciente = new FormGroup({
    nationalId: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(MIN_DOCUMENTO),
        Validators.pattern(DOCUMENTO_VALIDO),
      ],
    }),
    // El nombre va en sus cuatro partes, no en un campo libre: es como lo emite
    // el documento de identidad y como se comparan dos personas al buscar
    // duplicados. Partir después una cadena es una conjetura que falla con los
    // nombres compuestos y con los apellidos de más de una palabra.
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    middleName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    motherLastName: new FormControl('', { nonNullable: true }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
  });

  readonly formProfesional = new FormGroup({
    // Mismas cuatro partes que el paciente: la persona se registra igual sea
    // cual sea el perfil, y el backend compone con ellas el nombre que muestra.
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    middleName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    motherLastName: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
    // Documento de identidad: opcional para el profesional (se guarda como
    // identificador oficial, no como login — eso lo sigue siendo el correo).
    nationalId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(DOCUMENTO_VALIDO)],
    }),
    licenseNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    credentialNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    // Quién emitió la matrícula: Ministerio de Salud y Deportes para la
    // mayoría de las especialidades médicas, o el Colegio de Odontólogos para
    // quien ejerce odontología. Texto libre porque no todas las jurisdicciones
    // ni todos los colegios departamentales caben en un catálogo cerrado.
    regulatoryAuthority: new FormControl('', { nonNullable: true }),
    professionalTitle: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
  });

  /** Fecha de nacimiento y fechas de emisión: van con `app-date-picker`, no con `FormControl`. */
  readonly fechaNacimientoProfesional = signal<Date | null>(null);
  readonly fechaInscripcionMatricula = signal<Date | null>(null);

  /** Departamento que emitió el documento (VS_ADMINISTRATIVE_AREA), y su catálogo. */
  private readonly departamentos = inject(BoDepartmentsCatalog);
  readonly departamentoEmisor = signal<string | null>(null);
  readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  readonly catalogoDepartamentosCaido = signal(false);

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  readonly registered = signal(false);
  readonly verificationSent = signal(false);

  /** Con qué va a iniciar sesión, para decírselo en la confirmación. */
  readonly accessHint = computed(() =>
    this.tipo() === 'paciente' ? 'tu documento' : 'tu correo',
  );

  /**
   * El titular de la columna de marca cambia con el tipo elegido.
   *
   * El diseño original es solo de profesional —«Potencia tu práctica médica»—,
   * pero esta pantalla sirve a los dos perfiles: prometerle eso a alguien que
   * se registra como paciente sería hablarle de otra cosa.
   */
  readonly claim = computed(() =>
    this.tipo() === 'paciente' ? 'Tu salud, en un solo lugar' : 'Potenciá tu práctica médica',
  );

  readonly tagline = computed(() =>
    this.tipo() === 'paciente'
      ? 'Llevá tu historia clínica, tus turnos y tus estudios siempre con vos.'
      : 'Sumate a la red de salud más grande de Bolivia y conectá con miles de pacientes.',
  );

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    this.cargarDepartamentos();
  }

  /**
   * Trae el catálogo de departamentos bolivianos, para «departamento que
   * emitió tu documento».
   *
   * Un fallo no bloquea el registro: el campo es opcional, así que sin
   * catálogo la persona sigue pudiendo crear su cuenta y completar el dato
   * después desde su perfil.
   */
  protected cargarDepartamentos(): void {
    this.departamentos.listar().subscribe({
      next: (opciones) => {
        this.catalogoDepartamentosCaido.set(false);
        this.opcionesDepartamento.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        );
      },
      error: () => {
        this.opcionesDepartamento.set([]);
        this.catalogoDepartamentosCaido.set(true);
      },
    });
  }

  /**
   * Cambiar de tipo limpia el error anterior: era de otro formulario.
   *
   * Acepta `null` porque el grupo de radios modela «sin elección»; se cae a
   * paciente, que es el caso mayoritario.
   */
  cambiarTipo(tipo: string | null): void {
    this.tipo.set(tipo === 'profesional' ? 'profesional' : 'paciente');
    this.state.set(ready(null));
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    return this.tipo() === 'paciente' ? this.submitPaciente() : this.submitProfesional();
  }

  /**
   * Lleva al login en vez de iniciar sesión sola.
   *
   * Ninguno de los dos endpoints devuelve tokens —devuelven los identificadores
   * del perfil—, así que entrar automáticamente exigiría un segundo viaje con
   * las credenciales recién escritas.
   */
  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  private submitPaciente(): void {
    if (this.formPaciente.invalid) {
      this.formPaciente.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.auth.registerPatient(this.datosPaciente()).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.verificationSent.set(resultado.emailVerificationSent);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  private submitProfesional(): void {
    if (this.formProfesional.invalid) {
      this.formProfesional.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.registerPractitioner(this.datosProfesional()).subscribe({
      next: () => {
        this.state.set(ready(null));
        // El alta de profesional no encola verificación de correo.
        this.verificationSent.set(false);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  private datosPaciente(): PatientRegistration {
    const { nationalId, name, middleName, lastName, motherLastName, password, email } =
      this.formPaciente.getRawValue();
    const correo = email.trim();
    const segundoNombre = middleName.trim();
    const apellidoMaterno = motherLastName.trim();

    return {
      nationalId: nationalId.trim(),
      name: name.trim(),
      lastName: lastName.trim(),
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      password,
      // Ausente si no se completó: `forbidNonWhitelisted` rechaza lo que sobra,
      // y una cadena vacía no es lo mismo que la ausencia del campo.
      ...(correo === '' ? {} : { email: correo }),
    };
  }

  private datosProfesional(): PractitionerRegistration {
    const raw = this.formProfesional.getRawValue();
    const titulo = raw.professionalTitle.trim();
    const telefono = raw.phone.trim();
    const segundoNombre = raw.middleName.trim();
    const apellidoMaterno = raw.motherLastName.trim();
    const documento = raw.nationalId.trim();
    const autoridad = raw.regulatoryAuthority.trim();
    const fechaNacimiento = this.fechaNacimientoProfesional();
    const fechaInscripcion = this.fechaInscripcionMatricula();
    const departamento = this.departamentoEmisor();

    return {
      email: raw.email.trim(),
      password: raw.password,
      name: raw.name.trim(),
      lastName: raw.lastName.trim(),
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      ...(fechaNacimiento === null ? {} : { birthDate: fechaIso(fechaNacimiento) }),
      ...(documento === '' ? {} : { nationalId: documento }),
      // Sólo tiene sentido con documento: sin CI no hay identificador al que
      // atarle un departamento de emisión.
      ...(documento === '' || departamento === null
        ? {}
        : { issuerAdministrativeAreaConceptId: departamento }),
      licenseNumber: raw.licenseNumber.trim(),
      credentialNumber: raw.credentialNumber.trim(),
      ...(autoridad === '' ? {} : { regulatoryAuthority: autoridad }),
      ...(fechaInscripcion === null ? {} : { licenseIssueDate: fechaIso(fechaInscripcion) }),
      ...(titulo === '' ? {} : { professionalTitle: titulo }),
      ...(telefono === '' ? {} : { phone: telefono }),
    };
  }
}
