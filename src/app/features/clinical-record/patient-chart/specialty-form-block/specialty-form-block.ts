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
} from '@angular/core';
import { of, switchMap } from 'rxjs';

import { ChartTemplatesClient } from '../../../../core/data-access/chart-templates/chart-templates.client';
import type {
  ChartTemplate,
  ChartTemplateField,
} from '../../../../core/data-access/chart-templates/chart-templates.types';
import { FormsClient } from '../../../../core/data-access/forms/forms.client';
import type {
  FieldValueInput,
  FormInstanceDetail,
} from '../../../../core/data-access/forms/forms.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import {
  downloadFormResponsePdf,
  VALOR_ENMASCARADO,
} from '../../../../shared/utils/clinical-pdf/clinical-pdf';

/** Los tipos de dato que este bloque sabe dibujar como campo de captura. */
type TipoDibujable = 'boolean' | 'integer' | 'decimal' | 'date' | 'text' | 'string';

/** Una respuesta ya lista para leerse: etiqueta, texto y si está protegida. */
interface RespuestaVisible {
  readonly id: string;
  readonly etiqueta: string;
  /** La respuesta en palabras. Vacía cuando `masked`: el marcador la reemplaza. */
  readonly texto: string;
  readonly masked: boolean;
}

/** Cómo se imprime una fecha en el modo lectura. Local, no ISO: lo lee gente. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/**
 * **Formularios clínicos por especialidad**, dentro del encuentro — carril 2,
 * punto 1 del reclamo.
 *
 * ## Qué plantilla se ofrece
 *
 * El objetivo final es «el formulario asignado a la especialidad del
 * encuentro activo», pero hoy el frontend no tiene de dónde leer esa
 * especialidad —el encuentro no la trae y no hay binding declarado para
 * derivarla del profesional que atiende—. Mientras esa pieza no exista, el
 * bloque ofrece las plantillas existentes en un selector y quien atiende
 * elige la suya; con una sola plantilla, se preselecciona sola. El día que
 * haya una especialidad resoluble por encuentro, este selector se reemplaza
 * por un filtro automático sin tocar el resto del bloque.
 *
 * ## Cómo se guarda
 *
 * Cada envío abre una instancia de `forms` sobre el encuentro
 * (`POST /forms/instances`), captura los valores tipados
 * (`POST /forms/instances/:id/values`) y la cierra
 * (`POST /forms/instances/:id/close`) — el mismo motor que gobierna el resto
 * de la extensibilidad dinámica. Igual que el diagnóstico y la receta de al
 * lado, vive **dentro del encuentro abierto**: sin uno, no hay dónde
 * adjuntar la instancia.
 *
 * ## Primero se pregunta, después se ofrece
 *
 * Con los GET de `forms` el bloque tiene la memoria que antes no tenía: al
 * conocer el encuentro consulta `GET /forms/instances?encounter=` y, si ya hay
 * una instancia, carga su detalle y se muestra en **modo lectura** — con un
 * marcador explícito para los valores que el backend enmascaró — en vez de
 * ofrecer completarla de nuevo. El `409` del backend queda como red de
 * seguridad ante una carrera, no como la forma normal de enterarse.
 *
 * ## El duplicado no es un error
 *
 * El backend rechaza con `409` una segunda instancia para el mismo encuentro
 * y versión de esquema (`forms.form_instances` es única por recurso +
 * versión). Igual que el diagnóstico repetido: no es un fallo, es la
 * plantilla ya completada para este encuentro.
 */
