import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import type { PatientOrder } from '../../../core/data-access/diagnostics/diagnostics.types';
import { PatientContextService } from '../../../core/patient-context/patient-context.service';
import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import type {
  ClinicalSummary,
  Encounter,
  MedicationRequest,
} from '../../../core/data-access/clinical/clinical.types';
import { blobToDataUrl } from '../../../core/data-access/files/blob-to-data-url';
import { FileDownloader } from '../../../core/data-access/files/file-downloader';
import { FormsClient } from '../../../core/data-access/forms/forms.client';
import type { FormInstanceDetail } from '../../../core/data-access/forms/forms.types';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { Booking } from '../../../core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Accordion } from '../../../shared/components/molecules/accordion/accordion';
import { AccordionPanel } from '../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { EncounterTimeline } from '../../../shared/components/organisms/encounter-timeline/encounter-timeline';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { downloadVisitPdf } from '../../../shared/utils/clinical-pdf/clinical-pdf';
import type { DocumentoDeFormulario } from '../../../shared/utils/clinical-pdf/clinical-pdf.types';
import {
  atencionDesdeResumen,
  type ContextoDelDocumento,
  historiaDesdeFuentes,
} from '../../../shared/utils/clinical-pdf/from-summary';
import { descargarHistoriaConEncuentros } from '../../../shared/utils/clinical-pdf/historia-con-encuentros';
import { textoDeValor } from '../../../shared/utils/form-values/form-values';
import { MIS_TURNOS_ROUTE } from '../appointments/appointments.routes';
import {
  atencionesDeLaHistoria,
  bloquesDeDiagnosticos,
  seccionesNuevasDeLaHistoria,
  SIN_DATO,
  type BloqueDeDiagnosticos,
  type DetalleDeAtenciones,
  type EncounterInHistory,
} from './history-view-model';

/** Tope por bloque. El backend admite hasta 200; nadie lee doscientas filas. */
const TOPE = 50;

/* ---- FT-20 · las pestañas de la historia --------------------------------- */

/** El parámetro que dice qué pestaña se está mirando. */
const PARAM_DE_SECCION = 'seccion';

/**
 * Las pestañas, en el orden en que se dibujan.
 *
 * El nombre —y no el índice— es lo que viaja en la URL: si mañana se agrega una
 * pestaña en el medio, `?seccion=resultados` sigue apuntando a los resultados y
 * `?seccion=3` habría pasado a apuntar a otra cosa. «Diagnósticos» (C6) entró
 * al final justamente por eso: los cuatro enlaces que ya circulan siguen
 * apuntando a lo mismo.
 */
const SECCIONES = ['atenciones', 'recetas', 'alergias', 'resultados', 'diagnosticos'] as const;

/** Una receta del archivo. */
interface RecetaVisible {
  readonly id: string;
  readonly medicamento: string;
  readonly indicacion: string;
  readonly estado: string;
  readonly emitida: boolean;
  readonly cuando: Date;
}

/** Una fila de las listas de sólo lectura (alergias, resultados). */
interface FilaVisible {
  readonly id: string;
  readonly principal: string;
  readonly secundario: string;
  readonly cuando: Date | null;
}

/** Una respuesta de un formulario, ya en palabras. */
interface RespuestaLeible {
  readonly id: string;
  readonly etiqueta: string;
  /** La respuesta en palabras. Vacía cuando `masked`: el marcador la reemplaza. */
  readonly texto: string;
  readonly masked: boolean;
}

/** Un formulario clínico respondido, tal como lo lee quien fue atendido. */
interface FormularioVisible {
  readonly id: string;
  /** El encuentro en que se respondió; ata el formulario a su atención. */
  readonly encounterId: string;
  readonly titulo: string;
  /** Cuándo se completó, para mostrarse: el cierre manda; si no, la creación. */
  readonly cuando: Date | null;
  /** El cierre real, si lo hubo. Es lo único que el PDF declara como completado. */
  readonly cerradoEl?: Date;
  readonly respuestas: readonly RespuestaLeible[];
}

