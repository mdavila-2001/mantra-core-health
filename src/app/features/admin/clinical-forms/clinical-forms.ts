import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ChartTemplatesClient } from '../../../core/data-access/chart-templates/chart-templates.client';
import type {
  ChartTemplate,
  TemplateFieldInput,
} from '../../../core/data-access/chart-templates/chart-templates.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ValueSetOption } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/**
 * Los tipos de dato que este editor ofrece.
 *
 * El backend acepta el catálogo entero de `TECHNICAL_DATA_TYPES` — pero
 * `uuid`/`json`/`binary`/`reference` necesitan un dato adicional que este
 * editor no pide (un target de referencia, un archivo) y `code` no es texto
 * libre: `buildValueColumns` lo traduce a `valueConceptId`, así que exige un
 * concepto del catálogo, no una palabra tecleada. Ofrecerlos sin eso dejaría
 * un campo que el backend rechaza al completarse. El subconjunto de acá es el
 * que un campo propio de especialidad usa en la práctica: texto, número,
 * sí/no y fecha.
 */
const TIPOS_DE_DATO: readonly SelectOption<string>[] = [
  { value: 'string', label: 'Texto corto' },
  { value: 'text', label: 'Texto largo' },
  { value: 'integer', label: 'Número entero' },
  { value: 'decimal', label: 'Número decimal' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'date', label: 'Fecha' },
];

/** Una fila del editor de campos, antes de enviarse. */
interface CampoEnEdicion {
  readonly clave: string;
  code: string;
  name: string;
  dataType: string;
  required: boolean;
}

let correlativo = 0;

/** Una fila nueva y vacía, con una clave local estable para el `trackBy`. */
function campoVacio(): CampoEnEdicion {
  correlativo += 1;
  return { clave: `campo-${correlativo}`, code: '', name: '', dataType: 'string', required: false };
}

/**
 * Formularios clínicos por especialidad — carril 2, punto 1 del reclamo.
 *
 * ## Lo que resuelve
 *
 * El módulo `forms` (backend) es un motor de formularios dinámicos completo
 * desde siempre; lo que faltaba era decir «estas son las plantillas por
 * especialidad» — `chart.specialty_chart_templates` sólo tenía **asignación**
 * (UC-15-12), no alta, listado ni lectura de esquema. Con los tres nuevos
 * (`POST` / `GET` / `GET :id` de `/charts/templates`) esta pantalla es su
 * primer cliente: un admin de especialidad arma la plantilla acá, y
 * `specialty-form-block` —dentro de la ficha del paciente— la completa.
 *
 * ## Sólo alta y lectura, no edición
 *
 * El backend no tiene `PATCH /charts/templates/:id` — el README de carriles
 * pide extender sin inventar superficie que el modelo no tiene. Esta pantalla
 * crea plantillas nuevas y lista las existentes; versionar o corregir una ya
 * publicada queda para cuando ese endpoint exista.
 */
