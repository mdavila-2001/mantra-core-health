import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';

/**
 * La columna que gobierna el diagnóstico.
 *
 * El selector resuelve sus opciones por **binding de columna**, no por un value
 * set elegido acá: `esquema.tabla.columna` es lo que el catálogo publica, y es
 * lo que hace que el día que la nosología completa reemplace al catálogo
 * inicial esta pantalla funcione sin tocar una línea.
 */
export const TARGET_DIAGNOSTICO = 'clinical.conditions.code_concept_id';

/** La categoría del registro. Opcional en el DTO: sin binding, se omite y ya. */
export const TARGET_CATEGORIA = 'clinical.conditions.category_concept_id';

/** La severidad. Mismo trato que la categoría. */
export const TARGET_SEVERIDAD = 'clinical.conditions.severity_concept_id';

/** La lateralidad. Mismo trato que la categoría. */
export const TARGET_LATERALIDAD = 'clinical.conditions.laterality_concept_id';

/**
 * El curso clínico (Patch v4.0.8): agudo/crónico/subagudo/recurrente.
 *
 * Eje distinto del estado —que el backend sigue fijando en `ACTIVE` al
 * nacer—: decide, más adelante, qué transiciones de estado van a ser válidas
 * (una condición crónica no puede pasar a resuelta).
 */
export const TARGET_CURSO_CLINICO = 'clinical.conditions.clinical_course_concept_id';

/**
 * Las categorías en castellano, por código estable.
 *
 * El catálogo trae su `display` en inglés técnico porque es terminología, no
 * copy de producto, y mapear por **código** —no por uuid— es lo que permite
 * traducir sin atarse a un identificador que un re-seed puede mover.
 */
const ETIQUETAS_DE_CATEGORIA: Readonly<Record<string, string>> = {
  COND_DIAGNOSIS: 'Diagnóstico del encuentro',
  COND_PROBLEM: 'Problema de la lista',
};

/** Las severidades en castellano. Mismo criterio que {@link ETIQUETAS_DE_CATEGORIA}. */
const ETIQUETAS_DE_SEVERIDAD: Readonly<Record<string, string>> = {
  COND_SEV_MILD: 'Leve',
  COND_SEV_MODERATE: 'Moderada',
  COND_SEV_SEVERE: 'Grave',
};

/** Las lateralidades en castellano. Mismo criterio que {@link ETIQUETAS_DE_CATEGORIA}. */
const ETIQUETAS_DE_LATERALIDAD: Readonly<Record<string, string>> = {
  COND_LAT_LEFT: 'Izquierda',
  COND_LAT_RIGHT: 'Derecha',
  COND_LAT_BILATERAL: 'Bilateral',
};

/** Los cursos clínicos en castellano. Mismo criterio que {@link ETIQUETAS_DE_CATEGORIA}. */
const ETIQUETAS_DE_CURSO: Readonly<Record<string, string>> = {
  COND_COURSE_ACUTE: 'Aguda',
  COND_COURSE_CHRONIC: 'Crónica',
  COND_COURSE_SUBACUTE: 'Subaguda',
  COND_COURSE_RECURRENT: 'Recurrente',
  COND_COURSE_UNKNOWN: 'Sin determinar',
};

