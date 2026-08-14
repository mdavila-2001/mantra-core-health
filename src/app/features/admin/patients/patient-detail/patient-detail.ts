import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { AuthzClient } from '../../../../core/data-access/authz/authz.client';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type { PatientDetail as FichaDePaciente } from '../../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { PdfExportButton } from '../../../../shared/components/molecules/pdf-export-button/pdf-export-button';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { RelatedPersonForm } from '../related-person-form/related-person-form';
import { PATIENTS_ROUTE } from '../patients.routes';

/**
 * Un dato de la ficha, ya listo para pintar: rótulo y valor legible.
 *
 * Se arma en el componente y no en la plantilla para que la decisión de qué
 * hacer cuando un dato falta —y de cómo se llama cada campo en el idioma del
 * dominio— quede en un solo lugar y se pueda probar.
 */
export interface FichaCampo {
  readonly etiqueta: string;
  readonly valor: string;
}

/** Un contacto de la ficha, con su vínculo ya traducido a etiqueta. */
export interface FichaContacto {
  readonly id: string;
  readonly nombre: string;
  readonly vinculo: string;
  readonly esTutor: boolean;
  readonly esEmergencia: boolean;
}

/** Una relación asistencial de la ficha, con su tipo ya traducido. */
export interface FichaRelacion {
  readonly id: string;
  readonly tipo: string;
  readonly proposito: string;
  readonly desde: Date;
  readonly hasta?: Date;
  readonly vigente: boolean;
}

/**
 * El bloque de relaciones asistenciales, con su propio estado.
 *
 * Tiene uno propio y no comparte el de la ficha porque **falla distinto**: la
 * lectura pide `CLINICIAN` o `SECURITY_ADMIN` y puede quedar prohibida sin que
 * eso diga nada sobre la filiación, que es lo que la persona vino a ver.
 */
export interface FichaRelaciones {
  readonly estado: 'cargando' | 'listo' | 'vacio' | 'sin-permiso';
  readonly items: readonly FichaRelacion[];
}

/** Lo que se muestra cuando el registro no tiene ese dato cargado. */
const SIN_DATO = 'Sin registrar';

/**
 * Ficha de filiación **F-01** (UC-05-14) — pantalla de detalle de V05-01.
 *
 * ## Qué NO trae, y por qué importa
 *
 * **Ningún dato clínico.** Condiciones, alergias y medicación se leen de
 * `clinical`, y las notas del expediente de `chart`. La separación es del
 * backend y responde a que filiación y expediente los administran roles
 * distintos: mezclarlas acá volvería clínica una pantalla administrativa.
 *
 * ## Los uuid no se muestran; se traducen
 *
 * La ficha llega con once `*ConceptId` en uuid. Mostrarlos sería mostrar ruido,
 * así que se resuelven de una sola vez con `GET /terminology/concepts?ids=…` —
 * una petición para todos, no una por campo.
 *
 * Si esa segunda lectura falla, **la ficha se muestra igual** con los campos de
 * catálogo en «Sin registrar»: el nombre, el documento y la fecha de nacimiento
 * son lo que la persona vino a ver, y perderlos porque el catálogo no respondió
 * sería cambiar un problema chico por uno grande.
 */
