import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import type { ClinicalSummary } from '../../../core/data-access/clinical/clinical.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { OwnPractitionerProfile } from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { downloadPrescriptionPdf } from '../../../shared/utils/clinical-pdf/clinical-pdf';
import { contextoDeLaSesion } from '../../../shared/utils/clinical-pdf/firma-de-la-sesion';
import {
  recetaDesdeResumen,
  type ContextoDelDocumento,
} from '../../../shared/utils/clinical-pdf/from-summary';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { TutorialTarget } from '../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  CITA_QUERY_PARAM,
  CLINICAL_RECORD_ROUTE,
  MOTIVO_QUERY_PARAM,
  patientChartRoute,
} from '../clinical-record.routes';
import { AdmissionBlock, type InternacionEnFicha } from '../patient-chart/admission-block/admission-block';
import {
  MedicationBlock,
  type DiagnosticoEnFicha,
  type RecetaEnFicha,
} from '../patient-chart/medication-block/medication-block';
import { SpecialtyFormBlock } from '../patient-chart/specialty-form-block/specialty-form-block';

/** Tope por bloque. La API aplica 50 si no se pide otro. */
const TOPE = 50;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Largo máximo del motivo de consulta. El backend no lo acota; la legibilidad sí. */
const TOPE_DEL_MOTIVO = 500;

/** Un encuentro abierto, listo para ofrecer su cierre. */
export interface EncuentroEnCurso {
  readonly id: string;
  readonly clase: string;
  readonly motivo: string;
  readonly desde: Date | null;
}

/**
 * **Atención clínica** — todo lo que se escribe durante una consulta.
 *
 * ## Por qué es una pantalla y no una columna del expediente
 *
 * Vivía dentro del Archivo clínico: la tarjeta del encuentro pegada al costado
 * de las pestañas de la historia y, debajo, los bloques de registro. Eran dos
 * modos de trabajo en la misma pantalla —leer y escribir— y se estorbaban: la
 * historia perdía la mitad del ancho contra un formulario de una sola pregunta,
 * y quien sólo venía a consultar un antecedente se llevaba encima un
 * odontograma y una internación que no iba a tocar.
 *
 * Separadas, cada una hace una cosa. El expediente es lectura —y por eso puede
 * quedarse con el ancho completo para sus ocho secciones—; ésta es escritura, y
 * es la que se abre desde la agenda y desde «Consulta médica», que es de donde
 * se llega con un paciente para atenderlo. Las dos se enlazan mutuamente, así
 * que consultar la historia mientras se registra sigue estando a un clic.
 *
 * ## Lee lo mismo que escribe
 *
 * Sólo `GET /clinical/patients/:id/summary`, que es de donde salen los
 * encuentros, la medicación, las internaciones y los diagnósticos. La lectura
 * narrativa (`/charts/...`) no hace falta acá: notas, planes y documentos son
 * historia, y su lugar es el expediente.
 *
 * El criterio para admitir una escritura no cambió y no es de alcance sino de
 * honestidad: se ofrece la que esta misma pantalla **vuelve a leer**.
 */