/**
 * **Diagnóstico** del expediente: registrar la condición — V08-08.
 *
 * ## Sólo el alta, sin lista propia
 *
 * El backend fija el estado activo y confirmado al nacer; este bloque no lo
 * pregunta. Desde el Patch v4.0.8 una condición sí puede cambiar de estado más
 * adelante (`change-status`), pero esa acción vive en la fila de la pestaña
 * «Diagnósticos» del expediente —donde está el registro sobre el que actúa—,
 * no acá: duplicar la lista en este bloque sería tener dos verdades del mismo
 * dato en la misma pantalla. Por eso este bloque sigue siendo el formulario y
 * nada más.
 *
 * ## Vive dentro del encuentro abierto
 *
 * El contrato declara `encounterId` opcional y el backend no lo valida, pero el
 * recorrido de quien atiende es check-in → ficha → registrar ahí mismo, y un
 * diagnóstico suelto —sin la consulta que lo motivó— es un dato que después
 * nadie sabe explicar. Mismo criterio que la receta de al lado.
 *
 * ## El binding del selector se verifica antes de ofrecer nada
 *
 * `codeConceptId` es obligatorio y sale del catálogo. Si la columna no tiene
 * binding declarado el selector queda vacío **por diseño** —no cae a texto
 * libre, porque un uuid tecleado a mano es un dato inválido o, peor, uno válido
 * de otro conjunto—. En ese caso el bloque lo dice con todas las letras en vez
 * de mostrar un formulario que no puede enviarse.
 *
 * ## El `409` del duplicado es un aviso, no un error
 *
 * El backend rechaza con `409 CONFLICT` si la persona ya tiene esa condición
 * activa. No es un fallo del sistema ni de quien registra: es la historia
 * protegiéndose de decir dos veces lo mismo. Se cuenta en ámbar y señalando la
 * salida —el registro ya está en la pestaña de abajo—.
 *
 * ## Después de escribir se relee
 *
 * La respuesta del alta trae el estado nuevo, pero la lista sale de
 * `GET /clinical/patients/:id/summary`, y el bloque avisa al expediente para
 * que vuelva a leer. Un diagnóstico que aparece porque lo pintamos nosotros y
 * no porque el servidor lo tenga es exactamente la clase de mentira que el
 * expediente no puede permitirse.
 */
