import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import type {
  ClinicalSummary,
  PatientChart as ExpedienteDePaciente,
} from '../../../core/data-access/clinical/clinical.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  CITA_QUERY_PARAM,
  CLINICAL_RECORD_ROUTE,
  MOTIVO_QUERY_PARAM,
} from '../clinical-record.routes';
import { MedicationBlock, type RecetaEnFicha } from './medication-block/medication-block';

/** Tope por bloque. La API aplica 50 si no se pide otro. */
const TOPE = 50;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Nombre legible de cada bloque, para el aviso de recorte. */
const NOMBRE_DE_BLOQUE: Readonly<Record<string, string>> = {
  conditions: 'diagnósticos',
  allergies: 'alergias',
  medicationRequests: 'medicación',
  observations: 'observaciones',
  encounters: 'encuentros',
  notes: 'notas',
  carePlans: 'planes de cuidados',
  documents: 'documentos',
};

/** Largo máximo del motivo de consulta. El backend no lo acota; la legibilidad sí. */
const TOPE_DEL_MOTIVO = 500;

/** Un encuentro abierto, listo para ofrecer su cierre. */
export interface EncuentroEnCurso {
  readonly id: string;
  readonly clase: string;
  readonly motivo: string;
  readonly desde: Date | null;
}

/** Una fila de cualquiera de las tablas del expediente, ya sin uuid. */
export interface FilaClinica {
  readonly id: string;
  readonly principal: string;
  readonly secundario: string;
  readonly estado: string;
  readonly cuando: Date | null;
  readonly detalle: string;
}

/** Lo que la pantalla necesita de las dos lecturas, ya unido. */
interface Expediente {
  readonly resumen: ClinicalSummary;
  readonly chart: ExpedienteDePaciente;
}

/**
 * **Expediente clínico** de una persona — `clinical` (M08) + `chart` (M15).
 *
 * ## Dos lecturas, una pantalla
 *
 * `GET /clinical/patients/:id/summary` trae lo estructurado —diagnósticos,
 * alergias, medicación, observaciones, encuentros— y
 * `GET /charts/patients/:id/chart` lo narrativo —notas, planes, documentos—.
 * La separación es de escritura: quien atiende no piensa en dos módulos.
 *
 * Van en `forkJoin` y **la pantalla exige las dos**: media historia clínica es
 * peor que ninguna, porque no se distingue de una historia completa que no
 * tiene alergias registradas.
 *
 * ## El nombre del paciente es opcional a propósito
 *
 * Ninguna de las dos lecturas lo trae, y `GET /profiles/patients/:id` pide
 * `SECURITY_ADMIN` — un rol que quien atiende no tiene. Se intenta y, si
 * responde `403`, el encabezado dice «Expediente clínico» y sigue. Tumbar el
 * expediente porque no se pudo poner un nombre en el título sería cambiar un
 * problema cosmético por uno clínico.
 *
 * ## Lo que quedó recortado se dice
 *
 * `truncated` nombra los bloques cortados por el tope. Un expediente al que le
 * faltan notas sin avisar es un expediente que miente, y en clínica esa mentira
 * se lee como «no hay antecedentes».
 *
 * ## Lo que se escribe acá: el encuentro y la receta
 *
 * La pantalla era de consulta pura. Abre y cierra **encuentros**
 * (`POST /clinical/encounters/check-in` y `.../{id}/close`) y, desde el
 * encuentro abierto, **receta** (`app-medication-block`). El criterio para
 * admitir una escritura no cambió y no es de alcance sino de honestidad: se
 * ofrece la que esta misma pantalla **vuelve a leer**. Encuentros y medicación
 * salen los dos de `GET /clinical/patients/:id/summary`, así que lo que se
 * registra aparece; firmar una nota tiene endpoint pero no lectura, y sería un
 * formulario que traga el dato.
 *
 * Juntas cierran el recorrido de quien atiende: llega desde su agenda con el
 * turno, abre el expediente, deja constancia de que la persona fue atendida y
 * le indica el tratamiento sin salir de la ficha.
 *
 * ## Por qué no hay un `appointmentId` en el encuentro
 *
 * El contrato del check-in lo admite, pero apunta a `clinical.appointments` y
 * `GET /scheduling/bookings` no expone ninguna. Lo que sí viaja desde la agenda
 * es el **motivo** de la cita, como parámetro, para precargar el del encuentro.
 * El vínculo por identificador queda anotado como P11 en `PENDIENTES-BACKEND.md`.
 */
