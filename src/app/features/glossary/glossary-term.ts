import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type {
  GlossaryRelation,
  GlossaryRelationType,
  GlossaryTermDetail,
} from '../../core/data-access/terminology/terminology.types';
import { valorDeTexto } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { Card } from '../../shared/components/molecules/card/card';
import { ContentDialog } from '../../shared/components/organisms/content-dialog/content-dialog';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  cimaFactsFrom,
  drugFactsFrom,
  type CimaDrugFacts,
  type GlossaryDrugFacts,
} from './glossary-drug-facts';
import { GlossaryCategoryIcon } from './glossary-category-icon';
import { GlossaryDataFlow } from './glossary-data-flow';

/**
 * Rótulo en castellano de cada tipo de relación clínica, en el orden en que se
 * agrupan en la ficha. `RELATED_TERM` va último: es el «ver también» genérico,
 * y las relaciones con significado clínico concreto —enfermedad, procedimiento,
 * tratamiento, anatomía, prueba diagnóstica— importan más para entender el
 * término. Síntomas y especialidad van justo después de enfermedad: es lo
 * primero que busca quien llega a una ficha de enfermedad.
 */
const RELATION_GROUPS: readonly { readonly type: GlossaryRelationType; readonly label: string }[] =
  [
    { type: 'DISEASE', label: 'Enfermedades relacionadas' },
    { type: 'SYMPTOM', label: 'Síntomas y signos' },
    { type: 'SPECIALTY', label: 'Especialidades que la atienden' },
    { type: 'PROCEDURE', label: 'Procedimientos relacionados' },
    { type: 'TREATMENT', label: 'Tratamientos relacionados' },
    { type: 'ANATOMY', label: 'Anatomía relacionada' },
    { type: 'DIAGNOSTIC_TEST', label: 'Pruebas diagnósticas relacionadas' },
    { type: 'PERFORMS', label: 'Modalidad que realiza' },
    { type: 'INCLUDES', label: 'Estudios que incluye' },
    { type: 'SENDS_DATA_TO', label: 'Envía sus datos a' },
    { type: 'RELATED_TERM', label: 'También se relaciona con' },
  ];

/**
 * Nombre legible de cada fuente, por el prefijo del identificador corto que
 * escribe el importador en la propiedad `source`. Un identificador que no está
 * acá se muestra tal cual: es mejor un código feo que una fuente inventada.
 */
const NOMBRE_DE_FUENTE: readonly { readonly clave: string; readonly nombre: string }[] = [
  { clave: 'cima', nombre: 'CIMA (AEMPS)' },
  { clave: 'medlineplus', nombre: 'MedlinePlus en español (NLM)' },
  { clave: 'cie10es', nombre: 'CIE-10-ES (Ministerio de Sanidad)' },
  { clave: 'eciemaps', nombre: 'CIE-10-ES (Ministerio de Sanidad)' },
  { clave: 'cms-icd10cm', nombre: 'ICD-10-CM (CMS/NCHS)' },
  { clave: 'loinc', nombre: 'LOINC (Regenstrief), vía NLM' },
  { clave: 'wikidata', nombre: 'Wikidata' },
  { clave: 'netter', nombre: 'Atlas de Anatomía Humana (índice)' },
  { clave: 'alovida-curated', nombre: 'Equipo AloVida' },
];

/** Cómo se llama en pantalla el sistema de codificación de un término. */
const NOMBRE_DE_SISTEMA: Readonly<Record<string, string>> = {
  icd10cm: 'ICD-10-CM',
  cie10es: 'CIE-10-ES',
  loinc: 'LOINC',
  atc: 'ATC',
};

/** De dónde sale el término: nombre, enlace, fecha de consulta y condición de uso, lo que haya. */
export interface FuenteDelTermino {
  readonly nombre: string;
  readonly url: string | null;
  readonly consultado: string | null;
  readonly licencia: string | null;
}

/** De dónde sale la definición, cuando la fila lo declara (`definitionSource`). */
export interface FuenteDeDefinicion {
  readonly nombre: string;
  readonly url: string | null;
  readonly consultado: string | null;
}

