import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type {
  ResolvedContext,
  ResolvedFact,
} from '../../../core/data-access/health-context/health-context.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import {
  dataOf,
  empty,
  loading,
  mapData,
  notFound,
  ready,
  stale,
} from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../shared/components/atoms/input/input';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Card } from '../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { UUID_ERROR, UUID_PATTERN } from '../../../shared/forms/form-support';

const BASE = '/administration/health-context';

/** Dónde se crea lo que no se encontró. */
const RUTA_ALTA = `${BASE}/contexts/new`;

/** Los dos catálogos que gobiernan la consulta. */
const TARGET_PAIS = 'health_context.country_health_contexts.country_concept_id';
const TARGET_DOMINIO = 'health_context.country_health_contexts.context_domain_concept_id';

/**
 * V44-03 · Resolver el contexto vigente de un país.
 *
 * `GET /health-context/contexts/resolve?country&domain&key` — la única lectura
 * del módulo. **No es un listado**: los tres parámetros son obligatorios y los
 * dos primeros pasan por `ParseUUIDPipe`, así que un valor mal formado es un
 * 400, no un «no hay resultados».
 *
 * ## Es el primer S7 real del producto
 *
 * El backend **no oculta una versión caducada**: la devuelve con `stale: true`.
 * Esa es exactamente la situación que el estado S7 del M34 describe —hay dato
 * para mostrar, pero puede estar atrasado— y hasta ahora ninguna pantalla la
 * producía de verdad. El `asOf` que S7 exige es `observedAt`: el momento al que
 * corresponde el dato, no cuándo se pidió.
 *
 * ## Por qué acá SÍ se admite pegar un identificador de concepto
 *
 * `ConceptSelect` prohíbe el respaldo a texto libre, y con razón: un
 * `*_concept_id` tecleado a mano es un dato inválido que el backend rechaza o
 * —peor— un uuid de otro conjunto que **acepta y persiste**.
 *
 * Ese daño no existe acá, y la diferencia es de fondo: **esto es una consulta,
 * no una escritura**. Un uuid equivocado en un parámetro de query produce un
 * 404 y nada más; no deja basura en ninguna tabla. Y hace falta, porque hoy
 * `system_context` **no tiene ningún binding sembrado para el esquema
 * `health_context`** (verificado sobre `45_system_context.seeds.json`), así que
 * los dos selectores nacen deshabilitados y sin la escotilla la pantalla sería
 * inservible.
 *
 * **No copiar esta escotilla a los formularios del módulo.** Ahí el valor se
 * persiste y la prohibición de `ConceptSelect` vale entera.
 */
