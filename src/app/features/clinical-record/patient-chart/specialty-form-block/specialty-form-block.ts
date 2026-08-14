import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { switchMap } from 'rxjs';

import { ChartTemplatesClient } from '../../../../core/data-access/chart-templates/chart-templates.client';
import type { ChartTemplate } from '../../../../core/data-access/chart-templates/chart-templates.types';
import { FormsClient } from '../../../../core/data-access/forms/forms.client';
import type { FieldValueInput } from '../../../../core/data-access/forms/forms.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
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

/** Los tipos de dato que este bloque sabe dibujar como campo de captura. */
type TipoDibujable = 'boolean' | 'integer' | 'decimal' | 'date' | 'text' | 'string';

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
 * ## El duplicado no es un error
 *
 * El backend rechaza con `409` una segunda instancia para el mismo encuentro
 * y versión de esquema (`forms.form_instances` es única por recurso +
 * versión). Igual que el diagnóstico repetido: no es un fallo, es la
 * plantilla ya completada para este encuentro.
 */
@Component({
  selector: 'app-specialty-form-block',
  imports: [Alert, Card, Checkbox, DatePicker, FormActions, FormField, Input, Select],
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
