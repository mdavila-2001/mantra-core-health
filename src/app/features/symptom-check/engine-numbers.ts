import type { Match } from './engine.types';
import type { Symptom } from './symptoms.data';

/**
 * Los síntomas que la gente escribe como una medición.
 *
 * «Tengo 38.5», «la presión me dio 160/100», «la glucosa en 280». No hay
 * sinónimo que los cubra —el dato es el número— y son de los textos más
 * frecuentes de una consulta. Cada regla exige una palabra que le dé contexto:
 * sin eso, «hace 38 días» sería fiebre.
 */
const NUMERIC_RULES: readonly {
  readonly sintoma: string;
  readonly patron: RegExp;
  readonly vale: (numeros: readonly number[]) => boolean;
  /**
   * Cuando el número dice lo contrario de la palabra.
   *
   * «Tengo 36 de temperatura» nombra la temperatura y niega la fiebre. Quien
   * escribe el número está siendo preciso a propósito, y contestarle con un
   * chip de fiebre es no haberlo leído.
   */
  readonly desmiente?: (numeros: readonly number[]) => boolean;
}[] = [
  {
    sintoma: 'fiebre',
    // La medición se escribe en los dos órdenes: «fiebre de 38.5» y «38.5 de
    // fiebre». La segunda rama es la que atrapa «tengo 36 de temperatura», que
    // es la forma de decir que fiebre no hay.
    patron:
      /(?:fiebre|temperatura|termometro|decimas?)[^.;!?]{0,20}?(\d{2}(?:[.,]\d)?)|(\d{2}(?:[.,]\d)?)\s*(?:grados|°|º|de (?:temperatura|fiebre))/,
    vale: ([grados]) => grados >= 37.4 && grados <= 43,
    desmiente: ([grados]) => grados >= 34 && grados < 37.4,
  },
  {
    sintoma: 'presion-alta',
    patron: /(?:presion|tension)[^.;!?]{0,20}?(\d{2,3})\s*(?:[/x-]|sobre)\s*(\d{1,3})/,
    vale: ([alta, baja]) =>
      (alta >= 140 && alta <= 260) || (alta >= 14 && alta <= 26 && baja <= 20) || baja >= 90,
  },
  {
    sintoma: 'azucar-alta',
    patron: /(?:azucar|glucosa|glicemia|glucemia)[^.;!?]{0,20}?(\d{2,3})/,
    vale: ([valor]) => valor >= 126,
  },
];

export interface NumbersSay {
  /** Lo que el número trae por sí solo. */
  readonly agrega: readonly Match[];
  /** Lo que el número **desmiente**, aunque la palabra esté escrita. */
  readonly quita: ReadonlySet<string>;
}

export function byNumbers(normalizado: string, tabla: readonly Symptom[]): NumbersSay {
  const agrega: Match[] = [];
  const quita = new Set<string>();

  for (const regla of NUMERIC_RULES) {
    const sintoma = tabla.find((fila) => fila.id === regla.sintoma);
    if (sintoma === undefined) {
      continue;
    }
    const hallazgo = regla.patron.exec(normalizado);
    if (hallazgo === null) {
      continue;
    }
    const numeros = hallazgo
      .slice(1)
      .filter((parte): parte is string => parte !== undefined)
      .map((parte) => Number.parseFloat(parte.replace(',', '.')));
    if (numeros.length === 0) {
      continue;
    }
    if (regla.desmiente?.(numeros) === true) {
      quita.add(sintoma.id);
      continue;
    }
    if (!regla.vale(numeros)) {
      continue;
    }
    agrega.push({
      sintoma,
      confianza: 1,
      desde: hallazgo.index,
      evidencia: hallazgo[0],
      negado: false,
    });
  }

  return { agrega, quita };
}
