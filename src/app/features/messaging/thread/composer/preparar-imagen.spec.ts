import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';
import {
  ImagenRechazada,
  LADO_MAXIMO,
  prepararImagen,
  renombrarComoJpeg,
  type Lienzo,
} from './preparar-imagen';

/**
 * Lo que estas pruebas fijan: una foto que ya está bien **no se toca**; una
 * enorme en píxeles o en peso, o en un formato que el servidor no reconoce, se
 * redibuja como JPEG con el lado mayor en 2048; el GIF no se redibuja nunca; y
 * sin navegador (SSR) no se inventa una reducción que no se puede hacer.
 */
describe('prepararImagen', () => {
  const archivo = (nombre: string, tipo: string, bytes: number): File => {
    const f = new File(['x'], nombre, { type: tipo });
    Object.defineProperty(f, 'size', { value: bytes });
    return f;
  };

  /** Un lienzo de mentira: mide lo que se le dice y codifica a `bytes`. */
  const lienzo = (
    ancho: number,
    alto: number,
    bytes = 500_000,
  ): Lienzo & { codificados: { ancho: number; alto: number; tipo: string }[]; cerrado: boolean } => {
    const registro = {
      codificados: [] as { ancho: number; alto: number; tipo: string }[],
      cerrado: false,
      decodificar: async () => ({
        ancho,
        alto,
        dibujable: {} as CanvasImageSource,
        cerrar: () => {
          registro.cerrado = true;
        },
      }),
      codificar: async (_f: CanvasImageSource, w: number, h: number, tipo: string) => {
        registro.codificados.push({ ancho: w, alto: h, tipo });
        const blob = new Blob(['y'], { type: tipo });
        Object.defineProperty(blob, 'size', { value: bytes });
        return blob;
      },
    };
    return registro;
  };

  it('deja pasar sin tocar una foto aceptada, liviana y de tamaño razonable', async () => {
    const original = archivo('receta.jpg', 'image/jpeg', 800_000);
    const l = lienzo(1600, 1200);
    const lista = await prepararImagen(original, true, l);
    expect(lista).toBe(original);
    expect(l.codificados).toEqual([]);
    expect(l.cerrado).toBe(true);
  });

  it('achica a 2048 de lado mayor una foto de cámara enorme en píxeles', async () => {
    const original = archivo('IMG_2041.png', 'image/png', 3_000_000);
    const l = lienzo(4000, 3000);
    const lista = await prepararImagen(original, true, l);
    expect(lista).not.toBe(original);
    expect(lista.type).toBe('image/jpeg');
    expect(lista.name).toBe('IMG_2041.jpg');
    expect(l.codificados[0]).toEqual({ ancho: LADO_MAXIMO, alto: 1536, tipo: 'image/jpeg' });
  });

  it('reduce la que pesa más que el tope aunque sus píxeles estén bien', async () => {
    const original = archivo('scan.png', 'image/png', UPLOAD_MAX_BYTES + 1);
    const l = lienzo(1800, 1200);
    const lista = await prepararImagen(original, true, l);
    expect(lista.type).toBe('image/jpeg');
    expect(lista.size).toBeLessThanOrEqual(UPLOAD_MAX_BYTES);
    // Sin agrandar: la escala nunca pasa de 1.
    expect(l.codificados[0]).toEqual({ ancho: 1800, alto: 1200, tipo: 'image/jpeg' });
  });

  it('convierte a JPEG un formato que el servidor no reconoce (HEIC)', async () => {
    const lista = await prepararImagen(archivo('foto.heic', 'image/heic', 2_000_000), true, lienzo(1000, 800));
    expect(lista.type).toBe('image/jpeg');
    expect(lista.name).toBe('foto.jpg');
  });

  it('rechaza con un mensaje claro lo que el navegador no sabe abrir', async () => {
    const roto: Lienzo = {
      decodificar: () => Promise.reject(new Error('no')),
      codificar: () => Promise.reject(new Error('no')),
    };
    await expect(prepararImagen(archivo('x.tiff', 'image/tiff', 10), true, roto)).rejects.toThrow(
      /no es una imagen que podamos mandar/,
    );
  });

  it('rechaza si aun achicándola no entra en el tope', async () => {
    const l = lienzo(4000, 3000, UPLOAD_MAX_BYTES + 1);
    await expect(prepararImagen(archivo('a.png', 'image/png', 30_000_000), true, l)).rejects.toBeInstanceOf(
      ImagenRechazada,
    );
    expect(l.codificados).toHaveLength(3);
  });

  it('no redibuja un GIF y lo rechaza si se pasa del tope', async () => {
    const l = lienzo(4000, 3000);
    const chico = archivo('risa.gif', 'image/gif', 1_000_000);
    expect(await prepararImagen(chico, true, l)).toBe(chico);
    await expect(
      prepararImagen(archivo('largo.gif', 'image/gif', UPLOAD_MAX_BYTES + 1), true, l),
    ).rejects.toThrow(/10 MB/);
    expect(l.codificados).toEqual([]);
  });

  it('sin navegador (SSR) no reduce: pasa lo que ya cumple y rechaza lo demás', async () => {
    const l = lienzo(4000, 3000);
    const chica = archivo('a.webp', 'image/webp', 1000);
    expect(await prepararImagen(chica, false, l)).toBe(chica);
    await expect(prepararImagen(archivo('b.png', 'image/png', UPLOAD_MAX_BYTES + 1), false, l)).rejects.toBeInstanceOf(
      ImagenRechazada,
    );
  });

  it('renombra a .jpg conservando el nombre', () => {
    expect(renombrarComoJpeg('IMG_1.HEIC')).toBe('IMG_1.jpg');
    expect(renombrarComoJpeg('sin-extension')).toBe('sin-extension.jpg');
    expect(renombrarComoJpeg('.png')).toBe('foto.jpg');
  });
});
