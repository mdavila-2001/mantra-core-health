import { artefactosInexistentesDan404, esArtefactoDeConstruccion } from './build-assets';

/**
 * Lo que estas pruebas vigilan es un fallo que **se disfraza de otra cosa**: un
 * `chunk-*.js` que ya no existe devolvía el HTML de la aplicación con un 200, y
 * el navegador se quejaba de no poder importar un módulo. El síntoma señalaba al
 * cliente cuando el problema estaba en el servidor.
 *
 * La otra mitad —que un navegador con el `index.html` viejo en caché pida esos
 * chunks— la cubre el `no-cache` del HTML en `server.ts`.
 */
describe('build-assets', () => {
  describe('qué cuenta como artefacto de la construcción', () => {
    it('reconoce las extensiones que sólo emite el build', () => {
      expect(esArtefactoDeConstruccion('/chunk-P744KRQN.js')).toBe(true);
      expect(esArtefactoDeConstruccion('/main-2VEGBWX2.js')).toBe(true);
      expect(esArtefactoDeConstruccion('/polyfills.mjs')).toBe(true);
      expect(esArtefactoDeConstruccion('/styles-ABC123.css')).toBe(true);
      expect(esArtefactoDeConstruccion('/main.js.map')).toBe(true);
    });

    it('no toca las rutas del router, que es lo que el SSR tiene que renderizar', () => {
      expect(esArtefactoDeConstruccion('/auth/register')).toBe(false);
      expect(esArtefactoDeConstruccion('/search')).toBe(false);
      expect(esArtefactoDeConstruccion('/')).toBe(false);
    });

    it('ignora la cadena de consulta al decidir', () => {
      expect(esArtefactoDeConstruccion('/chunk-ABC.js?v=2')).toBe(true);
    });
  });

  describe('el middleware', () => {
    function correr(ruta: string) {
      const res = {
        codigo: 0,
        terminado: false,
        status(codigo: number) {
          this.codigo = codigo;
          return this;
        },
        end() {
          this.terminado = true;
        },
      };
      let siguiente = false;
      artefactosInexistentesDan404()(
        { path: ruta } as never,
        res as never,
        (() => {
          siguiente = true;
        }) as never,
      );
      return { res, siguiente };
    }

    it('corta con 404 el artefacto que no existe, en vez de renderizar la aplicación', () => {
      const { res, siguiente } = correr('/chunk-P744KRQN.js');
      expect(res.codigo).toBe(404);
      expect(res.terminado).toBe(true);
      expect(siguiente).toBe(false);
    });

    it('deja pasar una ruta de la aplicación hacia el motor de Angular', () => {
      const { res, siguiente } = correr('/auth/register');
      expect(siguiente).toBe(true);
      expect(res.codigo).toBe(0);
    });
  });
});
