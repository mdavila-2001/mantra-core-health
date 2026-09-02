import { clave, distancia, lema, normalizar, tokenizar, tramosNegados } from './texto';

/**
 * La capa de lengua del reconocimiento de síntomas.
 *
 * Cada una de estas pruebas es un texto que **antes no se reconocía**. No están
 * para cubrir funciones: están para que el día que alguien toque el reductor de
 * plurales sepa qué se rompe.
 */
describe('normalizar', () => {
  it('colapsa los espacios: en un teléfono se escribe con dedos gordos', () => {
    expect(normalizar('  dolor   de  CABEZA ')).toBe('dolor de cabeza');
  });

  it('saca las tildes, que casi nadie escribe', () => {
    expect(normalizar('migraña')).toBe('migrana');
    expect(normalizar('Náuseas')).toBe('nauseas');
  });
});

describe('lema', () => {
  it('junta la familia de doler, que ningún reductor de sufijos alcanza', () => {
    for (const forma of ['duele', 'duelen', 'dolores', 'doliendo', 'dolorido']) {
      expect(lema(forma), forma).toBe('dolor');
    }
  });

  it('quita el plural sin comerse la palabra', () => {
    expect(lema('rodillas')).toBe('rodilla');
    expect(lema('articulaciones')).toBe('articulacion');
    // «dientes» pierde sólo la ese: «dient» no es nada, y la tabla dice
    // «diente».
    expect(lema('dientes')).toBe('diente');
    // Y «tos» no es un plural aunque termine en ese.
    expect(lema('tos')).toBe('tos');
  });

  it('neutraliza el género de los participios sin inventar palabras', () => {
    expect(lema('hinchada')).toBe('hinchazon');
    expect(lema('hinchado')).toBe('hinchazon');
    // «espada» NO se convierte en «espado»: así sigue estando a una letra de
    // «espalda», que es lo que alguien quiso escribir.
    expect(lema('espada')).toBe('espada');
  });

  it('colapsa el alargamiento, que es énfasis y no otra palabra', () => {
    expect(lema('doooolor')).toBe('dolor');
  });

  it('NO junta «duelo» con «doler»: son dos consultas distintas', () => {
    // Estar de duelo lleva a psicología; que algo duela, no. Confundirlos
    // mandaba a terapia a cualquiera que dijera que le duele la rodilla.
    expect(lema('duelo')).not.toBe('dolor');
  });
});

describe('clave', () => {
  it('hace sonar igual las faltas de ortografía del castellano', () => {
    expect(clave('caveza')).toBe(clave('cabeza'));
    expect(clave('cabesa')).toBe(clave('cabeza'));
    expect(clave('aogo')).toBe(clave('ahogo'));
    expect(clave('nauceas')).toBe(clave('nauseas'));
    expect(clave('diavetes')).toBe(clave('diabetes'));
  });

  it('no hace sonar igual dos palabras distintas', () => {
    expect(clave('cabeza')).not.toBe(clave('cadera'));
    expect(clave('panza')).not.toBe(clave('pecho'));
  });
});

describe('distancia', () => {
  it('cuenta una transposición como un error y no como dos', () => {
    // En un teclado de teléfono es el error típico.
    expect(distancia('dolro', 'dolor', 2)).toBe(1);
  });

  it('devuelve el tope más uno cuando se pasa, no la distancia real', () => {
    // Es un centinela. Leerlo como una distancia daba por parecidas dos
    // palabras que no se parecen en nada, y fue el peor error del motor.
    expect(distancia('fiebre', 'garganta', 1)).toBeGreaterThan(1);
  });
});

describe('tokenizar', () => {
  it('separa palabras completas, no subcadenas', () => {
    // «tos» dentro de «estos» era un falso positivo del motor viejo.
    const palabras = tokenizar(normalizar('todos estos dias')).map((t) => t.texto);
    expect(palabras).toEqual(['todos', 'estos', 'dias']);
  });

  it('marca las palabras que no dicen nada por sí solas', () => {
    const conContenido = tokenizar(normalizar('tengo un dolor muy fuerte en la cabeza'))
      .filter((t) => t.contenido)
      .map((t) => t.lema);

    expect(conContenido).toEqual(['dolor', 'fuerte', 'cabeza']);
  });

  it('cuenta las frases y marca dónde corta una coma', () => {
    const tokens = tokenizar(normalizar('tengo tos. me duele, mucho'));

    expect(tokens[2].frase).toBe(1);
    expect(tokens.find((t) => t.texto === 'mucho')?.corte).toBe(true);
  });
});

describe('tramosNegados', () => {
  it('marca lo que viene después de una negación', () => {
    const tokens = tokenizar(normalizar('no tengo fiebre'));

    expect(tramosNegados(tokens)).toEqual([[0, 2]]);
  });

  it('corta en la conjunción: «pero» empieza otra cosa', () => {
    const tokens = tokenizar(normalizar('no tengo fiebre pero me duele la garganta'));
    const [[, hasta]] = tramosNegados(tokens);

    expect(tokens[hasta].texto).toBe('fiebre');
  });

  it('corta en la coma', () => {
    // «no tengo tos, solo dolor de garganta»: la garganta duele.
    const tokens = tokenizar(normalizar('no tengo tos, solo dolor de garganta'));
    const [[, hasta]] = tramosNegados(tokens);

    expect(tokens[hasta].texto).toBe('tos');
  });

  it('no toma por negación la que afirma el síntoma', () => {
    // «no se me pasa el dolor» dice que el dolor está, no que falta.
    expect(tramosNegados(tokenizar(normalizar('no se me pasa el dolor de cabeza')))).toEqual([]);
    expect(tramosNegados(tokenizar(normalizar('no aguanto el dolor')))).toEqual([]);
  });
});
