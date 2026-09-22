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
import { map } from 'rxjs';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  PatientListItem,
  PatientPage,
} from '../../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { historialDeCursor } from '../../../../shared/components/organisms/data-table/cursor-history';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import type { PageHeaderAction } from '../../../../shared/components/organisms/page-header/page-header';
import {
  patientDetailRoute,
  PATIENTS_ROUTE,
  PATIENT_MERGE_ROUTE,
  PATIENT_NEW_ROUTE,
} from '../patients.routes';

/** Filas por página. El backend admite hasta 200 y aplica 50 por omisión. */
const TAMANO_DE_PAGINA = 25;

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
 * ## Las columnas son las del endpoint, no las de la entidad
 *
 * La ficha deriva sus columnas de `profiles.patient_profiles` —grupo ABO, factor
 * Rh, estado de cobertura, idioma clínico, estado de vinculación— porque se
 * escribió **antes** de que el listado existiera. El endpoint real devuelve una
 * fila más angosta a propósito: «lo justo para pintar una tabla y decidir a cuál
 * entrar», dice su propio contrato. Se pinta lo que llega; el resto está en la
 * ficha de filiación, a un clic. Inventar columnas que la respuesta no trae
 * sería llenar la tabla de celdas vacías.
 *
 * El único `*ConceptId` de la fila (`personStatusConceptId`) **no se pinta**:
 * un uuid no le dice nada a nadie y resolverlo pediría una lectura de
 * terminología por fila. La defunción sí, porque el backend la manda ya
 * derivada como booleano — que es exactamente por qué la manda así.
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
  imports: [AppButtonLink, Badge, DataTable, DatePipe, Link, PageHeader, RouterLink, SearchField],
  templateUrl: './patient-list.html',
  styleUrl: './patient-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientList {
  private readonly profiles = inject(ProfilesClient);
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
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaEstado');

  protected readonly listado = signal<ViewState<readonly PatientListItem[]>>(loading());

  /** El filtro vigente, leído de la URL. Vacío es «sin filtro», no «buscar nada». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /**
   * El paginado por cursor, con memoria: el contrato solo entrega `nextCursor`
   * y el camino de vuelta lo recuerda `historialDeCursor`, que es el mismo que
   * usan organizaciones, el catálogo de servicios y las solicitudes de seguro.
   */
  private readonly paginado = historialDeCursor();
  protected readonly cursor = this.paginado.cursor;

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
    { key: 'deceased', header: 'Estado', priority: 2, cell: this.celdaEstado() },
  ]);

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
      untracked(() => {
        this.paginado.reiniciar();
        this.cargar();
      });
    });
  }

  /** La búsqueda se publica en la URL; el efecto de arriba hace el resto. */
  protected buscar(texto: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: texto === '' ? {} : { q: texto },
      // Reemplaza en vez de apilar: cada tecleo no es un paso del historial.
      replaceUrl: true,
    });
  }

  protected mover(cursor: string): void {
    this.paginado.mover(cursor);
    this.cargar();
  }

  /** Reintento de S8/S9: repite la página en la que quedó, no la primera. */
  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.listado.set(loading());

    const texto = this.busqueda();
    const cursorActual = this.paginado.actual();

    this.profiles
      .searchPatients({
        limit: TAMANO_DE_PAGINA,
        ...(texto === '' ? {} : { query: texto }),
        ...(cursorActual === undefined ? {} : { cursor: cursorActual }),
      })
      .subscribe({
        next: (pagina) => {
          this.paginado.llego(pagina.nextCursor);
          this.listado.set(this.estadoDe(pagina));
        },
        error: (error: unknown) => {
          this.paginado.llego(null);
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

    return this.busqueda() === ''
      ? empty(
          { label: 'Registrar un paciente', route: PATIENT_NEW_ROUTE },
          'Todavía no hay pacientes registrados en esta organización.',
        )
      : empty(
          { label: 'Ver todos los pacientes', route: PATIENTS_ROUTE },
          `Ningún paciente coincide con «${this.busqueda()}».`,
        );
  }
}