@Component({
  selector: 'app-context-resolve',
  imports: [
    Badge,
    Card,
    Checkbox,
    ConceptSelect,
    DataTable,
    DatePipe,
    FormActions,
    FormField,
    FormSection,
    Input,
    JsonPipe,
    PageHeader,
    ReactiveFormsModule,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './context-resolve.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextResolve {
  private readonly healthContext = inject(HealthContextClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidError = UUID_ERROR;
  protected readonly targetPais = TARGET_PAIS;
  protected readonly targetDominio = TARGET_DOMINIO;

  /** La clave es texto libre por contrato: el backend no la valida. */
  protected readonly form = new FormGroup({
    key: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    countryId: new FormControl('', { nonNullable: true, validators: [uuidOpcional] }),
    domainId: new FormControl('', { nonNullable: true, validators: [uuidOpcional] }),
  });

  /** Lo elegido en los selectores de catálogo. */
  protected readonly country = signal<string | null>(null);
  protected readonly domain = signal<string | null>(null);

  /** Con la escotilla abierta, los dos conceptos se pegan como uuid. */
  protected readonly pegarIdentificadores = signal(false);

  protected readonly state = signal<ViewState<ResolvedContext>>(ESTADO_INICIAL);

  protected readonly contexto = computed(() => dataOf(this.state()));

  /**
   * La tabla recibe un `ViewState`, así que se deriva del mismo estado: los
   * estados sin datos pasan intactos y no hay que repetir el `switch`.
   *
   * Las filas se aplanan acá y no con plantillas de celda porque `ColumnDef.cell`
   * pide un `TemplateRef`, y para cinco columnas de texto eso es más maquinaria
   * que la que resuelve. Formatear en el componente además deja el valor listo
   * para leer sin que la plantilla tenga que saber que `valueJson` es `unknown`.
   */
  protected readonly hechos = computed<ViewState<readonly FilaHecho[]>>(() =>
    mapData(this.state(), (c) => c.facts.map((fact) => aFila(fact))),
  );

  protected readonly columnas: readonly ColumnDef<FilaHecho>[] = [
    { key: 'factKey', header: 'Hecho', priority: 1 },
    { key: 'valor', header: 'Valor', priority: 1 },
    { key: 'valueType', header: 'Tipo', priority: 3 },
    { key: 'confianza', header: 'Confianza', priority: 2, align: 'end' },
    { key: 'evidencias', header: 'Evidencias', priority: 2, align: 'end' },
  ];

  /** El id del hecho es estable y único: es exactamente lo que `@for` necesita. */
  protected readonly identidadDeFila = (fila: FilaHecho): string => fila.id;

  protected consultar(): void {
    const consulta = this.consultaValida();
    if (consulta === null) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());
    this.healthContext.resolveContext(consulta).subscribe({
      next: (contexto) => this.state.set(this.aEstado(contexto)),
      error: (error: unknown) => this.state.set(this.conSalida(error)),
    });
  }

  /** El identificador de un concepto, venga del catálogo o pegado a mano. */
  private conceptoElegido(
    control: 'countryId' | 'domainId',
    desdeCatalogo: string | null,
  ): string {
    return this.pegarIdentificadores()
      ? this.form.controls[control].value.trim()
      : (desdeCatalogo ?? '');
  }

  private consultaValida(): { country: string; domain: string; key: string } | null {
    const country = this.conceptoElegido('countryId', this.country());
    const domain = this.conceptoElegido('domainId', this.domain());
    const key = this.form.controls.key.value.trim();

    if (this.form.controls.key.invalid || country === '' || domain === '') {
      return null;
    }
    // Con la escotilla abierta los dos controles se validan de verdad; con los
    // selectores, el uuid lo garantiza el catálogo.
    if (this.pegarIdentificadores() && (this.form.controls.countryId.invalid || this.form.controls.domainId.invalid)) {
      return null;
    }

    return { country, domain, key };
  }

  /**
   * `stale: true` es S7, no un error. El `asOf` obligatorio del M34 es
   * `observedAt` —cuándo se observó el dato—; si el backend no lo trae se usa
   * `expiresAt`, que es lo segundo más honesto. Sin ninguno de los dos no se
   * puede afirmar una antigüedad, y decir «ahora» sería mentir: en ese caso el
   * dato se muestra como fresco y el aviso de caducidad queda en el sello.
   */
  private aEstado(contexto: ResolvedContext): ViewState<ResolvedContext> {
    if (!contexto.stale) {
      return ready(contexto);
    }
    const asOf = contexto.observedAt ?? contexto.expiresAt;
    return asOf === undefined ? ready(contexto) : stale(contexto, asOf);
  }

  /** Un S6 sin salida es un callejón: acá la salida es crear el contexto. */
  private conSalida(error: unknown): ViewState<ResolvedContext> {
    const estado = errorToViewState<ResolvedContext>(error);
    return estado.status === 'not-found'
      ? notFound({ label: 'Crear el contexto', route: RUTA_ALTA })
      : estado;
  }
}

/** Un hecho aplanado para la tabla: solo texto, listo para leer. */
interface FilaHecho {
  readonly id: string;
  readonly factKey: string;
  readonly valor: string;
  readonly valueType: string;
  readonly confianza: string;
  readonly evidencias: number;
}

/**
 * `valueJson` es `unknown` por contrato —el valor de un hecho puede ser un
 * número, un texto o un objeto—, así que se muestra como texto: los escalares
 * tal cual y lo demás serializado. `JSON.stringify` de una cadena la devolvería
 * entrecomillada, que en una celda se lee como si las comillas fueran parte del
 * dato.
 */
function comoTexto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '—';
  }
  if (typeof valor === 'string') {
    return valor;
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return valor.toString();
  }
  return JSON.stringify(valor) ?? '—';
}

function aFila(fact: ResolvedFact): FilaHecho {
  return {
    id: fact.id,
    factKey: fact.factKey,
    valor: comoTexto(fact.valueJson),
    valueType: fact.valueType,
    // Texto por contrato (`@IsNumberString`): se muestra sin convertir.
    confianza: fact.confidenceScore ?? '—',
    evidencias: fact.evidenceObservationIds.length,
  };
}

/**
 * S3 con acción, y no S2: todavía no se pidió nada. El mensaje dice qué hace
 * falta, porque los tres parámetros son obligatorios y eso no es evidente.
 */
const ESTADO_INICIAL: ViewState<ResolvedContext> = empty(
  { label: 'Crear un contexto', route: RUTA_ALTA },
  'Elegí país y dominio, y escribí la clave del contexto para resolver su versión vigente.',
);

/** Vacío es válido: el control solo se exige con la escotilla abierta. */
const uuidOpcional = Validators.pattern(UUID_PATTERN);
