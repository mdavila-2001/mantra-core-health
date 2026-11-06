import { GENERIC_SPECIALTY_IMAGE, defaultSpecialtyImage, safeImageValue } from './specialty-images';

describe('specialty-images', () => {
  it.each([
    ['Cardiología', '/especialidades/cardiologia.svg'],
    ['Ginecología y obstetricia', '/especialidades/ginecologia-obstetricia.svg'],
    ['Medicina interna', '/especialidades/medicina-interna.svg'],
    ['Psiquiatría y salud mental', '/especialidades/psiquiatria.svg'],
    ['Radiología e Imagenología', '/especialidades/radiologia.svg'],
    ['Fisioterapia y Rehabilitación', '/especialidades/fisioterapia.svg'],
    ['Cirugía General', '/especialidades/cirugia-general.svg'],
    ['Algo desconocido', GENERIC_SPECIALTY_IMAGE],
  ])('%s → %s', (nombre, ruta) => {
    expect(defaultSpecialtyImage(nombre)).toBe(ruta);
  });

  it('acepta sólo rutas propias, https y data:image raster', () => {
    expect(safeImageValue('/especialidades/a.svg')).toBe('/especialidades/a.svg');
    expect(safeImageValue('https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(safeImageValue('data:image/webp;base64,AAAA')).toBe('data:image/webp;base64,AAAA');
    expect(safeImageValue('javascript:alert(1)')).toBeNull();
    expect(safeImageValue('//evil.test/a.png')).toBeNull();
    expect(safeImageValue('data:image/svg+xml;base64,AAAA')).toBeNull();
    expect(safeImageValue(42)).toBeNull();
  });
});
