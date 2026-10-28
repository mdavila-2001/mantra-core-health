import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import { describeApiFailure, fieldErrorsOf } from '../../../../core/http/api-failure';
import type {
  OwnMedicalAspects,
  OwnMedicalAspectsChanges,
} from '../../../../core/data-access/clinical/clinical.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';

/** Un campo del formulario: qué se pregunta y dónde se guarda. */
interface CampoDeAspectos {
  readonly clave: keyof OwnMedicalAspectsChanges;
  readonly rotulo: string;
  readonly ayuda: string;
  /** Los textos largos van en área; el grupo sanguíneo es una línea. */
  readonly largo: boolean;
  /** Regla de UI de ALOVIDA: todo campo lleva su ícono a la izquierda. */
  readonly icono: NavIconName;
}

/**
 * Las preguntas, en el orden en que se responden.
 *
 * De lo que decide una urgencia a lo que aporta contexto: si alguien abandona el
 * formulario a la mitad, lo que queda cargado es lo que más importa.
 */
/** Lo que dice un campo que la API no aceptó. */
const CAMPO_RECHAZADO = 'No se pudo guardar así. Revise este dato.';

const CAMPOS: readonly CampoDeAspectos[] = [
  {
    clave: 'bloodType',
    rotulo: 'Grupo y factor sanguíneo',
    ayuda: 'Por ejemplo, O+. Si no lo sabe, déjelo vacío.',
    largo: false,
    icono: 'flask',
  },
  {
    clave: 'allergiesText',
    rotulo: 'Alergias',
    ayuda: 'A medicamentos, alimentos o cualquier otra cosa. Cuente qué le pasó.',
    largo: true,
    icono: 'flag',
  },
  {
    clave: 'currentMedicationsText',
    rotulo: 'Qué está tomando',
    ayuda: 'Incluya lo de venta libre, vitaminas y anticonceptivos.',
    largo: true,
    icono: 'pill',
  },
  {
    clave: 'chronicConditionsText',
    rotulo: 'Enfermedades crónicas',
    ayuda: 'Lo que lleva hace tiempo: presión, diabetes, tiroides, asma.',
    largo: true,
    icono: 'heart',
  },
  {
    clave: 'surgeriesText',
    rotulo: 'Cirugías e internaciones',
    ayuda: 'Qué le operaron y aproximadamente cuándo.',
    largo: true,
    icono: 'scalpel',
  },
  {
    clave: 'familyHistoryText',
    rotulo: 'Antecedentes familiares',
    ayuda: 'Enfermedades importantes de padres, hermanos o abuelos.',
    largo: true,
    icono: 'people',
  },
  {
    clave: 'habitsText',
    rotulo: 'Hábitos',
    ayuda: 'Tabaco, alcohol, actividad física, cómo come y cómo duerme.',
    largo: true,
    icono: 'sliders',
  },
];

/**
 * «Aspectos médicos» — lo que el propio paciente declara sobre su salud.
 *
 * ## Por qué está acá y no en la historia clínica
 *
 * Porque **no es historia clínica**. La historia es lo que un profesional
 * registró y firmó: el paciente la lee y no la toca. Esto es lo otro, lo que la
 * persona dice de sí misma antes de que nadie la examine. Ponerlos en la misma
 * pantalla haría que un dato declarado se leyera como un diagnóstico, que en un
 * expediente clínico es un error caro.
 *
 * Vive junto a las encuestas porque las dos cosas son «lo que el paciente
 * responde», que es exactamente como lo pidió el cliente: dos pestañas, una
 * editable y otra no.
 *
 * ## Editable y guardado de verdad
 *
 * Los campos son de texto libre a propósito: es una declaración, no un
 * formulario codificado, y obligar a elegir de un catálogo dejaría fuera justo
 * lo que la persona quiere aclarar. Se guarda contra
 * `PUT /clinical/me/medical-aspects` y se vuelve a pintar con lo que el
 * servidor devuelve —no con lo que se tipeó—, que es lo que hace que «guardado»
 * signifique algo.
 */
