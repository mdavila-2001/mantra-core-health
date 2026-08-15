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

import { DiagnosticUnitsAdminClient } from '../../../core/data-access/diagnostic-units/diagnostic-units-admin.client';
import type {
  DiagnosticUnitAdminAccreditation,
  DiagnosticUnitAdminDetail,
  DiagnosticUnitAdminEquipment,
  DiagnosticUnitAdminItem,
  DiagnosticUnitAdminSite,
  DiagnosticUnitAdminStaff,
  DiagnosticUnitAdminStudy,
} from '../../../core/data-access/diagnostic-units/diagnostic-units-admin.types';
import type { DiagnosticConcept } from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
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

/** Variante del badge por **código** de concepto; la etiqueta es presentación. */
const VARIANTE_POR_CODIGO: Readonly<Record<string, BadgeVariant>> = {
  DU_UNIT_ACTIVE: 'success',
  DU_UNIT_RETIRED: 'secondary',
  DU_VERIF_VERIFIED: 'success',
  DU_VERIF_PENDING: 'warning',
  DU_SITE_ACTIVE: 'success',
  DU_OFFER_ACTIVE: 'success',
  DU_OFFER_DRAFT: 'warning',
  DU_OFFER_RETIRED: 'secondary',
  DU_EQ_OPERATIONAL: 'success',
  DU_EQ_MAINTENANCE: 'warning',
  DU_PRICE_ACTIVE: 'success',
  DU_PRICE_SUPERSEDED: 'secondary',
  DU_PRICE_RETIRED: 'secondary',
  DU_ASSIGN_ACTIVE: 'success',
};

/** Días de aviso previo a un vencimiento o a una calibración. */
const AVISO_DIAS = 30;

/**
 * Consola del **administrador de organización de laboratorio médico** —
 * CARRIL 16.
 *
 * ## Qué resuelve, y por qué no alcanzaba el directorio
 *
 * `/laboratory-directory` es la vitrina: la usa el paciente del carril 11 para
 * elegir dónde hacerse un estudio, y por eso muestra **sólo** unidades activas
 * y verificadas, ofertas activas y precios de cronogramas públicos. Esa es
 * exactamente la información que un administrador no puede usar: la unidad que
 * todavía no publicó no aparece en ninguna pantalla, la oferta que retiró no se
 * puede reactivar porque no se puede encontrar, y el convenio con una
 * aseguradora no existe. Esta consola lee el mismo dominio **sin** esos
 * filtros, y agrega dos cosas que la vitrina no debe tener: el personal con sus
 * permisos de validación y firma, y las alertas de vencimiento y calibración.
 *
 * ## Maestro-detalle en una pantalla
 *
 * Un laboratorio no tiene decenas de unidades: tiene una o unas pocas. Una
 * pantalla de listado y otra de ficha obligarían a navegar de ida y vuelta para
 * comparar dos sedes del mismo tenant. La lista queda arriba como selector y la
 * ficha debajo, que es la misma forma que usa la consola de organización médica
 * del carril 13.
 */
