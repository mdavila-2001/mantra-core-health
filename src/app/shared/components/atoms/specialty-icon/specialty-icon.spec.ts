import { iconoDeEspecialidad, SPECIALTY_ICON_NAMES } from './specialty-icon.types';

/**
 * El resolvedor de íconos de especialidad.
 *
 * Se prueba la **función** y no el componente dibujado: lo que puede fallar acá
 * es la resolución —una raíz que se come a otra, una tilde que no casa, un
 * nombre compuesto que cae del lado equivocado—, no que Angular pinte un
 * `<svg>`. El fallo, además, es mudo: una especialidad mal resuelta no rompe
 * nada, sólo dibuja el estetoscopio genérico, y en una rejilla de dieciocho
 * tarjetas eso pasa desapercibido hasta que alguien lo mira de cerca.
 */
describe('iconoDeEspecialidad', () => {
  it('resuelve las dieciocho especialidades del catálogo a un ícono propio', () => {
    // Los `display` tal como los sirve `VS_MEDICAL_SPECIALTY`, con sus tildes.
    const catalogo = [
      'Cardiología',
      'Pediatría',
      'Ginecología y obstetricia',
      'Dermatología',
      'Traumatología y ortopedia',
      'Medicina interna',
      'Neurología',
      'Psiquiatría',
      'Oftalmología',
      'Odontología',
      'Endocrinología',
      'Gastroenterología',
      'Neumología',
      'Urología',
      'Nutrición',
      'Fisioterapia',
      'Anestesiología',
    ];

    const iconos = catalogo.map(iconoDeEspecialidad);

    // Ninguna cae al genérico: son justo las que el set dibuja.
    expect(iconos).not.toContain('general');
    // Y ninguna comparte dibujo con otra, que es lo único que un ícono aporta.
    expect(new Set(iconos).size).toBe(catalogo.length);
  });

  it('cae al genérico cuando el catálogo trae una que el set no dibuja', () => {
    // No es un error: es lo que tiene que pasar con una especialidad nueva de
    // terminología. Un hueco sería peor que el estetoscopio.
    expect(iconoDeEspecialidad('Cirugía maxilofacial')).toBe('general');
    expect(iconoDeEspecialidad('Medicina general')).toBe('general');
  });

  it('resuelve igual con tilde y sin tilde, y sin importar la caja', () => {
    // El nombre llega de dos sitios escritos por gente distinta: el `display`
    // del catálogo y el titular libre del perfil. «Cardiologia» a secas tiene
    // que dar el mismo corazón.
    expect(iconoDeEspecialidad('cardiologia')).toBe('cardiologia');
    expect(iconoDeEspecialidad('CARDIOLOGÍA')).toBe('cardiologia');
    expect(iconoDeEspecialidad('  Cardiología  ')).toBe('cardiologia');
  });

  it('no confunde neumología con neurología', () => {
    // Las dos empiezan por «neu» y son el par que un `startsWith` descuidado
    // junta: pulmón y cerebro con el mismo dibujo.
    expect(iconoDeEspecialidad('Neumología')).toBe('neumologia');
    expect(iconoDeEspecialidad('Neurología')).toBe('neurologia');
  });

  it('manda «Traumatología y ortopedia» a un solo lado, no a dos', () => {
    // El nombre contiene las dos raíces que el mapa conoce; gana la primera de
    // la tabla, y lo que importa es que sea siempre la misma.
    expect(iconoDeEspecialidad('Traumatología y ortopedia')).toBe('traumatologia');
    expect(iconoDeEspecialidad('Ortopedia')).toBe('traumatologia');
  });

  it('tolera el vacío y el nulo con el genérico', () => {
    // Los dos existen en pantalla: el grupo «Sin especialidad declarada» de la
    // portada y el «Especialidad no informada» del listado público.
    expect(iconoDeEspecialidad(null)).toBe('general');
    expect(iconoDeEspecialidad(undefined)).toBe('general');
    expect(iconoDeEspecialidad('')).toBe('general');
  });

  it('sólo devuelve nombres del set declarado', () => {
    // El componente conmuta por estos nombres: uno que no esté en la lista
    // caería en el `@default` sin que nadie se entere.
    const nombres = new Set<string>(SPECIALTY_ICON_NAMES);
    for (const especialidad of ['Cardiología', 'Oncología', 'Otorrinolaringología', 'Lo que sea']) {
      expect(nombres.has(iconoDeEspecialidad(especialidad))).toBe(true);
    }
  });
});
