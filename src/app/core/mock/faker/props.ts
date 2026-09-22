import { avatarSvg, imagenSvg, iso, isoDia } from '../mock-store';

import { conSemilla } from './semilla';
import * as bo from './bolivia';
import * as cl from './clinico';

/* ============================================================================
    Valores de prueba para las entradas de un componente.

    Esto es lo que hace que el stock de componentes sirva para algo: un botón
    sin texto y una tabla sin filas no dicen si el componente está bien. Con
    datos dentro, sí.

    La regla al elegir el valor es, en este orden:

      1. **Por el nombre.** `src` quiere una imagen, `label` quiere una etiqueta
         corta, `items` quiere una lista. El nombre dice más que el tipo.
      2. **Por el tipo literal.** `'sm' | 'md' | 'lg'` es una unión cerrada: se
         devuelve una de sus ramas, nunca un texto inventado que el componente
         no sabe pintar.
      3. **Por el tipo base.** `string`, `number`, `boolean`, `T[]`.

    Todo sale sembrado (ver `semilla.ts`): la misma ficha abierta dos veces se
    ve igual, y el botón «otros datos» cambia la semilla a propósito.
    ========================================================================== */

export interface EntradaAGenerar {
  readonly nombre: string;
  readonly tipo: string;
  readonly requerido: boolean;
}

const ETIQUETAS = [
  'Guardar cambios',
  'Ver detalle',
  'Continuar',
  'Cancelar cita',
  'Agregar paciente',
  'Descargar informe',
  'Confirmar',
] as const;

const TITULOS = [
  'Agenda de la semana',
  'Pacientes atendidos',
  'Recetas emitidas',
  'Resultados de laboratorio',
  'Consultas pendientes',
  'Historia clínica',
] as const;

const DESCRIPCIONES = [
  'Lo que tenés que revisar antes de la próxima consulta.',
  'Se actualiza cada vez que registrás una atención.',
  'Sólo vos y el equipo del consultorio pueden verlo.',
  'Los datos verificados llevan sello; el resto va rotulado como declarado.',
] as const;

/** Las ramas de una unión de literales: `'sm' | 'md'` → ['sm', 'md']. */
function ramasDeUnion(tipo: string): readonly string[] {
  if (!tipo.includes('|') || !tipo.includes("'")) return [];
  return tipo
    .split('|')
    .map((rama) => /'([^']*)'/.exec(rama.trim())?.[1])
    .filter((rama): rama is string => rama !== undefined);
}

/** El tipo de dentro de un arreglo: `readonly Foo[]` → `Foo`. */
function tipoDeElemento(tipo: string): string | null {
  const limpio = tipo.replace(/^readonly\s+/, '').trim();
  if (limpio.endsWith('[]')) return limpio.slice(0, -2).trim();
  const generico = /^(?:Readonly)?Array<(.+)>$/.exec(limpio);
  return generico?.[1]?.trim() ?? null;
}

function esOpcion(tipo: string): boolean {
  return /SelectOption|Option\b/.test(tipo);
}

/**
 * De dónde salió un valor generado, que es lo que decide si acredita algo.
 *
 *   - `del-tipo`: cumple el tipo declarado de la entrada (una rama de la unión,
 *     un número, un texto para un `string`…). El nombre puede haber elegido
 *     CUÁL texto, pero el tipo lo admite.
 *   - `sin-verificar`: el generador no sabe producir un valor válido para ese
 *     tipo y puso algo para que el componente monte (`[]`, `''`, un texto
 *     adivinado por el nombre). Montar así NO acredita el contrato.
 *   - `por-omision`: no se pasa nada; el componente usa su valor por omisión.
 */
export type ProcedenciaDelValor = 'del-tipo' | 'sin-verificar' | 'por-omision';

export interface ValorGenerado {
  readonly valor: unknown;
  readonly procedencia: ProcedenciaDelValor;
  /** Por qué no es `del-tipo`, en una línea legible. `null` si lo es. */
  readonly motivo: string | null;
}

/** El tipo declarado admite un texto (`string`, `string | null`, uniones con `string`). */
function admiteTexto(tipo: string): boolean {
  return /(^|\|)\s*string\s*($|\|)/.test(tipo) || tipo === 'string';
}

function admiteFecha(tipo: string): boolean {
  return /(^|\|)\s*Date\s*($|\|)/.test(tipo);
}

const delTipo = (valor: unknown): ValorGenerado => ({ valor, procedencia: 'del-tipo', motivo: null });

/**
 * Un valor elegido por el NOMBRE de la entrada. Si el tipo declarado no admite
 * lo que se eligió, el valor no se presenta como válido: se marca sin verificar.
 */
