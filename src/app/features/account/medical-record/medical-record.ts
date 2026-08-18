import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import type {
  ClinicalSummary,
  Encounter,
  MedicationRequest,
} from '../../../core/data-access/clinical/clinical.types';
import { FormsClient } from '../../../core/data-access/forms/forms.client';
import type { FormInstanceDetail } from '../../../core/data-access/forms/forms.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  downloadHistoryPdf,
  downloadPrescriptionPdf,
  downloadVisitPdf,
  VALOR_ENMASCARADO,
} from '../../../shared/utils/clinical-pdf/clinical-pdf';
import type { DocumentoDeFormulario } from '../../../shared/utils/clinical-pdf/clinical-pdf.types';
import {
  atencionDesdeResumen,
  recetaDesdeResumen,
  type ContextoDelDocumento,
  historiaDesdeFuentes,
} from '../../../shared/utils/clinical-pdf/from-summary';
import { textoDeValor } from '../../../shared/utils/form-values/form-values';
import { MIS_TURNOS_ROUTE } from '../appointments/appointments.routes';

/** Tope por bloque. El backend admite hasta 200; nadie lee doscientas filas. */
const TOPE = 50;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Una atención, tal como la lee quien fue atendido. */
interface AtencionVisible {
  readonly id: string;
  readonly motivo: string;
  readonly cuando: Date | null;
  readonly cerrada: boolean;
  /** Los diagnósticos de esa consulta, en palabras. */
  readonly diagnosticos: readonly string[];
}

/** Una receta del archivo. */
interface RecetaVisible {
  readonly id: string;
  readonly medicamento: string;
  readonly indicacion: string;
  readonly estado: string;
  readonly emitida: boolean;
  readonly cuando: Date;
}

/** Una fila de las listas de sólo lectura (diagnósticos, alergias, resultados). */
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
  imports: [Alert, AppButton, Badge, DatePipe, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './medical-record.html',
  styleUrl: './medical-record.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalRecord {
  private readonly clinical = inject(ClinicalClient);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly forms = inject(FormsClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** Quién es el titular. Sin esto no hay historia propia que pedir. */
  private readonly perfil = this.auth.patientProfileId();

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

  protected readonly historia = signal<ViewState<ClinicalSummary>>(loading());

  /** El documento completo se está armando: dos lecturas más en vuelo. */
  protected readonly armandoHistoria = signal(false);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  private readonly datos = computed<ClinicalSummary | null>(() => {
    const estado = this.historia();
    return estado.status === 'ready' || estado.status === 'stale' ? estado.data : null;
  });

  /* ---- los bloques, ya traducidos ---------------------------------------- */

  /**
   * Las atenciones, de la más reciente a la más vieja.
   *
   * Al revés que en el expediente del profesional, que las ordena como vienen:
   * quien entra a su archivo busca la última consulta, no la primera de su vida.
   */
  protected readonly atenciones = computed<readonly AtencionVisible[]>(() => {
    const datos = this.datos();
    if (datos === null) {
      return [];
    }
    return [...datos.encounters]
      .sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0))
      .map((encuentro) => ({
        id: encuentro.id,
        motivo: encuentro.reasonText ?? 'Consulta',
        cuando: encuentro.startAt ?? null,
        cerrada: encuentro.endAt !== undefined,
        diagnosticos: datos.conditions
          .filter((fila) => fila.encounterId === encuentro.id)
          .map((fila) => this.label(fila.codeConceptId)),
      }));
  });

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

  protected readonly diagnosticos = computed<readonly FilaVisible[]>(() =>
    (this.datos()?.conditions ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.codeConceptId),
      secundario: this.label(fila.clinicalStatusConceptId),
      cuando: fila.onsetAt ?? fila.createdAt,
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

  /* ---- los formularios clínicos respondidos ------------------------------- */

  /** Lo que el archivo imprime donde el backend no expuso el valor. */
  protected readonly marcadorEnmascarado = VALOR_ENMASCARADO;

  /**
   * Los formularios propios, con sus respuestas ya leídas.
   *
   * Estado aparte de `historia` a propósito: salen de otro módulo del backend
   * (`/forms/me`), y un fallo ahí no justifica perder las atenciones ni al
   * revés. Cada bloque declara su propia carga y su propio error.
   */
  protected readonly formularios = signal<ViewState<readonly FormularioVisible[]>>(loading());

  protected readonly buscandoFormularios = computed(
    () => this.formularios().status === 'loading',
  );

  protected readonly formulariosVisibles = computed<readonly FormularioVisible[]>(() => {
    const estado = this.formularios();
    return estado.status === 'ready' || estado.status === 'stale' ? estado.data : [];
  });

  /** Si la lectura de formularios falló, acá está el porqué, en palabras. */
  protected readonly errorDeFormularios = computed<string | null>(() => {
    const estado = this.formularios();
    if (estado.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (estado.status === 'forbidden') {
      return estado.message ?? 'Tu cuenta no puede leer estos formularios.';
    }
    if (estado.status === 'not-found') {
      return 'No encontramos tus formularios.';
    }
    if (estado.status === 'validation') {
      return estado.issues.map((issue) => issue.message).join(' ') || 'No pudimos leerlos.';
    }
    if (estado.status === 'error') {
      return `${estado.message || 'Ocurrió un error inesperado.'} (${estado.requestId})`;
    }
    return null;
  });

  /**
   * Lee el listado propio y el detalle de cada instancia.
   *
   * El detalle se trae entero de una vez —no al desplegar— porque es lo que la
   * sección muestra y lo que el PDF de la atención incorpora: descargar un
   * documento no puede depender de una lectura que todavía no salió.
   */
  protected cargarFormularios(): void {
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
  protected descargarAtencion(atencion: AtencionVisible): void {
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
    }).subscribe({
      next: ({ ordenes, resultados }) => {
        this.armandoHistoria.set(false);
        downloadHistoryPdf(
          historiaDesdeFuentes(
            {
              resumen: datos,
              // Todos los formularios del paciente, sin filtrar por encuentro:
              // la historia completa es longitudinal. Si su lectura falló, va
              // vacío y la sección lo dice — el documento no se niega por eso.
              formularios: this.formulariosVisibles().map(comoDocumentoDeFormulario),
              ordenes: ordenes.items,
              resultados: resultados.items,
            },
            this.contextoDelDocumento(),
            (id) => this.label(id),
          ),
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

  /** Descarga la receta. Disponible en cualquier momento posterior a su emisión. */
  protected descargarReceta(receta: RecetaVisible): void {
    const guardada = this.datos()?.medicationRequests.find((fila) => fila.id === receta.id);
    if (guardada === undefined) {
      return;
    }

    downloadPrescriptionPdf(
      recetaDesdeResumen(guardada, this.contextoDelDocumento(), (id) => this.label(id)),
    );
    this.toasts.success('Descargamos tu receta.', 'Receta');
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

/** Los conceptos que hay que traducir para pintar la historia. */
function conceptosDe(resumen: ClinicalSummary): readonly string[] {
  const ids = [
    ...resumen.conditions.flatMap((fila) => [fila.codeConceptId, fila.clinicalStatusConceptId]),
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
 * sí viaja en el detalle (`fieldName`) y es lo que vuelve legible la lista.
 * Cuando `masked` está puesto, el texto queda vacío: el marcador lo pone la
 * vista — acá jamás viaja el contenido.
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