/**
 * **Mi historia clínica** — el archivo del paciente (carril 09, cierre del P0).
 *
 * ## Por qué es una pantalla propia y no el expediente del profesional
 *
 * El expediente (`/medical-records/:profileId`) mira los datos desde el otro
 * lado: elige a una persona, ofrece escribir —abrir encuentros, prescribir,
 * diagnosticar— y exige roles clínicos. Acá el eje es «lo mío», no hay ninguna
 * escritura y la pregunta que se responde es otra: **qué me pasó y qué me
 * recetaron**. Reusar aquella pantalla habría significado esconderle la mitad de
 * los controles a quien no puede usarlos, que es exactamente la clase de
 * pantalla que la corrección #7 manda a limpiar.
 *
 * ## Los documentos son los mismos que los del profesional
 *
 * Las descargas usan los generadores compartidos (`shared/utils/clinical-pdf`),
 * los mismos que el expediente. No hay una versión «del paciente» del PDF: es
 * el mismo hecho clínico, y dos versiones del mismo documento es lo que un
 * sistema de salud no puede permitirse.
 *
 * ## El aislamiento no depende de esta pantalla
 *
 * Se pide siempre el perfil propio, pero eso no es lo que protege nada: el
 * servidor comprueba la titularidad contra la base en cada lectura. Si esta
 * pantalla pidiera otro identificador, recibiría un 403.
 */
