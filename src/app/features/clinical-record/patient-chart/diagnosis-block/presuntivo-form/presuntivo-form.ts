import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, filter, forkJoin, map, of, switchMap, tap, type Observable } from 'rxjs';

import { AuthService } from '../../../../../core/auth/auth.service';
import { ChartTemplatesClient } from '../../../../../core/data-access/chart-templates/chart-templates.client';
import type { ChartTemplate } from '../../../../../core/data-access/chart-templates/chart-templates.types';
import { ClinicalClient } from '../../../../../core/data-access/clinical/clinical.client';
import type { ConditionRegistration } from '../../../../../core/data-access/clinical/clinical.types';
import { FormsClient } from '../../../../../core/data-access/forms/forms.client';
import type { FormInstanceListItem } from '../../../../../core/data-access/forms/forms.types';
import { TerminologyClient } from '../../../../../core/data-access/terminology/terminology.client';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { ready, loading, validation } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../../shared/components/atoms/textarea/textarea';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../../shared/components/organisms/form-actions/form-actions';
import { writeFailureMessage } from '../../../write-message';
import { AdditionalFields } from '../../additional-fields/additional-fields';
import { fieldsOf, responsesOf, templateByCoverage } from '../../specialty-form-block/form-reading';
import { TARGET_DIAGNOSTICO } from '../diagnosis-targets';
import {
  motivosDeLaRespuesta,
  ORIGEN_FORMULARIO,
  resumenDelPresuntivo,
  type OrigenDelFormulario,
} from '../presuntivo-del-formulario';

const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Lo que dice el campo cuando la API rechaza el alta por un duplicado activo (409). */
const YA_TIENE_EL_DIAGNOSTICO =
  'Esta persona ya tiene este diagnóstico activo o en estudio. Búsquelo en la tabla de abajo para confirmarlo o rechazarlo.';

/**
 * **Alta de un diagnóstico presuntivo** (2026-10-30) — el formulario corto que `DiagnosisBlock`
 * ofrece arriba de su tabla.
 *
 * A pedido del cliente, para que el doctor no dé vueltas: el **diagnóstico** (catálogo CIE-10; la
 * API exige el concepto, no hay texto libre), los **motivos** como filas «campo: valor» escritas
 * ahí mismo —el mismo `AdditionalFields` del formulario médico— **o** traídas de un **formulario
 * médico ya llenado** del encuentro (editables), y unos **hallazgos** libres.
 *
 * Nace `PROVISIONAL` («En estudio») y se decide desde la tabla del bloque, que no cambió. Se guarda
 * en dos pasos: el diagnóstico y, si hay motivos, **una nota médica del encuentro** con las filas
 * estructuradas (`entries`), que después sirve de evidencia al confirmar o rechazar. La API no
 * guarda en el diagnóstico ni los motivos ni el formulario de origen —no hay columna—: el resumen
 * y la ficha de origen viajan en `noteText`.
 *
 * ## Fallo parcial
 *
 * Si el segundo paso falla, el diagnóstico **ya existe**: lo escrito se conserva y «Reintentar»
 * sólo repite la nota, nunca el diagnóstico. Por eso `terminado` —que los anfitriones atienden
 * cerrando el modal— sólo se emite con todo guardado (o al «dejar los motivos sin guardar»);
 * `diagnosticoCreado` avisa antes, para que la tabla relea.
 *
 * ## Por qué es su propio componente
 *
 * `DiagnosisBlock` es la tabla y el diálogo de verificación; el alta tiene su estado, sus
 * lecturas y sus pruebas. Juntos pasaban de 850 líneas contra un techo de 600.
 */
