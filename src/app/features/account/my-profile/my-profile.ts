import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { rolesConEtiqueta } from '../../../core/auth/role-labels';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Link } from '../../../shared/components/atoms/link/link';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { MedicalArticles } from './medical-articles/medical-articles';
import { PractitionerProfile } from './practitioner-profile/practitioner-profile';
import { ProfileSettings } from './profile-settings/profile-settings';

/**
 * Los roles con los que se viene a trabajar, no a atenderse.
 *
 * Mismo criterio que el panel: quien tiene alguno de estos ve la franja de
 * acceso aunque además sea paciente, porque para él la pregunta que responde
 * esa franja sí existe.
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
 * **Mi cuenta** (`/my-account`) — la página con pestañas.
 *
 * ## Qué era y por qué cambió
 *
 * Era una pantalla con tres tarjetas sueltas —datos, verificación de identidad
 * y acceso— repartidas entre una columna principal y un lateral, más DOS
 * pantallas aparte a las que sólo se llegaba por botones enterrados dentro del
 * perfil: `/my-account/articles` y `/my-account/edit`. Cinco lugares para dos
 * intenciones. El resultado era el reclamo del cliente: una página que a la vez
 * se siente vacía —cada tarjeta ocupaba un tercio de un monitor ancho— y
 * desordenada, porque nada de lo que hay ahí está donde se lo busca.
 *
 * Ahora es **una** página con dos pestañas, que son exactamente las dos cosas
 * que alguien viene a hacer a su cuenta:
 *
 * - **Mis Artículos** — lo que publica.
 * - **Configurar mi Perfil** — quién es y cómo lo ven.
 *
 * ## No hay componentes nuevos duplicados
 *
 * Las pestañas montan los MISMOS componentes que sirven las rutas
 * `/my-account/articles` y el perfil profesional; las rutas siguen existiendo y
 * siguen funcionando. Copiar sus plantillas acá habría dejado dos versiones del
 * mismo formulario divergiendo con cada arreglo — que es el defecto que este
 * carril venía a corregir, no a repetir.
 *
 * ## Qué quedó en este componente
 *
 * Casi nada, a propósito: la cabecera, la franja de acceso y las dos pestañas.
 * Las lecturas —resumen de paciente, perfil profesional, casos de
 * verificación— se fueron a `app-profile-settings`, que es quien las pinta. Un
 * contenedor que además pide datos que no muestra es el sitio donde después
 * aparecen los estados de carga fantasma.
 */
@Component({
  selector: 'app-my-profile',
  imports: [
    Badge,
    Card,
    Link,
    MedicalArticles,
    PageHeader,
    PractitionerProfile,
    ProfileSettings,
    RouterLink,
    Tab,
    Tabs,
  ],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProfile {
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /**
   * La pestaña abierta. Arranca en «Mis Artículos» porque es la que se visita a
   * diario; configurar el perfil es algo que se hace una vez y se retoca cada
   * tanto.
   */
  protected readonly pestana = signal(0);

  /**
   * Si la sesión tiene un perfil profesional detrás.
   *
   * Sale del claim `hpid` del token —el identificador del perfil profesional— y
   * **no de los roles**: un rol se concede y se revoca por organización, y quien
   * tiene un perfil profesional lo sigue teniendo aunque hoy entre a una
   * institución donde no atiende.
   */
  protected readonly esProfesional = computed(() => this.auth.practitionerProfileId() !== null);

  /**
   * Los roles con etiqueta. El código crudo no se pinta —es vocabulario de
   * sistema— pero sigue viajando en `data-role` para quien lo lea por máquina.
   */
  protected readonly rolesLegibles = computed(() => rolesConEtiqueta(this.auth.roles()));

  protected readonly tenantName = computed(() => {
    const id = this.auth.activeTenantId();
    return id === null ? null : this.auth.tenantName(id);
  });

  /**
   * Si se muestra la franja «Tu acceso» (F-22).
   *
   * A quien viene a atenderse no le dice nada: «Organización: Care Default
   * Tenant» y «Roles: Paciente» son la respuesta a «¿por qué no veo tal cosa?»,
   * una pregunta que se hace quien trabaja acá y tiene secciones que le faltan.
   * Un paciente no tiene secciones que le falten: tiene lo suyo.
   */
  protected readonly muestraElAcceso = computed(() => {
    const roles = this.auth.roles();
    if (!roles.includes('PATIENT')) return true;
    return ROLES_DE_TRABAJO.some((rol) => roles.includes(rol));
  });
}
