import { paginarCampos } from './paginar-campos';
import { MAX_CAMPOS_POR_PAGINA, type CampoDeFormulario } from './paginated-form.types';

/**
 * Lo que se prueba acá es **una invariante**, no un comportamiento cómodo.
 *
 * El tope de cuatro campos por página es la razón de que el motor exista, y su
 * modo de fallo es silencioso: nadie ve una excepción, se ve una pantalla con
 * nueve campos que alguien abandona a la mitad. Por eso la comprobación no es
 * «con trece campos salen cuatro páginas» —eso es aritmética— sino «ninguna
 * página, con ninguna entrada, excede el tope».
 */

/** Campos de mentira, los que hagan falta. */
function campos(cuantos: number): readonly CampoDeFormulario[] {
  return Array.from({ length: cuantos }, (_, indice) => ({
    key: `campo${indice + 1}`,
    label: `Campo ${indice + 1}`,
    control: 'text' as const,
  }));
}

describe('paginarCampos', () => {
  describe('el tope', () => {
    // 13 es el alta de paciente, que es el caso que originó todo esto.
    for (const cuantos of [1, 3, 4, 5, 8, 9, 13, 40]) {
      it(`con ${cuantos} campos, ninguna página pasa de ${MAX_CAMPOS_POR_PAGINA}`, () => {
        const paginas = paginarCampos(campos(cuantos));

        expect(paginas.length).toBeGreaterThan(0);
        for (const pagina of paginas) {
          expect(pagina.campos.length).toBeLessThanOrEqual(MAX_CAMPOS_POR_PAGINA);
          // Y ninguna vacía: una página que no pide nada es un paso de más en la
          // barra de avance, y quien lo ve cree que algo no cargó.
          expect(pagina.campos.length).toBeGreaterThan(0);
        }
      });
    }

    it('no pierde ni duplica ningún campo al partir', () => {
      const originales = campos(13);

      const repartidos = paginarCampos(originales).flatMap((pagina) => pagina.campos);

      // El orden importa tanto como la cuenta: un formulario que pregunta la
      // contraseña antes que el nombre está roto aunque no falte nada.
      expect(repartidos.map((campo) => campo.key)).toEqual(originales.map((campo) => campo.key));
    });
  });

  describe('las secciones', () => {
    it('respeta los cortes que trae el formulario, aunque quepan juntos', () => {
      const paginas = paginarCampos([
        { titulo: 'Identidad', campos: campos(2) },
        { titulo: 'Acceso', campos: campos(2) },
      ]);

      // Cuatro campos caben en una página, y aun así son dos: las secciones son
      // una decisión de quien declara el formulario, no una consecuencia del tope.
      expect(paginas.map((pagina) => pagina.titulo)).toEqual(['Identidad', 'Acceso']);
    });

    it('una sección larga se parte conservando su nombre', () => {
      const paginas = paginarCampos([{ titulo: 'Datos de contacto', campos: campos(6) }]);

      expect(paginas.map((pagina) => pagina.titulo)).toEqual([
        'Datos de contacto (1 de 2)',
        'Datos de contacto (2 de 2)',
      ]);
    });

    it('una sección que cabe entera no se numera', () => {
      const [pagina] = paginarCampos([{ titulo: 'Identidad', campos: campos(4) }]);

      // «(1 de 1)» sería ruido: no hay nada de qué distinguirla.
      expect(pagina.titulo).toBe('Identidad');
    });

    it('la ayuda de la sección viaja a todas sus páginas', () => {
      const paginas = paginarCampos([
        { titulo: 'Habilitación', hint: 'Tal como figura en tu matrícula.', campos: campos(5) },
      ]);

      // Quien llega a la segunda página no vio la primera hace un rato: una
      // explicación que sólo sale en el primer trozo es una que la mitad no lee.
      expect(paginas.map((pagina) => pagina.hint)).toEqual([
        'Tal como figura en tu matrícula.',
        'Tal como figura en tu matrícula.',
      ]);
    });

    it('una sección vacía no produce página', () => {
      const paginas = paginarCampos([
        { titulo: 'Identidad', campos: campos(2) },
        { titulo: 'Sin nada', campos: [] },
      ]);

      expect(paginas.map((pagina) => pagina.titulo)).toEqual(['Identidad']);
    });
  });

  describe('los bordes', () => {
    it('sin campos no hay páginas', () => {
      expect(paginarCampos([])).toEqual([]);
    });

    it('una lista suelta de campos toma el título que se le dé', () => {
      const [pagina] = paginarCampos(campos(2), { tituloPorDefecto: 'Tus datos' });

      expect(pagina.titulo).toBe('Tus datos');
    });
  });
});
