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
  GlossaryNeighborhood,
  GlossarySourceReference,
  GlossaryTermDetail,
} from '../../core/data-access/terminology/terminology.types';
import { valorDeTexto } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Card } from '../../shared/components/molecules/card/card';
import { ContentDialog } from '../../shared/components/organisms/content-dialog/content-dialog';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { RelationGroups } from '../../shared/components/organisms/relation-groups/relation-groups';
import type {
  RelationColumnView,
  RelationGroupsTone,
} from '../../shared/components/organisms/relation-groups/relation-groups.types';
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
import { GlossaryArticleView } from './glossary-article';
import { GlossaryDataFlow } from './glossary-data-flow';
import { GlossaryPdfService } from './glossary-pdf.service';
import { imagenAprobadaDelTermino } from './glossary-image.logic';
import { buildClinicalRoute, ROUTE_ZONES } from './glossary-clinical-route';
import type { GlossaryArticle } from '../../core/data-access/terminology/glossary-article.types';

/** Vecinos por grupo en la ficha: la misma muestra que la primera lectura del mapa. */
const RELATIONS_PER_GROUP = 8;

/** Una zona de relaciones de la ficha, lista para el organismo compartido. */
interface RelationZoneView {
  readonly zone: RelationGroupsTone;
  readonly title: string;
  readonly columns: readonly RelationColumnView[];
}

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

