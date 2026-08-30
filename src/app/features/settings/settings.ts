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
import type { ThemeMode } from '../../core/tokens/design-tokens.types';
import { ThemeService } from '../../core/tokens/theme.service';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { NotificationPreferences } from '../account/notification-preferences/notification-preferences';

/** Quién administra los permisos delegados del M29. Mismo rol que su sección. */
const ROLES_QUE_ADMINISTRAN_PERMISOS: readonly string[] = ['SECURITY_ADMIN'];

/** Las tres opciones de tema, en el orden en que se ofrecen. */
const TEMAS: readonly { valor: ThemeMode; rotulo: string; detalle: string }[] = [
  {
    valor: 'system',
    rotulo: 'El de mi dispositivo',
    detalle: 'Sigue la preferencia del sistema y cambia con ella.',
  },
  { valor: 'light', rotulo: 'Claro', detalle: 'Siempre claro, sin importar el sistema.' },
  { valor: 'dark', rotulo: 'Oscuro', detalle: 'Siempre oscuro, sin importar el sistema.' },
];

/** Cómo se llama cada permiso del navegador y para qué lo usa el producto. */
const PERMISOS: readonly {
  clave: PermisoDelNavegador;
  rotulo: string;
  paraQue: string;
}[] = [
  {
    clave: 'avisos',
    rotulo: 'Avisos del navegador',
    paraQue: 'Para verlos aunque tengas AloVida en otra pestaña. Tu bandeja funciona igual sin esto.',
  },
  {
    clave: 'ubicacion',
    rotulo: 'Ubicación',
    paraQue: 'Para buscar farmacias y consultorios cerca tuyo sin escribir la dirección.',
  },
  {
    clave: 'camara',
    rotulo: 'Cámara',
    paraQue: 'Para adjuntar una foto de un estudio o un documento sin salir del navegador.',
  },
];

/** Cómo se dice cada estado, y con qué tono se pinta. */
const ESTADOS: Readonly<Record<EstadoPermiso, { texto: string; tono: string }>> = {
  concedido: { texto: 'Permitido', tono: 'exito' },
  denegado: { texto: 'Bloqueado', tono: 'alerta' },
  'sin-decidir': { texto: 'Sin decidir', tono: 'neutro' },
  desconocido: { texto: 'Tu navegador no lo informa', tono: 'neutro' },
  'no-disponible': { texto: 'Este navegador no lo ofrece', tono: 'neutro' },
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
 * `/ajustes`, por el ícono y por un enlace de cualquier otra pantalla—; lo
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
  imports: [AppButton, NotificationPreferences, PageHeader, RouterLink, Tab, Tabs],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly theme = inject(ThemeService);
  private readonly session = inject(SessionStore);
  protected readonly permisos = inject(BrowserPermissionsService);

  protected readonly temas = TEMAS;
  protected readonly permisosDelNavegador = PERMISOS;

  /** Lo elegido, que puede ser «el del sistema» y no coincidir con lo pintado. */
  protected readonly temaElegido = this.theme.currentTheme;

  /** Lo que efectivamente se ve: es lo que hace legible la opción «el de mi dispositivo». */
  protected readonly temaResuelto = this.theme.resolvedTheme;

  protected readonly roles = computed(() => etiquetasDeRoles(this.session.roles()));

  /**
   * Si a esta sesión le sirve el enlace a la administración de permisos del
   * M29. Con `rolesAlcanzan` y no con una comparación propia, para que el
   * comodín `SUPERADMIN` valga acá lo mismo que en el menú y en el guard.
   */
  protected readonly administraPermisos = computed(() =>
    rolesAlcanzan(ROLES_QUE_ADMINISTRAN_PERMISOS, this.session.roles()),
  );

  /** La verificación de identidad sólo se ofrece si el producto la ofrece. */
  protected readonly verificacionOfrecida = VERIFICACION_DE_IDENTIDAD_OFRECIDA;

  protected elegirTema(modo: ThemeMode): void {
    this.theme.setTheme(modo);
  }

  protected estadoDe(permiso: PermisoDelNavegador): { texto: string; tono: string } {
    return ESTADOS[this.permisos.estado()[permiso]];
  }

  protected sePuedePedir(permiso: PermisoDelNavegador): boolean {
    return this.permisos.sePuedePedir(permiso);
  }

  protected pidiendo(permiso: PermisoDelNavegador): boolean {
    return this.permisos.enCurso(permiso);
  }

  /** Un permiso bloqueado sólo se recupera desde el navegador, no desde acá. */
  protected estaBloqueado(permiso: PermisoDelNavegador): boolean {
    return this.permisos.estado()[permiso] === 'denegado';
  }

  protected pedir(permiso: PermisoDelNavegador): void {
    void this.permisos.pedir(permiso);
  }
}
