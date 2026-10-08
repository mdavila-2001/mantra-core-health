import { of, throwError } from 'rxjs';

import { EstadoDeImagen } from './estado-de-imagen';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const archivo = (): File =>
  new File([Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0))], 'firma.png', { type: 'image/png' });
const esperar = async (estado: EstadoDeImagen): Promise<void> => {
  for (let i = 0; i < 50 && estado.subiendo(); i += 1) {
    await new Promise((resolver) => setTimeout(resolver, 5));
  }
};

describe('EstadoDeImagen', () => {
  it('empieza sin nada pendiente', () => {
    const estado = new EstadoDeImagen('la firma');

    expect(estado.cambio).toBeUndefined();
    expect(estado.visible()).toBeNull();
  });

  it('cargar muestra lo guardado, pero no pisa lo que la persona ya eligió', async () => {
    const estado = new EstadoDeImagen('la firma');
    estado.cargar('data:image/png;base64,guardada');
    expect(estado.visible()).toBe('data:image/png;base64,guardada');

    estado.elegir([archivo()], () => of('file-nuevo'));
    await esperar(estado);
    estado.cargar('data:image/png;base64,llegó-tarde');

    expect(estado.visible()).toMatch(/^data:image\/png/);
    expect(estado.visible()).not.toContain('llegó-tarde');
  });

  it('elegir sube, muestra la vista previa y deja el id pendiente', async () => {
    const estado = new EstadoDeImagen('el sello');
    const subir = vi.fn(() => of('file-nuevo'));

    estado.elegir([archivo()], subir);
    await esperar(estado);

    expect(subir).toHaveBeenCalledTimes(1);
    expect(estado.cambio).toBe('file-nuevo');
    expect(estado.visible()).toMatch(/^data:image\/png/);
    expect(estado.subiendo()).toBe(false);
  });

  it('elegir sin archivos no hace nada', () => {
    const estado = new EstadoDeImagen('el sello');
    const subir = vi.fn(() => of('x'));

    estado.elegir([], subir);

    expect(subir).not.toHaveBeenCalled();
    expect(estado.cambio).toBeUndefined();
  });

  it('si la subida falla lo dice, nombrando lo que se subía, y no deja nada pendiente', async () => {
    const estado = new EstadoDeImagen('la firma');

    estado.elegir([archivo()], () => throwError(() => new Error('500')));
    await esperar(estado);

    expect(estado.error()).toBe('No se pudo subir la firma. Pruebe de nuevo.');
    expect(estado.cambio).toBeUndefined();
    expect(estado.subiendo()).toBe(false);
  });

  it('quitar lo guardado deja pendiente `null`; quitar lo que nunca hubo no deja nada', () => {
    const conGuardada = new EstadoDeImagen('la firma');
    conGuardada.cargar('data:image/png;base64,x');
    conGuardada.quitar();
    expect(conGuardada.cambio).toBeNull();
    expect(conGuardada.visible()).toBeNull();

    const vacia = new EstadoDeImagen('la firma');
    vacia.quitar();
    expect(vacia.cambio).toBeUndefined();
  });

  it('descartar vuelve a lo guardado', async () => {
    const estado = new EstadoDeImagen('la firma');
    estado.cargar('data:image/png;base64,guardada');
    estado.elegir([archivo()], () => of('file-nuevo'));
    await esperar(estado);

    estado.descartar();

    expect(estado.cambio).toBeUndefined();
    expect(estado.visible()).toBe('data:image/png;base64,guardada');
  });

  it('confirmar convierte lo visible en lo guardado', async () => {
    const estado = new EstadoDeImagen('la firma');
    estado.elegir([archivo()], () => of('file-nuevo'));
    await esperar(estado);

    estado.confirmar();
    estado.descartar();

    // Ya no hay a qué volver: lo que se veía quedó como lo guardado.
    expect(estado.cambio).toBeUndefined();
    expect(estado.visible()).toMatch(/^data:image\/png/);
  });

  it.each([
    ['tamaño', '2 MB'],
    ['tipo', 'PNG, JPG o WEBP'],
  ] as const)('rechazar por %s explica el motivo', (reason, texto) => {
    const estado = new EstadoDeImagen('el sello');

    estado.rechazar([{ file: archivo(), reason }]);

    expect(estado.error()).toContain(texto);
    expect(estado.cambio).toBeUndefined();
  });
});
