import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { IdentityClient } from '../../core/data-access/identity/identity.client';
import type { VerificationCase } from '../../core/data-access/identity/identity.types';
import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import type { PatientListItem } from '../../core/data-access/profiles/profiles.types';
import {
  PublicClient,
  type PublicProjection,
} from '../../core/data-access/public/public.client';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import type { AppSection } from '../../core/navigation/navigation.types';
import { dataOf, empty, loading, ready, stale } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../shared/components/atoms/skeleton/skeleton';
import { StaggerList } from '../../shared/motion/stagger-list.directive';
import { Card } from '../../shared/components/molecules/card/card';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  CaseStatusCatalog,
  toCaseStatusPresentation,
} from '../identity-verification/case-status';
import { TutorialTarget } from '../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';

/**
 * Panel de inicio de la aplicación autenticada.
 *
 * ## Qué era y por qué cambió
 *
 * Era una pantalla de diagnóstico: dos tarjetas, una con los claims del token y
 * otra que pedía el directorio público «para comprobar de punta a punta que hay
 * API del otro lado». Cumplía su función cuando lo único que había era el
 * armazón, y para quien entra a trabajar era media pantalla en blanco que no le
 * decía qué hacer ni dónde estaba nada.
 *
 * Ahora responde las cuatro preguntas con las que alguien abre un panel:
 *
 * 1. **¿Cuánto hay?** — el conteo real de pacientes de la organización, que sale
 *    del `count` del listado y no de contar la página que se trajo.
 * 2. **¿A dónde puedo ir?** — las secciones que los roles de la sesión habilitan,
 *    cada una con el resumen que ya declara el registro de navegación. Es la
 *    misma lista que arma el menú lateral, así que no puede desincronizarse.
 * 3. **¿Qué pasó último?** — los últimos pacientes registrados, con enlace a su
 *    ficha.
 * 4. **¿Está todo bien?** — el estado de la identidad propia y el del directorio,
 *    que era lo único que había antes y ahora ocupa el lugar que le corresponde.
 *
 * ## Por qué cada bloque decide solo si aparece
 *
 * El panel lo ven roles muy distintos. Un `PATIENT` no puede listar pacientes
 * —el backend responde 403— así que pedirlo sería provocar un error para
 * después esconderlo. Cada bloque se pide **sólo si la sesión lo permite**, y el
 * que no corresponde no deja hueco: la rejilla se cierra sola.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    Badge,
    Card,
    PageHeader,
    RouterLink,
    Skeleton,
    StaggerList,
    StatusSeal,
    ViewStateHost,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly publicClient = inject(PublicClient);
  private readonly profiles = inject(ProfilesClient);
  // El panel muestra el sello del trámite de identidad: necesita los estados
  // resueltos contra terminología.
  private readonly estadosDeCaso = inject(CaseStatusCatalog);
  private readonly identity = inject(IdentityClient);
  private readonly navigation = inject(NavigationService);

  protected readonly userId = this.auth.userId;
  protected readonly roles = this.auth.roles;
  protected readonly activeTenantId = this.auth.activeTenantId;
  protected readonly displayName = this.auth.displayName;

  /** La organización activa por su nombre; el identificador queda para reportar. */
  protected readonly tenantName = computed(() => {
    const id = this.activeTenantId();
    return id === null ? null : this.auth.tenantName(id);
  });

  /** Cuántas organizaciones alcanza esta sesión. */
  protected readonly tenantCount = computed(() => this.auth.tenants().length);

  /**
   * Las secciones que la sesión puede abrir, separadas por si ya tienen pantalla.
   *
   * Salen de `NavigationService`, que es el mismo origen del menú lateral: una
   * sección nueva aparece acá sin tocar este archivo, y una que se apaga
   * desaparece de los dos lados a la vez.
   */
  private readonly secciones = computed(() => this.navigation.visibleSections());

  protected readonly seccionesDisponibles = computed<readonly AppSection[]>(() =>
    this.secciones().filter((s) => s.availability === 'disponible'),
  );

  protected readonly seccionesPlanificadas = computed<readonly AppSection[]>(() =>
    this.secciones().filter((s) => s.availability === 'planificada'),
  );

  /** Sólo quien administra puede listar pacientes; al resto la API le responde 403. */
  protected readonly puedeVerPacientes = computed(() => this.roles().includes('SECURITY_ADMIN'));

  protected readonly pacientes = signal<ViewState<PatientPageResumen>>(loading());
  protected readonly directory = signal<ViewState<PublicProjection>>(loading());

  /** Los casos de verificación propios. Sin estado de vista: es un adorno, no una pantalla. */
  protected readonly casos = signal<readonly VerificationCase[]>([]);

  /** El caso más reciente, que es el que responde «¿en qué quedó mi trámite?». */
  protected readonly casoVigente = computed<VerificationCase | null>(() => {
    const todos = this.casos();
    return todos.length === 0 ? null : todos[todos.length - 1];
  });

  protected readonly selloDeIdentidad = computed(() => {
    const caso = this.casoVigente();
    return caso === null ? null : toCaseStatusPresentation(caso.status);
  });

  /** El total de pacientes de la organización, o `null` si todavía no se sabe. */
  protected readonly totalPacientes = computed<number | null>(() => {
    const datos = dataOf(this.pacientes());
    return datos === null ? null : datos.total;
  });

  protected readonly ultimosPacientes = computed<readonly PatientListItem[]>(() => {
    const datos = dataOf(this.pacientes());
    return datos === null ? [] : datos.ultimos;
  });

  protected readonly recordCount = computed<number | null>(() => {
    const data = dataOf(this.directory());
    return data === null ? null : data.records.length;
  });

  constructor() {
    this.loadDirectory();
    this.loadCasos();
    if (this.puedeVerPacientes()) {
      this.loadPacientes();
    }
  }

  /** La ruta de la ficha de un paciente. Se arma acá para no repetirla en la plantilla. */
  protected rutaDeLaFicha(profileId: string): string {
    return `/administration/patients/${profileId}`;
  }

  /**
   * Pide el listado acotado a las cinco últimas.
   *
   * El `limit` bajo es deliberado: lo que se muestra son cinco filas, y traerse
   * la página entera para descartarla sería gastar ancho de banda en datos de
   * paciente que nadie va a ver. El total no se pierde por eso — viaja en
   * `count`, que el backend calcula sobre la consulta completa.
   */
  protected loadPacientes(): void {
    this.pacientes.set(loading());

    this.profiles.searchPatients({ limit: 5 }).subscribe({
      next: (page) => {
        this.pacientes.set(
          page.count === 0
            ? empty(
                { label: 'Registrar el primero', route: '/administration/patients/new' },
                'Todavía no hay pacientes registrados en esta organización.',
              )
            : ready({ total: page.count, ultimos: page.items }),
        );
      },
      error: (error: unknown) =>
        this.pacientes.set(errorToViewState<PatientPageResumen>(error)),
    });
  }

  /**
   * Pide los casos de verificación propios.
   *
   * El fallo se traga a propósito: es información de contexto, y un panel que se
   * rompe entero porque el módulo de identidad no contestó sería peor que un
   * panel sin ese dato.
   */
  protected loadCasos(): void {
    this.identity.listVerificationCases().subscribe({
      next: (casos) => this.casos.set(casos),
      error: () => this.casos.set([]),
    });
  }

  protected loadDirectory(): void {
    this.directory.set(loading());

    this.publicClient.searchDirectory().subscribe({
      next: (projection) => this.directory.set(toState(projection)),
      error: (error: unknown) => this.directory.set(errorToViewState<PublicProjection>(error)),
    });
  }
}

/** Lo que el panel necesita del listado: el total y las últimas filas. */
interface PatientPageResumen {
  readonly total: number;
  readonly ultimos: readonly PatientListItem[];
}

/**
 * De la proyección al estado.
 *
 * El orden importa: **vacío gana sobre atrasado**. Una proyección sin registros
 * no tiene nada que mostrar, así que anunciar su antigüedad sería decirle a la
 * persona cuán viejo es un dato que no está viendo.
 */
function toState(projection: PublicProjection): ViewState<PublicProjection> {
  if (projection.records.length === 0) {
    return empty(
      { label: 'Ver el sistema de diseño', route: '/design-system' },
      'El directorio público todavía no tiene registros publicados.',
    );
  }

  return projection.refreshedAt === null
    ? ready(projection)
    : stale(projection, projection.refreshedAt);
}
