import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { etiquetasDeRoles } from '../../core/auth/role-labels';
import { VERIFICACION_DE_IDENTIDAD_OFRECIDA } from '../../core/identity-assurance/verificacion-ofrecida';
import { rolesAlcanzan } from '../../core/navigation/navigation.types';
import {
  BrowserPermissionsService,
  type EstadoPermiso,
  type PermisoDelNavegador,
} from '../../core/permissions/browser-permissions.service';
import { AlovidaThemeToggleDirective } from '../../core/alovida/alovida-theme-toggle.directive';
import { ThemeService } from '../../core/tokens/theme.service';
import { AppButton } from '../../shared/components/atoms/button/button';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../shared/components/atoms/nav-icon/nav-icon.types';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { NotificationPreferences } from '../account/notification-preferences/notification-preferences';
import { ChatPreferences } from './chat-preferences/chat-preferences';

/** Quién administra los permisos delegados del M29. Mismo rol que su sección. */
const PERMISSION_ADMIN_ROLES: readonly string[] = ['SECURITY_ADMIN'];

/** Cómo se llama cada permiso del navegador y para qué lo usa el producto. */
const BROWSER_PERMISSIONS: readonly {
  key: PermisoDelNavegador;
  label: string;
  purpose: string;
  icon: NavIconName;
}[] = [
  {
    key: 'avisos',
    label: 'Avisos del navegador',
    purpose: 'Para verlos aunque tengas AloVida en otra pestaña. Tu bandeja funciona igual sin esto.',
    icon: 'bell',
  },
  {
    key: 'ubicacion',
    label: 'Ubicación',
    purpose: 'Para buscar farmacias y consultorios cerca tuyo sin escribir la dirección.',
    icon: 'pin',
  },
  {
    key: 'camara',
    label: 'Cámara',
    purpose: 'Para adjuntar una foto de un estudio o un documento sin salir del navegador.',
    icon: 'camera',
  },
];

/** Cómo se dice cada estado, y con qué tono se pinta. */
const PERMISSION_STATES: Readonly<Record<EstadoPermiso, { text: string; tone: string }>> = {
  concedido: { text: 'Permitido', tone: 'exito' },
  denegado: { text: 'Bloqueado', tone: 'alerta' },
  'sin-decidir': { text: 'Sin decidir', tone: 'neutro' },
  desconocido: { text: 'Tu navegador no lo informa', tone: 'neutro' },
  'no-disponible': { text: 'Este navegador no lo ofrece', tone: 'neutro' },
};

/**
 * Ajustes — todo lo que la persona configura sobre su propia cuenta, junto.
 *
 * ## Por qué existe
 *
 * Lo que se configura estaba repartido en tres sitios que no se parecían entre
 * sí: «Preferencias de avisos» ocupaba un renglón del menú lateral entre
 * pantallas de contenido —«Mis turnos», «Mis resultados»—, el tema era un botón
 * suelto del encabezado sin nombre ni rótulo, y los permisos del navegador no
 * se podían ni mirar. Configurar no es una sección más del producto: es una
 * sola cosa, y ahora tiene una sola puerta —el ícono del encabezado— y una sola
 * pantalla.
 *
 * ## Por qué no ocupa un renglón del menú
 *
 * Por lo mismo que no lo ocupan el tema ni la campana: los ajustes no son un
 * destino de trabajo. La sección declara `fueraDelMenuPara: [ANY_ROLE]` en el
 * registro, así que sigue teniendo ruta, título y breadcrumb —y se alcanza por
 * `/settings`, por el ícono y por un enlace de cualquier otra pantalla—; lo
 * único que no tiene es renglón.
 *
 * ## Lo que esta pantalla NO promete
 *
 * «Permisos» acá son **los del navegador** y **los roles de tu sesión**, que es
 * todo lo que hoy se puede leer de verdad. Quién tiene acceso a tu historia
 * clínica no se lista, y no es un olvido: los dos endpoints que lo responden
 * —`GET /authz/care-relationships` y `GET /authz/legal-representations`— están
 * declarados `@Roles('CLINICIAN', 'SECURITY_ADMIN')`, así que a la propia
 * persona la API no se lo cuenta. Se dice con esas palabras en vez de pintar
 * una lista vacía que se leería como «nadie tiene acceso».
 */
@Component({
  selector: 'app-settings',
  imports: [AlovidaThemeToggleDirective, AppButton, ChatPreferences, NavIcon, NotificationPreferences, PageHeader, RouterLink, Tab, Tabs],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly theme = inject(ThemeService);
  private readonly session = inject(SessionStore);
  protected readonly permissions = inject(BrowserPermissionsService);

  protected readonly browserPermissions = BROWSER_PERMISSIONS;

  /** Si nadie eligió a mano: el interruptor refleja lo que pide el dispositivo. */
  protected readonly followsSystem = computed(() => this.theme.currentTheme() === 'system');

  /** Lo que efectivamente se ve, que es lo que el interruptor marca. */
  protected readonly resolvedTheme = this.theme.resolvedTheme;

  protected readonly roles = computed(() => etiquetasDeRoles(this.session.roles()));

  /**
   * Si a esta sesión le sirve el enlace a la administración de permisos del
   * M29. Con `rolesAlcanzan` y no con una comparación propia, para que el
   * comodín `SUPERADMIN` valga acá lo mismo que en el menú y en el guard.
   */
  protected readonly managesPermissions = computed(() =>
    rolesAlcanzan(PERMISSION_ADMIN_ROLES, this.session.roles()),
  );

  /** La verificación de identidad sólo se ofrece si el producto la ofrece. */
  protected readonly verificationOffered = VERIFICACION_DE_IDENTIDAD_OFRECIDA;

  protected useSystemTheme(): void {
    this.theme.useSystemTheme();
  }

  protected stateOf(permission: PermisoDelNavegador): { text: string; tone: string } {
    return PERMISSION_STATES[this.permissions.estado()[permission]];
  }

  protected canRequest(permission: PermisoDelNavegador): boolean {
    return this.permissions.sePuedePedir(permission);
  }

  protected requesting(permission: PermisoDelNavegador): boolean {
    return this.permissions.enCurso(permission);
  }

  /** Un permiso bloqueado sólo se recupera desde el navegador, no desde acá. */
  protected isBlocked(permission: PermisoDelNavegador): boolean {
    return this.permissions.estado()[permission] === 'denegado';
  }

  protected request(permission: PermisoDelNavegador): void {
    void this.permissions.pedir(permission);
  }
}
