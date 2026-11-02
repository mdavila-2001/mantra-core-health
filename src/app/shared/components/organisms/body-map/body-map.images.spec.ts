import type { DestroyRef } from '@angular/core';
import { ImagenesDelCuerpo } from './body-map.images';

describe('ImagenesDelCuerpo', () => {
  let imagenes: ImagenesDelCuerpo;
  let cerrar: () => void;
  let siguienteCopia: number;

  beforeEach(() => {
    siguienteCopia = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('imagen')),
    );
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode = vi.fn(async () => undefined);
      },
    );
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:prueba-${++siguienteCopia}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const destruccion: DestroyRef = {
      destroyed: false,
      onDestroy: (callback) => {
        cerrar = callback;
        return () => undefined;
      },
    };
    imagenes = new ImagenesDelCuerpo(destruccion);
  });

  afterEach(() => {
    cerrar();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reutiliza la descarga y la copia de una vista repetida', async () => {
    const descarga = imagenes.precargar('/frente.webp');
    expect(imagenes.precargar('/frente.webp')).toBe(descarga);
    await descarga;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(imagenes.fuente('/frente.webp')).toBe('blob:prueba-1');
  });

  it('permite la ruta original si el servidor rechaza la imagen', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    await imagenes.precargar('/frente.webp');
    expect(imagenes.fuente('/frente.webp')).toBe('/frente.webp');
    expect(imagenes.listas().has('/frente.webp')).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('libera una copia que no se puede decodificar', async () => {
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode = vi.fn(async () => {
          throw new Error('Imagen dañada');
        });
      },
    );
    await imagenes.precargar('/frente.webp');
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:prueba-1');
    expect(imagenes.fuente('/frente.webp')).toBe('/frente.webp');
  });

  it('cancela al cerrar y no crea copias si la respuesta llega después', async () => {
    let responder!: (respuesta: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolver) => {
          responder = resolver;
        }),
    );
    const descarga = imagenes.precargar('/frente.webp');
    cerrar();
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    responder(new Response('imagen'));
    await descarga;
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('libera una copia pendiente de decodificar y no la publica después de cerrar', async () => {
    let decodificar!: () => void;
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode = () =>
          new Promise<void>((resolver) => {
            decodificar = resolver;
          });
      },
    );
    const descarga = imagenes.precargar('/frente.webp');
    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    cerrar();
    decodificar();
    await descarga;
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:prueba-1');
    expect(imagenes.fuente('/frente.webp')).toBe('/frente.webp');
  });
});
