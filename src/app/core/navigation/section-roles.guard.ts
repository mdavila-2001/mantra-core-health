import { inject } from '@angular/core';
import { Router, type ActivatedRouteSnapshot, type CanActivateFn } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { tracedGuard } from '../observability/routing/guard-tracing';
import { APP_SECTIONS } from './navigation.map';
import { isVisibleTo, ROLES_ROUTE_DATA, rolesAlcanzan, type AppSection } from './navigation.types';

/**
 * A dónde se manda a quien llega a una sección que su rol no alcanza.
 *
 * Al panel y no al login: la sesión es válida y el problema no es de identidad.
 * Mandarla al login diría «volvé a entrar» sobre una cuenta que ya está dentro,
 * y quien lo intente va a entrar de nuevo y a chocar contra lo mismo.
 */
export const SECCION_DENEGADA_ROUTE = '/dashboard';

/**
 * Cierra por ruta lo que el menú ya no ofrece.
 *
 * ## Por qué hace falta, si el menú ya filtra
 *
 * Porque filtrar el menú **no es seguridad, es cortesía**: quien escribe la
 * dirección a mano llega igual, y quien tenga el enlace guardado también. La
 * corrección #2 del 15/08/2026 no dice «sacar del menú», dice que la Guía de
 * profesionales «no debe aparecer **ni ser accesible**» para quien no es
 * paciente — y sin este guard sólo se cumplía la primera mitad.
 *
 * ## Qué NO es
 *
 * No es la autoridad. La autoridad sigue siendo la API, que valida rol en cada
 * petición y responde 403. Esto es la puerta del frente: evita la pantalla
 * intermedia —cargando, y después vacía o con un error de permisos— que es
 * peor experiencia y además insinúa que del otro lado había algo.
 *
 * ## De dónde saca los roles
 *
 * Del **mismo registro** que arma el menú (`APP_SECTIONS`) y con la **misma
 * función** (`isVisibleTo`). Es deliberado: si el guard tuviera su propia lista,
 * los dos lados se desincronizarían y el resultado sería lo peor de los dos
 * mundos — un ítem visible que rebota, o una sección alcanzable que el menú
 * esconde. Incluido el comodín `SUPERADMIN`, que es la regla del `RolesGuard`
 * del backend y no una excepción inventada acá.
 *
 * ## Dónde se aplica
 *
 * A **las rutas de sección**, que se construyen desde el registro; a **toda
 * pantalla de operación** (`pantallaDeOperacion` en `app.routes.ts` lo pone por
 * construcción); y a las pantallas hijas que lo declaran explícitamente
 * (`/directory/:profileId`, `/administration/patients/new`…). Se declara ruta
 * por ruta y no se cuelga del armazón entero a propósito: hay hijas cuyo rol
 * legítimo **no** es el de su sección —`administration/patients` es
 * `SECURITY_ADMIN` en el menú, pero su alta asistida la usa también un
 * `CLINICIAN` que llega por su propio flujo—, y un guard por prefijo sobre todo
 * el árbol les cerraría la puerta sin que nadie lo hubiera pedido. La regla
 * «hija de sección con roles ⇒ guard, salvo excepción escrita» la fija
 * `app.routes.spec.ts`.
 *
 * ## Cuando la hija declara sus propios roles
 *
 * Hay hijas al revés de las de arriba: cuelgan de una sección **sin** roles y
 * son de un rol concreto. «Configurar tu perfil», «Tu perfil público» y
 * «Artículos médicos» viven bajo «Mi perfil» —que abre cualquiera— y son de
 * quien atiende: el paciente que escribía la dirección llegaba a una pantalla
 * que le hablaba de su vitrina y de «las personas que atendí» (feedback de la
 * analista, barrido del 18/08/2026). Esas hijas declaran sus roles en `data`
 * (`ROLES_ROUTE_DATA`) y el guard los mira **antes** que la sección: la ruta
 * manda sobre el prefijo, con la misma regla del comodín (`rolesAlcanzan`).
 */
export const seccionRolesGuard: CanActivateFn = tracedGuard('seccionRolesGuard', (route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (alcanza(route, state.url, session.roles())) {
    return true;
  }

  return router.createUrlTree([SECCION_DENEGADA_ROUTE]);
});

function alcanza(route: ActivatedRouteSnapshot, url: string, roles: readonly string[]): boolean {
  const propios = rolesDeLaRuta(route);
  if (propios !== undefined) {
    return rolesAlcanzan(propios, roles);
  }

  const seccion = seccionDe(url);
  return seccion === null || isVisibleTo(seccion, roles);
}

/**
 * Los roles que la ruta declara en `data`, o `undefined` si no declara ninguno.
 *
 * Se valida la forma porque `data` es `Record<string, unknown>`. Una ruta que
 * declaró la clave con otra forma quiso restringirse y no se la puede leer:
 * eso **cierra** (nadie salvo el comodín), no abre — un guard que ante un error
 * de declaración dejara pasar a todos fallaría justo hacia el lado que existe
 * para evitar. `app.routes.spec.ts` fija la forma en las rutas que la usan.
 */
function rolesDeLaRuta(route: ActivatedRouteSnapshot): readonly string[] | undefined {
  const valor: unknown = route.data?.[ROLES_ROUTE_DATA];
  if (valor === undefined) {
    return undefined;
  }
  return esListaDeTextos(valor) ? valor : [];
}

function esListaDeTextos(valor: unknown): valor is readonly string[] {
  return Array.isArray(valor) && valor.every((rol) => typeof rol === 'string');
}

/**
 * La sección a la que pertenece una URL, por la coincidencia **más larga**.
 *
 * Mismo criterio que usa `NavigationService` para marcar el menú y armar el
 * breadcrumb: `/my-account/appointments` tiene que resolver a «Mis turnos» y no
 * a «Mi perfil», que también es prefijo suyo.
 */
function seccionDe(url: string): AppSection | null {
  const ruta = url.split('?')[0].split('#')[0].replace(/^\//, '');

  return (
    APP_SECTIONS.filter(
      (seccion) => ruta === seccion.path || ruta.startsWith(`${seccion.path}/`),
    ).sort((a, b) => b.path.length - a.path.length)[0] ?? null
  );
}
