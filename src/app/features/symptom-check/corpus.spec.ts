import { BANCO, type CasoDelBanco } from './corpus.fixture';
import { reconocer, reconocerAlarmas } from './sintomas';

/**
 * La medición del reconocimiento de síntomas.
 *
 * Las demás pruebas dicen que el motor hace lo que dice hacer. Ésta dice
 * **cuánto** acierta, que es la única forma de saber si un cambio en la tabla o
 * en el motor mejoró o empeoró las cosas — y de que «anda mejor» deje de ser
 * una opinión.
 *
 * Falla con la lista de los textos que se rompieron, no con un número: el
 * número no dice qué arreglar.
 */
function fallosDe(caso: CasoDelBanco): string | null {
  const sintomas = [...reconocer(caso.texto)].map((s) => s.id).sort();
  const alarmas = [...reconocerAlarmas(caso.texto)].map((s) => s.id).sort();
  const esperados = [...caso.sintomas].sort();
  const esperadas = [...(caso.alarmas ?? [])].sort();

  if (sintomas.join() === esperados.join() && alarmas.join() === esperadas.join()) {
    return null;
  }
  return (
    `«${caso.texto}» — esperado [${esperados}] / alarmas [${esperadas}]` +
    ` · dio [${sintomas}] / alarmas [${alarmas}]`
  );
}

describe('el banco de textos', () => {
  it('reconoce los 296 textos tal como dice la tabla', () => {
    const fallos = BANCO.map(fallosDe).filter((fallo): fallo is string => fallo !== null);

    expect(fallos).toEqual([]);
  });

  it('no manda a una guardia a quien no lo necesita', () => {
    // El error más caro de esta pantalla no es no entender: es asustar. Una
    // alarma de más se mide aparte y no se negocia con el porcentaje general.
    const deMas = BANCO.filter((caso) => (caso.alarmas ?? []).length === 0)
      .filter((caso) => reconocerAlarmas(caso.texto).length > 0)
      .map((caso) => caso.texto);

    expect(deMas).toEqual([]);
  });

  it('no deja pasar una urgencia que el texto nombra', () => {
    // Y el segundo error más caro es el contrario.
    const faltantes = BANCO.filter((caso) => (caso.alarmas ?? []).length > 0)
      .filter((caso) => {
        const dio = new Set(reconocerAlarmas(caso.texto).map((s) => s.id));
        return (caso.alarmas ?? []).some((esperada) => !dio.has(esperada));
      })
      .map((caso) => caso.texto);

    expect(faltantes).toEqual([]);
  });

  it('el banco cubre las tres maneras de escribir mal', () => {
    // Si alguien recorta el banco, que se note qué dejó de estar medido.
    const textos = BANCO.map((caso) => caso.texto).join(' ');

    expect(textos).toContain('caveza');
    expect(textos).toContain('no tengo fiebre');
    expect(textos).toContain('me duelen las rodillas');
  });
});

describe('el coste de reconocer', () => {
  it('analiza un texto largo en menos de lo que dura una tecla', () => {
    // Esto corre en cada pulsación. Si tarda, la pantalla se traba mientras
    // alguien cuenta lo que le pasa, que es el único momento que importa.
    const largo =
      'me duele mucho la cabeza hace tres dias, tengo fiebre de 38.5, nauseas y no puedo dormir. ' +
      'ademas me arde al orinar y se me hinchan los tobillos desde el lunes pasado';
    reconocer(largo);

    const empezo = performance.now();
    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      reconocer(`${largo} ${vuelta}`);
    }
    const porVez = (performance.now() - empezo) / 20;

    expect(porVez).toBeLessThan(16);
  });
});
