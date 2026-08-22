import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { catchError, of } from 'rxjs';

import { MedicalOrganizationClient } from '../../../core/data-access/medical-organization/medical-organization.client';
import type {
  MedicalOrganizationConsole,
  OrganizationCareSpace,
  OrganizationClinicalUnit,
  OrganizationConcept,
  OrganizationHealthcareService,
  OrganizationInventoryItem,
  OrganizationLegalDocument,
  OrganizationSite,
  OrganizationStaffMember,
  PracticeSummary,
} from '../../../core/data-access/medical-organization/medical-organization.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, hasData, loading, ready, stale } from '../../../core/view-state/view-state';
import type {
  ViewState,
  ViewStateNextAction,
} from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/**
 * Variante del badge por **código** de concepto, no por etiqueta.
 *
 * El código es lo estable; la etiqueta es texto traducible y atarle la
 * presentación haría que un cambio de redacción cambiara los colores. Lo que no
 * figura se pinta `info`: un estado desconocido no es un estado roto.
 */
const VARIANTE_POR_CODIGO: Readonly<Record<string, BadgeVariant>> = {
  PR_ACTIVE: 'success',
  SITE_ACTIVE: 'success',
  SITE_RETIRED: 'secondary',
  SITE_OP_PLANNED: 'warning',
  SITE_OP_CLOSED: 'secondary',
  UNIT_ACTIVE: 'success',
  UNIT_RETIRED: 'secondary',
  SPACE_ACTIVE: 'success',
  SPACE_RETIRED: 'secondary',
  SPACE_OP_AVAILABLE: 'success',
  SPACE_OP_CLOSED: 'error',
  SVC_ACTIVE: 'success',
  SVC_SUSPENDED: 'warning',
  ROLE_ASG_ACTIVE: 'success',
  ROLE_ASG_ENDED: 'secondary',
  ACCRED_VERIFIED: 'success',
  ACCRED_PENDING: 'warning',
  ACCRED_EXPIRED: 'error',
  INV_ACTIVE: 'success',
};

/** Días de aviso previo al vencimiento de un documento legal. */
const AVISO_DE_VENCIMIENTO_DIAS = 30;

/**
 * Consola del **administrador de organización médica** — CARRIL 13.
 *
 * ## Qué resuelve
 *
 * El módulo `practice` tenía once operaciones de escritura y tres lecturas. Se
 * podían dar de alta sedes, áreas, quirófanos, consultorios, servicios,
 * personal, acreditaciones e inventario, y **ninguna pantalla los volvía a
 * mostrar**: la estructura de la organización existía en la base y no existía
 * para nadie. Esta es la pantalla que la muestra, sobre
 * `GET /practices/:id/organization`.
 *
 * ## El ámbito es la práctica, y por eso hay selector
 *
 * Las siete listas cuelgan del mismo `practiceId`. Un parámetro obligatorio no
 * es un filtro: es el asunto de la pantalla. Va arriba, una sola vez, y no se
 * repite como columna en ninguna tabla. El selector sólo aparece cuando hay más
 * de una práctica — ofrecer una lista de un elemento es ruido.
 *
 * ## Lo que esta pantalla NO hace, y lo dice
 *
 * La especificación del carril incluye contabilidad, red social, foros,
 * encuestas y notificaciones de la organización. Esos dominios tienen sus
 * propios módulos y sus propios carriles (M16 contabilidad, M19 comunidad, M09
 * formularios, M25 mensajería). Duplicarlos acá sería la segunda
 * implementación que el carril prohíbe, y simularlos sería peor. La pantalla
 * declara la cobertura de cada dominio en vez de fingirla.
 */