@Component({
  selector: 'app-patient-chart',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DataTable,
    DatePipe,
    FormActions,
    FormField,
    MedicationBlock,
    PageHeader,
    StatusSeal,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './patient-chart.html',
  styleUrl: './patient-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientChart {
  private readonly clinical = inject(ClinicalClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  private readonly celdaPrincipal =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaPrincipal');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaEstado');
  private readonly celdaCuando =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaCuando');

  /**
   * El perfil que se está mirando, leído del segmento `:profileId`.
   *
   * De la ruta activa y no como `input()` porque la aplicación no habilita
   * `withComponentInputBinding()`: activarlo acá cambiaría cómo se enlazan las
   * entradas de todas las pantallas.
   */
  private readonly profileId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('profileId') ?? '')),
    { initialValue: '' },
  );

  /** El mismo perfil, para los bloques hijos que escriben contra él. */
  protected readonly pacienteDeLaFicha = this.profileId;

  /**
   * El motivo de la cita desde la que se llegó, si se llegó desde una.
   *
   * Lo pone la agenda en `?motivo=`. Es una **semilla**, no un enlace: una vez
   * sembrado, el campo es de quien escribe, y volver a leer el parámetro en cada
   * cambio pisaría lo que acaba de teclear.
   */
  private readonly motivoDeLaCita = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(MOTIVO_QUERY_PARAM) ?? '')),
    { initialValue: '' },
  );

  /**
   * La cita clínica del turno desde el que se llegó, si lo trae.
   *
   * A diferencia del motivo **no es una semilla editable**: es un identificador
   * que ata el encuentro a su turno, y no hay nada que quien atiende pueda
   * corregir a mano. Se lee de la URL en el momento de registrar.
   *
   * Su ausencia es corriente —una reserva sin cita clínica detrás, o una entrada
   * al expediente que no vino de la agenda— y el encuentro se abre igual.
   */
  protected readonly citaDeOrigen = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(CITA_QUERY_PARAM))),
    { initialValue: null },
  );

  protected readonly expediente = signal<ViewState<Expediente>>(loading());

  /** Nombre del paciente si se pudo leer; vacío si el padrón está prohibido. */
  private readonly nombre = signal('');

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  private readonly datos = computed(() => dataOf(this.expediente()));

  protected readonly titulo = computed(() =>
    this.nombre() === '' ? 'Expediente clínico' : this.nombre(),
  );

  protected readonly subtitulo = computed(() =>
    this.nombre() === ''
      ? 'Historia clínica y expediente de la persona atendida.'
      : 'Historia clínica y expediente.',
  );

  /**
   * La ruta de navegación, con el paciente como último escalón.
   *
   * El anteúltimo pasa a ser enlace: desde un expediente, volver a elegir otra
   * persona es la salida más pedida.
   */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: CLINICAL_RECORD_ROUTE },
      { label: this.titulo() },
    ];
  });

  /* -- Los bloques, ya traducidos ----------------------------------------- */

  protected readonly diagnosticos = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.conditions ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.codeConceptId),
      secundario: this.label(fila.categoryConceptId),
      estado: this.label(fila.clinicalStatusConceptId),
      cuando: fila.onsetAt ?? fila.createdAt,
      detalle: fila.resolvedAt === undefined ? '' : 'Resuelto',
    })),
  );

  protected readonly alergias = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.allergies ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.substanceConceptId),
      secundario: this.label(fila.categoryConceptId),
      estado: this.label(fila.clinicalStatusConceptId),
      cuando: fila.createdAt,
      // La criticidad es el dato que decide una conducta: va en el detalle, no
      // escondida en una columna que se pliega en móvil.
      detalle: this.label(fila.criticalityConceptId),
    })),
  );

  protected readonly medicacion = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.medicationRequests ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.medicationConceptId),
      secundario: [fila.doseText, fila.frequencyText].filter(Boolean).join(' · '),
      estado: this.label(fila.statusConceptId),
      cuando: fila.validFrom ?? fila.createdAt,
      detalle: fila.validTo === undefined ? '' : 'Con fin previsto',
    })),
  );

  protected readonly observaciones = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.observations ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.codeConceptId),
      secundario: this.valorDe(fila),
      estado: this.label(fila.statusConceptId),
      cuando: fila.effectiveStartAt ?? null,
      detalle: this.label(fila.interpretationConceptId),
    })),
  );

  protected readonly encuentros = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.encounters ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.classConceptId),
      secundario: fila.reasonText ?? '',
      estado: this.label(fila.statusConceptId),
      cuando: fila.startAt ?? null,
      detalle: fila.endAt === undefined ? 'En curso' : 'Cerrado',
    })),
  );

  protected readonly notas = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.notes ?? []).map((fila) => ({
      id: fila.noteId,
      principal: fila.chiefComplaintText ?? this.label(fila.noteTypeConceptId),
      secundario: fila.assessmentText ?? fila.subjectiveText ?? '',
      estado: this.label(fila.lifecycleStatusConceptId),
      cuando: fila.signedAt ?? fila.createdAt,
      // Derivado por el backend: no hace falta resolver terminología para saber
      // si la persona lo ve en su portal, y es un dato que cambia qué se escribe.
      detalle: fila.releasedToPatient ? 'Visible para la persona' : '',
    })),
  );

  protected readonly planes = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.carePlans ?? []).map((fila) => ({
      id: fila.id,
      principal: fila.goalText ?? 'Plan sin objetivo escrito',
      secundario: `${fila.activities.length} actividad${fila.activities.length === 1 ? '' : 'es'}`,
      estado: this.label(fila.statusConceptId),
      cuando: fila.startDate ?? fila.createdAt,
      detalle: this.label(fila.intentConceptId),
    })),
  );

  protected readonly documentos = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.documents ?? []).map((fila) => ({
      id: fila.id,
      principal: fila.title ?? 'Documento sin título',
      secundario: fila.authorText ?? '',
      estado: this.label(fila.statusConceptId),
      cuando: fila.documentDate ?? fila.createdAt,
      detalle: fila.isExternal === true ? 'Externo' : '',
    })),
  );

  /** Los ocho bloques con su rótulo, para dibujar las pestañas de una pasada. */
  protected readonly bloques = computed(() => [
    { clave: 'diagnosticos', titulo: 'Diagnósticos', filas: this.diagnosticos() },
    { clave: 'alergias', titulo: 'Alergias', filas: this.alergias() },
    { clave: 'medicacion', titulo: 'Medicación', filas: this.medicacion() },
    { clave: 'observaciones', titulo: 'Observaciones', filas: this.observaciones() },
    { clave: 'encuentros', titulo: 'Encuentros', filas: this.encuentros() },
    { clave: 'notas', titulo: 'Notas', filas: this.notas() },
    { clave: 'planes', titulo: 'Planes de cuidados', filas: this.planes() },
    { clave: 'documentos', titulo: 'Documentos', filas: this.documentos() },
  ]);

  /**
   * Aviso de recorte, en palabras.
   *
   * Se juntan los dos `truncated` porque para quien lee es un solo expediente:
   * que el corte venga de `clinical` o de `chart` es una división del backend
   * que no le cambia nada.
   */
  protected readonly recorte = computed(() => {
    const datos = this.datos();
    if (datos === null) {
      return '';
    }
    const bloques = [...datos.resumen.truncated, ...datos.chart.truncated].map(
      (clave) => NOMBRE_DE_BLOQUE[clave] ?? clave,
    );
    return bloques.length === 0 ? '' : bloques.join(', ');
  });

  protected readonly tope = TOPE;

  /* -- El encuentro: la única escritura de la pantalla --------------------- */

  protected readonly topeDelMotivo = TOPE_DEL_MOTIVO;

  /**
   * La organización bajo la que se registra el encuentro.
   *
   * `tenantId` es obligatorio en el check-in, y no hay forma de deducirlo del
   * paciente: una persona puede estar atendida en más de una. Es el custodio del
   * registro, así que sale de la sesión activa, que es donde el usuario ya lo
   * eligió.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /**
   * El motivo de consulta del encuentro a abrir.
   *
   * Se precarga con el `?motivo=` que trae la agenda —el de la cita— y desde ahí
   * es de quien escribe: el efecto que lo siembra corre al entrar y al cambiar
   * de persona, no en cada tecleo.
   */
  protected readonly motivo = signal('');

  /**
   * El resultado de la última escritura, para el aviso de la pantalla.
   *
   * Uno solo para las dos operaciones y no uno por cada una: sólo puede haber
   * una en vuelo, y dos avisos simultáneos pidiendo atención sobre el mismo
   * bloque compiten entre sí.
   */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  protected readonly registrando = signal(false);

  /** El encuentro en curso que se está cerrando, o `null`. */
  protected readonly cerrando = signal<string | null>(null);

  /**
   * El fallo de la escritura, en palabras.
   *
   * El `PRECONDITION_FAILED` se distingue dentro de S4 porque acá tiene un
   * significado concreto: el encuentro dejó de estar en curso —lo cerró otra
   * sesión, o esta pantalla está mirando datos viejos— y la salida es recargar,
   * no reintentar. `errorToViewState` lo trae como una validación con su código,
   * que es lo que permite reconocerlo sin mirar el mensaje.
   */
  protected readonly errorDelRegistro = computed<string | null>(() => {
    const state = this.registro();
    if (state.status === 'validation') {
      if (state.issues.some((issue) => issue.code === 'PRECONDITION_FAILED')) {
        return 'Ese encuentro ya no está en curso: alguien lo cerró antes. Recargá el expediente.';
      }
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite registrar encuentros.';
    }
    if (state.status === 'not-found') {
      return 'El encuentro ya no existe. Recargá el expediente.';
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
   * Los encuentros abiertos de esta persona.
   *
   * «Abierto» se deriva de `endAt` y no del estado: el estado es un uuid de
   * concepto, y ramificar por su valor ataría la pantalla a un identificador de
   * catálogo. El contrato ya declara `endAt` como el dato que dice si el
   * encuentro terminó, y es el mismo que la tabla usa para escribir «En curso».
   */
  protected readonly encuentrosEnCurso = computed<readonly EncuentroEnCurso[]>(() =>
    (this.datos()?.resumen.encounters ?? [])
      .filter((encuentro) => encuentro.endAt === undefined)
      .map((encuentro) => ({
        id: encuentro.id,
        clase: this.label(encuentro.classConceptId),
        motivo: encuentro.reasonText ?? 'Sin motivo registrado',
        desde: encuentro.startAt ?? null,
      })),
  );

  /**
   * Si la pantalla puede ofrecer el registro.
   *
   * Con el expediente todavía cargando —o caído— no: abrir un encuentro contra
   * una persona cuyo expediente no se pudo leer es escribir a ciegas.
   */
  protected readonly puedeRegistrar = computed(
    () => this.datos() !== null && !this.sinOrganizacion(),
  );

  /* -- La receta, que se escribe desde el encuentro ------------------------ */

  /**
   * El encuentro sobre el que se receta, o `null`.
   *
   * El primero de los abiertos, y no una elección: tener dos encuentros en
   * curso para la misma persona ya es una anomalía que el bloque de arriba
   * muestra. Pedir que se elija uno convertiría ese caso raro en una pregunta
   * para todos.
   */
  protected readonly encuentroParaRecetar = computed<string | null>(
    () => this.encuentrosEnCurso()[0]?.id ?? null,
  );

  /**
   * Las recetas del expediente, con su ciclo resuelto.
   *
   * «Firmada» y «emitida» salen de `signedAt` e `issuedAt`, no del estado: el
   * estado es un uuid de concepto, y ramificar por su valor ataría la pantalla
   * a un identificador de catálogo. Es el mismo criterio con el que el bloque
   * de encuentros deriva «en curso» de `endAt`.
   */
  protected readonly recetas = computed<readonly RecetaEnFicha[]>(() =>
    (this.datos()?.resumen.medicationRequests ?? []).map((receta) => ({
      id: receta.id,
      medicamento: this.label(receta.medicationConceptId),
      indicacion: [receta.doseText, receta.frequencyText].filter(Boolean).join(' · '),
      estado: this.label(receta.statusConceptId),
      firmada: receta.signedAt !== undefined,
      emitida: receta.issuedAt !== undefined,
    })),
  );

  protected readonly columnas = computed<readonly ColumnDef<FilaClinica>[]>(() => [
    { key: 'principal', header: 'Registro', priority: 1, cell: this.celdaPrincipal() },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'cuando', header: 'Fecha', priority: 2, cell: this.celdaCuando() },
    { key: 'detalle', header: 'Detalle', priority: 3 },
  ]);

  protected readonly porFila = (fila: FilaClinica): string => fila.id;

  /** El estado del bloque: hay filas, o el vacío con su explicación propia. */
  protected estadoDe(
    filas: readonly FilaClinica[],
    titulo: string,
  ): ViewState<readonly FilaClinica[]> {
    if (filas.length > 0) {
      return ready(filas);
    }
    // El vacío de un bloque clínico **no** ofrece cargar nada: esta pantalla es
    // de lectura y quien la mira puede no tener permiso de escritura. La salida
    // honesta es volver a elegir persona.
    return empty(
      { label: 'Elegir otra persona', route: CLINICAL_RECORD_ROUTE },
      `Sin ${titulo.toLowerCase()} registrados para esta persona.`,
    );
  }

  constructor() {
    // Ir de un expediente a otro reutiliza el componente: sin escuchar el
    // parámetro, el segundo seguiría mostrando los datos del primero.
    effect(() => {
      this.profileId();
      untracked(() => this.cargar());
    });

    // El motivo que trae la agenda se siembra al entrar y al cambiar de
    // persona. Depende del perfil a propósito: el motivo de la cita de alguien
    // no debe sobrevivir a la navegación hacia el expediente de otro.
    effect(() => {
      this.profileId();
      const dePar = this.motivoDeLaCita();
      untracked(() => this.motivo.set(dePar));
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  /* -- Escritura ----------------------------------------------------------- */

  /**
   * Abre el encuentro (UC-08-02).
   *
   * Sin confirmación previa: abrir un encuentro no es destructivo ni
   * irreversible —queda en curso y se cierra desde acá mismo—, y el M34 reserva
   * el diálogo para lo que no se puede deshacer. Lo que sí hace falta es
   * releer: el encuentro recién abierto tiene que aparecer en su bloque, o la
   * pantalla estaría afirmando un registro que no muestra.
   */
  protected registrarEncuentro(): void {
    const patientProfileId = this.profileId();
    const tenantId = this.organizacion();
    if (patientProfileId === '' || tenantId === null || this.registrando()) {
      return;
    }

    const motivo = this.motivo().trim();
    const cita = this.citaDeOrigen();
    const profesional = this.auth.practitionerProfileId();
    this.registrando.set(true);
    this.registro.set(loading());

    this.clinical
      .checkInEncounter({
        patientProfileId,
        tenantId,
        // El motivo es opcional en el contrato: una cadena vacía sería un motivo
        // registrado que no dice nada, y se lee peor que su ausencia.
        ...(motivo === '' ? {} : { reasonText: motivo }),
        // El turno que originó la atención, cuando se llegó desde la agenda y la
        // reserva tenía cita clínica detrás. Es una clave foránea real: si no
        // viene, se omite en vez de mandar algo parecido.
        ...(cita === null || cita === '' ? {} : { appointmentId: cita }),
        // Quién atiende, del claim de la sesión. Un encuentro sin profesional es
        // una marca de tiempo sin autor: mientras el dato no existía había que
        // omitirlo, ahora no.
        ...(profesional === null ? {} : { primaryPractitionerId: profesional }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.motivo.set('');
          this.toasts.success('Queda en curso hasta que lo cierres.', 'Encuentro abierto');
          this.cargar();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Cierra un encuentro en curso (UC-08-14).
   *
   * Con confirmación, y no por prudencia genérica: el backend responde `422` a
   * un encuentro que ya no está en curso, así que cerrar es un paso sin vuelta
   * desde la interfaz. Además dispara la facturación del lado del servidor.
   */
  protected async cerrarEncuentro(encuentro: EncuentroEnCurso): Promise<void> {
    if (this.cerrando() !== null) {
      return;
    }

    const confirmado = await this.dialogs.confirm({
      title: '¿Cerrar el encuentro?',
      message: `Se cierra «${encuentro.motivo}» y sus participantes y ubicaciones activos. Un encuentro cerrado no se puede volver a abrir.`,
      confirmLabel: 'Cerrar encuentro',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }

    this.cerrando.set(encuentro.id);
    this.registro.set(loading());

    this.clinical.closeEncounter(encuentro.id).subscribe({
      next: () => {
        this.cerrando.set(null);
        this.registro.set(ready(null));
        this.toasts.success('Queda registrado con su hora de fin.', 'Encuentro cerrado');
        this.cargar();
      },
      error: (error: unknown) => {
        this.cerrando.set(null);
        this.registro.set(errorToViewState<null>(error));
      },
    });
  }

  /* -- Lectura ------------------------------------------------------------- */

  private cargar(): void {
    const profileId = this.profileId();
    this.expediente.set(loading());
    this.etiquetas.set(new Map());
    this.nombre.set('');
    // El aviso de la escritura anterior no sobrevive a la relectura: tras un
    // cierre exitoso seguiría en pantalla un error que ya no describe nada.
    this.registro.set(ready(null));

    if (profileId === '') {
      // S6 y no un error: sin identificador no hay recurso que buscar, y decir
      // «no encontrado» no filtra nada porque no se preguntó por nadie.
      this.expediente.set(notFound({ label: 'Elegir una persona', route: CLINICAL_RECORD_ROUTE }));
      return;
    }

    // El nombre va por su lado a propósito: es cosmético y su permiso es otro.
    // Atarlo al `forkJoin` del expediente haría que un 403 del padrón se llevara
    // puesta la historia clínica.
    this.profiles
      .getPatient(profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((paciente) => {
        if (paciente !== null) {
          this.nombre.set(paciente.displayName ?? `Paciente ${paciente.patientCode}`);
        }
      });

    forkJoin({
      resumen: this.clinical.getSummary(profileId, TOPE),
      chart: this.clinical.getChart(profileId, TOPE),
    })
      .pipe(
        switchMap((datos) =>
          forkJoin({
            datos: of(datos),
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(datos))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ datos, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.expediente.set(ready(datos));
        },
        error: (error: unknown) => this.expediente.set(errorToViewState<Expediente>(error)),
      });
  }

  /** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /**
   * El valor de una observación.
   *
   * Cinco caminos excluyentes, en el orden en que el contrato los declara. Se
   * elige el primero presente en vez de concatenar: una observación no tiene dos
   * valores, y mostrar dos casillas sugeriría que sí.
   */
  private valorDe(observacion: {
    readonly quantityValue?: string;
    readonly quantityUnitConceptId?: string;
    readonly valueDecimal?: string;
    readonly valueText?: string;
    readonly valueBoolean?: boolean;
    readonly valueConceptId?: string;
  }): string {
    if (observacion.quantityValue !== undefined) {
      const unidad = this.label(observacion.quantityUnitConceptId);
      return unidad === SIN_DATO
        ? observacion.quantityValue
        : `${observacion.quantityValue} ${unidad}`;
    }
    if (observacion.valueDecimal !== undefined) {
      return observacion.valueDecimal;
    }
    if (observacion.valueText !== undefined) {
      return observacion.valueText;
    }
    if (observacion.valueBoolean !== undefined) {
      return observacion.valueBoolean ? 'Sí' : 'No';
    }
    if (observacion.valueConceptId !== undefined) {
      return this.label(observacion.valueConceptId);
    }
    return SIN_DATO;
  }
}

/**
 * Los identificadores de concepto del expediente, sin los ausentes.
 *
 * Listados a mano —y no recorriendo las claves que terminen en `ConceptId`— por
 * lo mismo que en la ficha de paciente: una clave nueva del contrato debe
 * obligar a decidir si se muestra, no colarse en la petición sin que nadie la
 * haya puesto en pantalla.
 */
function conceptosDe({ resumen, chart }: Expediente): readonly string[] {
  return [
    ...resumen.conditions.flatMap((fila) => [
      fila.codeConceptId,
      fila.categoryConceptId,
      fila.clinicalStatusConceptId,
      fila.severityConceptId,
    ]),
    ...resumen.allergies.flatMap((fila) => [
      fila.substanceConceptId,
      fila.categoryConceptId,
      fila.criticalityConceptId,
      fila.clinicalStatusConceptId,
    ]),
    ...resumen.medicationRequests.flatMap((fila) => [
      fila.medicationConceptId,
      fila.statusConceptId,
    ]),
    ...resumen.observations.flatMap((fila) => [
      fila.codeConceptId,
      fila.statusConceptId,
      fila.interpretationConceptId,
      fila.valueConceptId,
      fila.quantityUnitConceptId,
    ]),
    ...resumen.encounters.flatMap((fila) => [fila.statusConceptId, fila.classConceptId]),
    ...chart.notes.flatMap((fila) => [fila.noteTypeConceptId, fila.lifecycleStatusConceptId]),
    ...chart.carePlans.flatMap((fila) => [fila.statusConceptId, fila.intentConceptId]),
    ...chart.documents.flatMap((fila) => [fila.categoryConceptId, fila.statusConceptId]),
  ].filter((id): id is string => id !== undefined);
}
