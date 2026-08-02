import { allowedHostsFromEnv, parseAllowedHosts } from './allowed-hosts';

/**
 * El modo de fallo que estas pruebas vigilan **no se ve**: con el dominio fuera
 * de la lista, el servidor responde 200 y degrada a renderizado de cliente. La
 * página funciona, más lenta y sin SSR, y nadie se entera. Este proyecto ya lo
 * vivió durante meses.
 *
 * Por eso lo que se fija acá no es solo qué entra, sino qué se **descarta y se
 * dice**: una variable mal escrita que se ignorara en silencio reproduciría
 * exactamente el mismo síntoma.
 */
describe('allowed-hosts', () => {
  describe('lectura de la variable', () => {
    it('sin variable no agrega ningún host: manda lo que declara el artefacto', () => {
      expect(parseAllowedHosts(undefined).hosts).toEqual([]);
      expect(parseAllowedHosts('').hosts).toEqual([]);
    });

    it('acepta un dominio suelto', () => {
      expect(parseAllowedHosts('salud.example.bo').hosts).toEqual(['salud.example.bo']);
    });

    it('separa por coma y por espacios, porque las dos formas se escriben', () => {
      expect(parseAllowedHosts('uno.bo,dos.bo tres.bo').hosts).toEqual([
        'uno.bo',
        'dos.bo',
        'tres.bo',
      ]);
    });

    it('tolera los espacios de más alrededor de cada entrada', () => {
      expect(parseAllowedHosts('  uno.bo ,  dos.bo  ').hosts).toEqual(['uno.bo', 'dos.bo']);
    });

    it('admite el puerto: el `Host` de la petición lo lleva cuando no es el 80', () => {
      expect(parseAllowedHosts('localhost:4000').hosts).toEqual(['localhost:4000']);
    });

    it('no repite un host declarado dos veces', () => {
      expect(parseAllowedHosts('uno.bo,uno.bo').hosts).toEqual(['uno.bo']);
    });
  });

  describe('lo que se descarta', () => {
    it('rechaza el comodín: apagaría la única comprobación que hay', () => {
      const { hosts, descartados } = parseAllowedHosts('*');

      expect(hosts).toEqual([]);
      expect(descartados[0]).toContain('*');
    });

    it('rechaza una URL completa, que es el error de escritura más probable', () => {
      const { hosts, descartados } = parseAllowedHosts('https://salud.example.bo');

      expect(hosts).toEqual([]);
      expect(descartados[0]).toContain('https://salud.example.bo');
    });

    it('rechaza un host con ruta', () => {
      expect(parseAllowedHosts('salud.example.bo/app').hosts).toEqual([]);
    });

    /**
     * Descartar uno **no** puede tirar el resto: si al desplegar se cuela una
     * entrada mal escrita, el dominio bueno tiene que seguir sirviendo con SSR.
     */
    it('conserva los hosts válidos aunque alguno de la lista no lo sea', () => {
      const { hosts, descartados } = parseAllowedHosts('bueno.bo,https://malo.bo,otro.bo');

      expect(hosts).toEqual(['bueno.bo', 'otro.bo']);
      expect(descartados).toHaveLength(1);
    });
  });

  describe('aviso al arrancar', () => {
    it('lo descartado se dice por consola: en silencio, el síntoma es invisible', () => {
      const avisos: string[] = [];
      const original = console.warn;
      console.warn = (mensaje: string) => avisos.push(mensaje);

      try {
        const hosts = allowedHostsFromEnv({ SSR_ALLOWED_HOSTS: 'bueno.bo,*' });

        expect(hosts).toEqual(['bueno.bo']);
        expect(avisos).toHaveLength(1);
        expect(avisos[0]).toContain('SSR_ALLOWED_HOSTS');
      } finally {
        console.warn = original;
      }
    });

    it('sin nada que descartar no dice nada', () => {
      const avisos: string[] = [];
      const original = console.warn;
      console.warn = (mensaje: string) => avisos.push(mensaje);

      try {
        expect(allowedHostsFromEnv({ SSR_ALLOWED_HOSTS: 'bueno.bo' })).toEqual(['bueno.bo']);
        expect(avisos).toEqual([]);
      } finally {
        console.warn = original;
      }
    });
  });
});
