import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import { OpsLivenessClient } from '../../../core/data-access/admin-portal/ops-liveness.client';
import type { InstanceLiveness } from '../../../core/data-access/admin-portal/ops-liveness.types';
import { OpsToolsClient } from '../../../core/data-access/admin-portal/ops-tools.client';
import type { OpsTools } from '../../../core/data-access/admin-portal/ops-tools.types';
import { OpsTrafficClient } from '../../../core/data-access/admin-portal/ops-traffic.client';
import type { TrafficOverview } from '../../../core/data-access/admin-portal/ops-traffic.types';
import { OpsConsoleClient, QaLabClient } from '../../../core/data-access/admin-portal/platform.client';
import type {
  BackupPolicy,
  Deployment,
  Incident,
  QaDefect,
  QaRunSummary,
  Readiness,
} from '../../../core/data-access/admin-portal/platform.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { entero, porcentaje } from '../../admin/platform/platform-labels';
import { ESTADO_GENERAL } from '../../admin/instances/instances-labels';

/** Un destino de las dos puertas de entrada. */
interface Destino {
  readonly label: string;
  readonly route: string;
}

interface Area {
  readonly titulo: string;
  readonly descripcion: string;
  readonly destinos: readonly Destino[];
}

interface Portal {
  readonly id: 'administrativo' | 'observabilidad';
  readonly titulo: string;
  /** Pantalla a la que lleva el título de la puerta, si tiene portada propia. */
  readonly ruta?: string;
  readonly descripcion: string;
  readonly areas: readonly Area[];
}

/**
 * Lo que dejan las pruebas: corridas y defectos, que se piden juntos y se
 * muestran juntos.
 */
interface Pruebas {
  readonly corridas: readonly QaRunSummary[];
  readonly defectos: readonly QaDefect[];
}

/**
 * Las dos puertas del perfil de gestión. Cada área lista sólo los destinos que
 * la sesión puede abrir (se filtra contra el registro de secciones): ofrecer un
 * enlace que termina en 403 no es una puerta, es una trampa. La autoridad sigue
 * siendo la API.
 */
const PORTALES: readonly Portal[] = [
  {
    id: 'administrativo',
    titulo: 'Portal administrativo',
    descripcion: 'Quién entra, qué datos existen y bajo qué reglas: personas, catálogos y gobierno de la información.',
    areas: [
      {
        titulo: 'Personas y accesos',
        descripcion: 'Altas, organizaciones, admisiones y accesos delegados.',
        destinos: [
          { label: 'Usuarios', route: '/administration/users' },
          { label: 'Pacientes', route: '/administration/patients' },
          { label: 'Organizaciones', route: '/administration/organizations' },
          { label: 'Admisiones', route: '/administration/admissions' },
          { label: 'Acceso delegado', route: '/administration/delegated-access' },
          { label: 'Verificación de identidad', route: '/administration/identity-assurance' },
        ],
      },
      {
        titulo: 'Catálogos',
        descripcion: 'Lo que se clasifica y se cataloga para todos los tipos de usuario.',
        destinos: [
          { label: 'Catálogo de servicios', route: '/administration/services-catalog' },
          { label: 'Terminología', route: '/administration/terminology' },
          { label: 'Formularios clínicos', route: '/administration/clinical-forms' },
          { label: 'Paquetes de contenido', route: '/administration/content-packs' },
        ],
      },
      {
        titulo: 'Gobierno de los datos',
        descripcion: 'Qué tablas hay, por qué existen y quién responde por ellas.',
        destinos: [
          { label: 'Catálogo de datos', route: '/superadmin/data-catalog' },
          { label: 'Portal de inventario', route: '/superadmin/portal' },
          { label: 'Moderación', route: '/administration/moderation' },
        ],
      },
    ],
  },
  {
    id: 'observabilidad',
    titulo: 'Observabilidad y gobierno',
    ruta: '/superadmin/observability',
    descripcion: 'Cuánto se usa cada herramienta, cuánto dinero mueve y dónde falla.',
    areas: [
      {
        titulo: 'Uso y rendimiento',
        descripcion: 'Tráfico, errores, latencia y comportamiento en pantalla.',
        destinos: [
          { label: 'Observabilidad', route: '/superadmin/observability' },
          { label: 'Instancias y herramientas', route: '/superadmin/instances' },
          { label: 'Analítica web', route: '/superadmin/web-analytics' },
          { label: 'Operación', route: '/superadmin/operations' },
        ],
      },
      {
        titulo: 'Dinero',
        descripcion: 'Lo que se factura y lo que se contabiliza.',
        destinos: [
          { label: 'Facturación', route: '/billing' },
          { label: 'Contabilidad', route: '/administration/accounting' },
        ],
      },
      {
        titulo: 'Calidad',
        descripcion: 'Pruebas, flujos y su evidencia.',
        destinos: [
          { label: 'Orquestación de pruebas', route: '/superadmin/qa-lab' },
          { label: 'Catálogo de flujos', route: '/superadmin/flows' },
        ],
      },
    ],
  },
];

