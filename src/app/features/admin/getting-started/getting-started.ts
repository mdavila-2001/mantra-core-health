import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import type { TenantListItem } from '../../../core/data-access/directory/directory.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Stepper } from '../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../shared/components/molecules/stepper/stepper.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  ORGANIZATION_NEW_ROUTE,
  branchNewRoute,
  membershipNewRoute,
  organizationDetailRoute,
  organizationVerifyRoute,
} from '../organizations/organizations.routes';

/**
 * Cuántas organizaciones se miran para decidir si hay alguna real.
 *
 * Con dos alcanza: el tenant semilla más una. Pedir más sería traer un listado
 * entero para responder una pregunta de sí o no.
 */
const ORGANIZACIONES_A_MIRAR = 2;

/** Cuántas membresías se miran para saber si hay alguien además del dueño. */
const MEMBRESIAS_A_MIRAR = 2;

/**
 * El código del tenant que siembra el arranque.
 *
 * No es una organización real: existe para que el administrador tenga dónde
 * estar y para que las escrituras que arrancan sin contexto —archivos,
 * consentimientos— tengan a qué apuntar. Verlo en el listado no significa que
 * la plataforma esté puesta en marcha, así que el recorrido lo saltea.
 * Su valor vive en `SEED.tenantCode` del backend.
 */
const CODIGO_DEL_TENANT_SEMILLA = 'DEFAULT';

/** El código de concepto que marca una organización ya verificada. */
const CODIGO_VERIFICADA = 'TENANT_VERIFIED';

/**
 * El alta de cuentas, que es de dónde sale el dueño de la organización.
 *
 * La sección la declara `navigation.map.ts`; acá se escribe el destino porque
 * la etapa enlaza a ella cuando todavía no hay ninguna organización.
 */
const ALTA_DE_CUENTAS_ROUTE = '/administration/users';

/** Lo que hace falta para que una organización esté operando. */
type EtapaKey = 'organizacion' | 'verificacion' | 'sede' | 'plantilla' | 'operar';

/** Una etapa ya resuelta contra el estado real de la plataforma. */
export interface Etapa {
  readonly key: EtapaKey;
  readonly titulo: string;
  readonly explica: string;
  readonly accion: string;
  readonly ruta: string;
  /**
   * Un segundo camino, cuando la etapa necesita algo antes de poder cumplirse.
   *
   * Hoy sólo lo usa la primera: el alta de organización exige una cuenta dueña
   * que se elige de una lista, así que si no hay ninguna hay que ir a crearla
   * primero. Va aparte y no en lugar del principal para no esconder el camino
   * que la etapa realmente pide.
   */
  readonly accionSecundaria?: string;
  readonly rutaSecundaria?: string;
  readonly completa: boolean;
  /** Es la que hay que hacer ahora. */
  readonly actual: boolean;
}

/** Lo medido de la plataforma, antes de traducirlo a etapas. */
interface Avance {
  /** La primera organización real, si existe. */
  readonly organizacion?: TenantListItem;
  readonly verificada: boolean;
  readonly sedes: number;
  readonly membresias: number;
  /** Cuántas organizaciones reales hay; el recorrido mide **una**. */
  readonly organizaciones?: number;
}

/**
 * Puesta en marcha de la plataforma, paso por paso.
 *
 * ## Por qué no guarda en qué paso va
 *
 * Porque lo **deriva** de lo que ya existe: una organización que no es la
 * semilla, su estado de verificación, sus sedes y su plantilla. Volver a entrar
 * recalcula y aterriza donde corresponde, así que abandonar a mitad y retomar
 * mañana funciona sin que nadie persista un contador — y una plataforma que ya
 * estaba en marcha antes de que esta pantalla existiera no ve nada pendiente.
 *
 * Es el mismo criterio del alta del profesional, con una diferencia: allá el
 * servidor expone el avance ya calculado (`GET /profiles/me/onboarding`); acá no
 * hay endpoint agregado, así que las cuatro lecturas se combinan del lado del
 * navegador. Si algún día existe ese endpoint, esta pantalla se simplifica sin
 * cambiar lo que muestra.
 *
 * ## Por qué no bloquea la aplicación
 *
 * El administrador puede hacer otras cosas mientras tanto —cargar catálogos,
 * dar de alta cuentas—, y encerrarlo en un asistente sería impedírselo. La
 * presión es un aviso, no una puerta cerrada.
 *
 * ## Las etapas enlazan, no duplican
 *
 * Cada una manda a la pantalla que ya sabe hacer ese trabajo. Rehacer esos
 * formularios acá sería mantener dos veces las mismas validaciones.
 */