@Component({
  selector: 'app-diagnosis-block',
  imports: [Alert, Card, ConceptSelect, DatePicker, FormActions, FormField],
  templateUrl: './diagnosis-block.html',
  styleUrl: './diagnosis-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosisBlock {
  private readonly clinical = inject(ClinicalClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /**
   * El encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * Lo sabe el expediente —lo deriva de `endAt`, no del estado— y baja hecho:
   * el bloque no vuelve a preguntarlo para que no puedan discrepar.
   */
  readonly encounterId = input<string | null>(null);

  /** Algo se escribió y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  protected readonly targetDiagnostico = TARGET_DIAGNOSTICO;
  protected readonly targetCategoria = TARGET_CATEGORIA;
  protected readonly targetSeveridad = TARGET_SEVERIDAD;
  protected readonly targetLateralidad = TARGET_LATERALIDAD;
  protected readonly targetCursoClinico = TARGET_CURSO_CLINICO;
  protected readonly etiquetasDeCategoria = ETIQUETAS_DE_CATEGORIA;
  protected readonly etiquetasDeSeveridad = ETIQUETAS_DE_SEVERIDAD;
  protected readonly etiquetasDeLateralidad = ETIQUETAS_DE_LATERALIDAD;
  protected readonly etiquetasDeCurso = ETIQUETAS_DE_CURSO;

  /**
   * La organización bajo cuya custodia queda el registro.
   *
   * `custodianTenantId` es obligatorio en el DTO y no se deduce del paciente:
   * es quién responde por el registro, y eso lo eligió la sesión.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  /* -- El formulario ------------------------------------------------------- */

  protected readonly diagnostico = signal<string | null>(null);
  protected readonly categoria = signal<string | null>(null);
  protected readonly severidad = signal<string | null>(null);
  protected readonly lateralidad = signal<string | null>(null);
  protected readonly cursoClinico = signal<string | null>(null);
  protected readonly inicio = signal<Date | null>(null);
  /**
   * Sólo tiene sentido clínico en curso agudo/subagudo, pero se ofrece siempre:
   * el contrato no exige la pareja, y una condición crónica sin fecha marcada
   * es tan legítima como una aguda sin ella —quien registra decide.
   */
  protected readonly fechaEsperada = signal<Date | null>(null);

  /**
   * Si el catálogo del diagnóstico está disponible.
   *
   * `null` mientras se pregunta. Es el paso 0 hecho en código y no una vez a
   * mano: el día que el binding se declare, esta pantalla empieza a funcionar
   * sin desplegar nada nuevo.
   */
  protected readonly catalogoListo = signal<boolean | null>(null);

  protected readonly registrando = signal(false);

  /** El resultado de la última escritura. */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /**
   * Si el formulario puede enviarse.
   *
   * Las cuatro condiciones son del contrato, no de prudencia: encuentro en
   * curso (decisión de esta pantalla), organización activa y diagnóstico
   * elegido (obligatorios del DTO), y nada en vuelo.
   */
  protected readonly puedeRegistrar = computed(
    () =>
      this.hayEncuentro() &&
      !this.sinOrganizacion() &&
      this.diagnostico() !== null &&
      !this.registrando(),
  );

  /**
   * El aviso del duplicado, en palabras.
   *
   * Separado del error de verdad porque **no es un error**: el `409` de la
   * condición ya activa es la historia negándose a decir dos veces lo mismo, y
   * la salida —el registro existente— está en la pestaña de abajo. Pintarlo en
   * rojo enseñaría a quien atiende que el sistema se rompe cuando en realidad
   * lo está protegiendo.
   */
  protected readonly avisoDeDuplicado = computed<string | null>(() => {
    const state = this.registro();
    if (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT')
    ) {
      return 'Esta persona ya tiene ese diagnóstico activo: está en la pestaña «Diagnósticos». No hace falta registrarlo de nuevo.';
    }
    return null;
  });

  /**
   * El fallo de la escritura, en palabras.
   *
   * El duplicado ya se contó como aviso: repetirlo en rojo sería decir dos
   * veces lo mismo con dos tonos que se contradicen.
   */
  protected readonly errorDelDiagnostico = computed<string | null>(() => {
    if (this.avisoDeDuplicado() !== null) {
      return null;
    }

    const state = this.registro();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite registrar diagnósticos.';
    }
    if (state.status === 'not-found') {
      return 'El expediente ya no existe. Recargá la pantalla.';
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
    // El catálogo se pregunta una sola vez: el cliente memoiza por target, así
    // que esta llamada y la del selector son la misma petición.
    this.systemContext.dynamicEnum(TARGET_DIAGNOSTICO).subscribe({
      next: (enumeracion) => this.catalogoListo.set(enumeracion.options.length > 0),
      // Sin binding declarado la API responde 404. No es un fallo transitorio
      // que convenga reintentar: es un dato que falta en el catálogo.
      error: () => this.catalogoListo.set(false),
    });
  }

  /**
   * Registra el diagnóstico (UC-08-08) — nace activo y confirmado.
   *
   * Sin confirmación previa: los dos estados los fija el backend y el registro
   * no cierra ni sella nada. El caso que sí exige cuidado —el duplicado— lo
   * protege el propio backend con el `409`.
   */
  protected registrar(): void {
    const patientProfileId = this.patientProfileId();
    const custodianTenantId = this.organizacion();
    const codeConceptId = this.diagnostico();
    const encounterId = this.encounterId();

    if (
      custodianTenantId === null ||
      codeConceptId === null ||
      encounterId === null ||
      this.registrando()
    ) {
      return;
    }

    const categoria = this.categoria();
    const severidad = this.severidad();
    const lateralidad = this.lateralidad();
    const cursoClinico = this.cursoClinico();
    const inicio = this.inicio();
    const fechaEsperada = this.fechaEsperada();

    this.registrando.set(true);
    this.registro.set(loading());

    this.clinical
      .createCondition({
        custodianTenantId,
        patientProfileId,
        codeConceptId,
        encounterId,
        // Los opcionales sin elegir se **omiten**: el backend valida con
        // `forbidNonWhitelisted`, y una clave en null no es «sin especificar».
        ...(categoria === null ? {} : { categoryConceptId: categoria }),
        ...(severidad === null ? {} : { severityConceptId: severidad }),
        ...(lateralidad === null ? {} : { lateralityConceptId: lateralidad }),
        ...(cursoClinico === null ? {} : { clinicalCourseConceptId: cursoClinico }),
        ...(inicio === null ? {} : { onsetAt: inicio }),
        ...(fechaEsperada === null ? {} : { expectedResolutionAt: fechaEsperada }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
          this.toasts.success(
            'Quedó en la historia como condición activa.',
            'Diagnóstico registrado',
          );
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /** Vacía el formulario tras un alta. El siguiente diagnóstico arranca limpio. */
  private limpiar(): void {
    this.diagnostico.set(null);
    this.categoria.set(null);
    this.severidad.set(null);
    this.lateralidad.set(null);
    this.cursoClinico.set(null);
    this.inicio.set(null);
    this.fechaEsperada.set(null);
  }
}
