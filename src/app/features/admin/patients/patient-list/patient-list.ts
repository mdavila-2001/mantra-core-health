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
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  PatientListItem,
  PatientPage,
} from '../../../../core/data-access/profiles/profiles.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import type { DynamicEnum } from '../../../../core/data-access/system-context/system-context.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import type { PageHeaderAction } from '../../../../shared/components/organisms/page-header/page-header';
import {
  patientDetailRoute,
  PATIENTS_ROUTE,
  PATIENT_MERGE_ROUTE,
  PATIENT_NEW_ROUTE,
} from '../patients.routes';

/** Claves de filtro en la URL — las mismas que manda `PatientSearchQuery`. */
const FILTRO_ABO = 'aboGroupConceptId';
const FILTRO_RH = 'rhFactorConceptId';
const FILTRO_IDIOMA = 'clinicalLanguageConceptId';

/** Un catálogo dinámico a las opciones de `app-filter-bar`. `null` ⇒ vacío. */
function aOpciones(enumeracion: DynamicEnum | null): readonly SelectOption<string>[] {
  return (enumeracion?.options ?? []).map((opcion) => ({
    value: opcion.conceptId,
    label: opcion.display,
  }));
}

/** Filas por página. El backend admite hasta 200 y aplica 50 por omisión. */
const TAMANO_DE_PAGINA = 25;

/**
 * Centinela con el que la tabla pide la página anterior.
 *
 * El contrato solo entrega `nextCursor`: un cursor hacia atrás no existe. El
 * organismo, en cambio, emite el valor de `prevCursor` tal cual, así que se le
 * da esta marca y el camino de vuelta lo recuerda la pantalla.
 */
const VOLVER = 'anterior';

/**
 * Listado de pacientes — vista **V05-01·L** de `SALUD/Vistas/V05 profiles`.
 *
 * ## Deja de estar bloqueada
 *
 * La ficha del vault la marca `Tabla ⚠︎ · Listado pendiente`, que es la deuda
 * más repetida del sistema (674 de 693 vistas). Acá ya no aplica:
 * `GET /profiles/patients` (UC-05-13) entró en `dev`, así que la tabla se pinta
 * con datos reales en vez de quedar en S3 con un TODO.
 *
 * ## Las columnas son las del endpoint, no las de la entidad — con tres excepciones, y con motivo
 *
 * La ficha del vault deriva sus columnas de `profiles.patient_profiles` —grupo
 * ABO, factor Rh, estado de cobertura, idioma clínico, estado de vinculación—
 * porque se escribió **antes** de que el listado existiera. El endpoint real
 * devolvía una fila más angosta a propósito: «lo justo para pintar una tabla y
 * decidir a cuál entrar», dice su propio contrato. Inventar columnas que la
 * respuesta no trae sería llenar la tabla de celdas vacías — **y eso sigue
 * siendo cierto**: nada de esto habilita a inventar una columna que la API no
 * respalde.
 *
 * **Grupo ABO, factor Rh e idioma clínico se sumaron el 2026-09-22**, junto con
 * sus filtros, porque dejaron de ser «datos que la respuesta no trae»: los
 * tres tienen catálogo real (`VS_BLOOD_GROUP`, `VS_RH_FACTOR`, `VS_LANGUAGE`)
 * y viven en `PatientDetail` desde antes — el mismo caso que documento y
 * teléfono. Filtrar por un campo cuya columna no se ve deja a la persona sin
 * saber qué encontró, así que las tres entraron juntas: filtro y columna.
 *
 * **Estado de cobertura queda fuera**, y no por descuido: no existe un
 * conjunto de valores real para los tres estados de la maqueta
 * (Asegurada/Particular/En trámite). Inventarlo sería un catálogo sin
 * procedencia (regla 97.4). Es una ambigüedad para producto, no un contrato
 * que se pueda simular.
 *
 * El único `*ConceptId` de la fila que sigue sin pintarse es
 * `personStatusConceptId`: un uuid no le dice nada a nadie, y la defunción ya
 * llega derivada como booleano — que es exactamente por qué el backend la
 * manda así.
 *
 * ## La búsqueda vive en la URL
 *
 * `?q=` y no un signal interno, por tres cosas que se obtienen gratis: el
 * enlace se comparte con el filtro puesto, el botón «atrás» del navegador
 * deshace la búsqueda, y el estado vacío por filtro puede ofrecer una salida
 * que de verdad funciona — un enlace a la lista sin filtrar.
 */
