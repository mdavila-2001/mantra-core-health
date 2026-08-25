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
  | 'insertUnorderedList'
  | 'insertOrderedList';

/** Los bloques que el editor sabe aplicar al párrafo donde está el cursor. */
export type BloqueDeTexto = 'p' | 'h2' | 'h3';

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
