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
 * ## Por qué son cuarenta y siete y no siete
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
  /**
   * Candado. **No es `key`**: la llave es el acceso que se presta —la
   * delegación—, el candado es lo que uno guarda y nadie más abre. En un
   * formulario de acceso conviven, y confundirlos deja el campo de contraseña
   * diciendo «esto se comparte».
   */
  'lock',
  'link',
  'flag',
  'umbrella',
  'briefcase',

  // Contacto: cómo se llega a una persona. Ninguno de los de arriba lo dice
  // —`chat` es la mensajería del producto, no una dirección de correo—, y son
  // los dos datos que todo formulario de alta pide.
  'mail',
  'phone',

  // Avisos y ajustes.
  'bell',
  'sliders',
  'history',
  'teach',

  // Dirección: los dos únicos que NO nombran una sección.
  //
  // Entraron con el motor de formularios por partes, que necesita decir
  // «Atrás» y «Siguiente» sin texto (TAREA 04, AC-04-5). No había otra vía: el
  // sistema prohíbe el SVG suelto en una plantilla, así que un glifo que no
  // esté acá no se puede dibujar en ningún lado.
  //
  // Se declaran aparte y con este comentario para que la regla del set siga
  // leyéndose bien: los cuarenta y siete de arriba responden «¿qué sección es
  // esta?»; estos dos responden «¿hacia dónde va este botón?». Un ícono de
  // dirección NUNCA nombra una sección.
  'arrow-left',
  'arrow-right',

  // Y `remove`, por el mismo motivo y con la misma excusa: tampoco nombra una
  // sección, responde «¿qué le hace este botón a lo que está al lado?».
  //
  // Entra porque la alternativa que se había elegido era peor: los botones de
  // «Quitar» del alta usaban `arrow-left`, o sea **el mismo dibujo que el botón
  // «Atrás» del mismo formulario**. Dos acciones distintas con el mismo glifo en
  // la misma página rompe lo único que un ícono aporta, que es el
  // reconocimiento — es el defecto que el encabezado de `nav-icon.ts` describe,
  // visto del otro lado.
  //
  // Es un menos y no una papelera ni una cruz: quitar un nombre de más de una
  // lista no borra nada, y una papelera promete una destrucción que no ocurre.
  'remove',

  // Y `edit`, la cuarta acción del set: el lápiz que habilita los campos de
  // un formulario que entró en sólo lectura («Mi perfil», FT-11-R04). Responde
  // «¿qué le hace este botón a lo que está al lado?», igual que `remove`.
  //
  // Entra porque el pedido del cliente es un **botón de lápiz**, y la única
  // alternativa dentro del set era `note` —una hoja con un lápiz en la
  // esquina— que ya nombra la sección «Evoluciones»: el mismo dibujo para
  // «esta sección» y para «editar esto» rompe el reconocimiento, que es lo
  // único que un ícono aporta.
  'edit',

  // Preferencia del dispositivo: los tres del panel «Apariencia» y el que le
  // falta a «Permisos» (TAREA-17). No nombran una sección del menú, nombran un
  // valor de una preferencia — la misma excepción que ya vale para
  // `arrow-left`/`arrow-right`/`remove` un poco más arriba. `camera` sí falta
  // en el set y no es lo mismo que `scan`: una es la cámara del dispositivo,
  // la otra la imagenología clínica.
  'monitor',
  'sun',
  'moon',
  'camera',
] as const;

export type NavIconName = (typeof NAV_ICON_NAMES)[number];