@Component({
  selector: 'app-presuntivo-form',
  imports: [
    AdditionalFields,
    Alert,
    AppButton,
    ConceptSelect,
    FormActions,
    FormField,
    Select,
    Textarea,
  ],
  templateUrl: './presuntivo-form.html',
  styleUrl: './presuntivo-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresuntivoForm {
  private readonly clinical = inject(ClinicalClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly toasts = inject(ToastService);
  private readonly forms = inject(FormsClient);
  private readonly chartTemplates = inject(ChartTemplatesClient);
  private readonly auth = inject(AuthService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, o `null` (el expediente): sin él no hay formularios que traer. */
  readonly encounterId = input<string | null>(null);

  /** El diagnóstico ya existe en el servidor (aunque falte la nota): la tabla tiene que releerse. */
  readonly diagnosticoCreado = output<void>();

  /** Todo quedó guardado, o se dejó sin guardar lo que faltaba: el anfitrión relee y cierra. */
  readonly terminado = output<void>();

  /**
   * Contrato de `DraftBlock`: hay algo escrito que se perdería al cerrar el
   * modal. Cuenta el diagnóstico elegido, los hallazgos, las filas de motivos
   * y un formulario elegido como origen.
   */
  readonly tieneCambiosPendientes = computed(
    () =>
      this.diagnostico() !== null ||
      this.hallazgos().trim() !== '' ||
      this.respuestaElegida() !== null ||
      (this.adicionales()?.tieneContenido() ?? false),
  );

  /**
   * Contrato de `DraftBlock`: con el diagnóstico ya registrado y los motivos sin guardar,
   * descartar **no** deja «todo sin registrar», y el anfitrión tiene que releer.
   */
  readonly mensajeDeDescarte = computed(() =>
    this.registrado() === null
      ? null
      : 'El diagnóstico ya quedó registrado como presuntivo. Si cierra, los motivos que escribió no se guardan.',
  );

  /* -- El alta de un presuntivo --------------------------------------------- */

  protected readonly targetDiagnostico = TARGET_DIAGNOSTICO;

  private readonly adicionales = viewChild(AdditionalFields);

  protected readonly diagnostico = signal<string | null>(null);
  /** Cómo se llama el diagnóstico elegido, para el aviso y el encabezado de la nota. */
  protected readonly nombreDelDiagnostico = signal<string | null>(null);
  protected readonly hallazgos = signal('');

  /** Las respuestas **cerradas** del encuentro, la más reciente primero. */
  protected readonly respuestasDelEncuentro = signal<readonly FormInstanceListItem[]>([]);
  protected readonly respuestaElegida = signal<string | null>(null);
  protected readonly origen = signal<OrigenDelFormulario | null>(null);
  protected readonly importando = signal(false);
  protected readonly avisoDeImportacion = signal<string | null>(null);
  protected readonly falloAlImportar = signal(false);
  private plantillas: readonly ChartTemplate[] | null = null;

  /**
   * Cuenta cuántas veces se vació el formulario (cambio de persona, descarte, fin del alta).
   * Un registro en vuelo que vuelve después de un vaciado **no escribe** sobre el formulario
   * nuevo: sin esto, el diagnóstico de la persona A quedaba como `registrado` en el de B y el
   * siguiente «Registrar» saltaba el alta y escribía la nota de B.
   */
  private generacion = 0;

  protected readonly enviando = signal(false);
  protected readonly resultado = signal<ViewState<null>>(ready(null));

  /** El diagnóstico ya registrado cuando lo que falló fue guardar los motivos. */
  protected readonly registrado = signal<ConditionRegistration | null>(null);
  protected readonly falloDeLosMotivos = signal<string | null>(null);

  protected readonly sinOrganizacion = computed(() => this.auth.activeTenantId() === null);

  protected readonly opcionesDeRespuesta = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Ninguno: escribo los motivos' },
    ...this.respuestasDelEncuentro().map((respuesta, indice) => ({
      value: respuesta.id,
      label: `Formulario médico · ${FORMATO_FECHA.format(new Date(respuesta.closedAt ?? respuesta.createdAt))}${indice === 0 ? ' · el más reciente' : ''}`,
    })),
  ]);

  /** La línea con la que abre la nota de los motivos. */
  protected readonly encabezadoDeLaNota = computed(() => {
    const nombre = this.nombreDelDiagnostico();
    const origen = this.origen();
    const base = `Motivos del diagnóstico presuntivo${nombre === null ? '' : ` «${nombre}»`}`;
    return origen === null
      ? base
      : `${base} · Del formulario «${origen.nombre}»${origen.fecha === '' ? '' : ` (${origen.fecha})`}`;
  });

  protected readonly puedeRegistrar = computed(
    () =>
      this.diagnostico() !== null &&
      !this.enviando() &&
      !this.importando() &&
      !this.sinOrganizacion() &&
      !(this.adicionales()?.hayProblemas() ?? false) &&
      (this.adicionales()?.impedimento() ?? null) === null,
  );

  protected readonly rotuloDelEnvio = computed(() =>
    this.registrado() === null ? 'Registrar como presuntivo' : 'Reintentar guardar los motivos',
  );

  /**
   * Lo que dijo el servidor al registrar, repartido: lo que es del campo
   * «Diagnóstico» va en el campo —el 409 de «ya lo tiene», o un `field` que
   * apunta a él— y el resto, en un aviso. El 403/404/sin conexión se dicen con
   * las palabras de siempre.
   */
  protected readonly erroresDelRegistro = computed<{
    readonly diagnostico: string;
    readonly general: string | null;
  }>(() => {
    const estado = this.resultado();
    if (estado.status === 'validation') {
      const delCampo = estado.issues.filter(
        (issue) => issue.code === 'CONFLICT' || issue.field === 'codeConceptId',
      );
      const resto = estado.issues.filter((issue) => !delCampo.includes(issue));
      return {
        diagnostico:
          delCampo.length === 0
            ? ''
            : delCampo.some((issue) => issue.code === 'CONFLICT')
              ? YA_TIENE_EL_DIAGNOSTICO
              : delCampo.map((issue) => issue.message).join(' '),
        general: resto.length === 0 ? null : resto.map((issue) => issue.message).join(' '),
      };
    }
    if (estado.status === 'ready' || estado.status === 'loading') {
      return { diagnostico: '', general: null };
    }
    return {
      diagnostico: '',
      general:
        writeFailureMessage(estado, {
          accion: 'registrar diagnósticos',
          sinPermiso: 'Su rol no permite registrar diagnósticos.',
        }) ?? 'No pudimos registrar el diagnóstico. Reintente.',
    };
  });

  protected elegirDiagnostico(conceptId: string | null): void {
    this.diagnostico.set(conceptId);
    this.nombreDelDiagnostico.set(null);
    this.resultado.set(ready(null));
    if (conceptId === null) return;
    this.terminology.readConceptLabels([conceptId]).subscribe({
      next: (etiquetas) => {
        if (this.diagnostico() === conceptId) {
          this.nombreDelDiagnostico.set(etiquetas.get(conceptId)?.display ?? null);
        }
      },
      // Sin el nombre el alta sigue: sólo el aviso y el encabezado quedan más secos.
      error: () => undefined,
    });
  }

  /**
   * Elegir un formulario ya llenado trae sus respuestas como filas editables;
   * elegir «Ninguno» saca las que se habían traído y deja las escritas a mano.
   */
  protected elegirRespuesta(instanciaId: string | null): void {
    this.respuestaElegida.set(instanciaId);
    this.avisoDeImportacion.set(null);
    this.falloAlImportar.set(false);
    if (instanciaId === null) {
      this.importando.set(false);
      this.origen.set(null);
      this.adicionales()?.quitarOrigen(ORIGEN_FORMULARIO);
      return;
    }
    this.importando.set(true);
    forkJoin({
      detalle: this.forms.getInstance(instanciaId),
      plantillas: this.leerPlantillas(),
    }).subscribe({
      next: ({ detalle, plantillas }) => {
        // Se eligió otro mientras éste viajaba.
        if (this.respuestaElegida() !== instanciaId) return;
        // Sin plantillas no hay nombre para ninguna pregunta: traerlas daría filas
        // «Campo del formulario (2)», «(3)»… sin sentido clínico. Mejor decirlo.
        if (plantillas.length === 0) {
          this.fallarLaImportacion();
          return;
        }
        const plantilla = templateByCoverage(detalle, plantillas);
        const lectura = motivosDeLaRespuesta(responsesOf(detalle, fieldsOf(plantillas)));
        const cierre = new Date(detalle.closedAt ?? detalle.createdAt);
        const sobrantes =
          this.adicionales()?.cargar(
            lectura.entradas.map((entrada) => ({ label: entrada.label, value: entrada.value })),
            ORIGEN_FORMULARIO,
          ) ?? 0;
        this.origen.set({
          id: instanciaId,
          nombre: plantilla?.name ?? 'Formulario médico',
          fecha: Number.isNaN(cierre.getTime()) ? '' : FORMATO_FECHA.format(cierre),
        });
        this.avisoDeImportacion.set(
          avisoDeLaImportacion(
            lectura.entradas.length - sobrantes,
            lectura.protegidas,
            lectura.recortadas,
            sobrantes,
          ),
        );
        this.importando.set(false);
      },
      error: () => {
        if (this.respuestaElegida() !== instanciaId) return;
        this.fallarLaImportacion();
      },
    });
  }

  /** No se pudo traer el formulario: se deja sin elegir y se dice, los motivos se escriben a mano. */
  private fallarLaImportacion(): void {
    this.importando.set(false);
    this.respuestaElegida.set(null);
    this.origen.set(null);
    this.falloAlImportar.set(true);
  }

  /** Las plantillas, leídas una vez: dan el nombre de cada pregunta. */
  private leerPlantillas(): Observable<readonly ChartTemplate[]> {
    if (this.plantillas !== null) return of(this.plantillas);
    // Sólo se guarda una lectura con datos: cachear un `[]` condenaría a toda importación
    // posterior de esta instancia a fallar aunque el catálogo ya respondiera bien.
    return this.chartTemplates.listTemplates().pipe(
      tap((lista) => {
        if (lista.length > 0) this.plantillas = lista;
      }),
    );
  }

  private cargarRespuestas(encuentro: string | null): void {
    this.elegirRespuesta(null);
    if (encuentro === null) {
      this.respuestasDelEncuentro.set([]);
      return;
    }
    this.forms.listInstancesByEncounter(encuentro).subscribe({
      next: (listado) => {
        if (this.encounterId() !== encuentro) return;
        this.respuestasDelEncuentro.set(
          listado.items
            .filter((item) => item.closedAt != null)
            .slice()
            .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? '')),
        );
      },
      // Sin la lectura el alta sigue: los motivos se escriben a mano.
      error: () => {
        if (this.encounterId() === encuentro) this.respuestasDelEncuentro.set([]);
      },
    });
  }

  /**
   * Registra el presuntivo.
   *
   * 1. `POST /clinical/conditions` con `verificationStatus: PROVISIONAL`. Si ya
   *    se había registrado (porque lo que falló fue la nota) **no se repite**.
   * 2. Si hay motivos, la nota del encuentro con las filas. Un fallo acá no
   *    deshace el diagnóstico: se dice y se conserva lo escrito.
   */
  protected registrar(): void {
    const diagnostico = this.diagnostico();
    const organizacion = this.auth.activeTenantId();
    if (this.enviando() || !this.puedeRegistrar() || diagnostico === null || organizacion === null) {
      return;
    }
    const encuentro = this.encounterId();
    const previo = this.registrado();
    const generacion = this.generacion;
    const noteText = resumenDelPresuntivo(
      this.hallazgos(),
      this.origen(),
      this.adicionales()?.entradas() ?? [],
    );

    this.enviando.set(true);
    this.resultado.set(loading());
    this.falloDeLosMotivos.set(null);

    const alta$: Observable<ConditionRegistration> =
      previo !== null
        ? of(previo)
        : this.clinical.createCondition({
            custodianTenantId: organizacion,
            patientProfileId: this.patientProfileId(),
            codeConceptId: diagnostico,
            ...(encuentro === null ? {} : { encounterId: encuentro }),
            ...(noteText === undefined ? {} : { noteText }),
            verificationStatus: 'PROVISIONAL',
          });

    alta$
      .pipe(
        // Si el formulario se vació mientras viajaba, nada de lo que sigue le corresponde.
        filter(() => generacion === this.generacion),
        tap((registro) => {
          this.registrado.set(registro);
          // El diagnóstico ya existe en el servidor: la tabla lo muestra aunque lo que sigue
          // falle. `terminado` NO se emite todavía: los dos anfitriones
          // (consulta y expediente) cierran el modal al recibirlo, y con la nota fallida eso
          // destruiría el bloque con el aviso y lo escrito adentro.
          if (previo === null) this.diagnosticoCreado.emit();
        }),
        switchMap(() => this.guardarMotivos(encuentro)),
      )
      .subscribe({
        next: (falloDeLosMotivos) => {
          if (generacion !== this.generacion) return;
          this.enviando.set(false);
          this.resultado.set(ready(null));
          if (falloDeLosMotivos !== null) {
            this.falloDeLosMotivos.set(falloDeLosMotivos);
            return;
          }
          const nombre = this.nombreDelDiagnostico();
          this.toasts.success(
            'Nace «En estudio»: confírmelo o recháselo desde «Diagnóstico».',
            nombre === null ? 'Diagnóstico presuntivo registrado' : `«${nombre}» registrado`,
          );
          this.reiniciar();
          // Todo quedó guardado: ahora sí el anfitrión relee (y cierra el modal, como con
          // cualquier otra alta de la consulta).
          this.terminado.emit();
        },
        // Sólo puede venir del alta: `guardarMotivos` nunca falla hacia arriba.
        error: (error: unknown) => {
          if (generacion !== this.generacion) return;
          this.enviando.set(false);
          // Un fallo que no es de la API —p. ej. el catálogo que no publica el
          // concepto presuntivo— dice su causa: «error inesperado (sin-id)» no
          // le sirve a quien atiende.
          this.resultado.set(
            error instanceof Error && !(error instanceof HttpErrorResponse)
              ? validation([{ message: error.message }])
              : errorToViewState<null>(error),
          );
        },
      });
  }

  /** La nota con las filas de motivos. `null` si salió bien o no había nada que guardar. */
  private guardarMotivos(encuentro: string | null): Observable<string | null> {
    const [nota] = this.adicionales()?.pasos(encuentro) ?? [];
    if (nota === undefined) return of(null);
    return nota.ejecutar().pipe(
      map(() => null),
      catchError((error: unknown) => {
        const estado = errorToViewState<null>(error);
        const motivo =
          estado.status === 'validation'
            ? estado.issues.map((issue) => issue.message).join(' ')
            : (writeFailureMessage(estado, { accion: 'guardar los motivos' }) ?? '');
        return of(conPunto(`No pudimos guardar los motivos${motivo === '' ? '' : `: ${motivo}`}`));
      }),
    );
  }

  /**
   * «Dejar los motivos sin guardar»: el diagnóstico ya existe y lo único que se
   * descarta es la nota. Se avisa al anfitrión, que relee —y cierra el modal—.
   */
  protected dejarSinGuardar(): void {
    this.reiniciar();
    this.terminado.emit();
  }

  /**
   * `Enter` dentro del campo de una fila de motivos no registra: con el cursor ahí el
   * envío implícito del `<form>` mandaba el diagnóstico con la fila a medias. Registrar es
   * un acto del botón. (Los desplegables manejan su propio `Enter`; sólo se frena el de un
   * `<input>` de texto de las filas.)
   */
  protected alApretarEnter(evento: Event): void {
    const destino = evento.target;
    if (
      destino instanceof HTMLInputElement &&
      destino.closest('.adicionales__fila') !== null
    ) {
      evento.preventDefault();
    }
  }

  /** Vuelve el formulario a vacío (también al cambiar de persona). */
  protected reiniciar(): void {
    this.generacion += 1;
    this.enviando.set(false);
    this.diagnostico.set(null);
    this.nombreDelDiagnostico.set(null);
    this.hallazgos.set('');
    this.respuestaElegida.set(null);
    this.origen.set(null);
    this.avisoDeImportacion.set(null);
    this.falloAlImportar.set(false);
    this.importando.set(false);
    this.registrado.set(null);
    this.falloDeLosMotivos.set(null);
    this.resultado.set(ready(null));
    this.adicionales()?.limpiar();
  }

  constructor() {
    // Lo escrito era de la persona anterior: no se arrastra.
    effect(() => {
      this.patientProfileId();
      untracked(() => this.reiniciar());
    });
    // Las respuestas de formulario que se pueden traer son las del encuentro.
    effect(() => {
      const encuentro = this.encounterId();
      untracked(() => this.cargarRespuestas(encuentro));
    });
  }
}

/** Qué se trajo del formulario y qué no, en palabras. */
function avisoDeLaImportacion(
  traidas: number,
  protegidas: number,
  recortadas: number,
  sobrantes: number,
): string {
  const partes = [
    traidas === 0
      ? 'El formulario no tiene respuestas para traer.'
      : `Se trajeron ${traidas} ${traidas === 1 ? 'respuesta' : 'respuestas'} como motivos: puede editarlas o quitarlas.`,
  ];
  if (protegidas > 0) {
    partes.push(
      `${protegidas} ${protegidas === 1 ? 'respuesta protegida no se copió' : 'respuestas protegidas no se copiaron'}.`,
    );
  }
  if (recortadas > 0) {
    partes.push(
      `${recortadas} ${recortadas === 1 ? 'valor se cortó' : 'valores se cortaron'} al máximo de 500 caracteres.`,
    );
  }
  if (sobrantes > 0) {
    partes.push(`${sobrantes} no entraron: el máximo es de 40 filas.`);
  }
  return partes.join(' ');
}

/** Cierra la frase con un punto si no termina en puntuación: el mensaje del servidor no siempre lo trae. */
function conPunto(texto: string): string {
  return /[.!?…]$/.test(texto) ? texto : `${texto}.`;
}
