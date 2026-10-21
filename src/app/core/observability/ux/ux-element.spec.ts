import { describirElemento, esCampo, limpiarValor, tipoDeCampo } from './ux-element';

/**
 * Lo que estas pruebas fijan: que el descriptor que agrupa los clics del mapa
 * de calor **no saca nada que escribió una persona**. En salud, el texto de un
 * botón («Ver receta de Ana Pérez») es un dato de salud con nombre.
 */
describe('describirElemento', () => {
  function montar(html: string): HTMLElement {
    document.body.innerHTML = html;
    return document.body;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('describe el control sin texto, aria-label, title, id, clase ni href', () => {
    montar(`
      <app-recetas>
        <a id="receta-3f2504e0-4f89-41d3-9a0c-0305e82c3301" class="fila activa"
           href="/pacientes/8437/recetas" aria-label="Ver receta de Ana Pérez" title="Ana Pérez">
          Ver receta de Ana Pérez
        </a>
      </app-recetas>
    `);

    const descriptor = describirElemento(document.querySelector('a'));

    expect(descriptor?.selector).toBe('app-recetas > a');
    expect(descriptor?.interactivo).toBe(true);
    for (const prohibido of ['Ana', 'Pérez', 'receta-', '8437', 'fila', 'activa', 'href', 'aria']) {
      expect(descriptor?.selector).not.toContain(prohibido);
    }
  });

  it('un clic dentro del botón se atribuye al botón', () => {
    montar('<button type="submit" data-testid="guardar"><span><svg></svg>Guardar</span></button>');

    const descriptor = describirElemento(document.querySelector('svg'));

    expect(descriptor?.ancla).toBe(document.querySelector('button'));
    expect(descriptor?.selector).toBe('button[data-testid="guardar"][type="submit"]');
  });

  it('reemplaza uuid y corridas de dígitos de los atributos por :id', () => {
    montar('<div data-testid="fila-3f2504e0-4f89-41d3-9a0c-0305e82c3301"><button data-testid="ver-8437">x</button></div>');

    const descriptor = describirElemento(document.querySelector('button'));

    expect(descriptor?.selector).toBe('button[data-testid="ver-:id"]');
    expect(limpiarValor('fila-3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe('fila-:id');
  });

  it('se detiene en el primer ancestro con data-testid', () => {
    montar('<main><section data-testid="agenda"><ul><li><button>x</button></li></ul></section></main>');

    expect(describirElemento(document.querySelector('button'))?.selector).toBe(
      'section[data-testid="agenda"] > ul > li > button',
    );
  });

  it('publica formcontrolname, role y type de la lista blanca, y descarta los demás', () => {
    montar('<form><input formcontrolname="dosis" type="number" role="spinbutton" placeholder="Paracetamol"></form>');

    const descriptor = describirElemento(document.querySelector('input'));

    expect(descriptor?.selector).toBe('form > input[type="number"][name="dosis"]');
    expect(descriptor?.selector).not.toContain('Paracetamol');
  });

  it('no limpia un atributo hasta dejarlo capaz de romper el selector', () => {
    expect(limpiarValor('a"] > script[x="')).toBe('ascriptx');
  });

  it('no describe nada dentro de una zona data-ux-ignore', () => {
    montar('<div data-ux-ignore><button>Diagnóstico</button></div>');

    expect(describirElemento(document.querySelector('button'))).toBeNull();
  });

  it('no describe lo que no es un elemento', () => {
    expect(describirElemento(null)).toBeNull();
    expect(describirElemento(window)).toBeNull();
  });

  it('recorta el selector por la izquierda a 300 caracteres', () => {
    const profundo = '<div data-testid="x"><b><b><b><b><button name="' + 'n'.repeat(60) + '">x</button></b></b></b></b></div>';
    montar(profundo.replace(/<b>/g, `<app-${'a'.repeat(70)}>`).replace(/<\/b>/g, `</app-${'a'.repeat(70)}>`));

    const selector = describirElemento(document.querySelector('button'))?.selector ?? '';

    expect(selector.length).toBeLessThanOrEqual(300);
    expect(selector.endsWith(`button[name="${'n'.repeat(60)}"]`)).toBe(true);
  });
});

describe('campos', () => {
  it('reconoce input, select y textarea y nada más', () => {
    document.body.innerHTML = '<input><select></select><textarea></textarea><button></button>';
    const [input, select, textarea, button] = Array.from(document.body.children);

    expect([input, select, textarea, button].map((el) => esCampo(el ?? null))).toEqual([true, true, true, false]);
    expect(tipoDeCampo(input!)).toBe('input');
    expect(tipoDeCampo(select!)).toBe('select');
    expect(tipoDeCampo(textarea!)).toBe('textarea');
  });

  it('un type fuera de la lista blanca viaja como «otro»', () => {
    document.body.innerHTML = '<input type="x-propio">';

    expect(tipoDeCampo(document.querySelector('input')!)).toBe('otro');
  });
});