@Component({
  selector: 'app-medical-record',
  imports: [
    Accordion,
    AccordionPanel,
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    DatePipe,
    EncounterTimeline,
    FactList,
    NgTemplateOutlet,
    PageHeader,
    RouterLink,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './medical-record.html',
  styleUrl: './medical-record.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalRecord {
  private readonly clinical = inject(ClinicalClient);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly forms = inject(FormsClient);
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);
  private readonly contexto = inject(PatientContextService);
  private readonly toasts = inject(ToastService);
  private readonly descargas = inject(FileDownloader);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Quién es el titular. Sin esto no hay historia propia que pedir. */
  /**
   * De quién es la historia que se muestra.
   *
   * Computado (B.1): quien representa a un dependiente lee la suya sin cambiar
   * de cuenta, y una instantánea dejaría la pantalla clavada en el titular.
   */
  private readonly perfil = this.contexto.activePatientProfileId();

  /**
   * La cuenta no es de un paciente.
   *
   * No es un error ni una falta de permisos: el personal de salud tiene sesión
   * válida y su historia clínica, si la tiene, es la de su propia cuenta de
   * paciente — que es otra.
   */
  protected readonly sinPerfilDePaciente = this.perfil === null;

  /** La salida cuando la cuenta no es de un paciente. */
  protected readonly rutaDeTurnos = MIS_TURNOS_ROUTE;

  /* ---- FT-20 · qué pestaña se está mirando -------------------------------- */

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

  /**
   * La pestaña abierta, como índice.
   *
   * Vive en la URL y no en un signal suelto (FT-20-R05): así el enlace se
   * comparte apuntando a la sección que se estaba leyendo —«mirá mis
   * resultados» es un enlace, no una instrucción— y «atrás» deshace el cambio
   * de pestaña. Es el mismo criterio que ya usan la vista y los filtros de
   * Mis citas.
   *
   * Un nombre y no un número en el parámetro: `?seccion=recetas` sobrevive a que
   * mañana se agregue una pestaña en el medio, `?seccion=1` no.
   */
  protected readonly seccion = computed(() => {
    const nombre = this.params()?.get(PARAM_DE_SECCION) ?? '';
    const indice = (SECCIONES as readonly string[]).indexOf(nombre);
    return indice < 0 ? 0 : indice;
  });

  protected elegirSeccion(indice: number): void {
    const nombre = SECCIONES[indice] ?? SECCIONES[0];
    void this.router.navigate([], {
      relativeTo: this.route,
      // La primera no ensucia el enlace: es la que se ve al entrar sin nada.
      queryParams: { [PARAM_DE_SECCION]: indice === 0 ? null : nombre },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected readonly historia = signal<ViewState<ClinicalSummary>>(loading());

  /** El documento completo se está armando: dos lecturas más en vuelo. */
  protected readonly armandoHistoria = signal(false);

  /**
   * La receta que se está bajando ahora mismo (B.3), o `null` si ninguna.
   * Una a la vez: bajar dos PDFs juntos no cambia el resultado y complica el
   * `isLoading` de cada botón para nada.
   */
  protected readonly descargandoReceta = signal<string | null>(null);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /* ---- C6 · lo que la línea del encuentro necesita, al primer despliegue --- */

  /**
   * Las notas y las órdenes, o `null` si **todavía nadie desplegó una atención**.
   *
   * `null` no es «vacío»: es «no se pidió». La distinción es lo que hace que la
   * pantalla no salga a la red al abrirse. Son dos lecturas más que sólo sirven
   * cuando alguien quiere ver qué pasó en una consulta, y cobrárselas a todos
   * para que el acordeón esté listo por si acaso es exactamente lo que el
   * carril prohíbe.
   *
   * Y son **dos**, no dos por atención: `getChart` y `getOwnOrders` traen todo
   * el historial de una vez y después se reparte por `encounterId` acá.
   */
  private readonly detalle = signal<ViewState<DetalleDeAtenciones> | null>(null);

  /** Lo que ya llegó. Sin nada pedido —o con la lectura fallada— va vacío. */
  private readonly detalleCargado = computed<DetalleDeAtenciones>(() => {
    const estado = this.detalle();
    if (estado === null || (estado.status !== 'ready' && estado.status !== 'stale')) {
      return { notas: [], ordenes: [], citas: [] };
    }
    return estado.data;
  });

  /** Hay una lectura en vuelo: la línea lo declara en vez de callarse. */
  protected readonly cargandoDetalle = computed(() => this.detalle()?.status === 'loading');

  /** La lectura falló: la línea se dibuja con lo que hay y el aviso lo explica. */
  protected readonly falloElDetalle = computed(() => {
    const estado = this.detalle();
    return estado !== null && estado.status !== 'loading' && estado.status !== 'ready';
  });

  /**
   * Alguien desplegó una atención.
   *
   * Sólo el **primer** despliegue sale a la red: `detalle() !== null` ya
   * significa pedido, con lo cual plegar y desplegar diez veces sigue siendo
   * una lectura.
   */
  protected desplegarAtencion(abierta: boolean): void {
    if (!abierta || this.detalle() !== null || this.perfil === null) {
      return;
    }
    this.cargarDetalle(this.perfil);
  }

  private cargarDetalle(perfil: string): void {
    this.detalle.set(loading());

    forkJoin({
      expediente: this.clinical.getChart(perfil, TOPE),
      ordenes: this.diagnostics.getOwnOrders(TOPE),
      // C8: las citas del titular, de donde sale la reconsulta de cada
      // atención. Si esta lectura falla la historia no se pierde: la línea se
      // dibuja sin el hecho de la reconsulta, que es lo único que aporta.
      citas: this.scheduling
        .searchBookings({ patientProfileId: perfil, limit: TOPE })
        .pipe(catchError(() => of({ items: [] as readonly Booking[] }))),
    })
      .pipe(
        switchMap(({ expediente, ordenes, citas }) =>
          forkJoin({
            expediente: of(expediente),
            ordenes: of(ordenes),
            citas: of(citas),
            // Las órdenes traen conceptos que el resumen no tenía —el estudio,
            // su categoría, su estado—. Sin esta segunda lectura la línea
            // mostraría «Sin registrar» donde hay un hemograma. Lo mismo vale
            // para el estado de la reconsulta, que también es un concepto.
            etiquetas: this.terminology
              .readConceptLabels([
                ...conceptosDeLasOrdenes(ordenes.items),
                ...conceptosDeLasCitas(citas.items),
              ])
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ expediente, ordenes, citas, etiquetas }) => {
          this.sumarEtiquetas(etiquetas);
          this.detalle.set(
            ready({ notas: expediente.notes, ordenes: ordenes.items, citas: citas.items }),
          );
        },
        error: (error: unknown) => this.detalle.set(errorToViewState<DetalleDeAtenciones>(error)),
      });
  }

  /** Agrega traducciones a las que ya había, sin perder las del primer tramo. */
  private sumarEtiquetas(nuevas: ConceptLabels): void {
    if (nuevas.size === 0) {
      return;
    }
    this.etiquetas.set(new Map([...this.etiquetas(), ...nuevas]));
  }

  private readonly datos = computed<ClinicalSummary | null>(() => {
    const estado = this.historia();
    return estado.status === 'ready' || estado.status === 'stale' ? estado.data : null;
  });

  /* ---- los bloques, ya traducidos ---------------------------------------- */

  /**
   * Las atenciones, de la más reciente a la más vieja, con su línea del
   * encuentro (C6).
   *
   * Al revés que en el expediente del profesional, que las ordena como vienen:
   * quien entra a su archivo busca la última consulta, no la primera de su vida.
   */
  protected readonly atenciones = computed<readonly EncounterInHistory[]>(() => {
    const datos = this.datos();
    if (datos === null) {
      return [];
    }
    return atencionesDeLaHistoria(
      datos,
      this.detalleCargado(),
      (id) => this.label(id),
      (id) => this.codigo(id),
    );
  });

  /* ---- C6 · la pestaña «Diagnósticos» ------------------------------------- */

  /**
   * Los tres bloques: en estudio, enfermedades activas e históricos.
   *
   * Siempre los tres, vacíos incluidos: un bloque que desaparece obliga a
   * adivinar si no hay nada o si el sistema no lo trajo.
   */
  protected readonly diagnosticos = computed<readonly BloqueDeDiagnosticos[]>(() =>
    bloquesDeDiagnosticos(
      this.datos()?.conditions ?? [],
      (id) => this.label(id),
      (id) => this.codigo(id),
    ),
  );

  /** Cuántos diagnósticos hay en total, para el rótulo de la pestaña. */
  protected readonly cuantosDiagnosticos = computed(() => this.datos()?.conditions.length ?? 0);

  /** Ni uno solo: el vacío de la pestaña entera, con su orientación. */
  protected readonly sinDiagnosticos = computed(() => this.cuantosDiagnosticos() === 0);

  protected readonly recetas = computed<readonly RecetaVisible[]>(() =>
    (this.datos()?.medicationRequests ?? []).map((receta) => ({
      id: receta.id,
      medicamento: this.label(receta.medicationConceptId),
      indicacion: [receta.doseText, receta.frequencyText].filter(Boolean).join(' · '),
      estado: this.label(receta.statusConceptId),
      emitida: receta.issuedAt !== undefined,
      cuando: receta.createdAt,
    })),
  );

  protected readonly alergias = computed<readonly FilaVisible[]>(() =>
    (this.datos()?.allergies ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.substanceConceptId),
      secundario: this.label(fila.criticalityConceptId),
      cuando: fila.createdAt,
    })),
  );

  protected readonly resultados = computed<readonly FilaVisible[]>(() =>
    (this.datos()?.observations ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.codeConceptId),
      secundario: this.valorDe(fila.quantityValue, fila.quantityUnitConceptId, fila.valueText),
      cuando: fila.effectiveStartAt ?? null,
    })),
  );

  /**
   * Qué bloques quedaron recortados por el tope.
   *
   * Se dice con esas palabras: un recorte silencioso en una historia clínica se
   * lee como «no hay nada más», y eso es afirmar algo que nadie comprobó.
   */
  protected readonly recorte = computed(() => (this.datos()?.truncated ?? []).join(', '));

  /* ---- los formularios clínicos, para los documentos ---------------------- */

  /**
   * Los formularios propios, con sus respuestas ya leídas.
   *
   * La pantalla no los lista: se leen porque los llevan los dos documentos —el
   * de cada atención y el de la historia completa—, y quitar la lectura los
   * degradaría en silencio.
   *
   * Estado aparte de `historia` a propósito: salen de otro módulo del backend
   * (`/forms/me`), y un fallo ahí no justifica perder las atenciones ni al
   * revés. Si esta lectura falla, los documentos salen sin ese bloque y el
   * resto de la historia se muestra igual.
   */
  private readonly formularios = signal<ViewState<readonly FormularioVisible[]>>(loading());

  private readonly formulariosVisibles = computed<readonly FormularioVisible[]>(() => {
    const estado = this.formularios();
    return estado.status === 'ready' || estado.status === 'stale' ? estado.data : [];
  });

  /**
   * Lee el listado propio y el detalle de cada instancia.
   *
   * El detalle se trae entero al abrir la pantalla —y no al pedir el PDF—
   * porque es lo que el documento de la atención incorpora: descargarlo no
   * puede depender de una lectura que todavía no salió.
   */
  private cargarFormularios(): void {
    if (this.perfil === null) {
      return;
    }

    this.formularios.set(loading());
    this.forms
      .listMyInstances(TOPE)
      .pipe(
        switchMap((listado) =>
          listado.items.length === 0
            ? of<FormInstanceDetail[]>([])
            : forkJoin(listado.items.map((item) => this.forms.getMyInstance(item.id))),
        ),
      )
      .subscribe({
        next: (detalles) => {
          this.formularios.set(ready(detalles.map((detalle) => formularioLeible(detalle))));
        },
        error: (error: unknown) =>
          this.formularios.set(errorToViewState<readonly FormularioVisible[]>(error)),
      });
  }

  constructor() {
    if (this.perfil !== null) {
      this.cargar();
      this.cargarFormularios();
    } else {
      // No es un vacío de datos ni un error: la pantalla no le corresponde a
      // esta cuenta, y el aviso lo dice con su propia salida.
      this.historia.set(empty({ label: 'Ir a mis turnos', route: MIS_TURNOS_ROUTE }));
      this.formularios.set(ready([]));
    }
  }

  /* ---- lectura ------------------------------------------------------------ */

  protected cargar(): void {
    const perfil = this.perfil;
    if (perfil === null) {
      return;
    }

    this.historia.set(loading());
    this.etiquetas.set(new Map());

    this.clinical
      .getSummary(perfil, TOPE)
      .pipe(
        switchMap((resumen) =>
          forkJoin({
            resumen: of(resumen),
            // Sin etiquetas la historia igual se muestra: perder la traducción
            // de un concepto no justifica perder la historia entera.
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(resumen))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ resumen, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.historia.set(
            estaVacia(resumen)
              ? empty(
                  { label: 'Pedir un turno', route: MIS_TURNOS_ROUTE },
                  'Todavía no hay atenciones registradas en tu historia.',
                )
              : ready(resumen),
          );
        },
        error: (error: unknown) => this.historia.set(errorToViewState<ClinicalSummary>(error)),
      });
  }

  /* ---- los documentos (corrección #16) ------------------------------------ */

  /**
   * Descarga la historia clínica de esa atención.
   *
   * Mismo generador y mismo mapeo que usa el profesional: el paciente se lleva
   * exactamente el documento que su médico ve.
   */
  protected descargarAtencion(atencion: EncounterInHistory): void {
    const datos = this.datos();
    const encuentro = datos?.encounters.find((fila) => fila.id === atencion.id);
    if (datos === null || encuentro === undefined) {
      return;
    }

    downloadVisitPdf(
      atencionDesdeResumen(
        encuentro,
        datos,
        this.contextoDelDocumento(encuentro),
        (id) => this.label(id),
        this.formulariosDeLaAtencion(encuentro.id),
      ),
    );
    this.toasts.success('Descargamos la historia de esa atención.', 'Historia clínica');
  }

  /**
   * Descarga **toda** la historia en un solo documento.
   *
   * Las órdenes y los resultados se piden **al tocar el botón** y no al abrir la
   * pantalla: son dos lecturas más que la mayoría de las visitas no necesita, y
   * pagarlas siempre para que un botón esté listo por si acaso es cobrarle a
   * todos por lo que usan pocos.
   *
   * Si alguna de las dos falla, el documento se arma igual con lo que haya y el
   * aviso lo dice. Un PDF con las atenciones y sin las órdenes sigue sirviendo;
   * negarle la descarga entera a alguien porque una lectura secundaria falló, no.
   */
  protected descargarHistoriaCompleta(): void {
    const datos = this.datos();
    if (datos === null || this.armandoHistoria()) {
      return;
    }
    this.armandoHistoria.set(true);

    forkJoin({
      ordenes: this.diagnostics.getOwnOrders().pipe(catchError(() => of({ items: [] as never[] }))),
      resultados: this.diagnostics
        .getOwnResults()
        .pipe(catchError(() => of({ items: [] as never[] }))),
    })
      .pipe(
        // C6: los estudios traen conceptos que el resumen no tenía. Sin esta
        // traducción el papel imprimiría «Sin registrar» donde hay un
        // hemograma, que es la clase de documento que no sirve para leerlo.
        switchMap((traido) =>
          forkJoin({
            traido: of(traido),
            etiquetas: this.terminology
              .readConceptLabels(conceptosDeLasOrdenes(traido.ordenes.items))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ traido: { ordenes, resultados }, etiquetas }) => {
          this.sumarEtiquetas(etiquetas);
          this.armandoHistoria.set(false);
          // C6: las órdenes que acaba de traer el botón son las mismas que la
          // línea del encuentro necesita. Se guardan para que el documento y la
          // pantalla digan lo mismo, y para no volver a pedirlas al desplegar.
          this.adoptarOrdenes(ordenes.items);
          descargarHistoriaConEncuentros(
            historiaDesdeFuentes(
              {
                resumen: datos,
                // Todos los formularios del paciente, sin filtrar por encuentro:
                // la historia completa es longitudinal. Si su lectura falló, va
                // vacío — el documento no se niega por eso.
                formularios: this.formulariosVisibles().map(comoDocumentoDeFormulario),
                ordenes: ordenes.items,
                resultados: resultados.items,
              },
              this.contextoDelDocumento(),
              (id) => this.label(id),
            ),
            seccionesNuevasDeLaHistoria(this.diagnosticos(), this.atenciones()),
          );
          this.toasts.success('Descargamos tu historia completa.', 'Historia clínica');
        },
        error: () => {
          this.armandoHistoria.set(false);
          this.toasts.error(
            'No pudimos armar el documento. Reintentá en un momento.',
            'Historia clínica',
          );
        },
      });
  }

  /**
   * Guarda las órdenes que trajo la descarga, si la línea ya estaba pedida.
   *
   * Sólo si **ya estaba pedida**: con `detalle()` en `null` nadie desplegó una
   * atención, y dejarlo en `ready` con las notas vacías haría que el primer
   * despliegue creyera que el expediente ya se leyó y mostrara una consulta sin
   * su nota médica. Un atajo que ahorra una petición y pierde un dato clínico
   * no es un atajo.
   */
  private adoptarOrdenes(ordenes: readonly PatientOrder[]): void {
    const estado = this.detalle();
    if (estado === null || (estado.status !== 'ready' && estado.status !== 'stale')) {
      return;
    }
    this.detalle.set(ready({ ...estado.data, ordenes }));
  }

  /**
   * Los formularios respondidos en esa atención, en la forma del documento.
   *
   * `completadoEl` sale sólo del cierre real: una instancia sin cerrar no puede
   * aparentar fecha de completado en el papel. Si la lectura de formularios
   * falló, va vacío — el PDF no inventa una sección que no se pudo leer.
   */
  private formulariosDeLaAtencion(encounterId: string): readonly DocumentoDeFormulario[] {
    return this.formulariosVisibles()
      .filter((formulario) => formulario.encounterId === encounterId)
      .map(comoDocumentoDeFormulario);
  }

  /**
   * Descarga el PDF **oficial** de la receta (corrección #16, subtarea B.3).
   *
   * Ya no se arma en el navegador: el backend es el único que conoce la
   * matrícula y la especialidad del profesional, y es quien decide si el
   * documento sale como oficial o como copia de trabajo (borrador) —
   * distinción que un generador del lado del cliente no puede hacer sin
   * inventar el dato.
   */
  protected descargarReceta(receta: RecetaVisible): void {
    if (this.descargandoReceta() !== null) {
      return;
    }
    this.descargandoReceta.set(receta.id);

    this.clinical.downloadPrescriptionPdf(receta.id).subscribe({
      next: ({ blob, fileName }) => {
        blobToDataUrl(blob).subscribe({
          next: (dataUrl) => {
            this.descargas.trigger(dataUrl, fileName ?? `receta-${receta.id}.pdf`);
            this.descargandoReceta.set(null);
            this.toasts.success('Descarga iniciada exitosamente', 'Receta oficial');
          },
          error: () => this.fallaAlDescargarReceta(),
        });
      },
      error: () => this.fallaAlDescargarReceta(),
    });
  }

  /** Un solo sitio para el fallo: el motivo no se distingue, a propósito. */
  private fallaAlDescargarReceta(): void {
    this.descargandoReceta.set(null);
    this.toasts.error(
      'No pudimos descargar la receta oficial. Reintentá en un momento.',
      'Receta oficial',
    );
  }

  /**
   * Quién es quién en el papel.
   *
   * El nombre del paciente sale de la sesión —es el titular, no hace falta
   * pedirlo—. El profesional **no se puede resolver desde acá**: el resumen
   * clínico devuelve su identificador, no su nombre, y el paciente no tiene
   * permiso para leer el padrón de profesionales. Va vacío y el documento lo
   * imprime como «No registrado», que es preferible a poner un uuid o a
   * atribuirle la atención a alguien equivocado.
   */
  private contextoDelDocumento(_encuentro?: Encounter): ContextoDelDocumento {
    return {
      paciente: this.auth.displayName() ?? '',
      profesional: '',
    };
  }

  /* ---- traducción --------------------------------------------------------- */

  /** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /**
   * El **código** de catálogo de un concepto, que es por lo que se ramifica.
   *
   * La etiqueta es metadato de presentación y puede cambiar sin aviso; el
   * código no. Decidir el bloque de un diagnóstico por su etiqueta es lo que
   * haría que un retoque de redacción moviera una enfermedad de columna.
   */
  private codigo(conceptId: string | undefined): string | undefined {
    return conceptId === undefined ? undefined : this.etiquetas().get(conceptId)?.code;
  }

  /** El valor de una observación por los caminos que el contrato declara. */
  private valorDe(
    cantidad: string | undefined,
    unidadConceptId: string | undefined,
    texto: string | undefined,
  ): string {
    if (cantidad !== undefined) {
      return `${cantidad} ${this.label(unidadConceptId)}`.trim();
    }
    return texto ?? SIN_DATO;
  }
}

