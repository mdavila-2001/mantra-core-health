import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { rolesConEtiqueta } from '../../../core/auth/role-labels';
import { IdentityClient } from '../../../core/data-access/identity/identity.client';
import type { VerificationCase } from '../../../core/data-access/identity/identity.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type {
  OwnAddress,
  OwnPatientProfile,
  OwnPatientSummary,
} from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import {
  errorToViewState,
  IDENTITY_VERIFICATION_ROUTE,
} from '../../../core/http/error-to-view-state';
import { VERIFICACION_DE_IDENTIDAD_OFRECIDA } from '../../../core/identity-assurance/verificacion-ofrecida';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  CaseStatusCatalog,
  toCaseStatusPresentation,
} from '../../identity-verification/case-status';
import { PractitionerProfile } from './practitioner-profile/practitioner-profile';

/**
 * Resumen propio — vista **V05-03** de `SALUD/Vistas/V05 profiles`
 * (`GET /profiles/patients/me/summary`).
 *
 * ## Autoservicio de verdad
 *
 * El sujeto lo resuelve el backend desde la sesión: no hay identificador que
 * pasar y no hay forma de pedir el resumen de otra persona. Por eso esta
 * pantalla no tiene parámetro de ruta ni buscador — no le faltan, no van.
 *
 * ## El perfil no depende de verificarse (F-34)
 *
 * El endpoint responde `200` a todo paciente, verificado o no. Lo único que la
 * verificación gobierna es el **código de paciente**, que el backend omite
 * mientras no haya aserción vigente: la fila lo dice en palabras y ofrece el
 * trámite como invitación. La vista no oculta nada por su cuenta — muestra lo
 * que el backend le devolvió a esa sesión.
 *
 * ## El 403 sigue contemplado, para la API anterior
 *
 * Una API previa a F-34 responde `403` con `IDENTITY_VERIFICATION_REQUIRED`, y
 * `errorToViewState` lo traduce a un S5 **con acción**: el host de estados
 * pinta el enlace a la pantalla de verificación. Se conserva tal cual para que
 * el frente y el backend se puedan desplegar en cualquier orden.
 *
 * ## Por qué son tres bloques y no una tarjeta
 *
 * Era una tarjeta de cuatro campos en una pantalla de mil cuatrocientos píxeles,
 * y se leía como si la cuenta de alguien fuera eso y nada más. Lo que faltaba no
 * era decoración: era **lo que la persona vino a averiguar**. Quien mira su
 * perfil quiere saber tres cosas y sólo una estaba.
 *
 * 1. **Sus datos**, que ya estaban.
 * 2. **En qué quedó su verificación de identidad** — el backend publica el
 *    historial de casos desde siempre (`GET /identity/me/verification-cases`) y
 *    nadie lo pedía; sin él, quien ya hizo el trámite no tiene forma de saber si
 *    salió, y es la pregunta que más se hace en esta pantalla.
 * 3. **Con qué credenciales está entrando** — organización y roles. Estaban sólo
 *    en el panel, que es otra pantalla.
 *
 * ## Dos perfiles, una pantalla
 *
 * Esta pantalla llamaba a `GET /profiles/patients/me/summary` para **todo el
 * mundo**, y ese endpoint es de pacientes: a un profesional le responde `404`
 * —no tiene perfil de paciente— o `403` si además no verificó su identidad. El
 * resultado era que la pantalla de perfil de un médico no mostraba nada, y no
 * por un defecto de la pantalla sino porque no existía la lectura que la
 * sirviera. Ahora existe (`GET /profiles/practitioners/me/summary`) y esta
 * pantalla elige cuál pedir según quién entró:
 *
 * - con perfil profesional, `app-practitioner-profile`, que es una trayectoria;
 * - si no, el resumen de paciente, que es lo que había.
 *
 * Los dos últimos bloques —verificación de identidad y acceso— son de la
 * **cuenta**, no del perfil, así que se muestran en los dos casos.
 */
/**
 * Los roles con los que se viene a trabajar, no a atenderse.
 *
 * Mismo criterio que el panel: quien tiene alguno de estos ve «Tu acceso»
 * aunque además sea paciente, porque para él la pregunta que responde esa
 * tarjeta sí existe.
 */
const ROLES_DE_TRABAJO: readonly string[] = [
  'SUPERADMIN',
  'SECURITY_ADMIN',
  'SCHEDULING_ADMIN',
  'SCHEDULING_AGENT',
  'PRACTITIONER',
  'CLINICIAN',
];

