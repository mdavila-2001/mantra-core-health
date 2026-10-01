import {
  conceptIdDe,
  explicar,
  normalizar,
  reconocer,
  reconocerAlarmas,
  reconocerNegados,
  recomendar,
  sugerir,
  SINTOMAS,
  SINTOMAS_DE_ALARMA,
  TODOS_LOS_SINTOMAS,
} from './sintomas';
import { ZONAS_CON_SILUETA } from '@shared/components/organisms/body-map/body-map';
import { ZONAS_DEL_CUERPO } from './zonas.datos';
import { ultimaFrase } from './texto';

/**
 * El flujo de síntomas (Frente C del plan de UX del 22/08/2026).
 *
 * El criterio de aceptación del plan es literal y estas pruebas son ese
 * criterio: quien escribe «me duele la cabeza hace tres días y veo borroso» ve
 * pintarse `dolor de cabeza` y `visión borrosa`, y recibe Neurología y
 * Oftalmología con su porqué.
 */
describe('reconocer', () => {
  it('reconoce el caso del criterio de aceptación, tal cual', () => {
    const encontrados = reconocer('me duele la cabeza hace tres días y veo borroso');

    expect(encontrados.map((s) => s.nombre)).toEqual(['dolor de cabeza', 'visión borrosa']);
  });

  it('los devuelve en el orden en que se escribieron, no en el de la tabla', () => {
    // Los chips se pintan mientras se escribe: si saltaran de lugar al agregar
    // el segundo síntoma, se leería como que la pantalla cambió de opinión.
    const encontrados = reconocer('veo borroso y me duele la cabeza');

    expect(encontrados.map((s) => s.nombre)).toEqual(['visión borrosa', 'dolor de cabeza']);
  });

  it('encuentra sin tildes: casi nadie las escribe en un teléfono', () => {
    expect(reconocer('tengo migrana').map((s) => s.id)).toContain('dolor-de-cabeza');
    expect(reconocer('tengo migraña').map((s) => s.id)).toContain('dolor-de-cabeza');
  });

  it('no repite un síntoma que el texto nombra de dos maneras', () => {
    const encontrados = reconocer('me duele la panza, dolor de barriga desde ayer');

    expect(encontrados.filter((s) => s.id === 'dolor-de-panza')).toHaveLength(1);
  });

  it('con el campo vacío no reconoce nada', () => {
    expect(reconocer('')).toEqual([]);
    expect(reconocer('   ')).toEqual([]);
  });

  it('un texto sin ningún síntoma conocido devuelve vacío, no una adivinanza', () => {
    expect(reconocer('quiero saber el horario de atención')).toEqual([]);
  });

  it('no reconoce lo que la persona escribió para negarlo', () => {
    // Era el peor error posible de esta pantalla: contestarle a alguien lo
    // contrario de lo que acababa de escribir.
    expect(reconocer('no tengo fiebre')).toEqual([]);
    expect(reconocerNegados('no tengo fiebre').map((s) => s.id)).toEqual(['fiebre']);
  });
});

describe('reconocerAlarmas', () => {
  it('un dolor de pecho con falta de aire dispara la derivación', () => {
    // Es la razón por la que existe C6: recomendarle cardiología con turno
    // para el jueves a esta persona sería el peor resultado posible.
    const alarmas = reconocerAlarmas('me duele el pecho y no puedo respirar');

    expect(alarmas.map((s) => s.id)).toEqual(['dolor-de-pecho', 'falta-de-aire']);
  });

  it('un síntoma corriente NO dispara la derivación', () => {
    expect(reconocerAlarmas('tengo fiebre y dolor de garganta')).toEqual([]);
  });

  it('las alarmas no están también en la tabla común: no se recomiendan', () => {
    // Si «dolor de pecho» estuviera en las dos, la pantalla derivaría a
    // urgencias Y ofrecería un turno debajo. La lista de alarma no aporta
    // especialidades justamente por eso.
    for (const alarma of reconocerAlarmas('dolor de pecho')) {
      expect(alarma.especialidades).toEqual([]);
    }
  });
});