@Component({
  selector: 'app-medical-aspects',
  imports: [Alert, AppButton, DatePipe, FormField, Input, Textarea],
  templateUrl: './medical-aspects.html',
  styleUrl: './medical-aspects.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalAspects {
  private readonly clinical = inject(ClinicalClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly campos = CAMPOS;

  /** Sin ficha de paciente no hay aspectos propios que declarar ni leer. */
  protected readonly sinPerfilDePaciente = this.auth.patientProfileId() === null;

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);

  /**
   * Los campos que la API rechazó en el último intento.
   *
   * Se guarda sólo QUÉ campo falló, no el texto de la API: el validador
   * responde en inglés técnico («must be shorter than…»), que no es para
   * mostrarle a un paciente. El texto lo pone la pantalla.
   */
  protected readonly camposRechazados = signal<ReadonlySet<string>>(new Set());
  protected readonly falloLaLectura = signal(false);

  /** Lo último que confirmó el servidor. Es contra esto que se compara y se cancela. */
  private readonly guardado = signal<OwnMedicalAspects>({});

  /** Lo que hay en los campos ahora mismo. */
  protected readonly borrador = signal<Record<string, string>>({});

  /** Cuándo se guardó por última vez, o `null` si nunca. */
  protected readonly actualizado = computed(() => this.guardado().updatedAt ?? null);

  /**
   * Hay algo sin guardar.
   *
   * Se compara campo a campo contra lo confirmado y no con una bandera «tocó
   * algo»: escribir una letra y borrarla no deja cambios, y un botón «Guardar»
   * habilitado sin nada que guardar enseña a ignorarlo.
   */
  protected readonly hayCambios = computed(() => {
    const actual = this.borrador();
    const previo = this.guardado();
    return CAMPOS.some((campo) => (actual[campo.clave] ?? '') !== (previo[campo.clave] ?? ''));
  });

  /** El titular nunca declaró nada: se dice, en vez de mostrar siete campos mudos. */
  protected readonly vacio = computed(
    () => !this.cargando() && CAMPOS.every((campo) => (this.guardado()[campo.clave] ?? '') === ''),
  );

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    if (this.sinPerfilDePaciente) {
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.falloLaLectura.set(false);
    this.clinical
      .getOwnMedicalAspects()
      .pipe(catchError(() => of(null)))
      .subscribe((aspectos) => {
        this.cargando.set(false);
        if (aspectos === null) {
          this.falloLaLectura.set(true);
          return;
        }
        this.aplicar(aspectos);
      });
  }

  protected escribir(clave: string, valor: string): void {
    this.borrador.update((actual) => ({ ...actual, [clave]: valor }));
    // Al corregirlo, el campo deja de estar marcado: la marca era del intento anterior.
    if (this.camposRechazados().has(clave)) {
      this.camposRechazados.update((previos) => new Set([...previos].filter((c) => c !== clave)));
    }
  }

  /** El aviso bajo un campo que la API rechazó; vacío si no lo rechazó. */
  protected errorDe(clave: string): string {
    return this.camposRechazados().has(clave) ? CAMPO_RECHAZADO : '';
  }

  /** El valor que va en el campo. Nunca `undefined`: el control es controlado. */
  protected valor(clave: string): string {
    return this.borrador()[clave] ?? '';
  }

  /** Vuelve a lo último que confirmó el servidor. */
  protected cancelar(): void {
    this.aplicar(this.guardado());
  }

  protected guardar(): void {
    if (this.guardando() || !this.hayCambios()) {
      return;
    }
    this.guardando.set(true);
    this.camposRechazados.set(new Set());
    const cambios: Record<string, string> = {};
    for (const campo of CAMPOS) {
      // Los siete van siempre, vacíos incluidos: el contrato dice que `''`
      // borra, y mandar sólo los que cambiaron dejaría sin borrar lo que la
      // persona acaba de vaciar.
      cambios[campo.clave] = (this.borrador()[campo.clave] ?? '').trim();
    }
    this.clinical.saveOwnMedicalAspects(cambios as OwnMedicalAspectsChanges).subscribe({
      next: (aspectos) => {
        this.guardando.set(false);
        // Se pinta lo que el servidor devolvió, no lo que se tipeó: si recortó o
        // normalizó algo, la pantalla tiene que mostrar lo que quedó guardado.
        this.aplicar(aspectos);
        this.toast.success('Guardamos sus aspectos médicos.');
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        // El borrador NO se pierde: si falla la red, lo escrito sigue en pantalla
        // para poder reintentar sin volver a tipearlo.
        const rechazados = new Set(Object.keys(fieldErrorsOf(error)));
        this.camposRechazados.set(rechazados);
        this.toast.error(
          describeApiFailure(
            error,
            rechazados.size > 0
              ? 'No pudimos guardar: revise los datos marcados. Lo que escribió sigue aquí.'
              : 'No pudimos guardar. Lo que escribió sigue aquí: intente de nuevo.',
          ),
        );
      },
    });
  }

  private aplicar(aspectos: OwnMedicalAspects): void {
    this.guardado.set(aspectos);
    const borrador: Record<string, string> = {};
    for (const campo of CAMPOS) {
      borrador[campo.clave] = aspectos[campo.clave] ?? '';
    }
    this.borrador.set(borrador);
  }
}