function fuentesDesdePropiedad(valor: unknown): readonly GlossarySourceReference[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item: unknown) => {
    if (!esObjeto(item)) return [];
    const { source, recordId, url, language, version, retrievedAt, role, attribution, rights } =
      item;
    if (
      typeof source !== 'string' ||
      typeof recordId !== 'string' ||
      typeof url !== 'string' ||
      !url.startsWith('https://') ||
      (language !== 'es' && language !== 'en') ||
      typeof version !== 'string' ||
      typeof retrievedAt !== 'string' ||
      (role !== 'concept_match' && role !== 'related_context' && role !== 'editorial_reference') ||
      typeof attribution !== 'string' ||
      typeof rights !== 'string'
    ) {
      return [];
    }
    const matchBasis = item['matchBasis'];
    return [
      {
        source,
        recordId,
        url,
        language,
        version,
        retrievedAt,
        role,
        ...(matchBasis === 'title' || matchBasis === 'also_called' ? { matchBasis } : {}),
        attribution,
        rights,
      },
    ];
  });
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
    AppButton,
    Card,
    Chip,
    ContentDialog,
    EmptyState,
    GlossaryArticleView,
    GlossaryCategoryIcon,
    GlossaryDataFlow,
    PageHeader,
    RelationGroups,
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
  private readonly glossaryPdf = inject(GlossaryPdfService);

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
   * El vecindario del término (salientes **y entrantes**), que es lo que pinta
   * el mapa. La ficha lo lee aparte de `relations`: así sus grupos, su orden y
   * sus sellos de evidencia son los del mapa (TAREA-41 F5.5) y un síntoma
   * muestra también las enfermedades que lo presentan.
   */
  protected readonly vecindario = signal<ViewState<GlossaryNeighborhood>>(loading());

  /** Las zonas de la ruta clínica, sin las vacías, en el orden del mapa. */
  protected readonly zonasDeRelaciones = computed<readonly RelationZoneView[]>(() => {
    const estado = this.vecindario();
    if (estado.status !== 'ready') return [];
    const ruta = buildClinicalRoute(estado.data);
    return ROUTE_ZONES.map(({ zone, title }) => ({
      zone,
      title,
      columns: ruta[zone].map((column) => ({
        key: column.key,
        title: column.title,
        items: column.items,
        count: column.complete ? column.items.length : null,
      })),
    })).filter((zona) => zona.columns.length > 0);
  });

  /**
   * Si la pestaña «Relacionados» tiene algo que decir: mientras carga o si
   * falló, sí (con su estado); ya leída y sin vecinos, se omite — una pestaña
   * vacía no informa.
   */
  protected readonly mostrarRelacionados = computed(() => {
    const estado = this.vecindario();
    return estado.status !== 'ready' || this.zonasDeRelaciones().length > 0;
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
      consultado:
        typeof cruda['retrievedAt'] === 'string' ? cruda['retrievedAt'].slice(0, 10) : null,
    };
  });

  /** Referencias editoriales curadas, sin confundir contexto relacionado con equivalencia. */
  protected readonly referenciasEditoriales = computed<readonly GlossarySourceReference[]>(() =>
    fuentesDesdePropiedad(this.ficha()?.properties?.['glossary-sources']),
  );

  protected rolDeFuente(rol: GlossarySourceReference['role']): string {
    switch (rol) {
      case 'concept_match':
        return 'Correspondencia del concepto';
      case 'related_context':
        return 'Contexto relacionado; no es una equivalencia';
      case 'editorial_reference':
        return 'Referencia editorial';
    }
  }

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

  /**
   * El artículo enciclopédico (F9), o `null` si el término no tiene. Se pide
   * aparte de la ficha y su fallo NO rompe la ficha: sin artículo, o si falla
   * la lectura, el término conserva la ficha de siempre.
   */
  protected readonly articulo = signal<GlossaryArticle | null>(null);
  protected readonly imagenAprobada = computed(() => imagenAprobadaDelTermino(this.ficha()));
  protected readonly articuloCargado = signal(false);
  protected readonly pdfOcupado = signal(false);
  protected readonly pdfError = signal('');

  /** Los nombres alternativos del término, para el artículo. */
  protected readonly nombresAlternativos = computed(() =>
    (this.ficha()?.synonyms ?? []).map((sinonimo) => sinonimo.value),
  );

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
   * La cita bibliográfica del término, al estilo de «Citar» en Google Académico.
   *
   * Sólo arma lo que la ficha declara: nombre, fuente, código y fecha de
   * consulta de la fuente. Sin fuente declarada no hay cita, porque citar
   * «Alovida» sola atribuiría a la plataforma una definición que no escribió.
   */
  protected readonly cita = computed<string | null>(() => {
    const ficha = this.ficha();
    const origen = this.fuente();
    if (ficha === null || origen === null) return null;
    const codigo = this.codigoPublicable();
    const partes = [
      `${origen.nombre}.`,
      `«${ficha.display}»${codigo === null ? '' : ` (${codigo})`}.`,
      'En: Alovida, Glosario médico.',
      origen.consultado === null ? '' : `Fuente consultada el ${this.fechaLegible(origen.consultado)}.`,
      origen.licencia === null ? '' : `Condición de uso: ${origen.licencia}.`,
    ];
    return partes.filter((parte) => parte !== '').join(' ');
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
    const quien =
      this.fuente()?.nombre ?? (sistema ? (NOMBRE_DE_SISTEMA[sistema] ?? sistema) : null);
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

  protected recargarRelaciones(): void {
    this.cargarRelaciones(this.conceptId());
  }

  private cargarRelaciones(conceptId: string): void {
    this.vecindario.set(loading());
    this.terminology.readGlossaryNeighborhood(conceptId, { perGroup: RELATIONS_PER_GROUP }).subscribe({
      next: (vecindario) => {
        if (conceptId === this.conceptId()) this.vecindario.set(ready(vecindario));
      },
      error: (error: unknown) => {
        if (conceptId === this.conceptId()) {
          this.vecindario.set(errorToViewState<GlossaryNeighborhood>(error));
        }
      },
    });
  }

  private cargar(conceptId: string): void {
    if (conceptId === '') return;

    this.termino.set(loading());
    this.articulo.set(null);
    this.articuloCargado.set(false);
    this.pdfError.set('');
    this.pestana.set(0);
    this.ampliada.set(false);

    this.terminology.readGlossaryArticle(conceptId).subscribe({
      next: (articulo) => {
        if (conceptId === this.conceptId()) {
          this.articulo.set(articulo);
          this.articuloCargado.set(true);
        }
      },
      // El artículo es un complemento: si falla la lectura, la ficha sigue.
      error: () => {
        if (conceptId === this.conceptId()) {
          this.articulo.set(null);
          this.articuloCargado.set(true);
        }
      },
    });

    this.cargarRelaciones(conceptId);

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

  protected async descargarPdf(): Promise<void> {
    const term = this.ficha();
    if (term === null || !this.articuloCargado() || this.pdfOcupado()) return;
    this.pdfOcupado.set(true);
    this.pdfError.set('');
    try {
      await this.glossaryPdf.download(term, this.articulo());
    } catch {
      this.pdfError.set(
        'No pudimos generar un PDF completo con las imágenes y sus fuentes. Vuelva a intentarlo.',
      );
    } finally {
      this.pdfOcupado.set(false);
    }
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
