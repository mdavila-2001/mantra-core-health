/**
 * Hosts que el servidor de renderizado acepta atender.
 *
 * ## Qué protege
 *
 * `AngularNodeAppEngine` compara el `Host` de cada petición contra esta lista.
 * Es la defensa contra SSRF que documenta Angular: sin ella, alguien puede
 * pedirle al servidor que renderice con un `Host` que él eligió, y todo lo que
 * el render construya a partir del origen —enlaces absolutos, redirecciones,
 * peticiones internas— sale apuntando a donde ese alguien quiso.
 *
 * ## Por qué esto se lee del entorno y no solo de `angular.json`
 *
 * `security.allowedHosts` es una opción de **construcción**: queda sellada
 * dentro del artefacto. Sirve para lo que se sabe al compilar —`localhost`,
 * `127.0.0.1`, el nombre del servicio en compose— y **no** para el dominio
 * público, que cambia por entorno y a menudo no se conoce cuando se construye.
 *
 * Sin esta pasarela, estrenar un dominio obligaría a reconstruir el artefacto,
 * y el fallo de olvidarlo es especialmente traicionero: el servidor **no falla**
 * —responde 200— pero degrada a renderizado de cliente. La página funciona, más
 * lenta y sin SSR, y nadie se entera. Este proyecto ya lo vivió: la lista
 * estuvo vacía desde el principio y el prerenderizado no se aplicó nunca, en
 * ningún entorno, hasta que las pruebas de extremo a extremo lo destaparon.
 *
 * Lo que se declara acá se **suma** a lo del artefacto; no lo reemplaza.
 *
 *     SSR_ALLOWED_HOSTS=salud.example.bo,www.salud.example.bo
 *
 * ## Sobre el comodín
 *
 * `*` se rechaza a propósito. Angular lo acepta con un aviso, pero acá delante
 * hay un reverse proxy que ya reenvía el `Host` original (`proxy_set_header
 * Host $host` en `deploy/nginx.conf`), así que un comodín no resolvería ninguna
 * necesidad real y apagaría la única comprobación que existe. En un sistema
 * clínico eso no se deja como opción de configuración.
 */

/** Un host válido: nombre, opcionalmente con puerto. Sin esquema ni ruta. */
const HOST_VALIDO = /^[a-z0-9.-]+(:\d{1,5})?$/i;

export interface HostsPermitidos {
  readonly hosts: readonly string[];
  /** Entradas descartadas, con el motivo. Se registran al arrancar. */
  readonly descartados: readonly string[];
}

/**
 * Lee `SSR_ALLOWED_HOSTS` y devuelve los hosts utilizables.
 *
 * Separa por coma o espacios, porque las dos formas se escriben. Descarta —sin
 * lanzar— lo que no sea un host: un valor mal escrito no puede impedir que el
 * servidor arranque, pero **tiene que decirse**, o el síntoma vuelve a ser el
 * de siempre: todo responde, nada prerenderiza y nadie sabe por qué.
 */
export function parseAllowedHosts(raw: string | undefined): HostsPermitidos {
  const hosts: string[] = [];
  const descartados: string[] = [];

  for (const parte of (raw ?? '').split(/[,\s]+/)) {
    const valor = parte.trim();
    if (valor === '') {
      continue;
    }
    if (valor === '*') {
      descartados.push(`${valor} (el comodín apagaría la comprobación entera)`);
      continue;
    }
    if (!HOST_VALIDO.test(valor)) {
      descartados.push(`${valor} (no es un host: va sin esquema, sin ruta y sin barras)`);
      continue;
    }
    if (!hosts.includes(valor)) {
      hosts.push(valor);
    }
  }

  return { hosts, descartados };
}

/**
 * Los hosts del entorno, avisando por consola de lo que se descartó.
 *
 * El aviso va a `stderr` al arrancar: es el único momento en que alguien está
 * mirando el registro del despliegue.
 */
export function allowedHostsFromEnv(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  const { hosts, descartados } = parseAllowedHosts(env['SSR_ALLOWED_HOSTS']);

  for (const descartado of descartados) {
    console.warn(`[ssr] SSR_ALLOWED_HOSTS: se ignora ${descartado}`);
  }

  return hosts;
}