@Component({
  selector: 'app-encounter-workspace',
  imports: [
    AdmissionBlock,
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    DatePipe,
    FormActions,
    FormField,
    MedicationBlock,
    PageHeader,
    RouterLink,
    SpecialtyFormBlock,
    StatusSeal,
    Tab,
    Tabs,
    Textarea,
    TutorialTarget,
    ViewStateHost,
  ],
  templateUrl: './encounter-workspace.html',
  styleUrl: './encounter-workspace.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EncounterWorkspace {
  private readonly clinical = inject(ClinicalClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  /**
   * El perfil que se está atendiendo, leído del segmento `:profileId`.
   *
   * De la ruta activa y no como `input()` porque la aplicación no habilita
   * `withComponentInputBinding()`, igual que en el expediente.
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
   * sembrado, el campo es de quien escribe, y volver a leer el parámetro en
   * cada cambio pisaría lo que acaba de teclear.
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
   * corregir a mano. Su ausencia es corriente —una entrada que no vino de la
   * agenda— y el encuentro se abre igual.
   */
  protected readonly citaDeOrigen = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(CITA_QUERY_PARAM))),
    { initialValue: null },
  );

  protected readonly resumenClinico = signal<ViewState<ClinicalSummary>>(loading());

  /** Nombre del paciente si se pudo leer; vacío si el padrón está prohibido. */
  private readonly nombre = signal('');

  /**
   * El perfil profesional de **quien está atendiendo**, para firmar el papel.
   *
   * Es de la sesión y no del paciente: no se relee al pasar de uno a otro.
   */
  private readonly perfilPropio = signal<OwnPractitionerProfile | null>(null);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  private readonly datos = computed(() => dataOf(this.resumenClinico()));

  protected readonly titulo = computed(() =>
    this.nombre() === '' ? 'Atención clínica' : this.nombre(),
  );

  protected readonly subtitulo = computed(() =>
    this.nombre() === ''
      ? 'Lo que se registra durante la consulta.'
      : 'Lo que se registra durante esta consulta.',
  );

  /** El expediente de la misma persona: la lectura está a un clic de la escritura. */
  protected readonly rutaDelExpediente = computed(() => patientChartRoute(this.profileId()));

  /**
   * La ruta de navegación. El expediente de la persona queda como escalón
   * anterior —enlazado— porque es de donde se viene y a donde se vuelve.
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
      { label: this.titulo(), routerLink: this.rutaDelExpediente() },
      { label: 'Atención' },
    ];
  });

  /* -- El encuentro --------------------------------------------------------- */

  protected readonly topeDelMotivo = TOPE_DEL_MOTIVO;

  /**
   * La organización bajo la que se registra el encuentro.
   *
   * `tenantId` es obligatorio en el check-in y no se deduce del paciente: una
   * persona puede estar atendida en más de una. Es el custodio del registro,
   * así que sale de la sesión activa, que es donde ya se eligió.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /** El motivo de consulta del encuentro a abrir. */
  protected readonly motivo = signal('');

  /**
   * El resultado de la última escritura, para el aviso de la pantalla.
   *
   * Uno solo para las dos operaciones y no uno por cada una: sólo puede haber
   * una en vuelo, y dos avisos simultáneos sobre el mismo bloque compiten.
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
   * no reintentar.
   */
  protected readonly errorDelRegistro = computed<string | null>(() => {
    const state = this.registro();
    if (state.status === 'validation') {
      if (state.issues.some((issue) => issue.code === 'PRECONDITION_FAILED')) {
        return 'Ese encuentro ya no está en curso: alguien lo cerró antes. Recargá la atención.';
      }
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite registrar encuentros.';
    }
    if (state.status === 'not-found') {
      return 'El encuentro ya no existe. Recargá la atención.';
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
   * catálogo.
   */
  protected readonly encuentrosEnCurso = computed<readonly EncuentroEnCurso[]>(() =>
    (this.datos()?.encounters ?? [])
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
   * Con la lectura todavía en curso —o caída— no: abrir un encuentro contra una
   * persona cuyo resumen no se pudo leer es escribir a ciegas.
   */
  protected readonly puedeRegistrar = computed(
    () => this.datos() !== null && !this.sinOrganizacion(),
  );

  /**
   * El encuentro sobre el que se registra, o `null`.
   *
   * El primero de los abiertos, y no una elección: tener dos en curso para la
   * misma persona ya es una anomalía que el bloque de arriba muestra. Pedir que
   * se elija uno convertiría ese caso raro en una pregunta para todos.
   */
  protected readonly encuentroParaRecetar = computed<string | null>(
    () => this.encuentrosEnCurso()[0]?.id ?? null,
  );

  /**
   * Las internaciones de esta persona, con su «sigue abierta» ya resuelto.
   *
   * «Abierta» se deriva de `endAt` y no del estado, por lo mismo que en los
   * encuentros.
   */
  protected readonly internaciones = computed<readonly InternacionEnFicha[]>(() =>
    (this.datos()?.careEpisodes ?? []).map((episodio) => ({
      id: episodio.id,
      abierta: episodio.endAt === undefined,
      desde: episodio.startAt ?? null,
      hasta: episodio.endAt ?? null,
    })),
  );

  /**
   * Las recetas ya registradas, con su ciclo resuelto.
   *
   * «Firmada» y «emitida» salen de `signedAt` e `issuedAt`, no del estado: es
   * el mismo criterio con el que el encuentro deriva «en curso» de `endAt`.
   */
  protected readonly recetas = computed<readonly RecetaEnFicha[]>(() =>
    (this.datos()?.medicationRequests ?? []).map((receta) => ({
      id: receta.id,
      medicamento: this.label(receta.medicationConceptId),
      indicacion: [receta.doseText, receta.frequencyText].filter(Boolean).join(' · '),
      estado: this.label(receta.statusConceptId),
      firmada: receta.signedAt !== undefined,
      emitida: receta.issuedAt !== undefined,
    })),
  );

  /**
   * Los diagnósticos como opciones para «¿para qué es esta receta?».
   *
   * Se ofrecen **todos**, no sólo los activos: renovar el tratamiento de una
   * condición ya resuelta es un acto clínico legítimo, y esconderla obligaría a
   * dejar la receta sin indicación. Lo que sí lleva la etiqueta es el estado,
   * para que elegir una resuelta sea una decisión y no un descuido.
   */
  protected readonly diagnosticosParaReceta = computed<readonly DiagnosticoEnFicha[]>(() =>
    (this.datos()?.conditions ?? []).map((dx) => {
      const principal = this.label(dx.codeConceptId);
      return {
        id: dx.id,
        etiqueta: dx.resolvedAt === undefined ? principal : `${principal} · Resuelto`,
      };
    }),
  );

  /**
   * Los `medicationConceptId` de la medicación ya registrada, sin traducir —
   * lo que {@link MedicationBlock} necesita para chequear interacciones antes
   * de prescribir una más. Se incluye toda y no sólo la vigente: advertir de
   * más sobre algo que ya no se toma es un error mucho más chico que no
   * advertir sobre algo que sí.
   */
  protected readonly medicacionActivaConceptIds = computed<readonly string[]>(() =>
    Array.from(new Set((this.datos()?.medicationRequests ?? []).map((r) => r.medicationConceptId))),
  );

  constructor() {
    effect(() => {
      this.profileId();
      untracked(() => this.cargar());
    });

    // El motivo que trae la agenda se siembra al entrar y al cambiar de
    // persona. Depende del perfil a propósito: el motivo de la cita de alguien
    // no debe sobrevivir a la navegación hacia la atención de otro.
    effect(() => {
      this.profileId();
      const dePar = this.motivoDeLaCita();
      untracked(() => this.motivo.set(dePar));
    });

    // Quién firma se resuelve una sola vez, cuando la sesión dice que hay
    // perfil profesional: la matrícula no cambia porque se atienda a otro.
    effect(() => {
      const perfilId = this.auth.practitionerProfileId();
      untracked(() => this.resolverPerfilPropio(perfilId));
    });
  }

  /**
   * Lee el perfil profesional propio, del que sale la matrícula del papel.
   *
   * Falla en silencio: una cuenta sin perfil profesional —administración,
   * recepción— responde `404`, y eso es un caso normal que no cabe contarle a
   * nadie. Sin perfil no hay matrícula y el documento no imprime esa línea.
   */
  private resolverPerfilPropio(perfilId: string | null): void {
    if (perfilId === null) {
      this.perfilPropio.set(null);
      return;
    }
    if (this.perfilPropio()?.profileId === perfilId) {
      return;
    }
    this.profiles.getOwnPractitionerProfile().subscribe({
      next: (perfil) => this.perfilPropio.set(perfil),
      error: () => this.perfilPropio.set(null),
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  /* -- Escritura ------------------------------------------------------------ */

  /**
   * Abre el encuentro (UC-08-02).
   *
   * Sin confirmación previa: abrir un encuentro no es destructivo ni
   * irreversible —queda en curso y se cierra desde acá mismo—, y el M34 reserva
   * el diálogo para lo que no se puede deshacer. Lo que sí hace falta es
   * releer: el encuentro recién abierto tiene que aparecer, o la pantalla
   * estaría afirmando un registro que no muestra.
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
        // El motivo es opcional en el contrato: una cadena vacía sería un
        // motivo registrado que no dice nada, y se lee peor que su ausencia.
        ...(motivo === '' ? {} : { reasonText: motivo }),
        // El turno que originó la atención, cuando se llegó desde la agenda y
        // la reserva tenía cita clínica detrás. Es una clave foránea real: si
        // no viene, se omite en vez de mandar algo parecido.
        ...(cita === null || cita === '' ? {} : { appointmentId: cita }),
        // Quién atiende, del claim de la sesión. Un encuentro sin profesional
        // es una marca de tiempo sin autor.
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

  /**
   * Descarga la receta en PDF.
   *
   * Se ofrece también sobre una receta todavía sin emitir: el documento se
   * declara copia de trabajo en vez de aparentar validez, que es lo que haría
   * un PDF idéntico al de una receta emitida.
   */
  protected descargarReceta(receta: RecetaEnFicha): void {
    const guardada = (this.datos()?.medicationRequests ?? []).find(
      (fila) => fila.id === receta.id,
    );
    if (guardada === undefined) {
      return;
    }

    downloadPrescriptionPdf(
      recetaDesdeResumen(guardada, this.contextoDelDocumento(), (id) => this.label(id)),
    );
    this.toasts.success('La receta se descargó como PDF.', 'Receta');
  }

  /**
   * Quién es quién en el papel. La regla vive en `firma-de-la-sesion`, una sola
   * vez: la atención firma la receta y el expediente la historia de la visita,
   * y el mismo acto clínico no puede salir firmado distinto en cada papel.
   */
  private contextoDelDocumento(): ContextoDelDocumento {
    return contextoDeLaSesion({
      paciente: this.nombre(),
      practitionerProfileId: this.auth.practitionerProfileId(),
      displayName: this.auth.displayName(),
      perfilPropio: this.perfilPropio(),
      tenantId: this.auth.activeTenantId(),
      tenantName: (id) => this.auth.tenantName(id),
    });
  }

  /* -- Lectura -------------------------------------------------------------- */

  private cargar(): void {
    const profileId = this.profileId();
    this.resumenClinico.set(loading());
    this.etiquetas.set(new Map());
    this.nombre.set('');
    // El aviso de la escritura anterior no sobrevive a la relectura: tras un
    // cierre exitoso seguiría en pantalla un error que ya no describe nada.
    this.registro.set(ready(null));

    if (profileId === '') {
      // S6 y no un error: sin identificador no hay recurso que buscar, y decir
      // «no encontrado» no filtra nada porque no se preguntó por nadie.
      this.resumenClinico.set(
        notFound({ label: 'Elegir una persona', route: CLINICAL_RECORD_ROUTE }),
      );
      return;
    }

    // El nombre va por su lado a propósito: es cosmético y su permiso es otro.
    // Atarlo a la lectura clínica haría que un 403 del padrón se llevara puesta
    // la atención entera.
    this.profiles
      .getPatient(profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((paciente) => {
        if (paciente !== null) {
          this.nombre.set(paciente.displayName ?? `Paciente ${paciente.patientCode}`);
        }
      });

    this.clinical
      .getSummary(profileId, TOPE)
      .pipe(
        switchMap((resumen) =>
          this.terminology.readConceptLabels(conceptosDe(resumen)).pipe(
            catchError(() => of<ConceptLabels>(new Map())),
            map((etiquetas) => ({ resumen, etiquetas })),
          ),
        ),
      )
      .subscribe({
        next: ({ resumen, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.resumenClinico.set(ready(resumen));
        },
        error: (error: unknown) =>
          this.resumenClinico.set(errorToViewState<ClinicalSummary>(error)),
      });
  }

  /** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }
}


/**
 * Los identificadores de concepto que esta pantalla traduce, sin los ausentes.
 *
 * Listados a mano —y no recorriendo las claves que terminen en `ConceptId`—
 * para que una clave nueva del contrato obligue a decidir si se muestra, en vez
 * de colarse en la petición sin que nadie la haya puesto en pantalla. Son
 * menos que los del expediente porque acá se muestra menos: el encuentro, la
 * receta y el diagnóstico que la indica.
 */
function conceptosDe(resumen: ClinicalSummary): readonly string[] {
  return [
    ...resumen.conditions.map((fila) => fila.codeConceptId),
    ...resumen.medicationRequests.flatMap((fila) => [
      fila.medicationConceptId,
      fila.statusConceptId,
    ]),
    ...resumen.encounters.flatMap((fila) => [fila.statusConceptId, fila.classConceptId]),
  ].filter((id): id is string => id !== undefined);
}
