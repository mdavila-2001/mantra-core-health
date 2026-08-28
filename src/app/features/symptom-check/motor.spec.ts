import { analizar, sugerirDe } from './motor';
import { SINTOMAS, SINTOMAS_DE_ALARMA, type Sintoma } from './sintomas.datos';
import { TODOS_LOS_SINTOMAS } from './sintomas';

/**
 * El motor de reconocimiento.
 *
 * Estas pruebas son la lista de lo que el motor viejo —una búsqueda de
 * subcadenas contra una tabla de sinónimos— no podía hacer. Cada `describe` es
 * una de las cinco maneras en que fallaba.
 */
const ids = (texto: string): readonly string[] =>
  analizar(texto, TODOS_LOS_SINTOMAS).sintomas.map((c) => c.sintoma.id);

const alarmas = (texto: string): readonly string[] =>
  analizar(texto, TODOS_LOS_SINTOMAS).alarmas.map((c) => c.sintoma.id);

describe('la gramática de verdad', () => {
  it('reconoce el plural y el verbo conjugado', () => {
    expect(ids('me duelen las rodillas')).toContain('dolor-de-rodilla');
    expect(ids('la cabeza me duele')).toContain('dolor-de-cabeza');
    expect(ids('ayer me dolia la cabeza')).toContain('dolor-de-cabeza');
  });

  it('deja meter palabras en el medio', () => {
    expect(ids('tengo un dolor muy fuerte en la cabeza')).toContain('dolor-de-cabeza');
  });

  it('no cruza dos frases para armar un síntoma', () => {
    // «Me duele la rodilla. La cabeza la tengo bien» no es dolor de cabeza.
    expect(ids('me duele la rodilla. la cabeza la tengo bien')).not.toContain('dolor-de-cabeza');
  });

  it('un verbo alcanza para dos síntomas encadenados', () => {
    // «Me duele la cabeza y la garganta» tiene un solo «duele».
    expect(ids('me duele la cabeza y la garganta')).toEqual([
      'dolor-de-cabeza',
      'dolor-de-garganta',
    ]);
  });
});

describe('cómo se escribe en un teléfono', () => {
  it('encuentra la falta de ortografía homófona', () => {
    expect(ids('me duele la caveza')).toContain('dolor-de-cabeza');
    expect(ids('tengo fievre')).toContain('fiebre');
    expect(ids('siento nauceas')).toContain('nauseas');
  });

  it('encuentra la letra de más y la de menos', () => {
    expect(ids('estoy con diarea')).toContain('diarrea');
    expect(ids('tengo dolor de kbeza')).toContain('dolor-de-cabeza');
  });

  it('no confunde una palabra corta con otra', () => {
    // Con parecido tipográfico suelto, «dos» y «vos» serían «tos».
    expect(ids('somos dos personas')).toEqual([]);
  });

  it('no toma «alegría» por «alergia»', () => {
    // Están a una transposición y significan lo contrario.
    expect(ids('estoy con mucha alegria')).toEqual([]);
  });
});

describe('lo que la persona dice que NO tiene', () => {
  it('no reconoce lo negado', () => {
    expect(ids('no tengo fiebre')).toEqual([]);
    expect(ids('sin fiebre')).toEqual([]);
    expect(ids('no me duele la cabeza')).toEqual([]);
  });

  it('la negación termina donde empieza otra cosa', () => {
    expect(ids('no tengo fiebre pero me duele la garganta')).toEqual(['dolor-de-garganta']);
    expect(ids('no tengo tos, solo dolor de garganta')).toEqual(['dolor-de-garganta']);
  });

  it('el verbo compartido no arrastra al segundo síntoma', () => {
    // «Ya no me duele la cabeza, ahora es la panza»: hay un solo «duele», y
    // está negado, pero la panza no.
    expect(ids('ya no me duele la cabeza, ahora es la panza')).toEqual(['dolor-de-panza']);
  });

  it('un síntoma que se dice CON un «no» no queda negado', () => {
    // «No puedo respirar» se dice con un «no» que no niega: constituye.
    expect(alarmas('no puedo respirar')).toContain('falta-de-aire');
    expect(ids('no puedo dormir')).toContain('insomnio');
  });

  it('«no se me pasa» afirma, no niega', () => {
    expect(ids('no se me pasa el dolor de cabeza')).toContain('dolor-de-cabeza');
  });

  it('lo negado se puede consultar aparte, para poder explicarlo', () => {
    const negados = analizar('no tengo fiebre', TODOS_LOS_SINTOMAS).negados;

    expect(negados.map((c) => c.sintoma.id)).toEqual(['fiebre']);
  });
});