/**
 * Los conceptos que traen las órdenes del portal.
 *
 * Van en una lectura aparte porque las órdenes llegan después, al primer
 * despliegue: pedirlos con el resumen sería pedir la traducción de algo que
 * todavía no se leyó.
 */
function conceptosDeLasOrdenes(ordenes: readonly PatientOrder[]): readonly string[] {
  const ids = ordenes.flatMap((orden) => [
    orden.codeConceptId,
    orden.categoryConceptId,
    orden.statusConceptId,
  ]);
  return [...new Set(ids.filter((id): id is string => id !== undefined))];
}

/**
 * Los conceptos que traen las citas: el estado de la reconsulta.
 *
 * Es uno solo por cita, pero se pide igual con los de las órdenes en la misma
 * lectura: dos peticiones al catálogo para un despliegue serían una de más.
 */
function conceptosDeLasCitas(citas: readonly Booking[]): readonly string[] {
  return [...new Set(citas.map((cita) => cita.statusConceptId))];
}

/** Los conceptos que hay que traducir para pintar la historia. */
function conceptosDe(resumen: ClinicalSummary): readonly string[] {
  const ids = [
    ...resumen.conditions.flatMap((fila) => [
      fila.codeConceptId,
      fila.clinicalStatusConceptId,
      // C6: el bloque de un diagnóstico se decide por estos dos códigos. Sin
      // pedirlos, `diagnosisStateOf` no tendría con qué ramificar y todo caería
      // en «en estudio».
      fila.verificationStatusConceptId,
      fila.clinicalCourseConceptId,
    ]),
    ...resumen.allergies.flatMap((fila) => [fila.substanceConceptId, fila.criticalityConceptId]),
    ...resumen.medicationRequests.flatMap((fila: MedicationRequest) => [
      fila.medicationConceptId,
      fila.statusConceptId,
    ]),
    ...resumen.observations.flatMap((fila) => [
      fila.codeConceptId,
      fila.quantityUnitConceptId,
      fila.valueConceptId,
    ]),
  ];
  return [...new Set(ids.filter((id): id is string => id !== undefined))];
}