@Component({
  selector: 'app-medical-organization',
  imports: [AppButton, Badge, DataTable, PageHeader, Tab, Tabs],
  templateUrl: './medical-organization.html',
  styleUrl: './medical-organization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalOrganization {
  private readonly client = inject(MedicalOrganizationClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaSede =
    viewChild.required<TemplateRef<{ $implicit: OrganizationSite }>>('celdaSede');
  private readonly celdaEstadoSede =
    viewChild.required<TemplateRef<{ $implicit: OrganizationSite }>>('celdaEstadoSede');
  private readonly celdaEstructuraSede =
    viewChild.required<TemplateRef<{ $implicit: OrganizationSite }>>('celdaEstructuraSede');

  private readonly celdaArea =
    viewChild.required<TemplateRef<{ $implicit: OrganizationClinicalUnit }>>('celdaArea');
  private readonly celdaSedeDelArea =
    viewChild.required<TemplateRef<{ $implicit: OrganizationClinicalUnit }>>('celdaSedeDelArea');
  private readonly celdaEstadoArea =
    viewChild.required<TemplateRef<{ $implicit: OrganizationClinicalUnit }>>('celdaEstadoArea');

  private readonly celdaEspacio =
    viewChild.required<TemplateRef<{ $implicit: OrganizationCareSpace }>>('celdaEspacio');
  private readonly celdaUbicacionEspacio =
    viewChild.required<TemplateRef<{ $implicit: OrganizationCareSpace }>>('celdaUbicacionEspacio');
  private readonly celdaDisponibilidadEspacio =
    viewChild.required<
      TemplateRef<{ $implicit: OrganizationCareSpace }>
    >('celdaDisponibilidadEspacio');

  private readonly celdaServicio =
    viewChild.required<
      TemplateRef<{ $implicit: OrganizationHealthcareService }>
    >('celdaServicio');
  private readonly celdaCondicionesServicio =
    viewChild.required<
      TemplateRef<{ $implicit: OrganizationHealthcareService }>
    >('celdaCondicionesServicio');
  private readonly celdaEstadoServicio =
    viewChild.required<
      TemplateRef<{ $implicit: OrganizationHealthcareService }>
    >('celdaEstadoServicio');

  private readonly celdaProfesional =
    viewChild.required<TemplateRef<{ $implicit: OrganizationStaffMember }>>('celdaProfesional');
  private readonly celdaDestinoProfesional =
    viewChild.required<
      TemplateRef<{ $implicit: OrganizationStaffMember }>
    >('celdaDestinoProfesional');
  private readonly celdaVigencia =
    viewChild.required<TemplateRef<{ $implicit: OrganizationStaffMember }>>('celdaVigencia');
  private readonly celdaEstadoVinculo =
    viewChild.required<TemplateRef<{ $implicit: OrganizationStaffMember }>>('celdaEstadoVinculo');

  private readonly celdaDocumento =
    viewChild.required<TemplateRef<{ $implicit: OrganizationLegalDocument }>>('celdaDocumento');
  private readonly celdaVencimiento =
    viewChild.required<TemplateRef<{ $implicit: OrganizationLegalDocument }>>('celdaVencimiento');
  private readonly celdaEstadoDocumento =
    viewChild.required<
      TemplateRef<{ $implicit: OrganizationLegalDocument }>
    >('celdaEstadoDocumento');

  private readonly celdaInsumo =
    viewChild.required<TemplateRef<{ $implicit: OrganizationInventoryItem }>>('celdaInsumo');
  private readonly celdaExistencias =
    viewChild.required<TemplateRef<{ $implicit: OrganizationInventoryItem }>>('celdaExistencias');
  private readonly celdaEstadoInsumo =
    viewChild.required<TemplateRef<{ $implicit: OrganizationInventoryItem }>>('celdaEstadoInsumo');

  /** Las prácticas que se pueden administrar. */
  protected readonly practicas = signal<ViewState<readonly PracticeSummary[]>>(loading());

  /** La práctica elegida. Vacío mientras el listado no resolvió. */
  protected readonly practicaElegida = signal('');

  /** El árbol de la práctica elegida. */
  protected readonly consola = signal<ViewState<MedicalOrganizationConsole>>(loading());

  /** La ficha, cuando la consola cargó. `null` en cualquier otro estado. */
  protected readonly organizacion = computed(() => {
    const estado = this.consola();
    return estado.status === 'ready' ? estado.data.organization : null;
  });

  /** Nombre de cada sede por su id: las demás pestañas devuelven `siteId` crudo. */
  private readonly nombreDeSede = computed<ReadonlyMap<string, string>>(() => {
    const estado = this.consola();
    if (estado.status !== 'ready') return new Map();
    return new Map(estado.data.sites.map((sede) => [sede.id, sede.name]));
  });

  /** Nombre de cada área por su id, por el mismo motivo. */
  private readonly nombreDeArea = computed<ReadonlyMap<string, string>>(() => {
    const estado = this.consola();
    if (estado.status !== 'ready') return new Map();
    return new Map(estado.data.clinicalUnits.map((area) => [area.id, area.name]));
  });

  protected readonly sedes = computed(() =>
    this.listaDe(
      (datos) => datos.sites,
      { label: 'Registrar una sede' },
      'Una sede es cada lugar donde la organización atiende. Sin al menos una no hay dónde ubicar áreas, quirófanos ni consultorios.',
    ),
  );

  protected readonly areas = computed(() =>
    this.listaDe(
      (datos) => datos.clinicalUnits,
      { label: 'Crear un área' },
      'Las áreas son los departamentos de cada sede —emergencias, cirugía, laboratorio—. Ordenan al personal y los espacios; sin ellas todo cuelga directo de la sede.',
    ),
  );

  protected readonly espacios = computed(() =>
    this.listaDe(
      (datos) => datos.careSpaces,
      { label: 'Registrar un espacio' },
      'Quirófanos, consultorios y salas. Sin espacios registrados no se puede reservar uno para una intervención ni asociar una cita a un consultorio.',
    ),
  );

  protected readonly servicios = computed(() =>
    this.listaDe(
      (datos) => datos.healthcareServices,
      { label: 'Publicar un servicio' },
      'Los servicios son lo que la organización ofrece. Mientras no haya ninguno, no hay nada que un paciente pueda pedir.',
    ),
  );

  protected readonly plantilla = computed(() =>
    this.listaDe(
      (datos) => datos.staff,
      { label: 'Vincular a un profesional' },
      'La plantilla es quién trabaja acá y con qué rol clínico. Mientras esté vacía, ninguna pantalla que dependa de un rol clínico va a funcionar.',
    ),
  );

  protected readonly legajo = computed(() =>
    this.listaDe(
      (datos) => datos.legalDocuments,
      { label: 'Cargar un documento' },
      'Licencias, registros sanitarios y acreditaciones, con su vencimiento. Es el respaldo legal de la organización.',
    ),
  );

  protected readonly inventario = computed(() =>
    this.listaDe(
      (datos) => datos.inventory,
      { label: 'Dar de alta un insumo' },
      'Insumos y equipamiento con sus existencias. El punto de reposición avisa antes de que falte.',
    ),
  );

  /** Documentos vencidos o por vencer dentro del mes: el aviso de la cabecera. */
  protected readonly documentosPorVencer = computed(() => {
    const estado = this.consola();
    if (estado.status !== 'ready') return [];
    return estado.data.legalDocuments.filter(
      (doc) => doc.daysToExpiry !== null && doc.daysToExpiry <= AVISO_DE_VENCIMIENTO_DIAS,
    );
  });

  /** Insumos en el punto de reposición o por debajo. */
  protected readonly insumosEnFalta = computed(() => {
    const estado = this.consola();
    if (estado.status !== 'ready') return [];
    return estado.data.inventory.filter((item) => item.belowReorderLevel);
  });

  protected readonly columnasDeSede = computed<readonly ColumnDef<OrganizationSite>[]>(() => [
    { key: 'name', header: 'Sede', priority: 1, cell: this.celdaSede() },
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoSede() },
    {
      key: 'clinicalUnitCount',
      header: 'Estructura',
      priority: 2,
      cell: this.celdaEstructuraSede(),
    },
  ]);

  protected readonly columnasDeArea = computed<readonly ColumnDef<OrganizationClinicalUnit>[]>(
    () => [
      { key: 'name', header: 'Área', priority: 1, cell: this.celdaArea() },
      { key: 'code', header: 'Código', priority: 1 },
      { key: 'siteId', header: 'Sede', priority: 2, cell: this.celdaSedeDelArea() },
      { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoArea() },
    ],
  );

  protected readonly columnasDeEspacio = computed<readonly ColumnDef<OrganizationCareSpace>[]>(
    () => [
      { key: 'name', header: 'Espacio', priority: 1, cell: this.celdaEspacio() },
      { key: 'code', header: 'Código', priority: 1 },
      { key: 'siteId', header: 'Ubicación', priority: 2, cell: this.celdaUbicacionEspacio() },
      {
        key: 'operationalStatus',
        header: 'Disponibilidad',
        priority: 1,
        cell: this.celdaDisponibilidadEspacio(),
      },
    ],
  );

  protected readonly columnasDeServicio = computed<
    readonly ColumnDef<OrganizationHealthcareService>[]
  >(() => [
    { key: 'service', header: 'Servicio', priority: 1, cell: this.celdaServicio() },
    {
      key: 'appointmentRequired',
      header: 'Condiciones',
      priority: 2,
      cell: this.celdaCondicionesServicio(),
    },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoServicio() },
  ]);

  protected readonly columnasDePlantilla = computed<
    readonly ColumnDef<OrganizationStaffMember>[]
  >(() => [
    { key: 'practitionerName', header: 'Profesional', priority: 1, cell: this.celdaProfesional() },
    { key: 'siteId', header: 'Destino', priority: 2, cell: this.celdaDestinoProfesional() },
    { key: 'validFrom', header: 'Vigencia', priority: 2, cell: this.celdaVigencia() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoVinculo() },
  ]);

  protected readonly columnasDeLegajo = computed<
    readonly ColumnDef<OrganizationLegalDocument>[]
  >(() => [
    { key: 'type', header: 'Documento', priority: 1, cell: this.celdaDocumento() },
    { key: 'issuerName', header: 'Emisor', priority: 2 },
    { key: 'validTo', header: 'Vigencia', priority: 1, cell: this.celdaVencimiento() },
    {
      key: 'verificationStatus',
      header: 'Verificación',
      priority: 1,
      cell: this.celdaEstadoDocumento(),
    },
  ]);

  protected readonly columnasDeInventario = computed<
    readonly ColumnDef<OrganizationInventoryItem>[]
  >(() => [
    { key: 'name', header: 'Insumo', priority: 1, cell: this.celdaInsumo() },
    {
      key: 'quantityOnHand',
      header: 'Existencias',
      priority: 1,
      align: 'end',
      cell: this.celdaExistencias(),
    },
    { key: 'status', header: 'Estado', priority: 2, cell: this.celdaEstadoInsumo() },
  ]);

  protected readonly porId = (row: { readonly id: string }): string => row.id;

  constructor() {
    this.cargarPracticas();
  }

  /** Cambia de organización desde el selector. */
  protected elegirPractica(practiceId: string): void {
    if (practiceId === '' || practiceId === this.practicaElegida()) return;
    this.practicaElegida.set(practiceId);
    this.cargarConsola(practiceId);
  }

  protected recargar(): void {
    const elegida = this.practicaElegida();
    if (elegida === '') {
      this.cargarPracticas();
      return;
    }
    this.cargarConsola(elegida);
  }

  /** La etiqueta de un concepto, o el guion si no vino. */
  protected etiquetaDe(concepto: OrganizationConcept | null | undefined): string {
    return concepto?.display ?? '—';
  }

  protected varianteDe(concepto: OrganizationConcept | null | undefined): BadgeVariant {
    return (concepto && VARIANTE_POR_CODIGO[concepto.code]) ?? 'info';
  }

  protected sedeDe(siteId: string | null): string | null {
    return siteId === null ? null : (this.nombreDeSede().get(siteId) ?? null);
  }

  protected areaDe(clinicalUnitId: string | null): string | null {
    return clinicalUnitId === null
      ? null
      : (this.nombreDeArea().get(clinicalUnitId) ?? null);
  }

  /**
   * Cómo se dice un vencimiento en días.
   *
   * En palabras y no en la cifra cruda porque «-14» obliga a interpretar un
   * signo, y el aviso lo lee alguien que necesita saber si tiene que actuar hoy.
   */
  protected vencimientoEnPalabras(dias: number | null): string {
    if (dias === null) return 'sin vencimiento declarado';
    if (dias < 0) return `vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
    if (dias === 0) return 'vence hoy';
    return `vence en ${dias} día${dias === 1 ? '' : 's'}`;
  }

  protected varianteDeVencimiento(dias: number | null): BadgeVariant {
    if (dias === null) return 'info';
    if (dias < 0) return 'error';
    if (dias <= AVISO_DE_VENCIMIENTO_DIAS) return 'warning';
    return 'success';
  }

  private cargarPracticas(): void {
    this.practicas.set(loading());
    this.client
      .listPractices()
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((resultado) => {
        if (esFallo(resultado)) {
          this.practicas.set(errorToViewState<readonly PracticeSummary[]>(resultado.error));
          this.consola.set(errorToViewState<MedicalOrganizationConsole>(resultado.error));
          return;
        }

        if (resultado.length === 0) {
          // El mismo mensaje en los dos: el que se ve es el de la consola —el
          // listado de prácticas no se dibuja cuando hay una sola o ninguna—, y
          // tener dos textos distintos dejaba el informativo sin pantalla que
          // lo mostrara.
          const vacio = empty(
            { label: 'Dar de alta la organización' },
            'Este tenant todavía no tiene ninguna organización médica dada de alta, así que no hay estructura que administrar.',
          );
          this.practicas.set(vacio);
          this.consola.set(vacio);
          return;
        }

        this.practicas.set(ready(resultado));
        // La primera por omisión: la pantalla tiene que abrir mostrando algo,
        // y en el caso mayoritario —una sola práctica— no hay nada que elegir.
        const primera = resultado[0];
        this.practicaElegida.set(primera.id);
        this.cargarConsola(primera.id);
      });
  }

  private cargarConsola(practiceId: string): void {
    this.consola.set(loading());
    this.client
      .getConsole(practiceId)
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((resultado) => {
        this.consola.set(
          esFallo(resultado)
            ? errorToViewState<MedicalOrganizationConsole>(resultado.error)
            : ready(resultado),
        );
      });
  }

  /**
   * El estado de una de las siete listas.
   *
   * Todas salen de la **misma** respuesta, así que comparten el estado de carga
   * y de error de la consola: no tiene sentido que una pestaña diga «cargando»
   * mientras otra ya falló. Lo único propio de cada una es el vacío, que sí
   * significa algo distinto en cada pestaña y por eso lleva su texto y su
   * salida.
   */
  private listaDe<T>(
    seleccionar: (datos: MedicalOrganizationConsole) => readonly T[],
    accion: ViewStateNextAction,
    mensaje: string,
  ): ViewState<readonly T[]> {
    const estado = this.consola();
    // Los estados sin datos pasan tal cual: son los mismos para las siete
    // pestañas porque las siete salen de la misma respuesta.
    if (!hasData(estado)) {
      return estado;
    }
    const filas = seleccionar(estado.data);
    if (filas.length === 0) {
      return empty(accion, mensaje);
    }
    // Se conserva la antigüedad si la respuesta venía atrasada: perderla acá
    // convertiría un S7 en un S-camino-feliz y la pantalla dejaría de avisar.
    return estado.status === 'stale' ? stale(filas, estado.asOf) : ready(filas);
  }
}

/** Una rama que se resolvió con fallo en vez de con datos. */
interface Fallo {
  readonly error: unknown;
}

function esFallo(valor: object): valor is Fallo {
  return 'error' in valor;
}