function porNombre(valor: unknown, entrada: EntradaAGenerar): ValorGenerado {
  const encaja =
    (typeof valor === 'string' && admiteTexto(entrada.tipo)) ||
    (valor instanceof Date && admiteFecha(entrada.tipo)) ||
    (typeof valor === 'number' && entrada.tipo === 'number');
  return encaja
    ? delTipo(valor)
    : {
        valor,
        procedencia: 'sin-verificar',
        motivo: `el tipo «${entrada.tipo || 'sin declarar'}» no se resolvió: se le pasó un valor adivinado por el nombre «${entrada.nombre}»`,
      };
}

/**
 * Un valor para una entrada, con su procedencia.
 *
 * Cuando no sabe qué poner y la entrada no es obligatoria, no pasa nada: es
 * mejor dejar que el componente use su valor por omisión —que es parte de lo
 * que se está revisando— que meterle un dato inventado que no sabe pintar.
 * Cuando es obligatoria, pone lo mínimo para que monte y LO DICE.
 */
export function generarEntrada(entrada: EntradaAGenerar, semilla: string): ValorGenerado {
  const f = conSemilla(`${semilla}-${entrada.nombre}`);
  const { nombre, tipo } = entrada;
  const bajo = nombre.toLowerCase();

  const ramas = ramasDeUnion(tipo);
  if (ramas.length > 0) return delTipo(f.helpers.arrayElement(ramas));

  if (tipo.startsWith('boolean') || tipo === 'boolean') return delTipo(f.datatype.boolean(0.5));
  if (tipo === 'number') {
    if (/count|total|max|items/.test(bajo)) return delTipo(f.number.int({ min: 3, max: 240 }));
    if (/value|progress|percent/.test(bajo)) return delTipo(f.number.int({ min: 10, max: 95 }));
    if (/rows|lines|overflow|debounce/.test(bajo)) return delTipo(f.number.int({ min: 2, max: 5 }));
    return delTipo(f.number.int({ min: 1, max: 12 }));
  }

  // Un arreglo declarado manda sobre el nombre: `coverages` casaba con /cover/
  // y recibía la imagen SVG de una portada, y el componente se caía en su
  // primer `.filter` (medido en el barrido de `evidencia/runtime-antes/`).
  const elemento = tipoDeElemento(tipo);
  if (elemento !== null) {
    if (esOpcion(elemento)) {
      return delTipo([
        { value: 'uno', label: 'Clínica Los Olivos' },
        { value: 'dos', label: 'Hospital San Lucas' },
        { value: 'tres', label: 'Consultorio propio' },
      ]);
    }
    if (elemento === 'string') {
      return delTipo(Array.from({ length: 3 }, () => f.helpers.arrayElement(ETIQUETAS)));
    }
    // Un arreglo de objetos que no se sabe cómo son. `[]` monta —no rompe el
    // `@for`— pero no prueba nada del contrato: se dice.
    return {
      valor: [],
      procedencia: 'sin-verificar',
      motivo: `arreglo de «${elemento}»: no sé construir un elemento válido, se pasó [] (vacío)`,
    };
  }

  // Por el nombre, antes que por el tipo. El tipo decide si lo elegido vale.
  if (/^src$|photo|image|avatarUrl/.test(nombre)) {
    return porNombre(avatarSvg(f.person.firstName(), '#1f6f8b'), entrada);
  }
  if (/cover|banner|imagen/i.test(nombre)) return porNombre(imagenSvg('Vista previa'), entrada);
  if (/^(label|submitLabel|cancelLabel|closeLabel|triggerLabel|searchLabel|etiqueta)/i.test(nombre)) {
    return porNombre(f.helpers.arrayElement(ETIQUETAS), entrada);
  }
  if (/^(title|heading|titulo|caption|legend|dialogTitle|confirmTitle)/i.test(nombre)) {
    return porNombre(f.helpers.arrayElement(TITULOS), entrada);
  }
  if (/^(subtitle|description|hint|subtitulo|descripcion|message|confirmMessage|emptyMessage|aviso)/i.test(nombre)) {
    return porNombre(f.helpers.arrayElement(DESCRIPCIONES), entrada);
  }
  if (/^(name|displayName|nombre)$/i.test(nombre)) {
    return porNombre(`${f.person.firstName()} ${f.person.lastName().split(' ')[0]}`, entrada);
  }
  if (/placeholder/i.test(nombre)) return porNombre('Escribí para buscar…', entrada);
  if (/errorMessage|error/i.test(nombre)) return porNombre('Revisá este campo: falta completarlo.', entrada);
  if (/phone|telefono/i.test(nombre)) return porNombre(bo.celular(f), entrada);
  if (/email|correo/i.test(nombre)) return porNombre(`${f.internet.username().toLowerCase()}@alovida.mock`, entrada);
  if (/direccion|address/i.test(nombre)) return porNombre(bo.direccion(f, bo.lugar(f)), entrada);
  if (/(^|[^a-z])date|fecha/i.test(nombre)) {
    return porNombre(admiteTexto(tipo) ? isoDia(-3) : new Date(iso(-3)), entrada);
  }
  if (/amount|precio|importe|monto/i.test(nombre)) return porNombre(bo.bolivianos(f, 80, 4800), entrada);
  if (/^(url|href|route|link|postLink|profileLink|fallback)/i.test(nombre)) return porNombre('/dashboard', entrada);
  if (/id$/i.test(nombre) && tipo === 'string') return delTipo(f.string.uuid());

  // Una fecha declarada como tal, sin que el nombre lo diga (`dia`, `mes`).
  if (admiteFecha(tipo)) return delTipo(new Date(iso(-3)));

  if (admiteTexto(tipo) || tipo.startsWith('string')) {
    return delTipo(f.helpers.arrayElement(TITULOS));
  }

  // Un alias que el generador no supo resolver (`BadgeValue`, `AvatarStatus`).
  // Si el nombre pide algo que se lee, se le da texto —sin verificar—; si no,
  // se deja que el componente use su valor por omisión.
  if (/^[A-Z]\w*$/.test(tipo) && /value|estado|status|state|texto|contenido/i.test(nombre)) {
    return {
      valor: f.helpers.arrayElement(ETIQUETAS),
      procedencia: 'sin-verificar',
      motivo: `tipo «${tipo}» sin resolver: se le pasó un texto adivinado por el nombre «${nombre}»`,
    };
  }

  if (entrada.requerido) {
    return {
      valor: '',
      procedencia: 'sin-verificar',
      motivo: `obligatoria de tipo «${tipo || 'sin declarar'}», que no sé producir: se pasó '' para que monte`,
    };
  }
  return {
    valor: undefined,
    procedencia: 'por-omision',
    motivo: `tipo «${tipo || 'sin declarar'}» sin generador: queda el valor por omisión del componente`,
  };
}

