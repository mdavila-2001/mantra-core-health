/**
 * Las marcas que el editor sabe aplicar.
 *
 * La lista es corta a propósito. Una nota clínica se imprime, se manda por fax,
 * la lee un lector de pantalla y algún día se exporta a otro sistema; lo que
 * sobreviva a todo eso es lo que vale la pena ofrecer.
 *
 * **Por qué no hay color.** Es la única petición que se dejó fuera. Si un médico
 * marca una alergia en rojo y ese rojo se pierde —impreso en blanco y negro,
 * dictado por un lector, exportado a texto plano—, el énfasis desaparece sin que
 * nadie se entere. La negrita sobrevive a las tres cosas. Lo mismo con los
 * tamaños libres: `h2`/`h3` dicen «esto es un título» y eso viaja; «letra 18» no
 * dice nada fuera de esta pantalla.
 */
export type MarcaDeTexto =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'insertHorizontalRule'
  | 'undo'
  | 'redo';

/** Los bloques que el editor sabe aplicar al párrafo donde está el cursor. */
export type BloqueDeTexto = 'p' | 'h2' | 'h3' | 'h4' | 'blockquote';

/** Un botón de la barra de herramientas. */
export interface HerramientaDeEditor {
  /** Qué aplica. */
  readonly comando: MarcaDeTexto | BloqueDeTexto;
  /** Si cambia el bloque entero o sólo lo seleccionado. */
  readonly tipo: 'marca' | 'bloque';
  /** Lo que se lee en el botón y en su nombre accesible. */
  readonly etiqueta: string;
  /** Atajo de teclado, cuando el navegador ya lo trae. */
  readonly atajo?: string;
  /**
   * Trazos (atributo `d`) de un ícono de 24×24 con `stroke`. Con ícono, el
   * botón muestra el dibujo y la etiqueta queda para el lector de pantalla y
   * el globo; sin ícono, se lee la etiqueta.
   */
  readonly icono?: readonly string[];
  /** Grupo visual: la barra dibuja un separador cuando cambia. */
  readonly grupo?: string;
  /** Si es un interruptor con estado (negrita sí/no); deshacer o separador no lo son. */
  readonly sinEstado?: boolean;
}

/**
 * Las etiquetas que sobreviven al saneado.
 *
 * Todo lo demás se descarta al pegar y al guardar. No es paranoia de seguridad
 * solamente —que también, porque este HTML se vuelve a pintar—: es que la nota
 * se firma por el hash de su contenido, y si el texto guardado depende de lo que
 * el portapapeles trajo de Word, dos notas idénticas a la vista tendrían hashes
 * distintos.
 */
export const ETIQUETAS_PERMITIDAS: readonly string[] = [
  'P',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'UL',
  'OL',
  'LI',
  'H2',
  'H3',
];

/** La barra, en el orden en que se dibuja. */
export const HERRAMIENTAS: readonly HerramientaDeEditor[] = [
  { comando: 'bold', tipo: 'marca', etiqueta: 'Negrita', atajo: 'Ctrl+B' },
  { comando: 'italic', tipo: 'marca', etiqueta: 'Cursiva', atajo: 'Ctrl+I' },
  { comando: 'underline', tipo: 'marca', etiqueta: 'Subrayado', atajo: 'Ctrl+U' },
  { comando: 'h2', tipo: 'bloque', etiqueta: 'Título' },
  { comando: 'h3', tipo: 'bloque', etiqueta: 'Subtítulo' },
  { comando: 'p', tipo: 'bloque', etiqueta: 'Texto normal' },
  { comando: 'insertUnorderedList', tipo: 'marca', etiqueta: 'Lista' },
  { comando: 'insertOrderedList', tipo: 'marca', etiqueta: 'Lista numerada' },
];

/** Una imagen que quien monta el editor inserta en la hoja. */
export interface ImagenDeEditor {
  /** Clave con la que quien llama la reconoce (para su archivo, su texto alternativo). */
  readonly key: string;
  /** Vista previa local: `blob:` o `data:image/…`. Cualquier otro origen se descarta. */
  readonly src: string;
  /** Texto alternativo. */
  readonly alt: string;
}

/**
 * La barra completa de un artículo: historial, marcas, jerarquía de títulos,
 * listas y bloques. Sin subrayado: el artículo se guarda como texto con marcas
 * y no tiene cómo expresarlo (ver `article-markup`).
 */
export const HERRAMIENTAS_DE_ARTICULO: readonly HerramientaDeEditor[] = [
  { comando: 'undo', tipo: 'marca', etiqueta: 'Deshacer', atajo: 'Ctrl+Z', grupo: 'historial', sinEstado: true, icono: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'] },
  { comando: 'redo', tipo: 'marca', etiqueta: 'Rehacer', atajo: 'Ctrl+Y', grupo: 'historial', sinEstado: true, icono: ['m15 14 5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'] },
  { comando: 'bold', tipo: 'marca', etiqueta: 'Negrita', atajo: 'Ctrl+B', grupo: 'marcas', icono: ['M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8'] },
  { comando: 'italic', tipo: 'marca', etiqueta: 'Cursiva', atajo: 'Ctrl+I', grupo: 'marcas', icono: ['M19 4h-9', 'M14 20H5', 'M15 4 9 20'] },
  { comando: 'strikeThrough', tipo: 'marca', etiqueta: 'Tachado', grupo: 'marcas', icono: ['M16 4H9a3 3 0 0 0-2.83 4', 'M14 12a4 4 0 0 1 0 8H6', 'M4 12h16'] },
  { comando: 'p', tipo: 'bloque', etiqueta: 'Texto normal', grupo: 'bloques' },
  { comando: 'h2', tipo: 'bloque', etiqueta: 'Título', grupo: 'bloques' },
  { comando: 'h3', tipo: 'bloque', etiqueta: 'Subtítulo', grupo: 'bloques' },
  { comando: 'h4', tipo: 'bloque', etiqueta: 'Apartado', grupo: 'bloques' },
  { comando: 'insertUnorderedList', tipo: 'marca', etiqueta: 'Lista', grupo: 'listas', icono: ['M3 6h.01', 'M3 12h.01', 'M3 18h.01', 'M8 6h13', 'M8 12h13', 'M8 18h13'] },
  { comando: 'insertOrderedList', tipo: 'marca', etiqueta: 'Lista numerada', grupo: 'listas', icono: ['M10 6h11', 'M10 12h11', 'M10 18h11', 'M4 6h1v4', 'M4 10h2', 'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'] },
  { comando: 'blockquote', tipo: 'bloque', etiqueta: 'Cita', grupo: 'listas', icono: ['M3 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1z', 'M15 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z'] },
  { comando: 'insertHorizontalRule', tipo: 'marca', etiqueta: 'Separador', grupo: 'listas', sinEstado: true, icono: ['M5 12h14'] },
];

/** Etiquetas extra que admite la hoja de un artículo (además de {@link ETIQUETAS_PERMITIDAS}). */
export const ETIQUETAS_DE_ARTICULO: readonly string[] = ['H4', 'BLOCKQUOTE', 'HR', 'S', 'STRIKE', 'DEL', 'A'];
