/**
 * Set de íconos de trazo propio de la navegación. Cerrado a propósito: un
 * string libre terminaría en nombres que no existen y en íconos mudos.
 *
 * ## Por qué vive acá y no en el nav lateral
 *
 * Lo declaraba `organisms/side-nav/side-nav.types.ts`, cuando el único que
 * dibujaba estos íconos era el menú. Desde el carril 02 los dibuja también
 * «Tus accesos» del panel, y el dueño del set tiene que ser el átomo que lo
 * pinta —si no, el panel importaría de un organismo para usar un ícono, que es
 * exactamente al revés de como se apilan las capas—.
 *
 * `side-nav.types.ts` lo re-exporta para no romper a quien ya lo importaba de
 * ahí.
 *
 * ## Por qué son cuarenta y cuatro y no siete
 *
 * Eran siete, elegidos cuando el menú tenía dos entradas y el set «anticipaba
 * los portales del modelo». Con cincuenta y cinco secciones eso dejó de ser un
 * set y pasó a ser un reparto: `orders` —una hoja de papel— cargaba catorce
 * secciones y `settings` doce, así que «Chats» era una onda de
 * electrocardiograma, «Directorio de médicos» una casa y «Directorio de
 * farmacias» un documento.
 *
 * Un ícono aporta **una** cosa: reconocer una sección sin leerla. Repetido
 * catorce veces no aporta nada —peor, miente—, y en la rejilla de «Tus
 * accesos», donde treinta secciones se ven juntas, la repetición es lo primero
 * que se nota.
 *
 * La regla al agregar uno: que **diga algo que su etiqueta no dice ya**. Dos
 * secciones comparten ícono sólo cuando son la misma idea vista dos veces
 * —«Turnos» y «Mis turnos», la agenda de quien atiende y la de quien
 * consulta—, nunca por falta de dibujo.
 */
export const NAV_ICON_NAMES = [
  // Los siete originales.
  'home',
  'patients',
  'calendar',
  'orders',
  'results',
  'billing',
  'settings',

  // Gente y conversación.
  'people',
  'chat',
  'directory',

  // Atención clínica.
  'stethoscope',
  'hospital',
  'flask',
  'scan',
  'scalpel',
  'pill',
  'heart',
  'folder',
  'note',

  // Papeles: los tres que `orders` hacía a la vez.
  'clipboard',
  'survey',
  'book',
  'labels',

  // Cosas y lugares.
  'building',
  'factory',
  'package',
  'bag',
  'tag',
  'megaphone',
  'pin',
  'route',
  'globe',

  // Dinero.
  'chart',
  'star',

  // Confianza y llaves.
  'shield',
  'key',
  'link',
  'flag',
  'umbrella',
  'briefcase',

  // Avisos y ajustes.
  'bell',
  'sliders',
  'history',
  'teach',
] as const;

export type NavIconName = (typeof NAV_ICON_NAMES)[number];