@Component({
  selector: 'app-clinical-forms',
  imports: [
    Alert,
    AppButton,
    Card,
    Checkbox,
    DataTable,
    FormActions,
    FormField,
    Input,
    PageHeader,
    ReferenceCombobox,
    Select,
  ],
  templateUrl: './clinical-forms.html',
  styleUrl: './clinical-forms.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicalForms {
  private readonly chartTemplates = inject(ChartTemplatesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly toasts = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly tiposDeDato = TIPOS_DE_DATO;

  /* -- Elegir la especialidad ----------------------------------------------- */

  /** El `conceptId` elegido. Se enlaza directo con `[(value)]` del buscador. */
  protected readonly especialidad = signal<string | null>(null);
  protected readonly opcionesDeEspecialidad = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoEspecialidad = signal(false);

  protected buscarEspecialidad(texto: string): void {
    this.buscandoEspecialidad.set(true);
    this.terminology.searchConcepts({ query: texto, limit: 20 }).subscribe({
      next: (pagina) => {
        this.opcionesDeEspecialidad.set(pagina.items.map(aOpcionDeReferencia));
        this.buscandoEspecialidad.set(false);
      },
      error: () => {
        this.opcionesDeEspecialidad.set([]);
        this.buscandoEspecialidad.set(false);
      },
    });
  }

  /** Elegir (o borrar) la especialidad también filtra el listado de abajo. */
  protected onEspecialidadElegida(): void {
    this.cargarPlantillas();
  }

  /* -- El formulario de alta -------------------------------------------------*/

  protected readonly codigo = signal('');
  protected readonly nombre = signal('');
  protected readonly campos = signal<readonly CampoEnEdicion[]>([campoVacio()]);
  protected readonly creando = signal(false);
  protected readonly resultado = signal<ViewState<null>>(ready(null));

  protected agregarCampo(): void {
    this.campos.update((filas) => [...filas, campoVacio()]);
  }

  protected quitarCampo(clave: string): void {
    this.campos.update((filas) => {
      if (filas.length <= 1) {
        return filas;
      }
      return filas.filter((fila) => fila.clave !== clave);
    });
  }

  protected actualizarCampo(clave: string, cambios: Partial<CampoEnEdicion>): void {
    this.campos.update((filas) =>
      filas.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)),
    );
  }

  /**
   * `app-input` emite `string | number | null` — el `<input>` real siempre
   * escribe texto, pero el tipo del átomo es genérico para `type="number"`.
   * Las plantillas de Angular no tienen `String()` global, así que este es el
   * puente.
   */
  protected readonly comoTexto = (valor: string | number | null): string =>
    valor === null ? '' : String(valor);

  /** Los campos con código y nombre completos — los vacíos se descartan, no se envían a medias. */
  private camposListos(): TemplateFieldInput[] {
    return this.campos()
      .filter((fila) => fila.code.trim() !== '' && fila.name.trim() !== '')
      .map((fila, indice) => ({
        code: fila.code.trim(),
        name: fila.name.trim(),
        dataType: fila.dataType,
        required: fila.required,
        ordinal: indice,
      }));
  }

  /** Al menos un campo tiene que quedar completo: una plantilla sin campos no es un formulario. */
  protected readonly hayAlMenosUnCampoCompleto = computed(() =>
    this.campos().some((fila) => fila.code.trim() !== '' && fila.name.trim() !== ''),
  );

  protected readonly puedeCrear = computed(
    () =>
      this.especialidad() !== null &&
      this.codigo().trim() !== '' &&
      this.nombre().trim() !== '' &&
      this.hayAlMenosUnCampoCompleto() &&
      !this.creando(),
  );

  protected readonly errorDeCreacion = computed<string | null>(() => {
    const state = this.resultado();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite crear plantillas de chart.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected crear(): void {
    const specialtyConceptId = this.especialidad();
    const code = this.codigo().trim();
    const name = this.nombre().trim();
    const fields = this.camposListos();

    if (specialtyConceptId === null || code === '' || name === '' || fields.length === 0) {
      return;
    }

    this.creando.set(true);
    this.resultado.set(loading());

    this.chartTemplates.createTemplate({ specialtyConceptId, code, name, fields }).subscribe({
      next: () => {
        this.creando.set(false);
        this.resultado.set(ready(null));
        this.toasts.success(`«${name}» ya está disponible para la especialidad.`, 'Plantilla creada');
        this.limpiarFormulario();
        this.cargarPlantillas();
      },
      error: (error: unknown) => {
        this.creando.set(false);
        this.resultado.set(errorToViewState<null>(error));
      },
    });
  }

  private limpiarFormulario(): void {
    this.codigo.set('');
    this.nombre.set('');
    this.campos.set([campoVacio()]);
  }

  /* -- Las plantillas ya creadas ---------------------------------------------*/

  protected readonly plantillas = signal<ViewState<readonly ChartTemplate[]>>(loading());

  protected readonly columnas: readonly ColumnDef<ChartTemplate>[] = [
    { key: 'name', header: 'Plantilla', priority: 1 },
    { key: 'code', header: 'Código', priority: 2 },
    { key: 'version', header: 'Versión', priority: 3 },
  ];

  protected readonly porPlantilla = (fila: ChartTemplate): string => fila.id;

  constructor() {
    this.cargarPlantillas();
  }

  protected recargarPlantillas(): void {
    this.cargarPlantillas();
  }

  private cargarPlantillas(): void {
    this.plantillas.set(loading());
    const specialtyConceptId = this.especialidad() ?? undefined;
    this.chartTemplates.listTemplates(specialtyConceptId).subscribe({
      next: (lista) => this.plantillas.set(ready(lista)),
      error: (error: unknown) =>
        this.plantillas.set(errorToViewState<readonly ChartTemplate[]>(error)),
    });
  }
}

/** De concepto de terminología a opción del buscador de referencia. */
function aOpcionDeReferencia(concepto: ValueSetOption): ReferenceOption {
  return { value: concepto.conceptId, label: concepto.display };
}
