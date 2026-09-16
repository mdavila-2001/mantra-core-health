import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  contentSecurityPolicy,
  cspHashOf,
  inlineScriptHashesOf,
  securityHeaders,
  sourceIndexScriptHashes,
} from './security-headers';

/**
 * Una CSP mal armada rompe la aplicación entera **en silencio**: el navegador
 * bloquea recursos sin avisarle a nadie, y el síntoma —pantalla sin estilos, o
 * tema que parpadea— aparece solo en producción.
 *
 * Estas pruebas fijan las cuatro decisiones que hacen que la política funcione
 * con este proyecto concreto.
 */
describe('security-headers', () => {
  it('permite previews locales de medios sin abrir frames u objetos', () => {
    const policy = contentSecurityPolicy();
    expect(policy).toContain("media-src 'self' blob:");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  describe('hashes de scripts en línea', () => {
    it('el hash es el sha256 del contenido exacto, en formato CSP', () => {
      // Vector conocido: sha256 de la cadena vacía.
      expect(cspHashOf('')).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
    });

    it('un espacio de más cambia el hash: por eso el contenido no se recorta', () => {
      expect(cspHashOf('a()')).not.toBe(cspHashOf('a() '));
    });

    it('extrae los scripts en línea de un HTML', () => {
      const html = '<head><script>uno()</script><script>dos()</script></head>';

      expect(inlineScriptHashesOf(html)).toEqual([cspHashOf('uno()'), cspHashOf('dos()')]);
    });

    it('ignora los scripts con `src`: ésos los cubre `self`', () => {
      const html = '<script src="/main.js"></script><script>inline()</script>';

      expect(inlineScriptHashesOf(html)).toEqual([cspHashOf('inline()')]);
    });

    it('reconoce los scripts con atributos, como los que emite Angular', () => {
      const html = '<script type="module" defer>hidratar()</script>';

      expect(inlineScriptHashesOf(html)).toEqual([cspHashOf('hidratar()')]);
    });
  });

  describe('`sourceIndexScriptHashes` (AG49-FT01-003)', () => {
    let raiz: string;

    beforeEach(() => {
      raiz = mkdtempSync(join(tmpdir(), 'alovida-security-headers-'));
    });

    afterEach(() => rmSync(raiz, { recursive: true, force: true }));

    it('hashea el script en línea de `src/index.html` bajo la raíz dada', () => {
      mkdirSync(join(raiz, 'src'));
      writeFileSync(
        join(raiz, 'src', 'index.html'),
        '<html><head><script>tema()</script></head></html>',
      );

      expect(sourceIndexScriptHashes(raiz)).toEqual([cspHashOf('tema()')]);
    });

    it('sin `src/index.html` —una imagen de despliegue que sólo trae `dist/`— no rompe: lista vacía', () => {
      expect(sourceIndexScriptHashes(raiz)).toEqual([]);
    });

    it('el `index.html` real del repo aporta el hash que ya sirve el navegador (uno o dos, según el final de línea del checkout)', () => {
      // Fija el caso que motivó esto: sin `dist/browser` que recorrer —como
      // pasa bajo `ng serve --ssr`— este es el ÚNICO origen del hash del
      // script anti-parpadeo del tema. Uno o dos elementos, no exactamente
      // uno: un checkout con `core.autocrlf=false` deja el `\r\n` de Windows
      // en el archivo y esto aporta las dos variantes (cruda y normalizada a
      // `\n`); un checkout que ya normalizó a `\n` hace que las dos coincidan
      // y el `Set` de `server.ts` las deje en una sola.
      const hashes = sourceIndexScriptHashes(process.cwd());

      expect(hashes.length).toBeGreaterThanOrEqual(1);
      expect(hashes.length).toBeLessThanOrEqual(2);
      for (const hash of hashes) {
        expect(hash).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);
      }
    });

    it('CRLF y LF del mismo script son bytes distintos: hashea los dos finales de línea (AG49-FT01-003)', () => {
      // El caso real que motivó esto: `ng serve --ssr` sirvió el mismo script
      // dos veces en la misma corrida de Playwright con dos hashes distintos
      // —uno por cada vía de render— porque el archivo en disco trae `\r\n`
      // (checkout Windows) y sólo UNA de esas dos vías lo normaliza a `\n` al
      // servirlo. Sin esto, la CSP sólo cubría la que se probó primero.
      mkdirSync(join(raiz, 'src'));
      writeFileSync(join(raiz, 'src', 'index.html'), '<script>tema();\r\nmas();</script>', {
        encoding: 'utf8',
      });

      const hashes = sourceIndexScriptHashes(raiz);

      expect(hashes).toEqual(
        expect.arrayContaining([cspHashOf('tema();\r\nmas();'), cspHashOf('tema();\nmas();')]),
      );
      expect(hashes).toHaveLength(2);
    });
  });

  describe('política', () => {
    it('cierra el clickjacking, que en salud no es un riesgo menor', () => {
      expect(contentSecurityPolicy()).toContain("frame-ancestors 'none'");
    });

    it('permite estilos en línea: Angular emite los de componente así', () => {
      // Sin esto la aplicación se ve sin estilos. Es un riesgo mucho menor que
      // `unsafe-inline` en `script-src`, que la política NO concede.
      expect(contentSecurityPolicy()).toContain("style-src 'self' 'unsafe-inline'");
      expect(contentSecurityPolicy()).not.toContain("script-src 'self' 'unsafe-inline'");
    });

    it('no abre ningún CDN de tipografías: están autoalojadas', () => {
      expect(contentSecurityPolicy()).toContain("font-src 'self'");
      expect(contentSecurityPolicy()).not.toContain('fonts.googleapis.com');
    });

    it('abre imágenes SOLO a los tiles del proveedor del mapa, y nada más sale a terceros', () => {
      const csp = contentSecurityPolicy();

      // El mapa (Leaflet sin clave de API) pide sus tiles directo del
      // navegador; sin este origen queda un rectángulo gris.
      expect(csp).toContain("img-src 'self' data: https://*.basemaps.cartocdn.com");
      // El permiso es de imágenes: scripts y conexiones no se abren con él.
      expect(csp).not.toContain('script-src \'self\' https://*.basemaps.cartocdn.com');
      expect(csp).not.toContain('connect-src \'self\' https://*.basemaps.cartocdn.com');
    });

    it('con la API en el mismo origen, `connect-src` se queda en `self`', () => {
      expect(contentSecurityPolicy({ apiBaseUrl: '' })).toContain("connect-src 'self';");
    });

    it('con la API en otro dominio agrega SOLO su origen, no la ruta', () => {
      const csp = contentSecurityPolicy({ apiBaseUrl: 'https://api.ejemplo.com/v1' });

      expect(csp).toContain("connect-src 'self' https://api.ejemplo.com");
      expect(csp).not.toContain('/v1');
    });

    it('una raíz de API ilegible no rompe la política', () => {
      expect(contentSecurityPolicy({ apiBaseUrl: 'no-es-una-url' })).toContain(
        "connect-src 'self';",
      );
    });

    it('incluye los hashes que se le pasan', () => {
      const csp = contentSecurityPolicy({ inlineScriptHashes: ["'sha256-abc'", "'sha256-def'"] });

      expect(csp).toContain("script-src 'self' 'sha256-abc' 'sha256-def'");
    });
  });

  describe('cabeceras', () => {
    it('emite las seis', () => {
      expect(Object.keys(securityHeaders()).sort()).toEqual([
        'Content-Security-Policy',
        'Permissions-Policy',
        'Referrer-Policy',
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'X-Frame-Options',
      ]);
    });

    it('no filtra la URL de origen a otro sitio', () => {
      // Cuando existan rutas con identificadores (`/pacientes/:id`), el
      // `Referer` sería una filtración.
      expect(securityHeaders()['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('niega cámara y micrófono; la ubicación queda solo para el propio origen', () => {
      // «Dónde comprar mi receta» pide la posición con permiso del navegador
      // para ordenar sucursales por cercanía; `geolocation=()` la apagaba para
      // toda la aplicación. `(self)` nunca la concede a un iframe de terceros.
      expect(securityHeaders()['Permissions-Policy']).toBe(
        'camera=(), microphone=(), geolocation=(self)',
      );
    });
  });

  describe('`upgrade-insecure-requests` y el servidor sin TLS', () => {
    it('va por omisión: sobre HTTPS es lo correcto', () => {
      expect(contentSecurityPolicy()).toContain('upgrade-insecure-requests');
    });

    it('se puede quitar, y entonces no aparece en ninguna forma', () => {
      // Servida por HTTP, la directiva hace que el navegador pida cada
      // subrecurso por `https` contra un servidor que no habla TLS: la página
      // queda sin estilos, sin JavaScript y sin imágenes. `localhost` está
      // exento del ascenso, así que el defecto solo se ve desde otra máquina.
      const politica = contentSecurityPolicy({ upgradeInsecureRequests: false });

      expect(politica).not.toContain('upgrade-insecure-requests');
      // Sin `;` colgando ni directiva vacía al final.
      expect(politica.endsWith("form-action 'self'")).toBe(true);
    });

    it('quitarla no toca ninguna otra directiva', () => {
      const conDirectiva = contentSecurityPolicy().split('; ');
      const sinDirectiva = contentSecurityPolicy({ upgradeInsecureRequests: false }).split('; ');

      expect(conDirectiva.filter((d) => d !== 'upgrade-insecure-requests')).toEqual(sinDirectiva);
    });

    it('`securityHeaders` la propaga a la cabecera que se emite', () => {
      expect(securityHeaders({ upgradeInsecureRequests: false })['Content-Security-Policy']).not.toContain(
        'upgrade-insecure-requests',
      );
    });
  });
});
