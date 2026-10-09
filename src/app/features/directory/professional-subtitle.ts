/* ============================================================================
    El subtítulo de una tarjeta de la Guía — y por qué hay que desconfiar de él.

    F-25 (recorrida de QA, 18/08/2026): la tarjeta de «Ana Lucía Flores» mostraba
    como subtítulo «Dra. Camila Roca — Medicina Familiar», la de «Mateo Quiroga
    Ríos» decía «Dr. Andrés Mercado — Cardiología». El subtítulo sale de
    `professionalTitle`, una columna de la propia fila del profesional, así que
    el cruce viene de los datos: el seeder de demo escribió ahí el nombre de otro
    registro. La corrección del dato es de su carril (FX-4); lo que se arregla
    acá es el principio, que no depende de qué haya en la base:

    > **Una tarjeta jamás muestra el nombre de otra persona como subtítulo.**
    > Si el dato no cierra, no hay subtítulo.

    Un subtítulo ausente es una tarjeta más pobre; un subtítulo cruzado es una
    guía médica que miente sobre quién es quién, y eso se paga con la confianza
    de quien busca a un profesional para atenderse.
    ========================================================================== */

/**
 * Tratamientos con los que se nombra a una persona.
 *
 * `professionalTitle` es un cargo o una formación —«Médico general», «Magíster
 * en Salud Pública»—, no una forma de dirigirse a alguien: que empiece con uno
 * de estos es la señal de que ahí quedó el nombre de una persona.
 */
const TRATAMIENTOS =
  /^(dr|dra|doctor|doctora|lic|licenciado|licenciada|mtro|mtra|ing|sr|sra|srta)\b\.?\s+/i;

/** Lo que separa al nombre de la especialidad en los valores cruzados. */
const SEPARADORES = /[—–\-·,|]/;

/** Sin tildes, sin mayúsculas y sin espacios de más: para comparar nombres. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El subtítulo que la tarjeta puede mostrar, o `undefined` si no es de fiar.
 *
 * Se comprueban dos cosas, de la más precisa a la más general:
 *
 * 1. **Que no sea el nombre de otro de la lista.** Es exacto y no depende de
 *    ninguna heurística: si el texto contiene el nombre de otro profesional de
 *    la misma respuesta, el dato está cruzado y punto.
 * 2. **Que no sea el nombre de una persona que no es esta.** Cubre el caso en
 *    que el registro cruzado no vino en esta página: un subtítulo que arranca
 *    con «Dr.», «Dra.» o «Lic.» está nombrando a alguien, y sólo pasa si ese
 *    alguien es el titular de la tarjeta.
 *
 * @param professionalTitle - Lo que el DTO trae como título profesional.
 * @param nombre - El nombre que la tarjeta muestra como título.
 * @param nombresDeOtros - Nombres del resto de la respuesta, si se conocen.
 * @returns El subtítulo, o `undefined` para no mostrar ninguno.
 */
export function subtituloProfesional(
  professionalTitle: string | undefined,
  nombre: string,
  nombresDeOtros: Iterable<string> = [],
): string | undefined {
  const texto = professionalTitle?.trim() ?? '';
  if (texto === '') {
    return undefined;
  }

  const normalizado = normalizar(texto);
  const propio = normalizar(nombre);

  for (const otro of nombresDeOtros) {
    const ajeno = normalizar(otro);
    if (ajeno !== '' && ajeno !== propio && normalizado.includes(ajeno)) {
      return undefined;
    }
  }

  if (TRATAMIENTOS.test(texto)) {
    const persona = normalizar(texto.replace(TRATAMIENTOS, '').split(SEPARADORES)[0] ?? '');
    // Sólo sobrevive si quien está nombrado ahí es el titular de la tarjeta.
    if (persona !== '' && !propio.includes(persona)) {
      return undefined;
    }
  }

  return texto;
}
