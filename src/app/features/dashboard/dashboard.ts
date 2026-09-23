import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import type { PatientListItem } from '../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { rolesAlcanzan } from '../../core/navigation/navigation.types';
import { dataOf, empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Skeleton } from '../../shared/components/atoms/skeleton/skeleton';
import { StaggerList } from '../../shared/motion/stagger-list.directive';
import { Card } from '../../shared/components/molecules/card/card';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { TutorialTarget } from '../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import { SetupNotice } from '../admin/getting-started/setup-notice/setup-notice';
import { AccessTree } from './access-tree/access-tree';
import { AgendaDeHoy } from './agenda-de-hoy/agenda-de-hoy';
import { ConsultasResumen } from './consultas-resumen/consultas-resumen';
import { PatientHome } from './patient-home/patient-home';

/**
 * Los roles con los que se viene a trabajar, no a atenderse.
 *
 * Quien tiene alguno de estos ve el panel de la organización aunque además sea
 * paciente: entra a hacer su trabajo.
 */
const ROLES_DE_TRABAJO: readonly string[] = [
  'SUPERADMIN',
  'SECURITY_ADMIN',
  'SCHEDULING_ADMIN',
  'SCHEDULING_AGENT',
  'PRACTITIONER',
  'CLINICIAN',
];