@Component({
  selector: 'app-medical-laboratory',
  imports: [AppButton, Badge, DataTable, PageHeader, Tab, Tabs],
  templateUrl: './medical-laboratory.html',
  styleUrl: './medical-laboratory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalLaboratory {
  private readonly client = inject(DiagnosticUnitsAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaSede =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminSite }>>('celdaSede');
  private readonly celdaCapacidadesSede =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminSite }>
    >('celdaCapacidadesSede');
  private readonly celdaEstadoSede =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminSite }>>('celdaEstadoSede');

  private readonly celdaEquipo =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminEquipment }>
    >('celdaEquipo');
  private readonly celdaSedeDelEquipo =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminEquipment }>
    >('celdaSedeDelEquipo');
  private readonly celdaCalibracion =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminEquipment }>
    >('celdaCalibracion');
  private readonly celdaEstadoEquipo =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminEquipment }>
    >('celdaEstadoEquipo');

  private readonly celdaEstudio =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminStudy }>>('celdaEstudio');
  private readonly celdaPreparacion =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminStudy }>>('celdaPreparacion');
  private readonly celdaPrecios =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminStudy }>>('celdaPrecios');
  private readonly celdaEstadoEstudio =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminStudy }>
    >('celdaEstadoEstudio');

  private readonly celdaIntegrante =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminStaff }>>('celdaIntegrante');
  private readonly celdaPermisos =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminStaff }>>('celdaPermisos');
  private readonly celdaVigenciaIntegrante =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminStaff }>
    >('celdaVigenciaIntegrante');
  private readonly celdaEstadoIntegrante =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminStaff }>
    >('celdaEstadoIntegrante');

  private readonly celdaAcreditacion =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminAccreditation }>
    >('celdaAcreditacion');
  private readonly celdaVigenciaAcreditacion =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminAccreditation }>
    >('celdaVigenciaAcreditacion');
  private readonly celdaEstadoAcreditacion =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminAccreditation }>
    >('celdaEstadoAcreditacion');

  /** Las unidades del tenant, publicadas o no. */
  protected readonly unidades = signal<ViewState<readonly DiagnosticUnitAdminItem[]>>(loading());

  /** La unidad elegida. Vacío mientras el listado no resolvió. */
  protected readonly unidadElegida = signal('');

  /** La ficha administrativa de la unidad elegida. */
  protected readonly ficha = signal<ViewState<DiagnosticUnitAdminDetail>>(loading());

  /** La cabecera, cuando la ficha cargó. `null` en cualquier otro estado. */
  protected readonly laboratorio = computed(() => {
    const estado = this.ficha();
    return estado.status === 'ready' ? estado.data : null;
  });

  /** Nombre de cada sede por su id: las demás pestañas devuelven `siteId` crudo. */
  private readonly nombreDeSede = computed<ReadonlyMap<string, string>>(() => {
    const estado = this.ficha();
    if (estado.status !== 'ready') return new Map();
    return new Map(estado.data.sites.map((sede) => [sede.id, sede.name]));
  });

  protected readonly sedes = computed(() =>
    this.listaDe(
      (datos) => datos.sites,
      { label: 'Registrar una sucursal' },
      'Una sucursal es cada punto donde el laboratorio toma muestras o procesa estudios. Sin al menos una no hay dónde reservar ni dónde instalar equipos.',
    ),
  );

  protected readonly equipamiento = computed(() =>
    this.listaDe(
      (datos) => datos.equipment,
      { label: 'Registrar un equipo' },
      'Analizadores y equipos de imagen, con su ventana de calibración. Registrarlos es lo que permite avisar antes de que una calibración se venza.',
    ),
  );

  protected readonly estudios = computed(() =>
    this.listaDe(
      (datos) => datos.studies,
      { label: 'Publicar un estudio' },
      'El catálogo de análisis con su preparación, su tiempo de entrega y sus precios. Mientras esté vacío, no hay nada que un paciente pueda reservar.',
    ),
  );

  protected readonly personal = computed(() =>
    this.listaDe(
      (datos) => datos.staff,
      { label: 'Vincular a un profesional' },
      'Bioquímicos, patólogos y técnicos, con quién puede validar resultados y quién puede firmar informes. Sin nadie con permiso de validación, ningún resultado se puede dar por definitivo.',
    ),
  );

  protected readonly acreditaciones = computed(() =>
    this.listaDe(
      (datos) => datos.accreditations,
      { label: 'Cargar una acreditación' },
      'Licencias, registros sanitarios y acreditaciones con su vencimiento. Es el respaldo legal del laboratorio.',
    ),
  );

  /** Acreditaciones vencidas o por vencer dentro del mes. */
  protected readonly acreditacionesPorVencer = computed(() => {
    const detalle = this.laboratorio();
    if (detalle === null) return [];
    return detalle.accreditations.filter(
      (doc) => doc.daysToExpiry !== null && doc.daysToExpiry <= AVISO_DIAS,
    );
  });

  /** Equipos con la calibración vencida o a punto de vencer. */
  protected readonly equiposPorCalibrar = computed(() => {
    const detalle = this.laboratorio();
    if (detalle === null) return [];
    return detalle.equipment.filter(
      (item) => item.daysToCalibration !== null && item.daysToCalibration <= AVISO_DIAS,
    );
  });

  /** Personal habilitado para validar resultados: el permiso crítico del carril. */
  protected readonly validadores = computed(() => {
    const detalle = this.laboratorio();
    if (detalle === null) return [];
    return detalle.staff.filter((integrante) => integrante.mayValidateResults === true);
  });

  protected readonly columnasDeSede = computed<readonly ColumnDef<DiagnosticUnitAdminSite>[]>(
    () => [
      { key: 'name', header: 'Sucursal', priority: 1, cell: this.celdaSede() },
      { key: 'code', header: 'Código', priority: 1 },
      {
        key: 'sampleCollectionAvailable',
        header: 'Capacidades',
        priority: 2,
        cell: this.celdaCapacidadesSede(),
      },
      { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoSede() },
    ],
  );

  protected readonly columnasDeEquipo = computed<
    readonly ColumnDef<DiagnosticUnitAdminEquipment>[]
  >(() => [
    { key: 'type', header: 'Equipo', priority: 1, cell: this.celdaEquipo() },
    { key: 'siteId', header: 'Sucursal', priority: 2, cell: this.celdaSedeDelEquipo() },
    { key: 'daysToCalibration', header: 'Calibración', priority: 1, cell: this.celdaCalibracion() },
    { key: 'operationalStatus', header: 'Estado', priority: 1, cell: this.celdaEstadoEquipo() },
  ]);

  protected readonly columnasDeEstudio = computed<
    readonly ColumnDef<DiagnosticUnitAdminStudy>[]
  >(() => [
    { key: 'name', header: 'Estudio', priority: 1, cell: this.celdaEstudio() },
    { key: 'preparationInstructions', header: 'Preparación', priority: 2, cell: this.celdaPreparacion() },
    { key: 'prices', header: 'Precios', priority: 2, cell: this.celdaPrecios() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoEstudio() },
  ]);

  protected readonly columnasDePersonal = computed<
    readonly ColumnDef<DiagnosticUnitAdminStaff>[]
  >(() => [
    { key: 'practitionerName', header: 'Profesional', priority: 1, cell: this.celdaIntegrante() },
    { key: 'mayValidateResults', header: 'Permisos', priority: 1, cell: this.celdaPermisos() },
    { key: 'validFrom', header: 'Vigencia', priority: 2, cell: this.celdaVigenciaIntegrante() },
    { key: 'status', header: 'Estado', priority: 2, cell: this.celdaEstadoIntegrante() },
  ]);

  protected readonly columnasDeAcreditacion = computed<
    readonly ColumnDef<DiagnosticUnitAdminAccreditation>[]
  >(() => [
    { key: 'type', header: 'Acreditación', priority: 1, cell: this.celdaAcreditacion() },
    { key: 'validTo', header: 'Vigencia', priority: 1, cell: this.celdaVigenciaAcreditacion() },
    {
      key: 'verificationStatus',
      header: 'Verificación',
      priority: 2,
      cell: this.celdaEstadoAcreditacion(),
    },
  ]);

  protected readonly porId = (row: { readonly id: string }): string => row.id;

  constructor() {
    this.cargarUnidades();
  }

  protected elegirUnidad(unitId: string): void {
    if (unitId === '' || unitId === this.unidadElegida()) return;
    this.unidadElegida.set(unitId);
    this.cargarFicha(unitId);
  }

  protected recargar(): void {
    const elegida = this.unidadElegida();
    if (elegida === '') {
      this.cargarUnidades();
      return;
    }
    this.cargarFicha(elegida);
  }

  protected etiquetaDe(concepto: DiagnosticConcept | null | undefined): string {
    return concepto?.display ?? '—';
  }

  protected varianteDe(concepto: DiagnosticConcept | null | undefined): BadgeVariant {
    return (concepto && VARIANTE_POR_CODIGO[concepto.code]) ?? 'info';
  }

  protected sedeDe(siteId: string | null): string | null {
    return siteId === null ? null : (this.nombreDeSede().get(siteId) ?? null);
  }

  /**
   * Cómo se dice un plazo en días.
   *
   * En palabras y no en la cifra cruda: «-14» obliga a interpretar un signo, y
   * quien lee el aviso necesita saber si tiene que actuar hoy.
   */
  protected plazoEnPalabras(dias: number | null, vencidoLabel = 'vencido'): string {
    if (dias === null) return 'sin fecha declarada';
    if (dias < 0) return `${vencidoLabel} hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
    if (dias === 0) return 'vence hoy';
    return `en ${dias} día${dias === 1 ? '' : 's'}`;
  }

  protected varianteDePlazo(dias: number | null): BadgeVariant {
    if (dias === null) return 'info';
    if (dias < 0) return 'error';
    if (dias <= AVISO_DIAS) return 'warning';
    return 'success';
  }

  private cargarUnidades(): void {
    this.unidades.set(loading());
    this.client
      .list()
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((resultado) => {
        if (esFallo(resultado)) {
          this.unidades.set(
            errorToViewState<readonly DiagnosticUnitAdminItem[]>(resultado.error),
          );
          this.ficha.set(errorToViewState<DiagnosticUnitAdminDetail>(resultado.error));
          return;
        }

        if (resultado.items.length === 0) {
          const vacio = empty(
            { label: 'Dar de alta un laboratorio' },
            'Este tenant todavía no tiene ninguna unidad de laboratorio o imagen dada de alta.',
          );
          this.unidades.set(vacio);
          this.ficha.set(vacio);
          return;
        }

        this.unidades.set(ready(resultado.items));
        const primera = resultado.items[0];
        this.unidadElegida.set(primera.id);
        this.cargarFicha(primera.id);
      });
  }

  private cargarFicha(unitId: string): void {
    this.ficha.set(loading());
    this.client
      .getById(unitId)
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((resultado) => {
        this.ficha.set(
          esFallo(resultado)
            ? errorToViewState<DiagnosticUnitAdminDetail>(resultado.error)
            : ready(resultado),
        );
      });
  }

  /**
   * El estado de una de las cinco listas.
   *
   * Todas salen de la misma respuesta y comparten carga y error: no tiene
   * sentido que una pestaña diga «cargando» mientras otra ya falló. Lo propio
   * de cada una es el vacío, que significa algo distinto en cada pestaña.
   */
  private listaDe<T>(
    seleccionar: (datos: DiagnosticUnitAdminDetail) => readonly T[],
    accion: ViewStateNextAction,
    mensaje: string,
  ): ViewState<readonly T[]> {
    const estado = this.ficha();
    if (!hasData(estado)) {
      return estado;
    }
    const filas = seleccionar(estado.data);
    if (filas.length === 0) {
      return empty(accion, mensaje);
    }
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