describe('recomendar', () => {
  it('el caso del criterio de aceptación trae Neurología y Oftalmología', () => {
    const recomendaciones = recomendar(
      reconocer('me duele la cabeza hace tres días y veo borroso'),
    );

    expect(recomendaciones.map((r) => r.nombre).slice(0, 2)).toEqual([
      'Neurología',
      'Oftalmología',
    ]);
  });

  it('la generalista va última aunque sume más que todas', () => {
    // «fiebre + dolor de garganta» suma más para medicina general que para
    // otorrino, y clínicamente no está mal. Pero una pantalla que a todo el
    // mundo le contesta «andá a un médico general» no orienta a nadie, que es
    // lo que este flujo vino a hacer.
    const recomendaciones = recomendar(reconocer('tengo fiebre y dolor de garganta'));

    expect(recomendaciones[0].nombre).toBe('Otorrinolaringología');
    expect(recomendaciones[recomendaciones.length - 1].nombre).toBe('Medicina general');
  });

  it('cuando la generalista es la única, queda primera: ahí sí es la respuesta', () => {
    const recomendaciones = recomendar(
      reconocer('quiero un chequeo'),
      new Set(['medicina general']),
    );

    expect(recomendaciones[0].nombre).toBe('Medicina general');
  });

  it('suma pesos en vez de contar síntomas', () => {
    // Un síntoma puede apuntar fuerte a una especialidad y de refilón a otra.
    // «dolor de cabeza + visión borrosa» da neurología 5 y oftalmología 4;
    // contando síntomas empatarían en dos cada una.
    const recomendaciones = recomendar(
      reconocer('me duele la cabeza y veo borroso'),
      new Set(['neurologia', 'oftalmologia']),
    );

    expect(recomendaciones.map((r) => [r.nombre, r.peso])).toEqual([
      ['Neurología', 5],
      ['Oftalmología', 4],
    ]);
  });

  it('no recomienda una especialidad que la plataforma no ofrece', () => {
    // Un camino que termina en un directorio vacío es peor que no ofrecerlo.
    const recomendaciones = recomendar(reconocer('veo borroso'), new Set(['neurologia']));

    expect(recomendaciones.map((r) => r.nombre)).toEqual(['Neurología']);
  });

  it('sin la lista de disponibles no filtra: un fallo de red no rompe el flujo', () => {
    expect(recomendar(reconocer('veo borroso'), new Set()).length).toBeGreaterThan(1);
  });

  it('sin síntomas no recomienda nada', () => {
    expect(recomendar([])).toEqual([]);
  });

  it('reconoce la especialidad aunque el directorio la escriba distinto', () => {
    // Los nombres del directorio los escribe cada profesional o cada catálogo:
    // «Cardióloga», «Otorrinolaringología y Cirugía de Cabeza y Cuello». Con
    // igualdad exacta ninguno coincidía, y el filtro que existe para no mandar
    // a un directorio vacío terminaba vaciando la recomendación entera.
    const conFemenino = recomendar(reconocer('veo borroso'), new Set(['oftalmologa']));
    const conNombreLargo = recomendar(
      reconocer('me duele la garganta'),
      new Set(['otorrinolaringologia y cirugia de cabeza y cuello']),
    );

    expect(conFemenino.map((r) => r.nombre)).toContain('Oftalmología');
    expect(conNombreLargo.map((r) => r.nombre)).toContain('Otorrinolaringología');
  });
});

describe('conceptIdDe', () => {
  it('resuelve el mismo par que hizo que la especialidad se recomendara', () => {
    // Este es el bug reportado: «me duele la pantorrilla» recomienda
    // Traumatología, pero el directorio la tiene escrita distinto
    // («Traumatología y Ortopedia»). `recomendar` la ofrece igual porque
    // `estaDisponible` es tolerante; antes, `verProfesionales` buscaba el
    // `conceptId` con igualdad exacta, no lo encontraba, y la navegación caía
    // al buscador por texto — que nunca pone `especialidad` en la URL y deja
    // a la persona en el directorio agrupado por categoría en vez de en la
    // lista de traumatólogos.
    const disponibles = new Map([['traumatologia y ortopedia', 'con-trauma']]);

    expect(conceptIdDe('Traumatología', disponibles)).toBe('con-trauma');
  });

  it('sin coincidencia ni siquiera difusa, no resuelve nada', () => {
    const disponibles = new Map([['cardiologia', 'con-cardio']]);

    expect(conceptIdDe('Reumatología', disponibles)).toBeUndefined();
  });
});

describe('explicar', () => {
  it('con un síntoma dice «Por X»', () => {
    expect(explicar({ nombre: 'Neurología', peso: 3, porque: ['dolor de cabeza'] })).toBe(
      'Por dolor de cabeza',
    );
  });

  it('con varios usa la conjunción en castellano, no comas hasta el final', () => {
    expect(explicar({ nombre: 'X', peso: 1, porque: ['fiebre', 'tos', 'dolor de garganta'] })).toBe(
      'Por fiebre, tos y dolor de garganta',
    );
  });
});

describe('sugerir', () => {
  it('busca por el comienzo del sinónimo, no por subcadena', () => {
    // Con subcadena, «dol» traería también «me duele la cabeza» y la lista se
    // volvería ruido.
    const sugeridos = sugerir('dolor de ca', []);

    expect(sugeridos.map((s) => s.id)).toContain('dolor-de-cabeza');
  });

  it('no sugiere lo que ya está puesto como chip', () => {
    const cabeza = SINTOMAS.filter((s) => s.id === 'dolor-de-cabeza');
    const sugeridos = sugerir('dolor de ca', cabeza);

    expect(sugeridos.map((s) => s.id)).not.toContain('dolor-de-cabeza');
  });

  it('con menos de tres letras no sugiere: sería la tabla entera', () => {
    expect(sugerir('do', [])).toEqual([]);
  });
});

