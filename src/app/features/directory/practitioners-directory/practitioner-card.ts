import { verificationOf } from '../../../core/verification/verification-status';
import type { PractitionerListItem } from '../../../core/data-access/profiles/profiles.types';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import type { SearchResultItem } from '../../../shared/components/molecules/search-result/search-result.types';
import { initialsOf } from '../../../shared/text/initials';
import { professionalSubtitle } from '../professional-subtitle';

/*
 * La tarjeta de un médico en la guía: de la fila del dominio a lo que
 * `app-result-card` dibuja. Vive aparte del directorio para que la pantalla
 * no cargue con la traducción.
 */

/**
 * El ancla de los horarios en la ficha del profesional.
 *
 * Vive acá y en `practitioner-detail.html`: es el contrato entre la tarjeta que
 * ofrece «revisar disponibilidad» y la sección que responde esa pregunta.
 */
const ANCLA_HORARIOS = 'horarios';

/**
 * Cuántas sedes se nombran en la tarjeta antes de resumir.
 *
 * Dos entran en una línea en un teléfono; con más, la tarjeta se convierte en
 * un párrafo y deja de servir para comparar de un vistazo. El resto se cuenta,
 * que es lo que hace falta saber: «y 3 sedes más» dice que hay más sin
 * obligar a leerlas.
 */
const MAXIMO_DE_SEDES = 2;

/**
 * Las especialidades reales del médico, en palabras y con la elegida primero:
 * en Cardiología, el cardiólogo dice «Cardiología». `undefined` si no declaró
 * ninguna o el catálogo no las resolvió, y entonces queda el título.
 */
function especialidadesDe(
  fila: PractitionerListItem,
  etiquetas: ConceptLabels,
  elegida: string | null,
): string | undefined {
  const nombres = [...fila.specialties]
    .sort(
      (a, b) => Number(b.specialtyConceptId === elegida) - Number(a.specialtyConceptId === elegida),
    )
    .map((especialidad) => etiquetas.get(especialidad.specialtyConceptId)?.display)
    .filter((nombre): nombre is string => nombre !== undefined && nombre !== '');
  return nombres.length === 0 ? undefined : [...new Set(nombres)].join(' · ');
}

export function porNombre(a: SearchResultItem, b: SearchResultItem): number {
  return a.title.localeCompare(b.title, 'es');
}

/**
 * Traduce el dominio a lo que la tarjeta de resultado muestra.
 *
 * La tarjeta no conoce al dominio a propósito (ver `search-result.types.ts`):
 * recibe figura, título, líneas de contexto y sellos, y quien la usa traduce.
 *
 * El `practitionerCode` no se muestra: es un identificador de sistema, y la
 * Guía es sólo del paciente (`navigation.map.ts`, `exclusiveRoles`), así que
 * no hay a quién mostrárselo por rol (feedback de la analista F-01, 18/08/2026).
 * Sigue viajando en el DTO por si una consola de administración lo necesita.
 */
export function toResultado(
  fila: PractitionerListItem,
  nombresDeOtros: readonly string[] = [],
  etiquetas: ConceptLabels = new Map(),
  elegida: string | null = null,
): SearchResultItem {
  const nombre = fila.displayName ?? 'Profesional sin nombre registrado';
  const meta = [];
  // El subtítulo pasa por el guardia de F-25: una tarjeta sin subtítulo es más
  // pobre, una con el nombre de otro es una guía que miente.
  // Primero las especialidades reales (propietario, 04/10/2026); el título
  // escrito a mano sólo cuando no declaró ninguna.
  const subtitulo =
    especialidadesDe(fila, etiquetas, elegida) ??
    professionalSubtitle(fila.professionalTitle, nombre, nombresDeOtros);
  // El subtítulo del profesional —«Cardióloga · Clínica Los Olivos»— NO va en
  // `meta`: es qué es esta persona, no un dato de contexto, y en el gris de
  // 13 px se leía igual que la lista de sedes de abajo. Va en `subtitle`, que
  // la tarjeta pinta pegado al nombre. Ver el JSDoc de `SearchResultItem`.

  // Dónde atiende, debajo del título. Es la pregunta que sigue a «quién es»
  // cuando se elige un médico, y hasta ahora había que abrir la ficha para
  // responderla. Con techo: alguien del padrón puede tener nueve sedes y la
  // tarjeta dejaría de ser una tarjeta.
  const sedes = fila.workplaces ?? [];
  if (sedes.length > 0) {
    const visibles = sedes.slice(0, MAXIMO_DE_SEDES);
    const resto = sedes.length - visibles.length;
    meta.push({
      text:
        visibles.join(' · ') +
        (resto > 0 ? ` · y ${resto} ${resto === 1 ? 'sede más' : 'sedes más'}` : ''),
    });
  }

  const sellos = [];
  // El sello de matrícula verificada, primero: es lo que distingue a quien
  // probó lo que declara del resto del padrón, y la guía los lista a todos.
  // Sólo se marca al verificado: estampar «sin verificar» a quien todavía no
  // pasó por el trámite dice de él algo que no es suyo.
  if (fila.verified) {
    sellos.push({ label: 'Matrícula verificada', tone: 'ok' as const });
  }
  // La disponibilidad para pacientes nuevos ya no se estampa: el sello salía en
  // TODA tarjeta, también en la de quien nunca tocó el ajuste, y el valor por
  // defecto anunciaba «No toma pacientes nuevos» de profesionales que sí los
  // toman. Quien busca lo resuelve en la agenda del profesional, que es el dato
  // real. `acceptsNewPatients` sigue viajando en la fila.
  if (fila.telehealthAvailable) {
    sellos.push({ label: 'Telemedicina', tone: 'info' as const });
  }

  return {
    id: fila.profileId,
    title: nombre,
    link: `/directory/${fila.profileId}`,
    // «Revisar disponibilidad» (fila 30 de la bitácora): el título lleva a la
    // ficha entera y esto salta a los horarios, que es la pregunta con la que
    // se compara a dos profesionales. Mismo destino, distinta altura — por eso
    // el ancla y no un segundo enlace al mismo lugar.
    action: {
      label: 'Revisar disponibilidad',
      link: `/directory/${fila.profileId}`,
      fragment: ANCLA_HORARIOS,
    },
    // Iniciales y no una foto de banco: en el hueco de la foto de perfil, una
    // persona ajena se lee como la cara del médico. Un lugar admite una imagen
    // ilustrativa; una persona, no. Cuando la guía resuelva `photoFileId`, su
    // foto real va acá.
    figureText: initialsOf(nombre),
    ...(subtitulo === undefined ? {} : { subtitle: subtitulo }),
    // Las reseñas reales, cuando la API las mande en el listado (P61).
    ...(fila.ratingAverage != null && (fila.ratingCount ?? 0) > 0
      ? { rating: { average: fila.ratingAverage, count: fila.ratingCount! } }
      : {}),
    // El check azul junto al nombre: lo decide la API (`verification`, o `verified`
    // en una API que todavía no lo envía). Acá sólo se traduce.
    verification: verificationOf(fila),
    meta,
    seals: sellos,
  };
}
