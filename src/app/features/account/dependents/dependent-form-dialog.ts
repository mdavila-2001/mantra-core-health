import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { Dependent } from '../../../core/data-access/profiles/profiles.types';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import { RelatedPersonRelationshipsCatalog } from '../../../core/data-access/system-context/related-person-relationships.service';
import { readApiError } from '../../../core/http/api-error';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';

/**
 * Los parentescos que habilitan a representar, **en primera persona**.
 *
 * El titular declara qué es **él** para el dependiente, que es el sentido que
 * esa columna tiene en todas las filas que ya existen. Por eso las palabras no
 * son las de `ETIQUETAS_PARENTESCO` —«Madre», que describe a un contacto—: acá
 * la frase es «Soy su madre», y decir «Madre» a secas dejaría al titular
 * adivinando de quién se habla.
 *
 * La clave es el `code` del concepto; el uuid lo aporta el catálogo, que es el
 * único que lo conoce.
 */
const PARENTESCOS_DE_REPRESENTACION: Readonly<Record<string, string>> = {
  RELATIONSHIP_MOTHER: 'Soy su madre',
  RELATIONSHIP_FATHER: 'Soy su padre',
  RELATIONSHIP_CHILD: 'Soy su hijo o hija',
  RELATIONSHIP_SPOUSE: 'Soy su cónyuge o pareja',
  RELATIONSHIP_GUARDIAN: 'Soy su tutor o representante legal',
};

/** El documento admite letras, dígitos, punto y guion; lo mismo que el alta. */
const DOCUMENTO = /^[A-Za-z0-9.-]+$/;

/**
 * Alta de una persona a cargo: un menor, un adulto mayor tutelado.
 *
 * ## Qué no pide, y por qué
 *
 * Ni correo ni contraseña: el dependiente **no inicia sesión**. Ese es el caso
 * —un chico sin teléfono propio—, y pedirle credenciales convertiría el
 * formulario en un registro de cuenta que nadie va a usar.
 *
 * El documento es opcional porque un recién nacido no tiene cédula. Si viene,
 * el servidor rechaza el que ya sea de otra persona: dos perfiles con el mismo
 * documento son dos historias clínicas de la misma persona.
 *
 * ## Por qué la fecha vive fuera del formulario
 *
 * `app-date-picker` expone un `model<Date | null>` y no implementa
 * `ControlValueAccessor`, así que no se ata con `formControlName`. Es el mismo
 * arreglo que usa el alta de personas relacionadas: una señal al lado del
 * grupo, comprobada al enviar.
 */