@Component({
  selector: 'app-patient-detail',
  imports: [
    PdfExportButton,
    AppButton,
    Badge,
    Card,
    DatePipe,
    PageHeader,
    RelatedPersonForm,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './patient-detail.html',
  styleUrl: './patient-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientDetail {
  /**
   * El bloque que se exporta a PDF.
   *
   * Por referencia y no por contenedor: el botón vive en la cabecera, así que
   * su contenedor sería la cabecera y el PDF saldría con el título y nada más.
   */
  protected readonly raizPdf = viewChild<ElementRef<HTMLElement>>('raizPdf');

  /** El elemento exportable, o `null` mientras la ficha no se pintó. */
  protected raizExportable(): HTMLElement | null {
    return this.raizPdf()?.nativeElement ?? null;
  }

  private readonly profiles = inject(ProfilesClient);
  private readonly authz = inject(AuthzClient);
  private readonly auth = inject(AuthService);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);

  /**
   * El perfil que se está mirando, leído del segmento `:profileId`.
   *
   * Se toma de la ruta activa y no como `input()` porque la aplicación no
   * habilita `withComponentInputBinding()`: activarlo acá cambiaría cómo se
   * enlazan las entradas de **todas** las pantallas, que no es una decisión que
   * corresponda tomar desde una ficha.
   */
  private readonly profileId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('profileId') ?? '')),
    { initialValue: '' },
  );

  protected readonly ficha = signal<ViewState<FichaDePaciente>>(loading());

  /**
   * Las relaciones asistenciales (V06-01), con su estado aparte.
   *
   * Empieza «cargando» aunque todavía no se haya pedido nada: la petición sale
   * en cuanto la ficha llega, y decir «vacío» antes de preguntar sería afirmar
   * que nadie atiende a esta persona sin haberlo consultado.
   */
  protected readonly relaciones = signal<FichaRelaciones>({ estado: 'cargando', items: [] });

  /** Etiquetas de los conceptos de esta ficha. Vacío mientras no resuelvan. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly paciente = computed(() => dataOf(this.ficha()));

  /**
   * La ruta de navegación, con el paciente como último escalón.
   *
   * El servicio resuelve hasta la sección —su coincidencia más larga es
   * «Pacientes»—; el nombre del registro lo agrega esta pantalla, que es la
   * única que lo conoce. El anteúltimo escalón pasa a ser enlace: desde una
   * ficha, volver al listado es la salida más pedida.
   */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }

    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: PATIENTS_ROUTE },
      { label: this.nombreVisible() },
    ];
  });

  /** Nombre para el encabezado. Sin nombre cargado, el código identifica igual. */
  protected readonly nombreVisible = computed(() => {
    const paciente = this.paciente();
    if (paciente === null) {
      return 'Ficha de paciente';
    }
    return paciente.displayName ?? `Paciente ${paciente.patientCode}`;
  });

  protected readonly subtitulo = computed(() => {
    const paciente = this.paciente();
    return paciente === null ? '' : `Código ${paciente.patientCode}`;
  });

  protected readonly fallecido = computed(() => this.paciente()?.deceasedAt !== undefined);

  /** Identificación: lo que distingue a esta persona de cualquier otra. */
  protected readonly identificacion = computed<readonly FichaCampo[]>(() => {
    const paciente = this.paciente();
    if (paciente === null) {
      return [];
    }

    return [
      { etiqueta: 'Código de paciente', valor: paciente.patientCode },
      { etiqueta: 'Índice maestro (MPI)', valor: paciente.masterPatientIndexCode ?? SIN_DATO },
      { etiqueta: 'Nombre visible', valor: paciente.displayName ?? SIN_DATO },
    ];
  });

  /** Datos demográficos, todos de catálogo salvo la fecha. */
  protected readonly demograficos = computed<readonly FichaCampo[]>(() => {
    const paciente = this.paciente();
    if (paciente === null) {
      return [];
    }

    return [
      {
        etiqueta: 'Género administrativo',
        valor: this.label(paciente.administrativeGenderConceptId),
      },
      { etiqueta: 'Sexo al nacer', valor: this.label(paciente.sexAtBirthConceptId) },
      { etiqueta: 'Identidad de género', valor: this.label(paciente.genderIdentityConceptId) },
      { etiqueta: 'Nacionalidad', valor: this.label(paciente.nationalityConceptId) },
      { etiqueta: 'Idioma preferido', valor: this.label(paciente.preferredLanguageConceptId) },
    ];
  });

  /** Datos que la atención necesita a mano. */
  protected readonly asistenciales = computed<readonly FichaCampo[]>(() => {
    const paciente = this.paciente();
    if (paciente === null) {
      return [];
    }

    return [
      { etiqueta: 'Grupo sanguíneo', valor: this.label(paciente.aboGroupConceptId) },
      { etiqueta: 'Factor Rh', valor: this.label(paciente.rhFactorConceptId) },
      { etiqueta: 'Estado de cobertura', valor: this.label(paciente.insuranceStatusConceptId) },
      { etiqueta: 'Idioma clínico', valor: this.label(paciente.clinicalLanguageConceptId) },
    ];
  });

  /** Estado del registro: de la persona y de su vinculación con otros sistemas. */
  protected readonly estado = computed<readonly FichaCampo[]>(() => {
    const paciente = this.paciente();
    if (paciente === null) {
      return [];
    }

    return [
      { etiqueta: 'Estado de la persona', valor: this.label(paciente.personStatusConceptId) },
      { etiqueta: 'Estado vital', valor: this.label(paciente.vitalStatusConceptId) },
      {
        etiqueta: 'Vinculación de registros',
        valor: this.label(paciente.recordLinkageStatusConceptId),
      },
    ];
  });

  /**
   * Contactos y representantes, con el vínculo ya traducido.
   *
   * Los dos roles se muestran por separado y pueden acumularse: quien firma un
   * consentimiento no es necesariamente a quien se llama en una urgencia, y dar
   * por sentado que sí es la clase de atajo que termina en una llamada al
   * teléfono equivocado.
   */
  protected readonly contactos = computed<readonly FichaContacto[]>(() => {
    const paciente = this.paciente();
    if (paciente === null) {
      return [];
    }

    return paciente.relatedPersons.map((persona) => ({
      id: persona.id,
      nombre: persona.displayName ?? 'Sin nombre registrado',
      vinculo: this.label(persona.relationshipConceptId),
      esTutor: persona.isLegalGuardian,
      esEmergencia: persona.isEmergencyContact,
    }));
  });

  /** Pestaña visible. `model` del organismo, así que se enlaza en los dos sentidos. */
  protected readonly pestana = signal(0);

  /** Si el formulario de alta de contacto está desplegado. */
  protected readonly agregando = signal(false);

  /**
   * El rótulo lleva la cuenta. En una ficha clínica saber que hay tres
   * contactos sin tener que entrar a mirarlos es la diferencia entre una
   * pestaña y un cajón.
   */
  protected readonly rotuloDeContactos = computed(() => {
    const cuantos = this.contactos().length;
    return cuantos === 0 ? 'Contactos' : `Contactos (${cuantos})`;
  });

  /**
   * Si ya hay un tutor legal. El modelo admite **uno solo activo** por
   * paciente, así que el formulario lo advierte antes de que el backend lo
   * rechace.
   */
  protected readonly yaTieneTutor = computed(() =>
    this.contactos().some((contacto) => contacto.esTutor),
  );

  /**
   * Tras registrar un contacto se relee la ficha entera.
   *
   * Agregarlo a la lista en memoria sería más rápido y estaría mal: el backend
   * decide el estado del vínculo y puede crear la persona, así que lo que
   * quedó registrado no es exactamente lo que se envió. Releer es lo que
   * garantiza que la pantalla muestre lo que hay, no lo que se pidió.
   */
  protected contactoRegistrado(): void {
    this.agregando.set(false);
    this.cargar();
  }

  constructor() {
    // Ir de una ficha a otra reutiliza el componente: sin escuchar el
    // parámetro, la segunda seguiría mostrando los datos de la primera.
    effect(() => {
      this.profileId();
      untracked(() => this.cargar());
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  /**
   * Pide la ficha y, con los identificadores que traiga, sus etiquetas.
   *
   * Encadenado y no en paralelo porque no hay forma de saber qué conceptos
   * pedir antes de tener la ficha. El `catchError` de la segunda lectura
   * devuelve un mapa vacío en vez de propagar: el fallo del catálogo degrada la
   * ficha, no la tumba.
   */
  private cargar(): void {
    this.ficha.set(loading());
    this.etiquetas.set(new Map());
    this.relaciones.set({ estado: 'cargando', items: [] });
    this.cargarRelaciones();

    this.profiles
      .getPatient(this.profileId())
      .pipe(
        switchMap((paciente) =>
          forkJoin({
            paciente: of(paciente),
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(paciente))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ paciente, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.ficha.set(ready(paciente));
        },
        error: (error: unknown) => this.ficha.set(errorToViewState<FichaDePaciente>(error)),
      });
  }

  /**
   * Las relaciones asistenciales del paciente (V06-01).
   *
   * Por su lado y no dentro del `forkJoin` de la ficha, a propósito: un `403`
   * acá —la lectura pide `CLINICIAN` o `SECURITY_ADMIN`— no debe llevarse puesta
   * la filiación, que es lo que la pantalla existe para mostrar.
   *
   * Sus etiquetas se resuelven en la misma llamada de terminología que el resto
   * no puede reutilizar, porque llegan después: se pide un segundo lote sólo con
   * los conceptos de las relaciones.
   */
  private cargarRelaciones(): void {
    const tenantId = this.auth.activeTenantId();
    const patientProfileId = this.profileId();

    if (tenantId === null || patientProfileId === '') {
      this.relaciones.set({ estado: 'vacio', items: [] });
      return;
    }

    this.authz
      .listCareRelationships({ tenantId, patientProfileId })
      .pipe(
        switchMap((items) =>
          forkJoin({
            items: of(items),
            etiquetas: this.terminology
              .readConceptLabels(
                items
                  .flatMap((relacion) => [
                    relacion.relationshipTypeConceptId,
                    relacion.purposeConceptId,
                  ])
                  .filter((id): id is string => id !== undefined),
              )
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ items, etiquetas }) => {
          if (items.length === 0) {
            this.relaciones.set({ estado: 'vacio', items: [] });
            return;
          }

          const ahora = new Date();
          this.relaciones.set({
            estado: 'listo',
            items: items.map((relacion) => ({
              id: relacion.id,
              tipo: etiquetas.get(relacion.relationshipTypeConceptId)?.display ?? SIN_DATO,
              proposito:
                relacion.purposeConceptId === undefined
                  ? ''
                  : (etiquetas.get(relacion.purposeConceptId)?.display ?? ''),
              desde: relacion.validFrom,
              ...(relacion.validTo === undefined ? {} : { hasta: relacion.validTo }),
              // Vigente es una ventana, no una bandera: sin `validTo` la
              // relación sigue abierta hasta que alguien la revoque.
              vigente:
                relacion.validFrom <= ahora &&
                (relacion.validTo === undefined || relacion.validTo > ahora),
            })),
          });
        },
        error: () => this.relaciones.set({ estado: 'sin-permiso', items: [] }),
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
 * Los identificadores de concepto de una ficha, sin los ausentes.
 *
 * Listarlos a mano —y no recorrer las claves que terminen en `ConceptId`— es
 * deliberado: una clave nueva en el contrato debe obligar a decidir si se
 * muestra, no colarse en la petición sin que nadie la haya puesto en pantalla.
 */
function conceptosDe(paciente: FichaDePaciente): readonly string[] {
  return [
    paciente.administrativeGenderConceptId,
    paciente.sexAtBirthConceptId,
    paciente.genderIdentityConceptId,
    paciente.nationalityConceptId,
    paciente.preferredLanguageConceptId,
    paciente.personStatusConceptId,
    paciente.vitalStatusConceptId,
    paciente.aboGroupConceptId,
    paciente.rhFactorConceptId,
    paciente.insuranceStatusConceptId,
    paciente.clinicalLanguageConceptId,
    paciente.recordLinkageStatusConceptId,
    ...paciente.relatedPersons.map((persona) => persona.relationshipConceptId),
  ].filter((id): id is string => id !== undefined);
}