@Component({
  selector: 'app-getting-started',
  imports: [Alert, AppButtonLink, PageHeader, RouterLink, Stepper, ViewStateHost],
  templateUrl: './getting-started.html',
  styleUrl: './getting-started.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GettingStarted {
  private readonly directory = inject(DirectoryClient);
  private readonly terminology = inject(TerminologyClient);

  protected readonly estado = signal<ViewState<Avance>>(loading());

  /** Las cinco etapas traducidas, con cuál es la actual. */
  protected readonly etapas = computed<readonly Etapa[]>(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') {
      return [];
    }

    const avance = actual.data;
    const organizacion = avance.organizacion;
    const id = organizacion?.id;

    const cumplidas: Readonly<Record<EtapaKey, boolean>> = {
      organizacion: organizacion !== undefined,
      verificacion: avance.verificada,
      sede: avance.sedes > 0,
      plantilla: avance.membresias > 1,
      operar: false,
    };

    const definiciones: readonly Omit<Etapa, 'completa' | 'actual'>[] = [
      {
        key: 'organizacion',
        titulo: 'Creá la organización',
        explica:
          'La clínica, el hospital o el consultorio con el que vas a trabajar. ' +
          'El alta pide una cuenta que quede como dueña y se elige de una lista, ' +
          'así que si todavía no existe, creala antes desde Usuarios.',
        // Pendiente, el botón lleva al alta de la organización — que es lo que la
        // etapa pide. Cumplida, a la ficha de la que ya existe. Estuvieron
        // cruzados: sin organización mandaba a Usuarios y el recorrido no tenía
        // ningún enlace al alta, y con organización decía «Ver la organización»
        // y abría el formulario de alta.
        accion: organizacion === undefined ? 'Crear la organización' : 'Ver la organización',
        ruta:
          id === undefined ? ORGANIZATION_NEW_ROUTE : organizationDetailRoute(id),
        // El alta exige una cuenta dueña que se elige de una lista: si no hay
        // ninguna, la etapa se queda sin resolver y hay que ir a crearla. Va
        // como acción secundaria para no competir con el camino principal.
        ...(organizacion === undefined
          ? { accionSecundaria: 'Crear una cuenta', rutaSecundaria: ALTA_DE_CUENTAS_ROUTE }
          : {}),
      },
      {
        key: 'verificacion',
        titulo: 'Verificala',
        explica:
          'Nace pendiente: existe en el directorio y todavía no opera. ' +
          'Verificarla es hacerse cargo de que su documentación se revisó.',
        accion: 'Verificar',
        ruta: id === undefined ? ORGANIZATION_NEW_ROUTE : organizationVerifyRoute(id),
      },
      {
        key: 'sede',
        titulo: 'Abrí una sede',
        explica:
          'Cada lugar físico donde se atiende. Sin al menos una no hay dónde agendar ' +
          'ni a qué sucursal asignar a la gente.',
        accion: 'Abrir una sede',
        ruta: id === undefined ? ORGANIZATION_NEW_ROUTE : branchNewRoute(id),
      },
      {
        key: 'plantilla',
        titulo: 'Sumá a tu equipo',
        explica:
          'Mientras la plantilla esté vacía, sólo quien creó la organización puede trabajar dentro.',
        accion: 'Sumar a alguien',
        ruta: id === undefined ? ORGANIZATION_NEW_ROUTE : membershipNewRoute(id),
      },
      {
        key: 'operar',
        titulo: 'Listo para operar',
        explica: 'La organización está en marcha: ya se puede agendar y atender.',
        accion: 'Ver la organización',
        ruta: id === undefined ? ORGANIZATION_NEW_ROUTE : organizationDetailRoute(id),
      },
    ];

    const primeraPendiente = definiciones.find((etapa) => !cumplidas[etapa.key])?.key;

    return definiciones.map((etapa) => ({
      ...etapa,
      completa: cumplidas[etapa.key],
      actual: etapa.key === primeraPendiente,
    }));
  });

  /** Lo que el indicador de avance necesita: rótulo y estado, nada más. */
  protected readonly pasosDelIndicador = computed<readonly StepperStep[]>(() =>
    this.etapas().map((etapa) => ({
      label: etapa.titulo,
      status: etapa.completa ? 'complete' : etapa.actual ? 'current' : 'upcoming',
    })),
  );

  /** La etapa que toca ahora, para destacarla arriba de todo. */
  protected readonly siguiente = computed(() => this.etapas().find((etapa) => etapa.actual));

  /** Cuántas etapas van, para el «paso X de 4». */
  protected readonly cumplidas = computed(
    () => this.etapas().filter((etapa) => etapa.completa).length,
  );

  /** Cuántas hacen falta: la última es el destino, no una tarea. */
  protected readonly totalDeTareas = computed(() => Math.max(this.etapas().length - 1, 0));

  /**
   * Cuántas organizaciones reales hay, cuando es más de una.
   *
   * El recorrido mide **una sola** —la más vieja—, así que con varias en juego
   * hay que decir cuál, o el avance se lee como el de la organización que la
   * persona tiene en la cabeza.
   */
  protected readonly variasOrganizaciones = computed(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') return 0;
    const cuantas = actual.data.organizaciones ?? 0;
    return cuantas > 1 ? cuantas : 0;
  });

  /** El nombre de la organización que este recorrido sigue. */
  protected readonly nombreDeLaOrganizacion = computed(() => {
    const actual = this.estado();
    return actual.status === 'ready' ? (actual.data.organizacion?.legalName ?? '') : '';
  });

  /** Ya no falta nada. */
  protected readonly completo = computed(
    () => this.etapas().length > 0 && this.cumplidas() === this.totalDeTareas(),
  );

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());

    this.directory
      .searchTenants({ limit: ORGANIZACIONES_A_MIRAR })
      .pipe(
        switchMap((pagina) => {
          const reales = pagina.items.filter(
            (tenant) => tenant.code !== CODIGO_DEL_TENANT_SEMILLA,
          );
          if (reales.length === 0) {
            return of<Avance>({
              verificada: false,
              sedes: 0,
              membresias: 0,
              organizaciones: 0,
            });
          }
          // La **más vieja**, y no la primera que devuelva la página: esta
          // pantalla dice «la primera organización», y el orden del listado no
          // lo elige ella. Tomar `items[0]` medía una organización arbitraria
          // —alfabéticamente primera, en la práctica— y mostraba su avance como
          // si fuera el de la que se está poniendo en marcha.
          const organizacion = [...reales].sort(
            (uno, otro) => uno.createdAt.getTime() - otro.createdAt.getTime(),
          )[0];
          return this.medirOrganizacion(organizacion, reales.length);
        }),
      )
      .subscribe({
        next: (avance) => this.estado.set(ready(avance)),
        error: (error: unknown) => this.estado.set(errorToViewState<Avance>(error)),
      });
  }

  /**
   * Mide qué le falta a una organización para estar operando.
   *
   * Las tres lecturas van juntas y cada una se traga su propio fallo: una
   * pestaña caída no puede hacer que el recorrido entero parezca vacío, porque
   * entonces diría que falta algo que quizá ya está hecho.
   *
   * @param organizacion - La organización a medir.
   */
  private medirOrganizacion(organizacion: TenantListItem, organizaciones = 1) {
    return forkJoin({
      sedes: this.directory
        .listBranches(organizacion.id)
        .pipe(catchError(() => of({ items: [], count: 0 }))),
      membresias: this.directory
        .listMemberships(organizacion.id, { limit: MEMBRESIAS_A_MIRAR })
        .pipe(catchError(() => of({ items: [], count: 0, limit: 0, nextCursor: null }))),
      // El estado de verificación es un uuid: para saber qué significa hay que
      // preguntarle al catálogo. Sin respuesta se asume no verificada, que es
      // el lado que ofrece la acción en vez de esconderla.
      etiquetas: this.terminology
        .readConceptLabels([organizacion.verificationStatusConceptId])
        .pipe(catchError(() => of(new Map<string, { readonly code: string }>()))),
    }).pipe(
      // `map` y no `switchMap`: acá no se dispara ninguna petición más, sólo se
      // arma el resumen con lo que ya llegó. Envolverlo en `of` y aplanarlo
      // hacía leer como que había una cuarta lectura donde no la hay.
      map<
        {
          sedes: { count: number };
          membresias: { count: number };
          etiquetas: ReadonlyMap<string, { readonly code: string }>;
        },
        Avance
      >(({ sedes, membresias, etiquetas }) => ({
        organizacion,
        verificada:
          etiquetas.get(organizacion.verificationStatusConceptId)?.code === CODIGO_VERIFICADA,
        sedes: sedes.count,
        membresias: membresias.count,
        organizaciones,
      })),
    );
  }
}