/**
 * Panel de inicio de la aplicación autenticada.
 *
 * ## Qué era y por qué cambió (dos veces)
 *
 * Nació como pantalla de diagnóstico: dos tarjetas, una con los claims del
 * token y otra que pedía el directorio público «para comprobar de punta a punta
 * que hay API del otro lado». Después se le sumaron cuatro cifras —pacientes,
 * secciones habilitadas, organizaciones alcanzadas, estado de la identidad—.
 *
 * El 19/09/2026 el propietario mandó sacar todo eso del inicio de sesión del
 * médico, con el argumento que se sostiene solo: **ninguno de esos bloques
 * contesta la pregunta con la que alguien abre el panel a las siete de la
 * mañana.** «Tu cuenta» enumeraba los roles del propio token, el directorio
 * público contaba registros que no son de nadie que mire esta pantalla, y las
 * dos cifras que quedaban —cuántas secciones habilita la cuenta y cuántas
 * organizaciones alcanza— describen la aplicación, no el trabajo.
 *
 * Lo que quedó responde tres preguntas, en este orden:
 *
 * 1. **¿Qué toca hoy?** — `app-agenda-de-hoy`: la jornada de quien atiende, con
 *    su forma, lo que pasa ahora y salida a la agenda completa.
 * 2. **¿A dónde puedo ir?** — las secciones que los roles de la sesión
 *    habilitan, repartidas por zonas. Es la misma lista que arma el menú
 *    lateral, así que no puede desincronizarse.
 * 3. **¿Quién entró último?** — los últimos pacientes registrados, con el total
 *    de la organización en el propio encabezado. Sólo para quien administra.
 *
 * ## Por qué cada bloque decide solo si aparece
 *
 * El panel lo ven roles muy distintos. Un `PATIENT` no puede listar pacientes
 * —el backend responde 403— así que pedirlo sería provocar un error para
 * después esconderlo. Una cuenta administrativa no tiene perfil profesional y
 * por lo tanto no tiene jornada. Cada bloque se pide **sólo si la sesión lo
 * permite**, y el que no corresponde no deja hueco: la rejilla se cierra sola.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    AccessTree,
    AgendaDeHoy,
    Card,
    ConsultasResumen,
    Alert,
    AppButtonLink,
    PageHeader,
    RouterLink,
    Skeleton,
    StaggerList,
    // Faltaba de la lista aunque la plantilla lo usa en dos elementos: el
    // atributo `appTutorialTarget` se renderizaba como un atributo cualquiera,
    // la directiva no aplicaba, y el tutorial del panel no encontraba ni el
    // título ni la rejilla de accesos —se salteaba los pasos en silencio, que
    // es justo lo que la directiva existe para evitar—. `yarn lint` lo venía
    // reportando como import sin usar desde antes de este carril.
    TutorialTarget,
    ViewStateHost,
    PatientHome,
    SetupNotice,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfilesClient);
  private readonly navigation = inject(NavigationService);

  protected readonly roles = this.auth.roles;
  protected readonly activeTenantId = this.auth.activeTenantId;

  /** La organización activa por su nombre. */
  protected readonly tenantName = computed(() => {
    const id = this.activeTenantId();
    return id === null ? null : this.auth.tenantName(id);
  });

  /**
   * Todo lo que la sesión alcanza, sin filtrar por disponibilidad.
   *
   * Es lo que consume el árbol de accesos, que reparte y **muestra las dos
   * cosas**: lo que se puede abrir y lo que está en construcción, cada una con
   * su forma. Dárselo ya separado lo obligaría a volver a juntarlo para
   * ordenarlo por zona.
   */
  protected readonly seccionesVisibles = computed(() => this.navigation.visibleSections());

  /**
   * Si esta sesión atiende pacientes, que es lo que decide si hay jornada.
   *
   * Se pregunta por el **perfil profesional** y no por el rol: es el mismo dato
   * con el que se busca el recurso de agenda (`resourceRefId`), así que una
   * cuenta que pase esta puerta tiene con qué buscar su día. Preguntar por
   * `PRACTITIONER` dibujaría la franja para una cuenta con el rol y sin perfil,
   * que se quedaría siempre en el vacío.
   */
  protected readonly atiendePacientes = computed(() => this.auth.practitionerProfileId() !== null);

  /** El subtítulo dice lo que la pantalla trae, y eso depende de quién entró. */
  protected readonly subtituloDelPanel = computed(() =>
    this.atiendePacientes()
      ? 'Tu jornada de hoy y todo lo que tu cuenta habilita.'
      : 'Todo lo que tu cuenta habilita en esta organización.',
  );

  /**
   * Sólo quien administra puede listar pacientes; al resto la API le responde 403.
   *
   * Por `rolesAlcanzan` y no por un `includes` propio: `SUPERADMIN` es comodín
   * en el guard del backend y en el menú, así que con la lista literal el panel
   * le escondía el bloque de pacientes a alguien a quien el menú **sí** le
   * ofrecía la sección. Dos lecturas de la misma regla terminan diciendo cosas
   * distintas; ésta es la única.
   */
  protected readonly puedeVerPacientes = computed(() =>
    rolesAlcanzan(['SECURITY_ADMIN'], this.roles()),
  );

  /** Quien puede aprovisionar organizaciones: es de quien es la puesta en marcha. */
  protected readonly puedeCrearOrganizacion = computed(() =>
    rolesAlcanzan(['SUPERADMIN'], this.roles()),
  );

  /**
   * Si quien entra viene a atenderse, y no a trabajar acá.
   *
   * Se pregunta por los roles de trabajo y no sólo por `PATIENT`: quien atiende
   * y además es paciente del sistema entra a trabajar, y su panel es el de
   * siempre. Al revés dejaría a un profesional sin su tablero el día que alguien
   * le cargue una ficha de paciente.
   */
  protected readonly esPaciente = computed(() => {
    const roles = this.roles();
    if (!roles.includes('PATIENT')) return false;
    return !ROLES_DE_TRABAJO.some((rol) => roles.includes(rol));
  });

  /**
   * Cuánto le falta al profesional para completar su alta (TJ-1).
   *
   * `null` = no aplica: la sesión no es de quien atiende, o ya terminó, o la
   * lectura falló. En los tres casos el aviso no se muestra — un banner que
   * aparece por un error de red sería peor que no avisar.
   */
  protected readonly altaPendiente = signal<{
    /** Cuántas etapas cumplió. */
    readonly cumplidas: number;
    /** De cuántas. */
    readonly total: number;
  } | null>(null);

  protected readonly pacientes = signal<ViewState<PatientPageResumen>>(loading());

  /** El total de pacientes de la organización, o `null` si todavía no se sabe. */
  protected readonly totalPacientes = computed<number | null>(() => {
    const datos = dataOf(this.pacientes());
    return datos === null ? null : datos.total;
  });

  protected readonly ultimosPacientes = computed<readonly PatientListItem[]>(() => {
    const datos = dataOf(this.pacientes());
    return datos === null ? [] : datos.ultimos;
  });

  constructor() {
    this.cargarAltaPendiente();
    if (this.puedeVerPacientes()) {
      this.loadPacientes();
    }
  }

  /**
   * Pregunta por el alta sólo si la sesión es de quien atiende.
   *
   * Se llama desde el constructor y no desde un `effect` porque es una lectura
   * de arranque, no una reacción: los roles no cambian mientras la pantalla
   * está abierta.
   */
  private cargarAltaPendiente(): void {
    if (!this.roles().includes('PRACTITIONER')) return;

    this.profiles.getOwnOnboarding().subscribe({
      next: (avance) => {
        if (avance.firstIncomplete === 'done') return;
        this.altaPendiente.set({
          cumplidas: avance.steps.filter((paso) => paso.complete).length,
          total: avance.steps.length,
        });
      },
      // Un fallo acá no muestra nada. El alta se puede completar igual desde el
      // perfil; inventar un aviso porque una lectura secundaria falló sería
      // decirle a alguien que le falta algo sin saberlo.
      error: () => this.altaPendiente.set(null),
    });
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
      error: (error: unknown) => this.pacientes.set(errorToViewState<PatientPageResumen>(error)),
    });
  }
}

/** Lo que el panel necesita del listado: el total y las últimas filas. */
interface PatientPageResumen {
  readonly total: number;
  readonly ultimos: readonly PatientListItem[];
}