/**
 * Un formulario visible, en la forma del documento PDF.
 *
 * Lo comparten la historia de una atención y la historia completa: el mismo
 * formulario no puede salir distinto según qué papel lo lleve. `completadoEl`
 * sale sólo del cierre real, y el texto de un campo enmascarado ya viene vacío
 * del view-model — el armador además lo descarta por la bandera.
 */
function comoDocumentoDeFormulario(formulario: FormularioVisible): DocumentoDeFormulario {
  return {
    id: formulario.id,
    titulo: formulario.titulo,
    ...(formulario.cerradoEl === undefined ? {} : { completadoEl: formulario.cerradoEl }),
    respuestas: formulario.respuestas.map((respuesta) => ({
      etiqueta: respuesta.etiqueta,
      texto: respuesta.texto,
      masked: respuesta.masked,
    })),
  };
}

/**
 * Un formulario respondido, en la forma en que el archivo lo lee.
 *
 * El título es genérico porque la instancia no declara su plantilla y el
 * paciente no puede leer el catálogo de plantillas; la etiqueta de cada campo
 * sí viaja en el detalle (`fieldName`) y es lo que vuelve legible la respuesta.
 * Cuando `masked` está puesto, el texto queda vacío: el marcador lo pone el
 * documento — acá jamás viaja el contenido.
 */