/**
 * La entrada del perfil de gestión: dos puertas —el portal administrativo y el
 * de observabilidad y gobierno— y, debajo, el estado de toda la plataforma: la API, su
 * preparación para producción, los incidentes, los despliegues, las pruebas y
 * los respaldos. Cada bloque se carga por su cuenta: que uno falle o no tenga
 * permiso no apaga a los demás.
 *
 * Sigue el orden del inicio de Atlas (cómo está la plataforma ahora, y desde
 * ahí a cada módulo) y la forma de las portadas del repositorio (`cover.css`).
 */
@Component({
  selector: 'app-platform-home',
  imports: [DatePipe, RouterLink, AppButton, Link, Card, PageHeader, ViewStateHost],
  templateUrl: './platform-home.html',
  styleUrls: ['../../cover.css', './platform-home.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformHome {
  private readonly trafficClient = inject(OpsTrafficClient);
  private readonly livenessClient = inject(OpsLivenessClient);
  private readonly toolsClient = inject(OpsToolsClient);
  private readonly ops = inject(OpsConsoleClient);
  private readonly qa = inject(QaLabClient);
  private readonly navigation = inject(NavigationService);

  protected readonly entero = entero;
  protected readonly porcentaje = porcentaje;

  protected readonly trafico = signal<ViewState<TrafficOverview>>(loading());
  protected readonly sonda = signal<ViewState<InstanceLiveness>>(loading());
  protected readonly herramientas = signal<ViewState<OpsTools>>(loading());
  protected readonly preparacion = signal<ViewState<Readiness>>(loading());
  protected readonly incidentes = signal<ViewState<readonly Incident[]>>(loading());
  protected readonly despliegues = signal<ViewState<readonly Deployment[]>>(loading());
  protected readonly pruebas = signal<ViewState<Pruebas>>(loading());
  protected readonly respaldos = signal<ViewState<readonly BackupPolicy[]>>(loading());

  /** Sólo los destinos que la sesión puede abrir; un área sin destinos no se dibuja. */
  protected readonly portales = computed<readonly Portal[]>(() => {
    const abiertas = new Set(this.navigation.visibleSections().map((s) => `/${s.path}`));
    return PORTALES.map(({ ruta, ...portal }) => ({
      ...portal,
      // El título sólo es enlace si la sesión puede abrir esa pantalla.
      ...(ruta !== undefined && abiertas.has(ruta) ? { ruta } : {}),
      areas: portal.areas
        .map((area) => ({ ...area, destinos: area.destinos.filter((d) => abiertas.has(d.route)) }))
        .filter((area) => area.destinos.length > 0),
    })).filter((portal) => portal.areas.length > 0);
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    const ahora = new Date();
    this.cargarEn(this.trafico, this.trafficClient.traffic({ to: ahora.toISOString(), interval: 'hour' }));
    this.cargarEn(this.sonda, this.livenessClient.liveness());
    this.cargarEn(this.herramientas, this.toolsClient.tools());
    this.cargarEn(this.preparacion, this.ops.readiness());
    this.cargarEn(this.incidentes, this.ops.incidents(true));
    this.cargarEn(this.despliegues, this.ops.deployments());
    this.cargarEn(this.respaldos, this.ops.backups());
    this.pruebas.set(loading());
    this.qa.runs().subscribe({
      next: (corridas) =>
        this.qa.defects().subscribe({
          next: (defectos) => this.pruebas.set(ready({ corridas, defectos })),
          error: (e: unknown) => this.pruebas.set(errorToViewState<Pruebas>(e)),
        }),
      error: (e: unknown) => this.pruebas.set(errorToViewState<Pruebas>(e)),
    });
  }

  /** Despliegues vigentes, uno por componente: lo que está corriendo ahora. */
  protected vigentes(todos: readonly Deployment[]): readonly Deployment[] {
    return todos.filter((d) => d.isCurrent);
  }

  protected milis(valor: number | null): string {
    return valor === null ? '—' : `${valor.toLocaleString('es-BO', { maximumFractionDigits: 0 })} ms`;
  }

  protected restauracionesFallidas(respaldos: readonly BackupPolicy[]): number {
    return respaldos.filter((r) => r.lastRestoreTest?.outcome === 'FAIL').length;
  }

  protected sinRestauracion(respaldos: readonly BackupPolicy[]): number {
    return respaldos.filter((r) => r.lastRestoreTest === null).length;
  }

  protected defectosAbiertos(defectos: readonly QaDefect[]): number {
    return defectos.filter((d) => d.status !== 'CLOSED' && d.status !== 'RESOLVED').length;
  }

  /** El veredicto de la sonda en palabras y con su tono; nunca sólo el color. */
  protected etiquetaSonda(overall: InstanceLiveness['overall']): string {
    return ESTADO_GENERAL[overall].texto;
  }

  protected etiquetaPreparacion(estado: Readiness['status']): string {
    return estado === 'READY' ? 'Lista' : estado === 'NOT_READY' ? 'No lista' : 'Bloqueada por datos desconocidos';
  }

  private cargarEn<T>(destino: WritableSignal<ViewState<T>>, fuente: Observable<T>): void {
    destino.set(loading());
    fuente.subscribe({
      next: (datos) => destino.set(ready(datos)),
      error: (e: unknown) => destino.set(errorToViewState<T>(e)),
    });
  }
}