/** Una sección verbatim de la fuente (guías de pruebas de MedlinePlus). */
export interface SeccionDeLaFuente {
  readonly titulo: string;
  readonly texto: string;
}

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Un grupo de relaciones ya resuelto contra la ficha, listo para pintarse. */
export interface GrupoDeRelaciones {
  readonly label: string;
  readonly relaciones: readonly GlossaryRelation[];
}

/**
 * La ficha de un término del glosario.
 *
 * ## Por qué es una ruta y no un panel
 *
 * Un término se comparte. «Mirá qué quiere decir esto» es un enlace, y un panel
 * no tiene enlace. Cuelga de `/glossary` como ruta hija (`glossary/:conceptId`),
 * así que el rastro de migas y la sección marcada en el menú siguen diciendo
 * «Glosario» sin tocar `navigation.map.ts`. La reconstrucción del glosario
 * (carril 03) no toca este esquema de ruteo — sigue siendo `conceptId`, no
 * `slug`: cambiarlo habría roto cualquier enlace ya compartido, y no es lo que
 * el cliente pidió corregir.
 *
 * ## Qué trae la reconstrucción
 *
 * - **Definición clínica extendida** (`clinicalDefinition`) y **explicación en
 *   lenguaje llano** (`plainSummary`), como dos textos distintos y no uno solo:
 *   son la diferencia entre lo que necesita quien atiende y lo que necesita
 *   quien pregunta qué le dijeron.
 * - **Categoría** (una sola, enlazada de vuelta a la grilla) y **etiquetas
 *   clínicas** (0..N, informativas — ya no son un filtro navegable, ver
 *   `glossary.ts`).
 * - **Relaciones clínicas tipadas**: enfermedad, procedimiento, tratamiento,
 *   anatomía, prueba diagnóstica y «ver también», cada una enlazando a la
 *   ficha del término relacionado por su propio `conceptId`.
 * - **Imagen médica**, si el término la tiene — hoy **ninguno** la tiene: el
 *   backend documenta la decisión explícita de no sembrar imágenes sin una
 *   política de licencias verificada. Por eso el ícono de la categoría hace de
 *   marcador visual permanente, no un relleno temporal.
 *
 * Todo eso sale de **una sola llamada** (`GET /terminology/concepts/:id`). La
 * alternativa era `$lookup`, que se resuelve por `(sistema, código)` y habría
 * exigido dos lecturas previas sólo para poder preguntar.
 */