@Component({
  selector: 'app-my-profile',
  imports: [
    Alert,
    Badge,
    Card,
    DatePipe,
    Link,
    PageHeader,
    PractitionerProfile,
    RouterLink,
    StatusSeal,
    ViewStateHost,
  ],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProfile {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly identity = inject(IdentityClient);
  // Declara que esta pantalla necesita los estados de caso resueltos contra
  // terminología: al inyectarlo se resuelven, y `toCaseStatusPresentation` los
  // encuentra. Sin esto los sellos se verían en neutro.
  private readonly estadosDeCaso = inject(CaseStatusCatalog);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /**
   * Si la sesión tiene un perfil profesional detrás.
   *
   * Sale del claim `hpid` del token —el identificador del perfil profesional— y
   * **no de los roles**: un rol se concede y se revoca por organización, y quien
   * tiene un perfil profesional lo sigue teniendo aunque hoy entre a una
   * institución donde no atiende. Preguntar por el rol dejaría a esa persona
   * mirando un perfil de paciente que no tiene.
   */
  protected readonly esProfesional = computed(() => this.auth.practitionerProfileId() !== null);

  /**
   * El resumen de paciente. Admite `null` **listo**, que no es lo mismo que
   * «cargando»: es «esta sesión no tiene resumen de paciente que pedir», el caso
   * de un profesional. Sin ese tercer valor, la única forma de no pedirlo era
   * dejar el estado en carga para siempre.
   */
  protected readonly resumen = signal<ViewState<OwnPatientSummary | null>>(loading());

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /**
   * Los datos completos de filiación, para MOSTRARLOS.
   *
   * Va aparte del resumen y no reemplaza a ninguno: el resumen compone el nombre
   * y trae el estado; éste trae lo que la persona declaró —documento, correo,
   * direcciones, seguros, tutores—, que hasta ahora sólo se podía ver entrando a
   * editar. Un fallo acá no rompe la tarjeta: los bloques nuevos sencillamente
   * no se dibujan.
   */
  protected readonly perfil = signal<OwnPatientProfile | null>(null);

  protected readonly datos = computed(() => dataOf(this.resumen()));

  /**
   * Si «Tus datos» está cerrado **sólo** porque falta verificar la identidad.
   *
   * Desde F-34 el backend ya no cierra esa puerta, así que esto sólo se
   * enciende contra una API anterior al cambio. Cuando pasa, la tarjeta lo dice
   * en neutro y con la salida a mano —una alerta roja «No tenés acceso» sobre
   * la propia cuenta lee como que algo se rompió (feedback de la analista,
   * barrido del 18/08/2026)—. Cualquier otro 403 sigue pintándose como lo que
   * es.
   */
  protected readonly verificacionPendiente = computed(() => {
    const estado = this.resumen();
    return (
      estado.status === 'forbidden' && estado.nextAction?.route === IDENTITY_VERIFICATION_ROUTE
    );
  });

  protected readonly rutaDeVerificacion = IDENTITY_VERIFICATION_ROUTE;

  /**
   * Si la ficha «Verificación de identidad» se dibuja.
   *
   * Campo y no import suelto porque la plantilla sólo lee miembros de la clase.
   * Ver `VERIFICACION_DE_IDENTIDAD_OFRECIDA`.
   */
  protected readonly verificacionOfrecida = VERIFICACION_DE_IDENTIDAD_OFRECIDA;

  /** El mensaje de un 403 que no es el de identidad: se muestra como lo haría el host. */
  protected readonly motivoDelMuro = computed(() => {
    const estado = this.resumen();
    return estado.status === 'forbidden' ? (estado.message ?? null) : null;
  });

  /**
   * Los roles con etiqueta, para las insignias de «Tu acceso».
   *
   * El código crudo no se pinta —es vocabulario de sistema— pero sigue viajando
   * en `data-role` para quien lo lea por máquina; el rol sin etiqueta se omite.
   */
  protected readonly rolesLegibles = computed(() => rolesConEtiqueta(this.auth.roles()));

  /**
   * Si se muestra la tarjeta «Tu acceso» (F-22).
   *
   * A quien viene a atenderse no le dice nada: «Organización: Care Default
   * Tenant» y «Roles: Paciente» son la respuesta a «¿por qué no veo tal cosa?»,
   * una pregunta que se hace quien trabaja acá y tiene secciones que le faltan.
   * Un paciente no tiene secciones que le falten: tiene lo suyo. Es la cuarta
   * fuga de la misma regla —cero organización, roles ni jerga en su vista— y
   * los barridos anteriores no alcanzaron esta pantalla.
   *
   * Se oculta en vez de reemplazarse: lo que iría en su lugar —su código de
   * paciente— todavía no tiene formato decidido (H-04).
   *
   * Se pregunta por los roles de trabajo, igual que el panel: quien atiende y
   * además es paciente entra a trabajar, y la tarjeta le sirve.
   */
  protected readonly muestraElAcceso = computed(() => {
    const roles = this.auth.roles();
    if (!roles.includes('PATIENT')) return true;
    return ROLES_DE_TRABAJO.some((rol) => roles.includes(rol));
  });

  protected readonly tenantName = computed(() => {
    const id = this.auth.activeTenantId();
    return id === null ? null : this.auth.tenantName(id);
  });

  /**
   * Los casos de verificación, del más nuevo al más viejo.
   *
   * El backend los devuelve sin orden garantizado y la pregunta que traen es
   * «¿cómo quedó el último?», así que ordenarlos acá evita que la respuesta
   * dependa de en qué orden vinieron.
   */
  protected readonly casos = signal<readonly VerificationCase[]>([]);

  protected readonly casosOrdenados = computed<readonly VerificationCase[]>(() =>
    [...this.casos()].sort((a, b) => fecha(b) - fecha(a)),
  );

  protected readonly casoVigente = computed<VerificationCase | null>(
    () => this.casosOrdenados()[0] ?? null,
  );

  protected readonly selloVigente = computed(() => {
    const caso = this.casoVigente();
    return caso === null ? null : toCaseStatusPresentation(caso.status);
  });

  /** La presentación de un caso cualquiera, para la lista del historial. */
  protected sello(caso: VerificationCase): ReturnType<typeof toCaseStatusPresentation> {
    return toCaseStatusPresentation(caso.status);
  }

  /**
   * El estado de la persona, en palabras.
   *
   * Llega como `*ConceptId` en uuid y se traduce con el catálogo. Si el
   * catálogo no responde se muestra el texto de ausencia, nunca el uuid: para
   * quien mira su propia cuenta, un identificador interno no es información,
   * es ruido.
   */
  protected readonly estado = computed(() => {
    const datos = this.datos();
    if (datos === null) {
      return '';
    }
    return this.etiquetas().get(datos.personStatus)?.display ?? 'Sin determinar';
  });

  constructor() {
    this.cargar();
    this.cargarCasos();
    this.cargarPerfil();
  }


  /**
   * La etiqueta de un concepto, o nada.
   *
   * Devuelve cadena vacía y no el uuid cuando el catálogo todavía no llegó: un
   * identificador crudo en la ficha no le dice nada a nadie y delata la
   * plomería. La fila queda con el dato principal y sin el sufijo.
   */
  protected etiquetaDe(conceptId: string): string {
    return this.etiquetas().get(conceptId)?.display ?? '';
  }

  /**
   * La edad, calculada.
   *
   * El registro del stakeholder la pide «de manera automática con la fecha de
   * nacimiento ingresada»: es derivada, no un dato que alguien escriba, así que
   * no se guarda ni se pide al backend.
   */
  protected readonly edad = computed<number | null>(() => {
    const nacimiento = this.perfil()?.birthDate;
    if (!nacimiento) return null;
    const hoy = new Date();
    let anios = hoy.getFullYear() - nacimiento.getFullYear();
    // Si todavía no llegó su cumpleaños este año, tiene uno menos.
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) anios -= 1;
    return anios >= 0 && anios < 130 ? anios : null;
  });

  /**
   * Una dirección en una línea.
   *
   * Se arma con lo que haya: quien declaró sólo el municipio ve el municipio, y
   * quien escribió la calle la ve primero. Las coordenadas NO se muestran —un
   * par de números no le dice nada a quien lee su ficha—; están para el mapa.
   */
  protected direccionLegible(dir: OwnAddress): string {
    const partes = [
      dir.lines,
      dir.city ?? (dir.municipalityConceptId ? this.etiquetaDe(dir.municipalityConceptId) : ''),
    ].filter((parte) => parte !== undefined && parte !== '');
    return partes.length > 0 ? partes.join(' · ') : 'Sin detalle';
  }

  /**
   * El enlace al mapa de una dirección, o `null` si no tiene coordenadas.
   *
   * El registro de procesos pide «Ubicación GPS» del domicilio (§1.9) y del
   * trabajo (§1.11), «en el Google Maps de AloVida». `common.addresses` guarda
   * `latitude`/`longitude` desde siempre y `OwnAddressDto` ya las devolvía: lo
   * único que faltaba era dibujarlas.
   *
   * Va como enlace y no como mapa embebido a propósito: incrustar un mapa mete
   * una clave de API y peticiones a un tercero en una pantalla que hoy no las
   * necesita. El enlace resuelve lo mismo —«llevame ahí»— con una etiqueta.
   */
  protected enlaceAlMapa(dir: OwnAddress): string | null {
    if (dir.latitude === undefined || dir.longitude === undefined) return null;
    if (dir.latitude === null || dir.longitude === null) return null;
    return `https://www.google.com/maps/search/?api=1&query=${dir.latitude},${dir.longitude}`;
  }

  protected recargar(): void {
    this.cargar();
    this.cargarCasos();
    this.cargarPerfil();
  }

  /**
   * Los datos completos, si la sesión es de paciente.
   *
   * Silencioso a propósito: a un profesional esta ruta le responde 404 —no tiene
   * perfil de paciente— y ese fallo no le falta a nadie. La tarjeta sigue
   * mostrando lo que el resumen ya trajo.
   */
  private cargarPerfil(): void {
    this.perfil.set(null);
    if (!this.debeLeerResumenDePaciente()) return;

    this.profiles.getOwnPatientProfile().subscribe({
      next: (p) => {
        this.perfil.set(p);
        const uuids = [
          p.issuerAdministrativeAreaConceptId,
          p.residenceMunicipalityConceptId,
          p.occupationConceptId,
          p.homeAddress?.municipalityConceptId,
          p.workAddress?.municipalityConceptId,
        ].filter((id): id is string => typeof id === 'string' && id.length > 0);

        if (uuids.length > 0) {
          this.terminology.readConceptLabels(uuids).subscribe({
            next: (nuevas) => {
              this.etiquetas.update((prev) => {
                const map = new Map(prev);
                for (const [k, v] of nuevas.entries()) {
                  map.set(k, v);
                }
                return map;
              });
            },
            error: () => {},
          });
        }
      },
      error: () => this.perfil.set(null),
    });
  }

  /**
   * Pide el resumen de paciente **sólo si la sesión es de paciente**.
   *
   * Es el arreglo de fondo: la pantalla pedía el resumen siempre, y para un
   * profesional esa petición vuelve `404` o `403`. Ese fallo no era informativo
   * —no le faltaba nada a la persona— pero pintaba la pantalla como rota.
   */
  private debeLeerResumenDePaciente(): boolean {
    return !this.esProfesional();
  }

  /**
   * Pide el historial de verificaciones.
   *
   * Va aparte del resumen y **no comparte su estado de vista** a propósito: el
   * resumen falla con 403 cuando falta verificar la identidad, que es
   * justamente cuando el historial más importa. Encadenarlos dejaría la pantalla
   * sin lo único que en ese caso tiene para decir.
   */
  private cargarCasos(): void {
    // Con la verificación apagada la ficha no se dibuja, así que su lectura
    // sería una petición para nadie. Ver `VERIFICACION_DE_IDENTIDAD_OFRECIDA`.
    if (!this.verificacionOfrecida) {
      this.casos.set([]);
      return;
    }

    this.identity.listVerificationCases().subscribe({
      next: (casos) => this.casos.set(casos),
      error: () => this.casos.set([]),
    });
  }

  private cargar(): void {
    this.resumen.set(loading());
    this.etiquetas.set(new Map());

    if (!this.debeLeerResumenDePaciente()) {
      // No hay resumen de paciente que pedir, y tampoco hay vacío que mostrar:
      // el bloque entero no se dibuja. Se deja en `ready` con un resumen nulo
      // para que el host de estados no se quede girando para siempre.
      this.resumen.set(ready(null));
      return;
    }

    this.profiles
      .getOwnSummary()
      .pipe(
        switchMap((resumen) =>
          forkJoin({
            resumen: of(resumen),
            // El fallo del catálogo degrada un campo; no puede tumbar la
            // pantalla que muestra los datos propios de alguien.
            etiquetas: this.terminology
              .readConceptLabels([resumen.personStatus])
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ resumen, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.resumen.set(ready(resumen));
        },
        error: (error: unknown) => this.resumen.set(errorToViewState<OwnPatientSummary>(error)),
      });
  }
}

/**
 * La fecha por la que se ordena un caso.
 *
 * El cierre manda sobre la apertura —un caso resuelto ayer es más reciente que
 * uno abierto la semana pasada y todavía en trámite— y sin ninguna de las dos
 * el caso va al fondo en vez de romper la comparación con un `NaN`.
 */
function fecha(caso: VerificationCase): number {
  return caso.completedAt?.getTime() ?? caso.openedAt?.getTime() ?? 0;
}
