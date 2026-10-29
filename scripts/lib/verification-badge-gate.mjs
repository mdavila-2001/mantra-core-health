/**
 * Reglas del guardián de la insignia de verificación (`check-verification-badge.mjs`).
 *
 * El sello de «verificado» tiene UN átomo (`app-verification-badge`) y UN campo
 * del servidor (`verification`). Pintar un sello a mano en otra pantalla es
 * exactamente cómo un check aparece donde la API no lo dijo: por eso estas
 * reglas buscan los tres atajos que se usan para saltarse el átomo.
 *
 *   R1 · glifo   — un ✓ ✔ ☑ ✅ 🔵 en la misma línea que «verificad…», «verified»
 *                  u «oficial». Un glifo escrito en un texto es un check que
 *                  cualquiera (un nombre, una bio) puede imitar.
 *   R2 · svg     — un `<svg>` pegado a un texto de verificación (título, clase,
 *                  `data-testid` o texto oculto «Identidad verificada»): es un
 *                  sello dibujado a mano.
 *   R3 · trazo   — el contorno del escudo del átomo copiado en otro archivo.
 *   R4 · clase   — una clase propia cuyo nombre dice verified/verificado/a.
 *   R5 · chip    — un `<app-status-seal>` (el chip del estado de un trámite) cuyo
 *                  `variant` o `label` se arma con la verificación del profesional
 *                  (`verificacion`, `verification`, «habilitación»): una segunda
 *                  fuente visual del mismo estado, que además puede contradecir
 *                  a la insignia (un «?» junto a «Verificado», «Pendiente» junto
 *                  al reloj de «en verificación»).
 *   R6 · rótulo  — un sello de texto «Verificado» / «Matrícula verificada» armado
 *                  a mano (`label: 'Verificado'`) para un resultado.
 *
 * Es análisis de texto, sin dependencias, y sólo mira lo que se puede mirar:
 * cuando una regla duda, avisa de más (nunca de menos).
 */

/** El único lugar donde se dibuja el sello. */
export const ATOM_DIR = 'src/app/shared/components/atoms/verification-badge/';

/** Archivos que no pintan nada de producto. */
export function isExempt(ruta) {
  return (
    ruta.startsWith(ATOM_DIR) ||
    /\.spec\.ts$/.test(ruta) ||
    /\.generated\.ts$/.test(ruta) ||
    /\/testing\//.test(ruta) ||
    ruta.startsWith('src/app/core/mock/')
  );
}

/** Los glifos de «check» con los que se imita una verificación en un texto. */
const GLYPHS = /[✓✔☑✅🔵]/u;

/** Lo que una línea dice cuando afirma una verificación. */
const CLAIM = /verificad[oa]s?|verified|oficial\b/i;

/**
 * Lo que, pegado a un `<svg>`, lo vuelve un sello de verificación hecho a mano:
 * un atributo (`title`, `aria-label`, `data-testid`, `class`) que dice
 * verificado/verified, o el texto oculto «Identidad verificada» que
 * acompaña a un pictograma. Los comentarios no cuentan: hablan de verificación
 * sin pintarla.
 */
const SEAL_TEXT =
  /(?:title|aria-label|data-testid|class)\s*=\s*"[^"]*(?:verificad[oa]|verified)[^"]*"|solo-lectores"\s*>[^<]*verificad/i;

/** Cuánto contexto se mira antes y después de cada `<svg>`. */
const CONTEXT_CHARS = 160;

/** Primeros caracteres del contorno del escudo del átomo. */
export const SEAL_PATH_PREFIX = 'M12 2.4c2.6 1.7 5.2 2.5 7.7 2.6';

const CLASS_NAME_IN_MARKUP = /class\s*=\s*"([^"]*)"/g;
const BAD_CLASS = /(?:^|[\s_-])(?:verified|verificad[oa])(?:$|[\s_-])|[\w]-(?:verified|verificad[oa])\b|__(?:verified|verificad[oa])\b/i;
const CSS_SELECTOR = /\.([\w-]*(?:verified|verificad[oa])[\w-]*)\s*[{,:.>+~[]/gi;

/**
 * Hallazgos de un archivo.
 *
 * @param {string} ruta  relativa al repo, con `/`
 * @param {string} texto contenido
 * @returns {{ regla: string, linea: number, muestra: string }[]}
 */
export function findViolations(ruta, texto) {
  if (isExempt(ruta)) {
    return [];
  }
  const esCss = ruta.endsWith('.css');
  const lineas = texto.split('\n');
  const hallazgos = [];
  const agregar = (regla, linea, muestra) =>
    hallazgos.push({ regla, linea, muestra: muestra.trim().slice(0, 110) });

  // R4 · clases propias (CSS y plantillas)
  if (esCss) {
    lineas.forEach((l, i) => {
      for (const m of l.matchAll(CSS_SELECTOR)) {
        agregar('R4 clase propia', i + 1, `.${m[1]}`);
      }
    });
    return hallazgos;
  }
  lineas.forEach((l, i) => {
    for (const m of l.matchAll(CLASS_NAME_IN_MARKUP)) {
      if (BAD_CLASS.test(m[1])) {
        agregar('R4 clase propia', i + 1, `class="${m[1]}"`);
      }
    }
  });

  // R1 · glifo en un texto de verificación
  lineas.forEach((l, i) => {
    if (GLYPHS.test(l) && CLAIM.test(l)) {
      agregar('R1 glifo', i + 1, l);
    }
  });

  // R2 · svg pegado a un texto de verificación
  const svg = /<svg\b[\s\S]*?<\/svg>/gi;
  for (const m of texto.matchAll(svg)) {
    const desde = Math.max(0, m.index - CONTEXT_CHARS);
    const hasta = Math.min(texto.length, m.index + m[0].length + CONTEXT_CHARS);
    const contexto = texto.slice(desde, hasta).replace(/<!--[\s\S]*?-->/g, ' ');
    if (SEAL_TEXT.test(contexto) || SEAL_TEXT.test(m[0])) {
      const linea = texto.slice(0, m.index).split('\n').length;
      agregar('R2 svg de sello', linea, contexto.replace(/\s+/g, ' '));
    }
  }

  // R5 · chip de trámite que dice la verificación del profesional
  for (const m of texto.matchAll(/<app-status-seal\b[^>]*>/gi)) {
    if (/\[(?:variant|label)\]\s*=\s*"[^"]*(?:verificacion|verification|habilitaci)/i.test(m[0])) {
      agregar('R5 chip de estado', texto.slice(0, m.index).split('\n').length, m[0].replace(/\s+/g, ' '));
    }
  }

  // R6 · sello de texto «Verificado» armado a mano
  lineas.forEach((l, i) => {
    if (/\blabel\s*:\s*'(?:Matr[ií]cula verificada|Verificad[oa])'/.test(l)) {
      agregar('R6 rótulo de texto', i + 1, l);
    }
  });

  // R3 · el contorno del átomo copiado
  const trazo = texto.indexOf(SEAL_PATH_PREFIX);
  if (trazo >= 0) {
    agregar('R3 trazo copiado', texto.slice(0, trazo).split('\n').length, SEAL_PATH_PREFIX);
  }
  return hallazgos;
}