@Component({
  selector: 'app-specialty-form-block',
  imports: [
    Alert,
    AppButton,
    Card,
    Checkbox,
    DatePicker,
    FormActions,
    FormField,
    Input,
    Select,
  ],
  templateUrl: './specialty-form-block.html',
  styleUrl: './specialty-form-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecialtyFormBlock {
  private readonly chartTemplates = inject(ChartTemplatesClient);
  private readonly forms = inject(FormsClient);
  private readonly toasts = inject(ToastService);

  /**
   * El encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * Lo sabe el expediente —lo deriva de `endAt`, no del estado— y baja hecho:
   * el bloque no vuelve a preguntarlo para que no puedan discrepar.
   */
  readonly encounterId = input<string | null>(null);

  /** Algo se escribió y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });

  /* -- Qué plantillas hay ---------------------------------------------------*/

  protected readonly plantillas = signal<ViewState<readonly ChartTemplate[]>>(loading());
  protected readonly plantillaId = signal<string | null>(null);

  protected readonly opcionesDePlantilla = computed<readonly SelectOption<string>[]>(() => {
    const state = this.plantillas();
    return state.status === 'ready' ? state.data.map((t) => ({ value: t.id, label: t.name })) : [];
  });

  protected readonly plantillaElegida = computed<ChartTemplate | null>(() => {
    const state = this.plantillas();
    if (state.status !== 'ready') return null;
    return state.data.find((t) => t.id === this.plantillaId()) ?? null;
  });

  protected elegirPlantilla(id: string | null): void {
    this.plantillaId.set(id);
    this.valores.set({});
  }

  constructor() {
    this.cargarPlantillas();
    // Cada vez que el expediente informa otro encuentro, se vuelve a preguntar
    // si ya tiene un formulario respondido.
    effect(() => {
      const encounterId = this.encounterId();
      untracked(() => this.consultarRespuesta(encounterId));
    });
  }

  protected recargarPlantillas(): void {
    this.cargarPlantillas();
  }

  private cargarPlantillas(): void {
    this.plantillas.set(loading());
    this.chartTemplates.listTemplates().subscribe({
      next: (lista) => {
        this.plantillas.set(ready(lista));
        // Con una sola plantilla no hace falta elegir: se preselecciona sola.
        if (lista.length === 1) {
          this.plantillaId.set(lista[0].id);
        }
      },
      error: (error: unknown) =>
        this.plantillas.set(errorToViewState<readonly ChartTemplate[]>(error)),
    });
  }

  /* -- Lo ya respondido para este encuentro ----------------------------------*/

  /**
   * El formulario respondido del encuentro, si existe.
   *
   * `ready(null)` significa «se preguntó y no hay»: es también el estado
   * inicial, para que la captura no quede bloqueada mientras el efecto todavía
   * no corrió — si la consulta está en vuelo el estado es `loading` y el
   * formulario no se ofrece, así que la ventana de duplicado real la sigue
   * cerrando el `409` del backend.
   */
  protected readonly respondido = signal<ViewState<FormInstanceDetail | null>>(ready(null));

  protected readonly buscandoRespuesta = computed(() => this.respondido().status === 'loading');

  /** El detalle respondido, o `null` si no hay (o todavía no se sabe). */
  protected readonly formularioRespondido = computed<FormInstanceDetail | null>(() => {
    const state = this.respondido();
    return state.status === 'ready' || state.status === 'stale' ? state.data : null;
  });

  /**
   * Si la consulta falló, acá está el porqué. Mientras no se pueda saber si el
   * encuentro ya tiene formulario, la captura no se ofrece: fallar cerrado es
   * lo que evita el duplicado, no la suerte.
   */
  protected readonly errorDeConsulta = computed<string | null>(() => {
    const state = this.respondido();
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite ver formularios clínicos.';
    }
    if (state.status === 'not-found') {
      return 'No encontramos el encuentro de este formulario.';
    }
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || 'No pudimos revisarlo.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected reconsultarRespuesta(): void {
    this.consultarRespuesta(this.encounterId());
  }

  private consultarRespuesta(encounterId: string | null): void {
    if (encounterId === null || encounterId === '') {
      this.respondido.set(ready(null));
      return;
    }
    this.respondido.set(loading());
    this.forms
      .listInstancesByEncounter(encounterId)
      .pipe(
        switchMap((listado) =>
          listado.items.length === 0
            ? of<FormInstanceDetail | null>(null)
            : this.forms.getInstance(listado.items[0].id),
        ),
      )
      .subscribe({
        next: (detalle) => {
          // El encuentro pudo cambiar mientras la respuesta viajaba.
          if (this.encounterId() !== encounterId) return;
          this.respondido.set(ready(detalle));
        },
        error: (error: unknown) => {
          if (this.encounterId() !== encounterId) return;
          this.respondido.set(errorToViewState<FormInstanceDetail | null>(error));
        },
      });
  }

  /* -- Cómo se lee lo respondido ---------------------------------------------*/

  protected readonly marcadorEnmascarado = VALOR_ENMASCARADO;

  /** Todos los campos conocidos por las plantillas, para ponerle nombre a cada valor. */
  private readonly camposConocidos = computed<ReadonlyMap<string, ChartTemplateField>>(() => {
    const state = this.plantillas();
    const campos = new Map<string, ChartTemplateField>();
    if (state.status !== 'ready') return campos;
    for (const plantilla of state.data) {
      for (const campo of plantilla.fields) {
        if (!campos.has(campo.fieldId)) campos.set(campo.fieldId, campo);
      }
    }
    return campos;
  });

  /**
   * La plantilla de la que salió la respuesta, inferida por cobertura de
   * campos: la instancia no declara su plantilla, así que gana la que más
   * `fieldId` de los valores contiene. Con el dato real —una plantilla por
   * especialidad— la inferencia es exacta; si nada matchea, el título cae al
   * genérico.
   */
  protected readonly plantillaDeLaRespuesta = computed<ChartTemplate | null>(() => {
    const detalle = this.formularioRespondido();
    const state = this.plantillas();
    if (detalle === null || state.status !== 'ready') return null;

    const respondidos = new Set(detalle.values.map((valor) => valor.fieldId));
    let mejor: ChartTemplate | null = null;
    let mejorCobertura = 0;
    for (const plantilla of state.data) {
      const cobertura = plantilla.fields.filter((campo) => respondidos.has(campo.fieldId)).length;
      if (cobertura > mejorCobertura) {
        mejor = plantilla;
        mejorCobertura = cobertura;
      }
    }
    return mejor;
  });

  protected readonly tituloDeLaRespuesta = computed(
    () => this.plantillaDeLaRespuesta()?.name ?? 'Formulario clínico',
  );

  /** Cuándo quedó completado, en palabras. El cierre manda; si no, la creación. */
  protected readonly fechaDeRespuesta = computed<string | null>(() => {
    const detalle = this.formularioRespondido();
    if (detalle === null) return null;
    const iso = detalle.closedAt ?? detalle.createdAt;
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? null : FORMATO_FECHA.format(fecha);
  });

  protected readonly respuestasVisibles = computed<readonly RespuestaVisible[]>(() => {
    const detalle = this.formularioRespondido();
    if (detalle === null) return [];
    const campos = this.camposConocidos();
    return [...detalle.values]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((valor) => {
        const campo = campos.get(valor.fieldId);
        return {
          id: valor.id,
          etiqueta: campo?.name ?? 'Campo del formulario',
          texto: valor.masked
            ? // El marcador lo pone la vista; acá jamás viaja el contenido.
              ''
            : textoDeValor(valor.value, valor.dataType ?? campo?.dataType),
          masked: valor.masked,
        };
      });
  });

  /** Descarga el formulario respondido con el motor PDF compartido. */
  protected descargarPdf(): void {
    const detalle = this.formularioRespondido();
    if (detalle === null) return;
    const cierre = detalle.closedAt === undefined ? undefined : new Date(detalle.closedAt);
    downloadFormResponsePdf({
      id: detalle.id,
      titulo: this.tituloDeLaRespuesta(),
      completadoEl: cierre !== undefined && !Number.isNaN(cierre.getTime()) ? cierre : undefined,
      respuestas: this.respuestasVisibles().map((respuesta) => ({
        etiqueta: respuesta.etiqueta,
        texto: respuesta.texto,
        masked: respuesta.masked,
      })),
    });
  }

  /* -- Los valores del formulario elegido ------------------------------------*/

  /** Los valores capturados, por `fieldId`. Se reinician al cambiar de plantilla. */
  protected readonly valores = signal<Readonly<Record<string, unknown>>>({});

  protected actualizarValor(fieldId: string, valor: unknown): void {
    this.valores.update((actuales) => ({ ...actuales, [fieldId]: valor }));
  }

  /* -- Leer el valor de un campo, tipado para el control que lo dibuja ------ */

  protected valorTexto(fieldId: string): string {
    const valor = this.valores()[fieldId];
    return typeof valor === 'string' ? valor : '';
  }

  protected valorNumero(fieldId: string): number | null {
    const valor = this.valores()[fieldId];
    return typeof valor === 'number' ? valor : null;
  }

  protected valorBooleano(fieldId: string): boolean {
    return this.valores()[fieldId] === true;
  }

  protected valorFecha(fieldId: string): Date | null {
    const valor = this.valores()[fieldId];
    return valor instanceof Date ? valor : null;
  }

  /** Cómo dibujar un campo, a partir de su `dataType`. Lo no reconocido cae a texto. */
  protected tipoDibujable(dataType: string): TipoDibujable {
    if (dataType === 'boolean' || dataType === 'integer' || dataType === 'decimal' || dataType === 'date') {
      return dataType;
    }
    return 'string';
  }

  private readonly camposObligatoriosCompletos = computed(() => {
    const plantilla = this.plantillaElegida();
    if (!plantilla) return false;
    const valores = this.valores();
    return plantilla.fields
      .filter((f) => f.required)
      .every((f) => !esVacio(valores[f.fieldId]));
  });

  protected readonly puedeCompletar = computed(
    () =>
      this.hayEncuentro() &&
      // Con un formulario ya respondido —o sin saberlo todavía— no se ofrece
      // otro: el modo lectura reemplaza a la captura.
      this.formularioRespondido() === null &&
      !this.buscandoRespuesta() &&
      this.plantillaElegida() !== null &&
      this.camposObligatoriosCompletos() &&
      !this.enviando(),
  );

  /* -- Completar ---------------------------------------------------------- */

  protected readonly enviando = signal(false);
  protected readonly resultado = signal<ViewState<null>>(ready(null));

  /**
   * El aviso del duplicado — mismo criterio que el diagnóstico: no es un
   * error, es la plantilla ya completada para este encuentro.
   */
  protected readonly avisoDeDuplicado = computed<string | null>(() => {
    const state = this.resultado();
    if (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT')
    ) {
      return 'Esta plantilla ya se completó para este encuentro.';
    }
    return null;
  });

  protected readonly errorDeCompletado = computed<string | null>(() => {
    if (this.avisoDeDuplicado() !== null) return null;

    const state = this.resultado();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite completar formularios clínicos.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected completar(): void {
    const encounterId = this.encounterId();
    const plantilla = this.plantillaElegida();
    if (encounterId === null || plantilla === null || !this.puedeCompletar()) {
      return;
    }

    const values = this.valoresParaEnviar(plantilla);
    if (values.length === 0) {
      return;
    }

    this.enviando.set(true);
    this.resultado.set(loading());

    this.forms
      .openInstance({ resourceId: encounterId })
      .pipe(
        switchMap((instancia) =>
          this.forms
            .captureValues(instancia.id, values)
            .pipe(switchMap(() => this.forms.closeInstance(instancia.id))),
        ),
      )
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.resultado.set(ready(null));
          this.valores.set({});
          this.toasts.success(`«${plantilla.name}» quedó guardada en la ficha.`, 'Formulario completado');
          this.cambio.emit();
          // Lo recién guardado se relee del backend y el bloque pasa a lectura.
          this.consultarRespuesta(encounterId);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.resultado.set(errorToViewState<null>(error));
        },
      });
  }

  private valoresParaEnviar(plantilla: ChartTemplate): FieldValueInput[] {
    const valores = this.valores();
    const entradas: FieldValueInput[] = [];
    for (const [ordinal, campo] of plantilla.fields.entries()) {
      const crudo = valores[campo.fieldId];
      if (esVacio(crudo)) {
        continue;
      }
      entradas.push({
        fieldId: campo.fieldId,
        dataType: campo.dataType,
        value: crudo instanceof Date ? crudo.toISOString() : crudo,
        assignmentId: campo.assignmentId,
        ordinal,
      });
    }
    return entradas;
  }
}

function esVacio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === '';
}

/**
 * El valor de un campo, en palabras.
 *
 * Los valores llegan como los serializó JSON: fechas en ISO, `integer` como
 * string (la columna es bigint). Lo no representable cae a `String(...)` antes
 * que a un hueco.
 */
function textoDeValor(valor: unknown, dataType: string | undefined): string {
  if (valor === undefined || valor === null) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (dataType === 'date' || dataType === 'datetime') {
    const fecha = new Date(String(valor));
    if (!Number.isNaN(fecha.getTime())) {
      return dataType === 'date'
        ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' }).format(fecha)
        : FORMATO_FECHA.format(fecha);
    }
  }
  return String(valor);
}