describe('las urgencias', () => {
  it('deriva lo que no puede esperar un turno', () => {
    expect(alarmas('me duele el pecho y no puedo respirar')).toEqual([
      'dolor-de-pecho',
      'falta-de-aire',
    ]);
  });

  it('NO deriva un ataque de pánico', () => {
    // El motor viejo buscaba «ataque» como subcadena y mandaba a una guardia a
    // alguien con ansiedad. Es el falso positivo más caro que tenía.
    expect(alarmas('tengo ataques de panico')).toEqual([]);
    expect(ids('tengo ataques de panico')).toEqual(['ansiedad']);
  });

  it('NO deriva a quien le sangran las encías', () => {
    expect(alarmas('me sangran las encias al cepillarme')).toEqual([]);
  });

  it('lo más específico gana: vomitar sangre no es vomitar', () => {
    expect(alarmas('vomite sangre')).toEqual(['sangrado-abundante']);
    expect(ids('vomite sangre')).toEqual([]);
  });

  it('no deriva lo que la persona niega', () => {
    expect(alarmas('no tengo dolor de pecho')).toEqual([]);
  });

  it('una crisis de salud mental trae su propio mensaje', () => {
    const crisis = SINTOMAS_DE_ALARMA.find((s) => s.id === 'ideas-suicidas');

    expect(alarmas('no quiero seguir viviendo')).toEqual(['ideas-suicidas']);
    expect(crisis?.mensaje).toBeDefined();
  });
});

describe('lo que se dice con números', () => {
  it('lee la fiebre medida', () => {
    expect(ids('tengo 38.5 de fiebre')).toContain('fiebre');
    expect(ids('el termometro me dio 39')).toContain('fiebre');
  });

  it('no toma cualquier número por una medición', () => {
    expect(ids('me duele la cabeza hace 5 dias')).toEqual(['dolor-de-cabeza']);
    expect(ids('tengo 36 de temperatura')).toEqual([]);
  });

  it('lee la presión y la glucosa', () => {
    expect(ids('la presion me dio 160/100')).toContain('presion-alta');
    expect(ids('la glucosa me dio 280')).toContain('azucar-alta');
  });
});

describe('el motivo genérico', () => {
  it('aparece cuando es lo único que hay', () => {
    expect(ids('quiero un control')).toEqual(['chequeo']);
  });

  it('desaparece cuando la persona ya dijo qué le pasa', () => {
    // «Un chequeo general» al lado de «problemas de tiroides» no agrega nada.
    expect(ids('me diagnosticaron hipotiroidismo y quiero un control')).toEqual(['tiroides']);
  });
});

describe('la confianza y la evidencia', () => {
  it('una coincidencia exacta vale más que una por parecido', () => {
    const exacta = analizar('dolor de cabeza', SINTOMAS).sintomas[0];
    const aproximada = analizar('dolor de kbeza', SINTOMAS).sintomas[0];

    expect(exacta.confianza).toBe(1);
    expect(aproximada.confianza).toBeLessThan(1);
  });

  it('dice qué trozo de texto la trajo', () => {
    const [coincidencia] = analizar('desde el lunes me duele la cabeza', SINTOMAS).sintomas;

    expect(coincidencia.evidencia).toBe('duele la cabeza');
  });
});

describe('el motor contra una tabla cualquiera', () => {
  it('no sabe nada de la tabla real: se le inyecta', () => {
    const tabla: readonly Sintoma[] = [
      {
        id: 'inventado',
        nombre: 'algo inventado',
        sinonimos: ['pata de palo'],
        especialidades: [{ nombre: 'Carpintería', peso: 3 }],
      },
    ];

    expect(analizar('tengo la pata de palo rota', tabla).sintomas.map((c) => c.sintoma.id)).toEqual([
      'inventado',
    ]);
  });
});

describe('sugerirDe', () => {
  it('busca por el comienzo de cualquier palabra, no de la frase', () => {
    // Quien escribió «cabe» espera ver «dolor de cabeza»; con la búsqueda vieja
    // —que exigía que el sinónimo empezara así— no lo veía nunca.
    const sugeridos = sugerirDe('cabe', SINTOMAS, new Set(), 6).map((s) => s.id);

    expect(sugeridos[0]).toBe('dolor-de-cabeza');
  });

  it('sugiere aunque esté mal escrito', () => {
    expect(sugerirDe('caveza', SINTOMAS, new Set(), 6).map((s) => s.id)).toContain(
      'dolor-de-cabeza',
    );
  });

  it('no sugiere una urgencia: no es un chip que se elige', () => {
    expect(sugerirDe('convul', SINTOMAS, new Set(), 6)).toEqual([]);
  });
});
