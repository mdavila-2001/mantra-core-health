import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { WritableSignal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { AttachmentUploader } from '../../../../shared/components/organisms/attachment-uploader/attachment-uploader';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import { environment } from '../../../../../environments/environment';
import { CASOS_DIAGNOSTICO_DEMO, conceptIdPorCodigo } from '../demo-presets';
import type { CasoDiagnosticoDemo } from '../demo-presets';

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
 * El código del curso **crónico**, la salida del catálogo.
 *
 * Se busca por código y no por posición: es el que decide si la condición tiene
 * fecha esperada de resolución o si es de seguimiento continuo, y el orden de
 * la expansión no es contrato.
 */
const CODIGO_CURSO_CRONICO = 'COND_COURSE_CHRONIC';

/** El curso que se aplica solo al elegir una duración con fecha. */
const CODIGO_CURSO_AGUDO = 'COND_COURSE_ACUTE';

/** El curso de las condiciones que duran más de un mes pero resuelven. */
const CODIGO_CURSO_SUBAGUDO = 'COND_COURSE_SUBACUTE';

/**
 * Cuántos días separan lo agudo de lo subagudo.
 *
 * Es el corte clínico corriente y sirve para **sugerir** el curso, no para
 * fijarlo: quien registra puede cambiarlo, y si lo cambia gana su elección.
 */
const DIAS_HASTA_SUBAGUDO = 30;

/**
 * Las duraciones que se ofrecen de un toque, y el «crónico» al final.
 *
 * El cliente lo pidió así: «debería poderse poner una duración promedio del
 * diagnóstico, en caso de ser crónico debería aparecer la opción». Son los
 * mismos chips que la receta usa para su pauta, por lo mismo: elegir «14 días»
 * es una sola decisión y calcular la fecha a mano son tres.
 */
const DURACIONES_DEL_DIAGNOSTICO: readonly { readonly dias: number | null; readonly label: string }[] =
  [
    { dias: 7, label: '7 días' },
    { dias: 14, label: '14 días' },
    { dias: 30, label: '30 días' },
    { dias: 90, label: '90 días' },
    { dias: null, label: 'Crónico — seguimiento continuo' },
  ];

/** La fecha de hoy corrida `dias` hacia adelante. */
function enDias(dias: number): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha;
}

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
  imports: [
    Alert,
    AppButton,
    Chip,
    AttachmentUploader,
    Badge,
    Card,
    ConceptSelect,
    DatePicker,
    FormActions,
    FormField,
    Textarea,
  ],
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

  /* -- Casos de demostración ------------------------------------------------ */

  /** La barra existe sólo donde el despliegue la pidió (`PUBLIC_DEMO_PRESETS`). */
  protected readonly demoActiva = environment.demoPresets;
  protected readonly casosDemo = CASOS_DIAGNOSTICO_DEMO;

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

  /* -- La duración estimada, y el crónico (pedido del cliente) -------------- */

  protected readonly duraciones = DURACIONES_DEL_DIAGNOSTICO;

  /** Los días elegidos de un toque, o `null` si nadie eligió o es crónico. */
  protected readonly duracionDias = signal<number | null>(null);

  /**
   * Si se eligió «Crónico».
   *
   * Señal propia y no `duracionDias() === null`: sin ella el chip de crónico
   * aparecía marcado con el formulario recién abierto, cuando nadie eligió
   * nada. Es el mismo defecto que la receta ya había corregido.
   */
  protected readonly esCronico = signal(false);

  /** Si el curso lo eligió una persona a mano; entonces la duración no lo pisa. */
  private cursoElegidoAMano = false;

  /** El concepto del curso crónico, cuando el catálogo llegó. */
  private readonly conceptoDelCurso = (codigo: string): string | null =>
    this.opcionesCurso().find((opcion) => opcion.code === codigo)?.conceptId ?? null;

  /**
   * Elige una duración estimada.
   *
   * Con días, deriva la fecha esperada desde el inicio —o desde hoy— y sugiere
   * el curso: agudo hasta un mes, subagudo más allá. Con «crónico», el curso es
   * crónico y **no hay fecha esperada**: una condición de seguimiento continuo
   * no resuelve, y ofrecer el campo invita a inventar una fecha.
   *
   * @param dias - Los días previstos, o `null` para crónico.
   */
  protected fijarDuracion(dias: number | null): void {
    this.duracionDias.set(dias);
    if (dias === null) {
      this.esCronico.set(true);
      this.fechaEsperada.set(null);
      if (!this.cursoElegidoAMano) this.cursoClinico.set(this.conceptoDelCurso(CODIGO_CURSO_CRONICO));
      return;
    }
    this.esCronico.set(false);
    const desde = this.inicio() ?? new Date();
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + dias);
    this.fechaEsperada.set(hasta);
    if (!this.cursoElegidoAMano) {
      this.cursoClinico.set(
        this.conceptoDelCurso(dias > DIAS_HASTA_SUBAGUDO ? CODIGO_CURSO_SUBAGUDO : CODIGO_CURSO_AGUDO),
      );
    }
  }

  /**
   * Guarda el curso elegido a mano.
   *
   * A partir de acá la duración deja de sugerirlo: quien registra sabe más que
   * la heurística, y pisarle la elección es peor que no sugerir nada.
   */
  protected elegirCurso(conceptId: string | null): void {
    this.cursoElegidoAMano = true;
    this.cursoClinico.set(conceptId);
    this.esCronico.set(conceptId !== null && conceptId === this.conceptoDelCurso(CODIGO_CURSO_CRONICO));
    if (this.esCronico()) this.fechaEsperada.set(null);
  }

  /** Si el curso elegido es el crónico: con él no se pregunta la resolución. */
  protected readonly cursoEsCronico = computed(
    () =>
      this.esCronico() ||
      (this.cursoClinico() !== null && this.cursoClinico() === this.conceptoDelCurso(CODIGO_CURSO_CRONICO)),
  );

  /** Hallazgos y justificación clínica. Viaja como `noteText` (Patch v4.1.3). */
  protected readonly notasClinicas = signal<string>('');

  /**
   * Las opciones de cada catálogo, guardadas para resolver los casos de
   * demostración por **código**. Cargarlas no cuesta peticiones extra: el
   * cliente memoiza por target, así que cada una es la misma petición que ya
   * hace el `ConceptSelect` correspondiente.
   */
  protected readonly opcionesDiagnostico = signal<readonly DynamicEnumOption[]>([]);
  private readonly opcionesCategoria = signal<readonly DynamicEnumOption[]>([]);

  /**
   * El diagnóstico que se acaba de registrar, mientras se ofrece adjuntarle
   * un archivo (ALV-033).
   *
   * Sólo tiene sentido con un id real: adjuntar exige que la condición ya
   * exista, así que no se puede ofrecer antes de guardar. Se limpia al
   * registrar el siguiente diagnóstico o al cerrar el panel a mano — no
   * desaparece solo, porque el archivo puede tardar en elegirse.
   */
  protected readonly diagnosticoRecienRegistrado = signal<string | null>(null);

  /** El vínculo del adjunto pasa por `clinical`, no por el genérico de `common`. */
  protected readonly enlazarAdjuntoAlDiagnostico = (fileId: string, conditionId: string) =>
    this.clinical.attachFileToCondition(conditionId, fileId);

  protected cerrarAdjuntos(): void {
    this.diagnosticoRecienRegistrado.set(null);
  }

  private readonly opcionesSeveridad = signal<readonly DynamicEnumOption[]>([]);
  private readonly opcionesLateralidad = signal<readonly DynamicEnumOption[]>([]);
  private readonly opcionesCurso = signal<readonly DynamicEnumOption[]>([]);

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
      next: (enumeracion) => {
        this.opcionesDiagnostico.set(enumeracion.options);
        this.catalogoListo.set(enumeracion.options.length > 0);
      },
      // Sin binding declarado la API responde 404. No es un fallo transitorio
      // que convenga reintentar: es un dato que falta en el catálogo.
      error: () => this.catalogoListo.set(false),
    });
    this.cargarOpciones(TARGET_CATEGORIA, this.opcionesCategoria);
    this.cargarOpciones(TARGET_SEVERIDAD, this.opcionesSeveridad);
    this.cargarOpciones(TARGET_LATERALIDAD, this.opcionesLateralidad);
    this.cargarOpciones(TARGET_CURSO_CLINICO, this.opcionesCurso);
  }

  /** Guarda las opciones de un catálogo. Sin catálogo, lista vacía y ya. */
  private cargarOpciones(
    target: string,
    destino: WritableSignal<readonly DynamicEnumOption[]>,
  ): void {
    this.systemContext.dynamicEnum(target).subscribe({
      next: (enumeracion) => destino.set(enumeracion.options),
      error: () => destino.set([]),
    });
  }

  /**
   * Precarga el formulario con un caso de demostración.
   *
   * Cada código se resuelve al `conceptId` del catálogo por coincidencia
   * EXACTA; lo que no resuelve queda sin elegir y se avisa. Nunca se cae a
   * «la primera opción»: autocompletar un diagnóstico equivocado en una
   * historia clínica es peor que dejar el campo vacío.
   *
   * Pública a propósito: los escenarios combinados del expediente la invocan.
   */
  aplicarCasoDemo(caso: CasoDiagnosticoDemo): void {
    const faltantes: string[] = [];
    const resolver = (
      opciones: readonly DynamicEnumOption[],
      codigo: string,
      etiqueta: string,
    ): string | null => {
      const conceptId = conceptIdPorCodigo(opciones, codigo);
      if (conceptId === null) {
        faltantes.push(`${etiqueta} (${codigo})`);
      }
      return conceptId;
    };

    this.diagnostico.set(resolver(this.opcionesDiagnostico(), caso.code, 'diagnóstico'));
    this.categoria.set(resolver(this.opcionesCategoria(), caso.categoria, 'categoría'));
    this.severidad.set(resolver(this.opcionesSeveridad(), caso.severidad, 'severidad'));
    this.lateralidad.set(
      caso.lateralidad === undefined
        ? null
        : resolver(this.opcionesLateralidad(), caso.lateralidad, 'lateralidad'),
    );
    this.cursoClinico.set(resolver(this.opcionesCurso(), caso.cursoClinico, 'curso clínico'));
    this.inicio.set(new Date());
    this.fechaEsperada.set(
      caso.diasResolucion === undefined ? null : enDias(caso.diasResolucion),
    );
    this.notasClinicas.set(caso.notas);

    if (faltantes.length > 0) {
      this.toasts.warning(
        `Sin correspondencia en el catálogo: ${faltantes.join(', ')}. Elegilos a mano.`,
        `Caso «${caso.label}» aplicado parcialmente`,
      );
    } else {
      this.toasts.info(`Revisá y registrá cuando quieras.`, `Caso «${caso.label}» aplicado`);
    }
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
    const notas = this.notasClinicas().trim();

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
        ...(notas === '' ? {} : { noteText: notas }),
      })
      .subscribe({
        next: (registrado) => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.diagnosticoRecienRegistrado.set(registrado.id);
          this.limpiar();
          // Se dice que el paciente ya tiene el aviso —y no que «se le acaba de
          // enviar»— porque el aviso es uno por consulta: si el médico ya
          // guardó antes la nota de evolución, salió entonces. Como estado es
          // cierto en los dos casos; como evento, sería mentira en uno.
          // El proceso 2.6 promete ese aviso, y quien lo dispara tiene que
          // poder verlo: una promesa que no deja rastro se convierte en el
          // médico avisando por WhatsApp «por las dudas».
          this.toasts.success(
            'Quedó en la historia como condición activa y el paciente ya tiene el aviso.',
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
    this.notasClinicas.set('');
  }
}
