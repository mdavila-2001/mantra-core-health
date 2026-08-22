import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Las 11 categorías clínicas del glosario, en el orden en que se dibuja la
 * grilla — el mismo de `glossary-reconstruction-spec.md`. No es alfabético: va
 * de lo anatómico a lo asistencial, que es como razona alguien que hojea un
 * diccionario médico.
 *
 * El `internalCode` es la clave real del backend (`glossary-category-<key>`);
 * este archivo sólo la usa para elegir el ícono y el orden, nunca para
 * traducir el nombre — el nombre en castellano lo trae `GlossaryTag.name` del
 * catálogo, como cualquier otro dato de presentación.
 */
export const GLOSSARY_CATEGORY_ORDER = [
  'glossary-category-anatomy',
  'glossary-category-signs-symptoms',
  'glossary-category-disease',
  'glossary-category-specialty',
  'glossary-category-diagnostic-test',
  'glossary-category-procedure',
  'glossary-category-treatment',
  'glossary-category-pharmacology',
  'glossary-category-lab',
  'glossary-category-imaging',
  'glossary-category-care',
] as const;

export type GlossaryCategoryCode = (typeof GLOSSARY_CATEGORY_ORDER)[number];

/**
 * Si un `internalCode` es una de las 11 categorías del glosario.
 *
 * Es el filtro que separa la grilla del resto de los conjuntos de valores que
 * devuelve `listValueSets()` — esa lectura no es del glosario, es de **todo**
 * el catálogo de la plataforma (género, estados administrativos, etc.), y sin
 * este filtro la grilla mostraría enums que no tienen nada de médico.
 */
export function isGlossaryCategoryCode(internalCode: string): internalCode is GlossaryCategoryCode {
  return (GLOSSARY_CATEGORY_ORDER as readonly string[]).includes(internalCode);
}

/**
 * Posición de una categoría en el orden de la grilla. Las que no se reconocen
 * —no debería pasar, pero un backend cambia antes que un frontend— se van al
 * final en vez de romper el orden de las demás.
 */
export function glossaryCategoryOrder(internalCode: string): number {
  const posicion = GLOSSARY_CATEGORY_ORDER.indexOf(internalCode as GlossaryCategoryCode);
  return posicion === -1 ? GLOSSARY_CATEGORY_ORDER.length : posicion;
}

/**
 * El ícono de una categoría del glosario, o el género neutro por defecto.
 *
 * No existe un `<app-icon>` genérico ni un sprite compartido en este proyecto
 * (`NAV_ICON_NAMES` del nav lateral es un set cerrado de 7 nombres, sin
 * relación con la medicina) — once formas nuevas no justifican construir esa
 * pieza genérica, así que este componente vive acá, junto a quien lo usa.
 *
 * Trazo simple de un color (`currentColor`), mismo peso visual que los íconos
 * del nav lateral (`stroke-width="1.6"`, `viewBox="0 0 24 24"`, sin relleno):
 * es la referencia de estilo que ya tiene el proyecto, no una invención.
 *
 * ```html
 * <app-glossary-category-icon [category]="etiqueta.internalCode" />
 * ```
 *
 * Sirve además como el marcador visual de un término **sin** imagen — que hoy
 * son todos: no hay política de licencias para imágenes médicas externas en
 * este repositorio (ver `glossary-reconstruction-spec.md`), así que la
 * iconografía por categoría reemplaza a la foto de stock que no se va a usar.
 */
@Component({
  selector: 'app-glossary-category-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'glossary-category-icon',
    'aria-hidden': 'true',
  },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      @switch (category()) {
        @case ('glossary-category-anatomy') {
          <!-- Silueta humana simplificada. -->
          <circle cx="12" cy="5" r="2.4" />
          <path d="M12 8v6M9 11H6.5a1.5 1.5 0 0 1 0-3H9M15 11h2.5a1.5 1.5 0 0 0 0-3H15M12 14l-2.5 7M12 14l2.5 7" />
        }
        @case ('glossary-category-signs-symptoms') {
          <!-- Termómetro. -->
          <path d="M12 3a2 2 0 0 0-2 2v9.3a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2Z" />
          <line x1="12" y1="8" x2="12" y2="14" />
          <circle cx="12" cy="17.5" r="1.3" />
        }
        @case ('glossary-category-disease') {
          <!-- Virus. -->
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <line x1="5.3" y1="5.3" x2="7.4" y2="7.4" />
          <line x1="16.6" y1="16.6" x2="18.7" y2="18.7" />
          <line x1="5.3" y1="18.7" x2="7.4" y2="16.6" />
          <line x1="16.6" y1="7.4" x2="18.7" y2="5.3" />
        }
        @case ('glossary-category-specialty') {
          <!-- Estetoscopio. -->
          <path d="M6 3v6a4 4 0 0 0 8 0V3" />
          <path d="M10 13v2a5 5 0 0 0 10 0v-1.5" />
          <circle cx="20" cy="12.5" r="1.6" />
        }
        @case ('glossary-category-diagnostic-test') {
          <!-- Lupa sobre un trazo de electrocardiograma. -->
          <path d="M3 12h3l1.5-4L10 16l2-8 1.5 4H16" />
          <circle cx="18" cy="16" r="3.2" />
          <line x1="20.3" y1="18.3" x2="22" y2="20" />
        }
        @case ('glossary-category-procedure') {
          <!-- Bisturí. -->
          <path d="M4 20 15 9" />
          <path d="M15 9 20 4l-1.5-1.5L14 7l-3-3-2 2Z" />
        }
        @case ('glossary-category-treatment') {
          <!-- Suero / gotero. -->
          <path d="M9 3h6l-1 5H10z" />
          <path d="M8 8h8l-1.2 8.5A2.8 2.8 0 0 1 12 19a2.8 2.8 0 0 1-2.8-2.5z" />
          <line x1="12" y1="12" x2="12" y2="15" />
        }
        @case ('glossary-category-pharmacology') {
          <!-- Cápsula. -->
          <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-30 12 12)" />
          <line x1="10.3" y1="7.4" x2="13.7" y2="16.6" />
        }
        @case ('glossary-category-lab') {
          <!-- Tubo de ensayo. -->
          <path d="M9 3h6" />
          <path d="M10 3v9.5L5.6 19a2 2 0 0 0 1.7 3h9.4a2 2 0 0 0 1.7-3L14 12.5V3" />
          <line x1="8" y1="15" x2="16" y2="15" />
        }
        @case ('glossary-category-imaging') {
          <!-- Placa radiográfica. -->
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 9c1.5 2 1.5 4 0 6M12 8c1.8 2.4 1.8 5.6 0 8M16 9c1.5 2 1.5 4 0 6" />
        }
        @case ('glossary-category-care') {
          <!-- Corazón con cruz: cuidado de enfermería. -->
          <path d="M12 20 4.5 12.6a4.6 4.6 0 0 1 6.5-6.5l1 1 1-1a4.6 4.6 0 0 1 6.5 6.5Z" />
          <line x1="12" y1="9.5" x2="12" y2="14.5" />
          <line x1="9.5" y1="12" x2="14.5" y2="12" />
        }
        @default {
          <!-- Cruz médica genérica: cualquier categoría que el frontend todavía no reconozca. -->
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        }
      }
    </svg>
  `,
})
export class GlossaryCategoryIcon {
  /** El `internalCode` del value set de categoría, p. ej. `glossary-category-disease`. */
  readonly category = input<string>('');
}