@Component({
  selector: 'app-glossary-term',
  imports: [
    Card,
    Chip,
    ContentDialog,
    GlossaryCategoryIcon,
    GlossaryDataFlow,
    PageHeader,
    RouterLink,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './glossary-term.html',
  styleUrl: './glossary-term.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryTerm {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly termino = signal<ViewState<GlossaryTermDetail>>(loading());

  private readonly conceptId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('conceptId') ?? '')),
    { initialValue: '' },
  );

  /** El término ya leído, o `null` mientras no lo esté. */
  protected readonly ficha = computed<GlossaryTermDetail | null>(() => {
    const estado = this.termino();
    return estado.status === 'ready' ? estado.data : null;
  });

  /**
   * El título de la pantalla.
   *
   * Mientras carga dice «Término», no el uuid de la ruta: un identificador en el
   * encabezado no le dice nada a quien vino a entender una palabra.
   */
  protected readonly titulo = computed(() => this.ficha()?.display ?? 'Término');

  /**
   * El código del término, **sólo si sirve para algo fuera de este sistema**.
   *
   * Un código como `I10` o `N02BE01` es útil: identifica el término en CIE-10 o
   * en la clasificación ATC y con él se lo busca en la literatura. Pero los
   * conceptos que siembra la propia plataforma guardan como código su **clave
   * interna** —`clinical:CONDITION_SEVERITY_SEVERE`—, porque
   * `catalog_concepts` exige unicidad por versión y varios módulos declaran
   * códigos genéricos que coinciden. Esa clave no le sirve a nadie en consulta:
   * es configuración, del mismo orden que el uuid que esta pantalla ya decidió
   * no mostrar.
   *
   * El prefijo de módulo (`modulo:CLAVE`) es lo que las distingue, y lo pone
   * `defineModuleConcepts` sin excepción. Verificado contra la API viva: los
   * conceptos internos vuelven con dos puntos, los importados de un catálogo
   * externo no.
   */
  protected readonly codigoPublicable = computed<string | null>(() => {
    const code = this.ficha()?.code;
    if (code === undefined || code === '') return null;
    return code.includes(':') ? null : code;
  });

  /**
   * Las relaciones de la ficha, agrupadas por tipo y en el orden clínico de
   * {@link RELATION_GROUPS}. Los grupos sin ninguna relación no se muestran:
   * un encabezado «Anatomía relacionada» seguido de nada no informa, confunde.
   */
  protected readonly gruposDeRelaciones = computed<readonly GrupoDeRelaciones[]>(() => {
    const relaciones = this.ficha()?.relations ?? [];
    return RELATION_GROUPS.map(({ type, label }) => ({
      label,
      relaciones: relaciones.filter((relacion) => relacion.type === type),
    })).filter((grupo) => grupo.relaciones.length > 0);
  });

  /**
   * Ficha de medicamento (TAREA-25), o `null` si no hay ninguno de los cuatro
   * datos. `null` es el estado normal hoy: la base no tiene ninguna fila del
   * `code_system` `ndc` (los importadores existen y no corrieron acá), así
   * que el bloque se omite entero — es el criterio de AC-25-6/AC-25-8, no una
   * falla de la pantalla.
   */
  protected readonly medicamento = computed<GlossaryDrugFacts | null>(() => {
    const termino = this.ficha();
    return termino === null ? null : drugFactsFrom(termino);
  });

  /**
   * La ficha técnica de CIMA, o `null`. Cuando existe **reemplaza** al bloque
   * del NDC: es la fuente del medicamento autorizado en España, y mostrar las
   * dos sería repetir principio activo y vía con dos grafías distintas.
   */
  protected readonly cima = computed<CimaDrugFacts | null>(() => {
    const termino = this.ficha();
    return termino === null ? null : cimaFactsFrom(termino);
  });

  /** De dónde sale la definición (p. ej. la sección 4.1 de una ficha técnica), si lo declara. */
  protected readonly fuenteDeDefinicion = computed<FuenteDeDefinicion | null>(() => {
    const cruda = this.ficha()?.properties?.['definition_source'];
    if (!esObjeto(cruda) || typeof cruda['name'] !== 'string') return null;
    return {
      nombre: cruda['name'],
      url: typeof cruda['url'] === 'string' ? cruda['url'] : null,
      consultado: typeof cruda['retrievedAt'] === 'string' ? cruda['retrievedAt'].slice(0, 10) : null,
    };
  });

  /**
   * Si la «definición» es la descripción breve de la comunidad de Wikidata
   * (anatomía): se dice, para que no pase por una definición clínica revisada.
   */
  protected readonly esDescripcionDeWikidata = computed(
    () => this.ficha()?.properties?.['definition_kind'] === 'wikidata-description',
  );

  /** Las secciones verbatim que trae la fuente (guías de pruebas de MedlinePlus). */
  protected readonly seccionesDeLaFuente = computed<readonly SeccionDeLaFuente[]>(() => {
    const crudas = this.ficha()?.properties?.['sections'];
    if (!Array.isArray(crudas)) return [];
    return crudas.flatMap((item: unknown) =>
      esObjeto(item) && typeof item['title'] === 'string' && typeof item['text'] === 'string'
        ? [{ titulo: item['title'], texto: item['text'] }]
        : [],
    );
  });

  /** La definición clínica, o vacío si el término no la tiene. */
  protected readonly definicion = computed(
    () => this.ficha()?.clinicalDefinition?.text.trim() ?? '',
  );

  /** El resumen en lenguaje llano, o vacío si el término no lo tiene. */
  protected readonly resumen = computed(() => this.ficha()?.plainSummary?.text.trim() ?? '');

  /** La pestaña que se está mirando. Vuelve a «Definición» al cambiar de término. */
  protected readonly pestana = signal(0);

  /** La foto ampliada está abierta. */
  protected readonly ampliada = signal(false);

  /**
   * De dónde sale el término, dicho con los datos que el propio término trae
   * (`source`, `source_url`, `source_retrieved_at`), o `null` si no trae
   * ninguno — nunca una fuente supuesta.
   */
  protected readonly fuente = computed<FuenteDelTermino | null>(() => {
    const propiedades = this.ficha()?.properties ?? {};
    const codigo = valorDeTexto(propiedades, 'source');
    const nombreDeclarado = valorDeTexto(propiedades, 'source_name');
    const url = valorDeTexto(propiedades, 'source_url') ?? null;
    if (codigo === undefined && nombreDeclarado === undefined && url === null) return null;
    const conocida =
      codigo === undefined
        ? undefined
        : NOMBRE_DE_FUENTE.find((fuente) => codigo.includes(fuente.clave));
    return {
      // El nombre que declara la fila manda; si no lo trae, el de la tabla; si
      // tampoco, el identificador tal cual — nunca una fuente supuesta.
      nombre: nombreDeclarado ?? conocida?.nombre ?? codigo ?? 'Fuente del término',
      url,
      consultado: valorDeTexto(propiedades, 'source_retrieved_at')?.slice(0, 10) ?? null,
      licencia: valorDeTexto(propiedades, 'source_license') ?? null,
    };
  });

  /**
   * Por qué falta la definición, dicho con honestidad.
   *
   * Vale para **cualquier** término sin definición, no sólo para los que llegan
   * en inglés: la capa CIE-10-ES trae código y nombre oficial, MedlinePlus no
   * cubre todo, y ningún texto se escribe sin fuente. Antes esto sólo lo decía
   * el simulador, inventando el párrafo en los datos; ahora lo dice la pantalla
   * cuando el texto viene vacío.
   */
  protected readonly motivoSinDefinicion = computed<string>(() => {
    const propiedades = this.ficha()?.properties ?? {};
    const sistema = valorDeTexto(propiedades, 'code_system');
    const codigo = valorDeTexto(propiedades, 'external_code');
    const quien = this.fuente()?.nombre ?? (sistema ? NOMBRE_DE_SISTEMA[sistema] ?? sistema : null);
    const loQuePublica =
      codigo === undefined ? 'su nombre oficial' : `el código «${codigo}» y su nombre oficial`;
    return quien === null
      ? 'Este término todavía no tiene una definición cargada. No se escribe una definición sin fuente.'
      : `Este término todavía no tiene una definición cargada. ${quien} publica ${loQuePublica}; ` +
          'no se escribe una definición sin fuente.';
  });

  constructor() {
    effect(() => {
      const id = this.conceptId();
      untracked(() => this.cargar(id));
    });
  }

  protected recargar(): void {
    this.cargar(this.conceptId());
  }

  private cargar(conceptId: string): void {
    if (conceptId === '') return;

    this.termino.set(loading());
    this.pestana.set(0);
    this.ampliada.set(false);

    this.terminology.readGlossaryTerm(conceptId).subscribe({
      next: (ficha) => this.termino.set(ready(ficha)),
      error: (error: unknown) => {
        // Un término que no existe es 404 del backend y se traduce a S6, que no
        // filtra existencia. Acá eso es sobre todo higiene: el catálogo no tiene
        // datos de paciente, pero la regla del proyecto vale igual.
        this.termino.set(errorToViewState<GlossaryTermDetail>(error));
      },
    });
  }

  /**
   * La cita de la ficha técnica, con la forma exacta que pide el propietario:
   * «Fuente: CIMA (AEMPS), ficha técnica nº …, consultado el …».
   */
  protected citaCima(ficha: CimaDrugFacts): string {
    const consulta =
      ficha.retrievedAt === null ? '' : `, consultado el ${this.fechaLegible(ficha.retrievedAt)}`;
    return `Fuente: CIMA (AEMPS), ficha técnica nº ${ficha.registrationNumber}${consulta}.`;
  }

  /** Qué medicamento concreto es el de la ficha técnica que se cita, y de qué versión. */
  protected referenciaCima(ficha: CimaDrugFacts): string {
    const cual = ficha.referenceName ?? `nº reg. ${ficha.registrationNumber}`;
    const version =
      ficha.documentDate === null ? '' : ` (versión del ${this.fechaLegible(ficha.documentDate)})`;
    return `Secciones de la ficha técnica de ${cual}${version}, tal como las publica CIMA.`;
  }

  /** `2026-09-30` → `30/09/2026`. Un valor con otra forma se muestra tal cual. */
  protected fechaLegible(iso: string): string {
    const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return partes === null ? iso : `${partes[3]}/${partes[2]}/${partes[1]}`;
  }
}
