import {
  MAX_CAMPOS_POR_PAGINA,
  type CampoDeFormulario,
  type PaginaDeFormulario,
  type SeccionDeFormulario,
} from './paginated-form.types';

/**
 * Parte campos en páginas de, como mucho, cuatro.
 *
 * ## Por qué es una función y no una regla de estilo
 *
 * Los campos de un formulario no siempre los escribe una persona. La ficha
 * clínica los recibe de la API —una plantilla por especialidad trae los que
 * traiga— y el generador de la fase 2 los recibirá de un doctor que extiende un
 * formulario estándar. En los dos casos **nadie está mirando** cuántos campos
 * caben en una pantalla de teléfono. Si el tope viviera sólo en la disciplina
 * de quien declara las páginas, se rompería el primer día que un catálogo
 * crezca.
 *
 * Por eso pasa por acá todo lo que va al motor, venga de donde venga.
 *
 * ## Qué hace con una sección larga
 *
 * La parte, y **conserva su nombre**: seis campos de «Datos de contacto» salen
 * como «Datos de contacto (1 de 2)» y «(2 de 2)», no como una sección y un
 * resto anónimo. Quien contesta sigue sabiendo dónde está, que es justamente lo
 * que la barra de avance y los rótulos existen para decir.
 *
 * Una sección que cabe entera no lleva numeración: «(1 de 1)» sería ruido.
 */
export function paginarCampos(
  entrada: readonly CampoDeFormulario[] | readonly SeccionDeFormulario[],
  opciones: { readonly tituloPorDefecto?: string } = {},
): readonly PaginaDeFormulario[] {
  const secciones = esListaDeSecciones(entrada)
    ? entrada
    : [{ titulo: opciones.tituloPorDefecto ?? '', campos: entrada }];

  return secciones.flatMap((seccion) => paginarSeccion(seccion));
}

/**
 * Una sección → sus páginas.
 *
 * Una sección **sin campos no produce página**: una página vacía sería un paso
 * más en la barra de avance que no pide nada, y quien la viera pensaría que
 * algo no cargó.
 */
function paginarSeccion(seccion: SeccionDeFormulario): readonly PaginaDeFormulario[] {
  const trozos = partirEnTrozos(seccion.campos, MAX_CAMPOS_POR_PAGINA);
  const total = trozos.length;

  return trozos.map((campos, indice) => ({
    titulo: total > 1 ? `${seccion.titulo} (${indice + 1} de ${total})` : seccion.titulo,
    // La ayuda de la sección se repite en cada una de sus páginas: quien llega a
    // la segunda no vio la primera hace un rato, y una explicación que sólo
    // aparece en el primer trozo es una explicación que la mitad no lee.
    ...(seccion.hint === undefined ? {} : { hint: seccion.hint }),
    ...(seccion.disposicion === undefined ? {} : { disposicion: seccion.disposicion }),
    campos,
  }));
}

function partirEnTrozos<T>(items: readonly T[], tamano: number): readonly (readonly T[])[] {
  const trozos: T[][] = [];
  for (let desde = 0; desde < items.length; desde += tamano) {
    trozos.push(items.slice(desde, desde + tamano));
  }
  return trozos;
}

/**
 * Distingue una lista de secciones de una lista de campos.
 *
 * Se mira `campos`, no `titulo`: un campo también tiene rótulo (`label`), pero
 * sólo una sección tiene campos dentro. Con la lista vacía da igual la rama —no
 * hay nada que paginar—, y se elige la de campos para no inventar una sección.
 */
function esListaDeSecciones(
  entrada: readonly CampoDeFormulario[] | readonly SeccionDeFormulario[],
): entrada is readonly SeccionDeFormulario[] {
  return entrada.length > 0 && 'campos' in entrada[0];
}