function formularioLeible(detalle: FormInstanceDetail): FormularioVisible {
  const cierre = detalle.closedAt === undefined ? undefined : new Date(detalle.closedAt);
  const cerradoEl = cierre !== undefined && !Number.isNaN(cierre.getTime()) ? cierre : undefined;
  const creacion = new Date(detalle.createdAt);
  return {
    id: detalle.id,
    encounterId: detalle.resourceId,
    titulo: 'Formulario clínico',
    cuando: cerradoEl ?? (Number.isNaN(creacion.getTime()) ? null : creacion),
    ...(cerradoEl === undefined ? {} : { cerradoEl }),
    respuestas: [...detalle.values]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((valor) => ({
        id: valor.id,
        etiqueta: valor.fieldName ?? 'Campo del formulario',
        texto: valor.masked ? '' : textoDeValor(valor.value, valor.dataType),
        masked: valor.masked,
      })),
  };
}

/**
 * La historia no tiene nada que mostrar.
 *
 * Se mira bloque por bloque y no `encounters` solo: una persona puede tener
 * alergias registradas antes de su primera consulta, y decirle que su historia
 * está vacía sería falso.
 *
 * **Las condiciones ahora sí cuentan (C6).** Antes no: no se listaban por su
 * cuenta, así que un archivo que sólo las tuviera no dibujaba ni una fila.
 * Desde que existe la pestaña «Diagnósticos», un archivo con diagnósticos y
 * nada más tiene tres bloques que leer — decirle a esa persona que su historia
 * está vacía sería falso, y es exactamente lo que la regla del vacío prohíbe.
 */
function estaVacia(resumen: ClinicalSummary): boolean {
  return (
    resumen.encounters.length === 0 &&
    resumen.conditions.length === 0 &&
    resumen.allergies.length === 0 &&
    resumen.medicationRequests.length === 0 &&
    resumen.observations.length === 0
  );
}