@Component({
  selector: 'app-patient-list',
  imports: [AppButtonLink, Badge, DataTable, DatePipe, FilterBar, Link, PageHeader, RouterLink],
  templateUrl: './patient-list.html',
  styleUrl: './patient-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientList {
  private readonly profiles = inject(ProfilesClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly rutaDeLaFicha = patientDetailRoute;
  protected readonly rutaDeAlta = PATIENT_NEW_ROUTE;

  private readonly celdaPaciente =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaPaciente');
  private readonly celdaNacimiento =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaNacimiento');
  private readonly celdaDocumento =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaDocumento');
  private readonly celdaTelefono =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaTelefono');
  private readonly celdaAbo =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaAbo');
  private readonly celdaRh = viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaRh');
  private readonly celdaIdioma =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaIdioma');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaEstado');

  protected readonly listado = signal<ViewState<readonly PatientListItem[]>>(loading());

  /** El filtro vigente, leído de la URL. Vacío es «sin filtro», no «buscar nada». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  private readonly filtroAbo = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(FILTRO_ABO) ?? '')),
    { initialValue: '' },
  );
  private readonly filtroRh = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(FILTRO_RH) ?? '')),
    { initialValue: '' },
  );
  private readonly filtroIdioma = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(FILTRO_IDIOMA) ?? '')),
    { initialValue: '' },
  );

  /**
   * Los tres catálogos de filtro, cargados una vez.
   *
   * `VS_BLOOD_GROUP`, `VS_RH_FACTOR` y `VS_LANGUAGE` ya existen y el manejador
   * de catálogos dinámicos ya reconoce `abo`, `rh` y `language` en el target
   * (`misc.handlers.ts`): no hace falta inventar ningún conjunto nuevo.
   *
   * Un catálogo que no responde deja el filtro deshabilitado con el motivo a
   * la vista — es lo que hace `app-filter-bar` con `options: []`. No degrada a
   * texto libre: un `*_concept_id` tecleado a mano no es válido.
   */
  private readonly opcionesAbo = signal<readonly SelectOption<string>[]>([]);
  private readonly opcionesRh = signal<readonly SelectOption<string>[]>([]);
  private readonly opcionesIdioma = signal<readonly SelectOption<string>[]>([]);

  /** Las etiquetas de los tres catálogos, para pintar las celdas sin un uuid. */
  private readonly etiquetasAbo = computed(() => new Map(this.opcionesAbo().map((o) => [o.value, o.label])));
  private readonly etiquetasRh = computed(() => new Map(this.opcionesRh().map((o) => [o.value, o.label])));
  private readonly etiquetasIdioma = computed(() =>
    new Map(this.opcionesIdioma().map((o) => [o.value, o.label])),
  );

  protected readonly filtros = computed<readonly FilterDef[]>(() => [
    { key: FILTRO_ABO, label: 'Grupo ABO', options: this.opcionesAbo() },
    { key: FILTRO_RH, label: 'Factor Rh', options: this.opcionesRh() },
    { key: FILTRO_IDIOMA, label: 'Idioma clínico', options: this.opcionesIdioma() },
  ]);

  /**
   * Los cursores ya visitados, en orden. Es lo que permite volver con una
   * paginación que solo sabe avanzar.
   */
  private readonly historia = signal<readonly (string | undefined)[]>([undefined]);

  private readonly cursorSiguiente = signal<string | null>(null);

  protected readonly cursor = computed<CursorState>(() => ({
    prevCursor: this.historia().length > 1 ? VOLVER : null,
    nextCursor: this.cursorSiguiente(),
  }));

  /**
   * Las columnas, ya con sus plantillas resueltas.
   *
   * `priority` la declara el consumidor a mano —el `responsive_priority` del
   * modelo está sembrado con placeholders—: 1 nunca se pliega. En móvil las de
   * prioridad 2 caen a la fila de detalle; **no se ocultan**, que es la regla
   * del M34.
   */
  protected readonly columnas = computed<readonly ColumnDef<PatientListItem>[]>(() => [
    { key: 'displayName', header: 'Paciente', priority: 1, cell: this.celdaPaciente() },
    { key: 'patientCode', header: 'Código', priority: 1 },
    { key: 'birthDate', header: 'Nacimiento', priority: 2, cell: this.celdaNacimiento() },
    /* Documento y teléfono los pidió el propietario el 19/09/2026 y el contrato
       ya los declara (`PatientListItem`): son lo que el médico usa para
       reconocer y para llamar. Prioridad 2 como el resto de los datos de
       reconocimiento: en móvil caen a la fila de detalle, no se ocultan. */
    { key: 'nationalId', header: 'Documento', priority: 2, cell: this.celdaDocumento() },
    { key: 'phone', header: 'Teléfono', priority: 2, cell: this.celdaTelefono() },
    /* Grupo ABO, factor Rh e idioma clínico: sumados el 2026-09-22 junto con
       sus filtros, porque los tres tienen catálogo real (`VS_BLOOD_GROUP`,
       `VS_RH_FACTOR`, `VS_LANGUAGE`) y un filtro cuya columna no se ve deja a
       la persona sin saber qué encontró. «Estado de seguro» queda fuera: no
       tiene un conjunto de valores real (ver el comentario de la clase). */
    { key: 'aboGroupConceptId', header: 'Grupo ABO', priority: 2, cell: this.celdaAbo() },
    { key: 'rhFactorConceptId', header: 'Factor Rh', priority: 2, cell: this.celdaRh() },
    { key: 'clinicalLanguageConceptId', header: 'Idioma clínico', priority: 2, cell: this.celdaIdioma() },
    { key: 'deceased', header: 'Estado', priority: 2, cell: this.celdaEstado() },
  ]);

  /** Etiqueta de un concepto ya resuelto, o el texto de ausencia. Nunca el uuid. */
  protected etiquetaAbo(conceptId: string | undefined): string | undefined {
    return conceptId === undefined ? undefined : this.etiquetasAbo().get(conceptId);
  }

  protected etiquetaRh(conceptId: string | undefined): string | undefined {
    return conceptId === undefined ? undefined : this.etiquetasRh().get(conceptId);
  }

  protected etiquetaIdioma(conceptId: string | undefined): string | undefined {
    return conceptId === undefined ? undefined : this.etiquetasIdioma().get(conceptId);
  }

  protected readonly porPerfil = (row: PatientListItem): string => row.profileId;
  /** Nombre de la fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDePaciente = (row: PatientListItem): string => row.displayName ?? '';

  protected readonly cargando = computed(() => this.listado().status === 'loading');

  /**
   * Acciones secundarias del encabezado.
   *
   * Fusionar va acá y no como acción de fila: no opera sobre **una** fila sino
   * sobre un par, y ninguna fila es «la» fusión. Ponerla en el menú de una fila
   * sugeriría que esa fila es el registro que sobrevive, que es exactamente la
   * confusión que la pantalla de fusión se ocupa de evitar.
   */
  protected readonly accionesSecundarias: readonly PageHeaderAction[] = [
    { code: 'fusionar', label: 'Fusionar duplicados' },
  ];

  protected ejecutarAccion(code: string): void {
    if (code === 'fusionar') {
      void this.router.navigateByUrl(PATIENT_MERGE_ROUTE);
    }
  }

  constructor() {
    // Un cambio de filtro es una lista nueva: el cursor que había era de la
    // anterior y seguirlo devolvería una página del listado viejo.
    effect(() => {
      this.busqueda();
      this.filtroAbo();
      this.filtroRh();
      this.filtroIdioma();
      untracked(() => {
        this.historia.set([undefined]);
        this.cargar();
      });
    });

    this.cargarCatalogos();
  }

  /**
   * Los tres catálogos, una sola vez. Un catálogo que falla deja su filtro
   * deshabilitado (`options: []`) en vez de tumbar la pantalla: el listado
   * sigue viéndose sin él.
   */
  private cargarCatalogos(): void {
    forkJoin({
      abo: this.systemContext
        .dynamicEnum('profiles.patient_profiles.abo_group_concept_id')
        .pipe(catchError(() => of(null))),
      rh: this.systemContext
        .dynamicEnum('profiles.patient_profiles.rh_factor_concept_id')
        .pipe(catchError(() => of(null))),
      idioma: this.systemContext
        .dynamicEnum('profiles.patient_profiles.clinical_language_concept_id')
        .pipe(catchError(() => of(null))),
    }).subscribe(({ abo, rh, idioma }) => {
      this.opcionesAbo.set(aOpciones(abo));
      this.opcionesRh.set(aOpciones(rh));
      this.opcionesIdioma.set(aOpciones(idioma));
    });
  }

  protected mover(cursor: string): void {
    if (cursor === VOLVER) {
      this.historia.update((visitados) => visitados.slice(0, -1));
    } else {
      this.historia.update((visitados) => [...visitados, cursor]);
    }
    this.cargar();
  }

  /** Reintento de S8/S9: repite la página en la que quedó, no la primera. */
  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.listado.set(loading());

    const texto = this.busqueda();
    const abo = this.filtroAbo();
    const rh = this.filtroRh();
    const idioma = this.filtroIdioma();
    const cursorActual = this.historia().at(-1);

    this.profiles
      .searchPatients({
        limit: TAMANO_DE_PAGINA,
        ...(texto === '' ? {} : { query: texto }),
        ...(abo === '' ? {} : { aboGroupConceptId: abo }),
        ...(rh === '' ? {} : { rhFactorConceptId: rh }),
        ...(idioma === '' ? {} : { clinicalLanguageConceptId: idioma }),
        ...(cursorActual === undefined ? {} : { cursor: cursorActual }),
      })
      .subscribe({
        next: (pagina) => {
          this.cursorSiguiente.set(pagina.nextCursor);
          this.listado.set(this.estadoDe(pagina));
        },
        error: (error: unknown) => {
          this.cursorSiguiente.set(null);
          this.listado.set(errorToViewState<readonly PatientListItem[]>(error));
        },
      });
  }

  /**
   * De la página al estado.
   *
   * El vacío distingue los dos casos que la persona vive distinto: no hay
   * pacientes todavía, o los hay pero ninguno coincide con lo que buscó.
   * Ofrecerle «registrar el primero» cuando en realidad se equivocó de apellido
   * sería empujarla a crear un duplicado.
   */
  private estadoDe(pagina: PatientPage): ViewState<readonly PatientListItem[]> {
    if (pagina.items.length > 0) {
      return ready(pagina.items);
    }

    const hayFiltro =
      this.busqueda() !== '' || this.filtroAbo() !== '' || this.filtroRh() !== '' || this.filtroIdioma() !== '';

    return hayFiltro
      ? empty(
          { label: 'Ver todos los pacientes', route: PATIENTS_ROUTE },
          this.busqueda() === ''
            ? 'Ningún paciente coincide con los filtros elegidos.'
            : `Ningún paciente coincide con «${this.busqueda()}».`,
        )
      : empty(
          { label: 'Registrar un paciente', route: PATIENT_NEW_ROUTE },
          'Todavía no hay pacientes registrados en esta organización.',
        );
  }
}