/** Sólo el valor, para quien no necesita saber de dónde salió. */
export function valorParaEntrada(entrada: EntradaAGenerar, semilla: string): unknown {
  return generarEntrada(entrada, semilla).valor;
}

/** Todos los valores de un componente, de una vez. */
export function valoresParaEntradas(
  entradas: readonly EntradaAGenerar[],
  semilla: string,
): Record<string, unknown> {
  return generarEntradas(entradas, semilla).valores;
}

export interface EntradasGeneradas {
  /** Lo que se le pasa al componente: sin las que quedan por omisión. */
  readonly valores: Record<string, unknown>;
  /** La procedencia de cada entrada, incluidas las que no se pasaron. */
  readonly procedencias: Readonly<Record<string, Omit<ValorGenerado, 'valor'>>>;
  /** Las que se pasaron sin poder verificar el contrato, con su motivo. */
  readonly sinVerificar: readonly { readonly nombre: string; readonly motivo: string }[];
}

/** Todos los valores de un componente, con la procedencia de cada uno. */
export function generarEntradas(entradas: readonly EntradaAGenerar[], semilla: string): EntradasGeneradas {
  const valores: Record<string, unknown> = {};
  const procedencias: Record<string, Omit<ValorGenerado, 'valor'>> = {};
  const sinVerificar: { nombre: string; motivo: string }[] = [];
  for (const entrada of entradas) {
    const generado = generarEntrada(entrada, semilla);
    procedencias[entrada.nombre] = { procedencia: generado.procedencia, motivo: generado.motivo };
    if (generado.valor !== undefined) valores[entrada.nombre] = generado.valor;
    if (generado.procedencia === 'sin-verificar') {
      sinVerificar.push({ nombre: entrada.nombre, motivo: generado.motivo ?? '' });
    }
  }
  return { valores, procedencias, sinVerificar };
}

/** Datos sueltos para las fichas que los piden a mano. */
export const muestras = {
  paciente: (semilla: string) => {
    const f = conSemilla(`muestra-paciente-${semilla}`);
    const l = bo.lugar(f);
    return {
      nombre: `${f.person.firstName('female')} ${f.person.lastName().split(' ')[0]}`,
      cedula: bo.cedula(f, l),
      telefono: bo.celular(f),
      ciudad: l.ciudad,
      motivo: cl.motivoDeConsulta(f),
    };
  },
};
