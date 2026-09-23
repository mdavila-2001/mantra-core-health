import { iconoDeServicio, SERVICE_ICON_NAMES } from './service-icon.types';

/**
 * El resolvedor de íconos de servicio.
 *
 * Se prueba la **función** y no el componente dibujado: lo que puede fallar
 * acá es la resolución —una palabra que se come a otra, una tilde que no casa,
 * un nombre compuesto que cae del lado equivocado—, no que Angular pinte un
 * `<svg>`. El fallo, además, es mudo: un servicio mal resuelto no rompe nada,
 * sólo dibuja la etiqueta genérica, y en una rejilla eso pasa desapercibido
 * hasta que alguien lo mira de cerca.
 */
describe('iconoDeServicio', () => {
  it('le da a «Cita médica» el ícono de consulta y no el genérico', () => {
    // Es el servicio que toda práctica trae de fábrica y, en un catálogo
    // recién creado, la única tarjeta de la pantalla: si cae al genérico, la
    // primera impresión de «Mis servicios» es una etiqueta de precio.
    expect(iconoDeServicio('Cita médica')).toBe('consulta');
  });

  it('no confunde la teleconsulta con la consulta', () => {
    // «Teleconsulta» contiene «consulta» entera: es el par que un `includes`
    // sin orden junta, y son dos servicios que se cobran distinto.
    expect(iconoDeServicio('Teleconsulta')).toBe('teleconsulta');
    expect(iconoDeServicio('Consulta médica')).toBe('consulta');
  });

  it('manda «Consulta de control» a control, y siempre al mismo lado', () => {
    // El nombre contiene las dos palabras que el mapa conoce; gana la primera
    // de la tabla, y lo que importa es que sea siempre la misma.
    expect(iconoDeServicio('Consulta de control')).toBe('control');
    expect(iconoDeServicio('Control post operatorio')).toBe('control');
  });

  it('separa la ecografía de la radiografía', () => {
    // Las dos son «imágenes» y con el mismo dibujo la rejilla no distingue el
    // estudio que se hace con el aparato en la mano del que se hace en sala.
    expect(iconoDeServicio('Ecografía abdominal')).toBe('ecografia');
    expect(iconoDeServicio('Radiografía de tórax')).toBe('imagen');
  });

  it('no manda lo dental al bisturí', () => {
    // «Extracción dental» tiene el aire de un procedimiento quirúrgico, pero
    // en la rejilla lo que hay que reconocer de un vistazo es que es del
    // dentista.
    expect(iconoDeServicio('Extracción dental')).toBe('odontologia');
    expect(iconoDeServicio('Limpieza dental')).toBe('odontologia');
  });

  it('resuelve igual con tilde y sin tilde, y sin importar la caja', () => {
    // El nombre lo escribe cada práctica a mano o lo trae el arancel: las tres
    // formas llegan de verdad.
    expect(iconoDeServicio('ecografia')).toBe('ecografia');
    expect(iconoDeServicio('ECOGRAFÍA')).toBe('ecografia');
    expect(iconoDeServicio('  Ecografía  ')).toBe('ecografia');
  });

  it('cae al genérico cuando el catálogo trae algo que el set no dibuja', () => {
    // No es un error: es lo que tiene que pasar con un servicio que la
    // práctica inventó. Un hueco sería peor que la etiqueta.
    expect(iconoDeServicio('Alquiler de silla de ruedas')).toBe('general');
  });

  it('tolera el vacío y el nulo con el genérico', () => {
    expect(iconoDeServicio(null)).toBe('general');
    expect(iconoDeServicio(undefined)).toBe('general');
    expect(iconoDeServicio('')).toBe('general');
  });

  it('sólo devuelve nombres del set declarado', () => {
    // El componente conmuta por estos nombres: uno que no esté en la lista
    // caería en el `@default` sin que nadie se entere.
    const nombres = new Set<string>(SERVICE_ICON_NAMES);
    for (const servicio of [
      'Cita médica',
      'Hemograma completo',
      'Vacuna antigripal',
      'Certificado de aptitud',
      'Sesión de kinesiología',
      'Día cama en internación',
      'Curación de herida',
      'Cirugía de vesícula',
      'Lo que sea',
    ]) {
      expect(nombres.has(iconoDeServicio(servicio))).toBe(true);
    }
  });
});