@Component({
  selector: 'app-dependent-form-dialog',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    AppButton,
    Input,
    Select,
    Alert,
    FormField,
    ContentDialog,
    DatePicker,
  ],
  templateUrl: './dependent-form-dialog.html',
  styleUrl: './dependents.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DependentFormDialog {
  /** El dependiente recién creado, para que la pantalla lo sume sin releer. */
  readonly saved = output<Dependent>();
  readonly closed = output<void>();

  private readonly profiles = inject(ProfilesClient);
  private readonly parentescos = inject(RelatedPersonRelationshipsCatalog);
  private readonly departamentos = inject(BoDepartmentsCatalog);
  private readonly fb = inject(FormBuilder);

  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly opcionesParentesco = signal<readonly SelectOption<string>[]>([]);
  protected readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);

  /** La fecha de nacimiento, fuera del grupo por lo dicho en el encabezado. */
  protected readonly fechaDeNacimiento = signal<Date | null>(null);

  /** Si se intentó enviar sin fecha: decide cuándo mostrar su error. */
  protected readonly fechaTocada = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    middleName: ['', Validators.maxLength(100)],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    motherLastName: ['', Validators.maxLength(100)],
    relationshipConceptId: ['', Validators.required],
    nationalId: [
      '',
      [Validators.minLength(4), Validators.maxLength(40), Validators.pattern(DOCUMENTO)],
    ],
    issuerAdministrativeAreaConceptId: [''],
  });

  /**
   * La edad que se está declarando, mientras se elige la fecha.
   *
   * Es una ayuda para ver un dedazo en el año antes de guardar: un «1918» salta
   * cuando la pantalla dice «107 años». La edad que vale es la que calcula el
   * servidor, y es la que después muestra la tarjeta.
   */
  protected readonly edadDeclarada = computed<string | null>(() => {
    const nacimiento = this.fechaDeNacimiento();
    if (nacimiento === null) return null;
    const hoy = new Date();
    let anios = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) anios -= 1;
    if (anios < 0) return 'Esa fecha es futura: revisá el año.';
    if (anios === 0) return 'Menos de un año.';
    return anios === 1 ? '1 año.' : `${anios} años.`;
  });

  /** Si falta la fecha después de haber intentado enviar. */
  protected readonly faltaLaFecha = computed(
    () => this.fechaTocada() && this.fechaDeNacimiento() === null,
  );

  constructor() {
    this.cargarParentescos();
    this.cargarDepartamentos();
  }

  /**
   * Los parentescos que habilitan a representar, con las palabras del producto.
   *
   * El catálogo trae los nueve; acá se ofrecen los cinco que sostienen una
   * representación. Un vecino describe a un contacto de emergencia, no a
   * alguien de quien uno se hace cargo, y el servidor rechaza los otros cuatro.
   */
  private cargarParentescos(): void {
    this.parentescos.listar().subscribe({
      next: (opciones) =>
        this.opcionesParentesco.set(
          opciones
            .filter((opcion) => opcion.code in PARENTESCOS_DE_REPRESENTACION)
            .map((opcion) => ({
              value: opcion.conceptId,
              label: PARENTESCOS_DE_REPRESENTACION[opcion.code]!,
            })),
        ),
      // Sin catálogo no se puede declarar el parentesco, y es obligatorio: la
      // pantalla lo dice en vez de ofrecer un desplegable vacío.
      error: () => this.opcionesParentesco.set([]),
    });
  }

  private cargarDepartamentos(): void {
    this.departamentos.listar().subscribe({
      next: (opciones) =>
        this.opcionesDepartamento.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        ),
      error: () => this.opcionesDepartamento.set([]),
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    this.fechaTocada.set(true);
    const nacimiento = this.fechaDeNacimiento();
    if (this.form.invalid || nacimiento === null) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    const valor = this.form.getRawValue();
    const documento = valor.nationalId.trim();

    this.profiles
      .registerOwnDependent({
        name: valor.name.trim(),
        ...(valor.middleName.trim() === '' ? {} : { middleName: valor.middleName.trim() }),
        lastName: valor.lastName.trim(),
        ...(valor.motherLastName.trim() === ''
          ? {}
          : { motherLastName: valor.motherLastName.trim() }),
        birthDate: fechaIso(nacimiento),
        relationshipConceptId: valor.relationshipConceptId,
        ...(documento === '' ? {} : { nationalId: documento }),
        // El departamento sólo viaja con documento: sin él no describe nada.
        ...(documento === '' || valor.issuerAdministrativeAreaConceptId === ''
          ? {}
          : { issuerAdministrativeAreaConceptId: valor.issuerAdministrativeAreaConceptId }),
      })
      .subscribe({
        next: (dependiente) => {
          this.saving.set(false);
          this.saved.emit(dependiente);
          this.dialog().close();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(mensajeDeError(error));
        },
      });
  }
}

/**
 * La fecha como `YYYY-MM-DD`, con los componentes **locales**.
 *
 * `toISOString()` la corre un día al oeste de Greenwich —una fecha elegida el
 * 14 de marzo viajaría como 13—, que es el mismo defecto que `maybeDateOnly`
 * deshace al leerla.
 */
function fechaIso(fecha: Date): string {
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Qué decirle a quien no pudo registrar.
 *
 * Se prefiere el mensaje del servidor cuando lo hay —«Ese documento ya está
 * registrado en la plataforma» explica qué pasó y qué hacer—, y sólo se cae a
 * una frase genérica cuando no llegó ninguno.
 */
function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return (
      readApiError(error)?.message ??
      'No se pudo registrar. Revisá los datos e intentá de nuevo.'
    );
  }
  return 'No se pudo registrar. Intentá de nuevo.';
}
