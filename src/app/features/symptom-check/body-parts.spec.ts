import { describe, expect, it } from 'vitest';

import { BODY_VIEWS, BODY_VIEWS_FEMALE, BODY_VIEWS_MALE } from '@shared/components/organisms/body-map/body-zones.generated';

import { BODY_PART_WORDS, bodyPartsIn, withNamedParts } from './body-parts';
import { BODY_ZONES } from './zones.data';

const madreDe = (id: string) => BODY_ZONES.find((z) => z.id === id)?.madre;
const partes = (texto: string) => [...bodyPartsIn(texto)].sort();

describe('bodyPartsIn · las partes del cuerpo nombradas en el texto', () => {
  /** Blindaje: lo que devuelve tiene que existir en la tabla y en la figura de los tres maniquíes. */
  it('cada palabra da zonas que existen en la tabla y se dibujan (o son gruesas con hijas dibujadas)', () => {
    const enLaTabla = new Set(BODY_ZONES.map((z) => z.id));
    for (const vistas of [BODY_VIEWS, BODY_VIEWS_MALE, BODY_VIEWS_FEMALE]) {
      const dibujadas = new Set(vistas.flatMap((v) => v.zonas.flatMap((z) => [z.id, z.madre])));
      for (const palabra of BODY_PART_WORDS) {
        const zonas = bodyPartsIn(`me duele la ${palabra}`);
        expect(zonas.length, `«${palabra}» no da ninguna zona`).toBeGreaterThan(0);
        for (const id of zonas) {
          expect(enLaTabla.has(id), `«${palabra}» → «${id}» no está en la tabla`).toBe(true);
          expect(dibujadas.has(id), `«${palabra}» → «${id}» no se dibuja`).toBe(true);
        }
      }
    }
  });

  it.each([
    ['me duelen los ojos', ['ojo-der', 'ojo-izq']],
    ['me duele el ojo derecho', ['ojo-der']],
    ['me arde el ojo izquierdo', ['ojo-izq']],
    ['me duele la rodilla derecha', ['rodilla-der']],
    ['me duelen las dos rodillas', ['rodilla-der', 'rodilla-izq']],
    ['me duelen ambas rodillas', ['rodilla-der', 'rodilla-izq']],
    ['tengo dolor de cabeza', ['cabeza']],
    ['me duele la muela', ['boca']],
    ['me duele el oído izquierdo', ['oido-izq']],
    ['me duele la oreja', ['oido-der', 'oido-izq']],
    ['me duele el codo izquierdo', ['codo-izq']],
    ['me torcí la muñeca derecha', ['muneca-der']],
    ['me corté el dedo de la mano izquierda', ['dedos-izq']],
    ['me golpeé el dedo gordo del pie derecho', ['dedos-pie-der']],
    ['tengo hongos en los dedos de los pies', ['dedos-pie-der', 'dedos-pie-izq']],
    ['me duele el pulgar derecho', ['dedos-der']],
    ['me duele el tobillo derecho', ['tobillo-der']],
    ['tengo una ampolla en el talón izquierdo', ['talon-izq']],
    ['me duele la boca del estómago', ['epigastrio']],
    ['me duele alrededor del ombligo', ['periumbilical']],
    ['me duele el bajo vientre', ['hipogastrio']],
    ['me duele la ingle derecha', ['ingle-der']],
    ['me arde la entrepierna', ['muslo-interno-der', 'muslo-interno-izq']],
    ['me duele el muslo derecho', ['muslo-der', 'muslo-interno-der', 'muslo-posterior-der']],
    ['me duele el empeine izquierdo', ['pie-izq']],
    ['me duele la planta del pie derecho', ['dedos-pie-der', 'pie-der', 'talon-der']],
    ['me duele la frente', ['frente']],
    ['me duele la sien izquierda', ['sien-izq']],
    ['tengo hinchado el cachete derecho', ['mejilla-der']],
    ['me duele la mandíbula izquierda', ['mandibula-izq']],
    ['tengo un grano en la barbilla', ['menton']],
    ['me caí y me duele la coronilla', ['coronilla']],
    ['me fracturé la clavícula derecha', ['clavicula-der']],
    ['tengo una bolita en el sobaco izquierdo', ['axila-izq']],
    ['me duele la panza', ['abdomen', 'estomago']],
    ['me duele la espalda', ['espalda']],
    ['me duele la columna', ['columna-alta', 'columna-lumbar', 'columna-media']],
    ['me duele el riñón izquierdo', ['lumbar-izq']],
    ['me duele la cintura', ['lumbar-der', 'lumbar-izq']],
    ['me caí sobre el coxis', ['coxis']],
    ['me duele la nalga derecha', ['gluteo-der']],
    ['me duele el lado derecho del pecho', ['pecho-der']],
    ['me duele el pecho', ['esternon', 'pecho-der', 'pecho-izq']],
    ['tengo un bulto en el seno izquierdo', ['pecho-izq']],
    ['me duele el cuello', ['cuello-der', 'cuello-izq', 'garganta']],
    ['me duele la nuca', ['nuca']],
    [
      'me duele la pierna izquierda',
      ['canilla-izq', 'corva-izq', 'muslo-interno-izq', 'muslo-izq', 'muslo-posterior-izq', 'pantorrilla-izq', 'rodilla-izq', 'tobillo-izq'],
    ],
    ['me duele el brazo derecho', ['antebrazo-der', 'brazo-der', 'codo-der', 'muneca-der']],
    // Sin acentos y en mayúsculas, como se escribe en el teléfono.
    ['ME DUELE EL TALON DERECHO', ['talon-der']],
    ['me duele el rinon derecho', ['lumbar-der']],
  ])('«%s»', (texto, esperadas) => {
    expect(partes(texto)).toEqual([...esperadas].sort());
  });

  it('cada lado va con su parte cuando se nombran dos', () => {
    expect(partes('me duele la mano derecha y el pie izquierdo')).toEqual(['dedos-der', 'dedos-pie-izq', 'mano-der', 'pie-izq', 'talon-izq']);
    expect(partes('me duele la rodilla izquierda y el hombro derecho')).toEqual(['hombro-der', 'rodilla-izq']);
  });

  it('lo negado no se marca, pero lo que no se puede hacer sí', () => {
    expect(partes('no me duele la rodilla')).toEqual([]);
    expect(partes('no tengo dolor en el pecho, me duele el codo derecho')).toEqual(['codo-der']);
    expect(partes('no puedo mover el brazo izquierdo')).toEqual(['antebrazo-izq', 'brazo-izq', 'codo-izq', 'muneca-izq']);
    expect(partes('no siento la mano derecha')).toEqual(['dedos-der', 'mano-der']);
  });

  /** «frente» sólo es la frente cuando se la nombra así: «de frente» o «al frente» no son partes. */
  it('«de frente» no es la frente', () => {
    expect(bodyPartsIn('me caí de frente')).toEqual([]);
    expect(bodyPartsIn('vivo al frente del hospital')).toEqual([]);
    expect(partes('me golpeé mi frente')).toEqual(['frente']);
  });

  it('sin partes nombradas no da nada', () => {
    expect(bodyPartsIn('estoy triste y no duermo')).toEqual([]);
    expect(bodyPartsIn('')).toEqual([]);
  });
});

describe('withNamedParts · lo nombrado precisa la zona del síntoma', () => {
  it('la rodilla derecha nombrada reemplaza a las dos rodillas del síntoma', () => {
    expect(withNamedParts(['rodilla-der'], ['rodillas'], madreDe)).toEqual(['rodilla-der']);
  });

  it('lo que nada precisa se queda (el ánimo, otra parte)', () => {
    expect(withNamedParts(['rodilla-der'], ['rodillas', 'animo', 'cabeza'], madreDe)).toEqual([
      'rodilla-der',
      'animo',
      'cabeza',
    ]);
  });

  it('sin partes nombradas quedan las del síntoma tal cual', () => {
    expect(withNamedParts([], ['ojos', 'piel'], madreDe)).toEqual(['ojos', 'piel']);
  });
});
