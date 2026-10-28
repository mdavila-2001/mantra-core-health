/**
 * La cuenta de superadministración que siembra el entorno **local y de
 * desarrollo** (`BOOTSTRAP_ADMIN_*` de la API), para mostrarla en el login y
 * no tener que recordarla.
 *
 * ## Por qué está gobernada por `ngDevMode` y no por una variable de entorno
 *
 * Todo lo que llega al navegador es público (`environment.types.ts`), y el
 * generador de entorno rechaza a propósito lo que tenga forma de credencial.
 * Una variable `PUBLIC_*` con la clave la publicaría en cualquier despliegue
 * que la encienda. `ngDevMode` es distinto: el compilador lo fija en `false`
 * al armar el paquete de producción y esa rama muerta se elimina, así que **el
 * literal no existe en lo que se despliega** — sólo en `ng serve` y en los
 * builds de desarrollo, que es donde esta cuenta existe.
 *
 * Mostrarla no la crea: si la API local no la sembró, el login la rechaza como
 * a cualquier otra.
 */
declare const ngDevMode: boolean | undefined;

export interface LocalLoginHint {
  readonly identifier: string;
  readonly password: string;
}

/**
 * Sólo si la página se sirve desde esta misma máquina. `ngDevMode` dice cómo se
 * compiló, no dónde corre: un build de desarrollo publicado por un túnel o en un
 * servidor compartido lo trae en `true`, y esa clave no debe verse ahí.
 */
function sirveDesdeLocalhost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * La cuenta local, o `null` fuera del modo desarrollo o fuera de localhost. Se evalúa al llamarla y
 * no al cargar el módulo: Angular inicializa `ngDevMode` al importar `core`.
 */
export function localLoginHint(
  host: string = globalThis.location?.hostname ?? '',
): LocalLoginHint | null {
  const enDesarrollo = typeof ngDevMode !== 'undefined' && ngDevMode;
  return enDesarrollo && sirveDesdeLocalhost(host)
    ? { identifier: 'admin@alovidasalud.com', password: '12345678' }
    : null;
}