describe('ultimaFrase', () => {
  it('mira sólo lo último que se está escribiendo', () => {
    // Quien ya escribió «tengo fiebre y do» busca algo que empieza con «do»;
    // sobre la frase entera no encontraría nada.
    expect(ultimaFrase('tengo fiebre y do')).toBe('do');
    expect(ultimaFrase('tengo fiebre, dolor de ca')).toBe('dolor de ca');
  });
});

describe('normalizar', () => {
  it('colapsa los espacios: en un teléfono se escribe con dedos gordos', () => {
    expect(normalizar('  dolor   de  CABEZA ')).toBe('dolor de cabeza');
  });
});

describe('la tabla', () => {
  it('no tiene identificadores repetidos', () => {
    const ids = SINTOMAS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada síntoma orienta a alguna especialidad', () => {
    // Un síntoma que no lleva a ningún lado se pinta como chip y después no
    // hace nada, que es peor que no reconocerlo.
    for (const sintoma of SINTOMAS) {
      expect(sintoma.especialidades.length, sintoma.id).toBeGreaterThan(0);
    }
  });

  it('los sinónimos están normalizados en el propio dato', () => {
    // Se comparan normalizados; uno con tilde o mayúscula no coincidiría nunca
    // y el fallo sería invisible.
    for (const sintoma of TODOS_LOS_SINTOMAS) {
      for (const frase of [...sintoma.sinonimos, ...(sintoma.partes ?? [])]) {
        expect(frase, `${sintoma.id}: «${frase}»`).toBe(normalizar(frase));
      }
    }
  });

  it('las dos tablas no comparten identificadores', () => {
    const todos = TODOS_LOS_SINTOMAS.map((s) => s.id);

    expect(new Set(todos).size).toBe(todos.length);
    expect(todos.length).toBe(SINTOMAS.length + SINTOMAS_DE_ALARMA.length);
  });

  it('las de alarma están marcadas como tales y no ofrecen especialidad', () => {
    for (const alarma of SINTOMAS_DE_ALARMA) {
      expect(alarma.alarma, alarma.id).toBe(true);
      expect(alarma.especialidades, alarma.id).toEqual([]);
    }
    for (const sintoma of SINTOMAS) {
      expect(sintoma.alarma, sintoma.id).not.toBe(true);
    }
  });

  it('cada zona del cuerpo ofrece síntomas que existen', () => {
    // Las zonas listan `id`, y tres de ellos son de alarma. Buscándolos sólo en
    // `SINTOMAS` no aparecían nunca: la zona ofrecía menos de lo que dice y
    // nadie se enteraba.
    const conocidos = new Set(TODOS_LOS_SINTOMAS.map((s) => s.id));

    for (const zona of ZONAS_DEL_CUERPO) {
      for (const id of zona.sintomas) {
        expect(conocidos.has(id), `${zona.id} ofrece «${id}»`).toBe(true);
      }
    }
  });

  /**
   * La figura y la tabla hablan de las mismas zonas: una forma sin fila sería
   * un botón que no abre nada, y una fila de cuerpo sin forma, una parte que no
   * se puede señalar ni elegir (ya no hay pastilla que la ofrezca).
   */
  it('cada forma de la figura tiene su zona, y cada zona sin forma es de las que no se señalan', () => {
    const enLaTabla = new Set(ZONAS_DEL_CUERPO.map((zona) => zona.id));
    for (const id of ZONAS_CON_SILUETA) {
      expect(enLaTabla.has(id), `la figura dibuja «${id}» y la tabla no la tiene`).toBe(true);
    }
    const sinForma = ZONAS_DEL_CUERPO.filter((zona) => !ZONAS_CON_SILUETA.has(zona.id));
    expect(sinForma.map((zona) => zona.id)).toEqual(['piel', 'animo', 'general']);
  });

  /**
   * Los síntomas de «Salud íntima» que sólo corresponden a un sexo (P-04,
   * 2026-09-25): `symptom-check` los filtra por el sexo del propio perfil.
   * Este test fija la lista, para que agregar una fila nueva a la zona no la
   * deje sin marcar por descuido.
   */
  it('«soloParaSexo» marca sólo lo que es exclusivo de un sexo', () => {
    const porSexo = (sexo: 'MALE' | 'FEMALE') =>
      SINTOMAS.filter((s) => s.soloParaSexo === sexo)
        .map((s) => s.id)
        .sort();

    expect(porSexo('MALE')).toEqual(
      ['dolor-de-testiculos', 'problemas-de-ereccion', 'prostata'].sort(),
    );
    expect(porSexo('FEMALE')).toEqual(
      [
        'atraso-menstrual',
        'control-embarazo',
        'dolor-menstrual',
        'flujo-vaginal',
        'menopausia',
        'sangrado-menstrual-abundante',
      ].sort(),
    );
  });
});
