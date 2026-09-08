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
 * Un valor para una entrada.
 *
 * Devuelve `undefined` cuando no sabe qué poner y la entrada no es obligatoria:
 * es mejor dejar que el componente use su valor por omisión —que es parte de lo
 * que se está revisando— que meterle un dato inventado que no sabe pintar.
 */
export function valorParaEntrada(entrada: EntradaAGenerar, semilla: string): unknown {
  const f = conSemilla(`${semilla}-${entrada.nombre}`);
  const { nombre, tipo } = entrada;
  const bajo = nombre.toLowerCase();

  const ramas = ramasDeUnion(tipo);
  if (ramas.length > 0) return f.helpers.arrayElement(ramas);

  if (tipo.startsWith('boolean') || tipo === 'boolean') return f.datatype.boolean(0.5);
  if (tipo === 'number') {
    if (/count|total|max|items/.test(bajo)) return f.number.int({ min: 3, max: 240 });
    if (/value|progress|percent/.test(bajo)) return f.number.int({ min: 10, max: 95 });
    if (/rows|lines|overflow|debounce/.test(bajo)) return f.number.int({ min: 2, max: 5 });
    return f.number.int({ min: 1, max: 12 });
  }

  // Por el nombre, antes que por el tipo.
  if (/^src$|photo|image|avatarUrl/.test(nombre)) {
    return avatarSvg(f.person.firstName(), '#1f6f8b');
  }
  if (/cover|banner|imagen/i.test(nombre)) return imagenSvg('Vista previa');
  if (/^(label|submitLabel|cancelLabel|closeLabel|triggerLabel|searchLabel|etiqueta)/i.test(nombre)) {
    return f.helpers.arrayElement(ETIQUETAS);
  }
  if (/^(title|heading|titulo|caption|legend|dialogTitle|confirmTitle)/i.test(nombre)) {
    return f.helpers.arrayElement(TITULOS);
  }
  if (/^(subtitle|description|hint|subtitulo|descripcion|message|confirmMessage|emptyMessage|aviso)/i.test(nombre)) {
    return f.helpers.arrayElement(DESCRIPCIONES);
  }
  if (/^(name|displayName|nombre)$/i.test(nombre)) {
    return `${f.person.firstName()} ${f.person.lastName().split(' ')[0]}`;
  }
  if (/placeholder/i.test(nombre)) return 'Escribí para buscar…';
  if (/errorMessage|error/i.test(nombre)) return 'Revisá este campo: falta completarlo.';
  if (/phone|telefono/i.test(nombre)) return bo.celular(f);
  if (/email|correo/i.test(nombre)) return `${f.internet.username().toLowerCase()}@alovida.mock`;
  if (/direccion|address/i.test(nombre)) return bo.direccion(f, bo.lugar(f));
  if (/(^|[^a-z])date|fecha/i.test(nombre)) return tipo === 'string' ? isoDia(-3) : new Date(iso(-3));
  if (/amount|precio|importe|monto/i.test(nombre)) return bo.bolivianos(f, 80, 4800);
  if (/^(url|href|route|link|postLink|profileLink|fallback)/i.test(nombre)) return '/dashboard';
  if (/id$/i.test(nombre) && tipo === 'string') return f.string.uuid();

  const elemento = tipoDeElemento(tipo);
  if (elemento !== null) {
    if (esOpcion(elemento)) {
      return [
        { value: 'uno', label: 'Clínica Los Olivos' },
        { value: 'dos', label: 'Hospital San Lucas' },
        { value: 'tres', label: 'Consultorio propio' },
      ];
    }
    if (elemento === 'string') {
      return Array.from({ length: 3 }, () => f.helpers.arrayElement(ETIQUETAS));
    }
    // Un arreglo de objetos que no se sabe cómo son: vacío, que es un estado
    // legítimo y no rompe el `@for` de la plantilla.
    return [];
  }

  if (tipo === 'string' || tipo.startsWith('string')) {
    return f.helpers.arrayElement(TITULOS);
  }

  // Un alias que el generador no supo resolver (`BadgeValue`, `AvatarStatus`).
  // Si el nombre pide algo que se lee, se le da texto; si no, se deja que el
  // componente use su valor por omisión, que también es parte de lo que se
  // está revisando.
  if (/^[A-Z]\w*$/.test(tipo) && /value|estado|status|state|texto|contenido/i.test(nombre)) {
    return f.helpers.arrayElement(ETIQUETAS);
  }

  return entrada.requerido ? '' : undefined;
}

/** Todos los valores de un componente, de una vez. */
export function valoresParaEntradas(
  entradas: readonly EntradaAGenerar[],
  semilla: string,
): Record<string, unknown> {
  const valores: Record<string, unknown> = {};
  for (const entrada of entradas) {
    const valor = valorParaEntrada(entrada, semilla);
    if (valor !== undefined) valores[entrada.nombre] = valor;
  }
  return valores;
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
