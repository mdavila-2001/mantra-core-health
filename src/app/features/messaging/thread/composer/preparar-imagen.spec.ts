import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';
import {
  ImagenRechazada,
  LADO_MAXIMO,
  LIENZO_DEL_NAVEGADOR,
  prepararImagen,
  quitarMetadatosPng,
  renombrarComoJpeg,
  type Lienzo,
} from './preparar-imagen';

/** Un bloque PNG: largo + tipo + datos + CRC (en cero: nadie lo verifica acá). */
const bloque = (tipo: string, datos: number[] = []): number[] => [
  0, 0, 0, datos.length,
  ...Array.from(tipo, (letra) => letra.charCodeAt(0)),
  ...datos,
  0, 0, 0, 0,
];
const FIRMA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = bloque('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const IDAT = bloque('IDAT', [1, 2, 3]);
const IEND = bloque('IEND');
/** «GPS» en un tEXt, como lo deja un editor que exporta el XMP. */
const TEXTO_GPS = bloque('tEXt', Array.from('GPS\0-34.6,-58.4', (c) => c.charCodeAt(0)));
const png = (...bloques: number[][]): Uint8Array => new Uint8Array([...FIRMA, ...bloques.flat()]);

/**
 * Lo que estas pruebas fijan: un JPEG **se redibuja siempre**, para que el
 * EXIF —el GPS— no salga del teléfono; a un PNG chico se le sacan los
 * metadatos sin recomprimirlo; un WEBP chico no se toca; una imagen enorme en
 * píxeles o en peso, o en un formato que el servidor no reconoce, se redibuja
 * como JPEG con el lado mayor en 2048; el GIF no se redibuja nunca; y sin
 * navegador (SSR) no se inventa una reducción que no se puede hacer.
 */
describe('prepararImagen', () => {
  const archivo = (nombre: string, tipo: string, bytes: number, contenido: BlobPart = 'x'): File => {
    const f = new File([contenido], nombre, { type: tipo });
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

  it('deja pasar sin tocar un WEBP aceptado, liviano y de tamaño razonable', async () => {
    const original = archivo('sticker.webp', 'image/webp', 800_000);
    const l = lienzo(1600, 1200);
    const lista = await prepararImagen(original, true, l);
    expect(lista).toBe(original);
    expect(l.codificados).toEqual([]);
    expect(l.cerrado).toBe(true);
  });

  describe('EXIF: los metadatos no salen del teléfono', () => {
    it('redibuja siempre un JPEG, aunque sea chico, al mismo tamaño y con el mismo nombre', async () => {
      const original = archivo('receta.jpg', 'image/jpeg', 800_000);
      const l = lienzo(1600, 1200);
      const lista = await prepararImagen(original, true, l);
      expect(lista).not.toBe(original);
      expect(lista.type).toBe('image/jpeg');
      expect(lista.name).toBe('receta.jpg');
      // Sin achicar: sólo se redibuja para que el canvas no copie el EXIF.
      expect(l.codificados).toEqual([{ ancho: 1600, alto: 1200, tipo: 'image/jpeg' }]);
      expect(l.cerrado).toBe(true);
    });

    it('el lienzo real decodifica aplicando la orientación EXIF', async () => {
      const mapa = { width: 3, height: 4, close: vi.fn() };
      const crear = vi.fn().mockResolvedValue(mapa);
      vi.stubGlobal('createImageBitmap', crear);
      try {
        const original = archivo('de-costado.jpg', 'image/jpeg', 10);
        const imagen = await LIENZO_DEL_NAVEGADOR.decodificar(original);
        expect(crear).toHaveBeenCalledWith(original, { imageOrientation: 'from-image' });
        expect(imagen.ancho).toBe(3);
        expect(imagen.alto).toBe(4);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('a un PNG chico le saca los bloques de texto sin recomprimirlo', async () => {
      const original = archivo('captura.png', 'image/png', 50_000, png(IHDR, TEXTO_GPS, IDAT, IEND) as BlobPart);
      const l = lienzo(800, 600);
      const lista = await prepararImagen(original, true, l);
      expect(lista).not.toBe(original);
      expect(lista.type).toBe('image/png');
      expect(lista.name).toBe('captura.png');
      expect(new Uint8Array(await lista.arrayBuffer())).toEqual(png(IHDR, IDAT, IEND));
      expect(l.codificados).toEqual([]);
    });

    it('un PNG chico sin metadatos pasa sin tocar (conserva la transparencia)', async () => {
      const original = archivo('logo.png', 'image/png', 50_000, png(IHDR, IDAT, IEND) as BlobPart);
      const l = lienzo(800, 600);
      expect(await prepararImagen(original, true, l)).toBe(original);
      expect(l.codificados).toEqual([]);
    });

    it('un PNG con eXIf se redibuja como PNG: sin GPS, con su orientación y su transparencia', async () => {
      const original = archivo('camara.png', 'image/png', 50_000, png(IHDR, bloque('eXIf', [0x4d, 0x4d]), IDAT, IEND) as BlobPart);
      const l = lienzo(800, 600);
      const lista = await prepararImagen(original, true, l);
      expect(lista.type).toBe('image/png');
      expect(lista.name).toBe('camara.png');
      expect(l.codificados).toEqual([{ ancho: 800, alto: 600, tipo: 'image/png' }]);
    });

    it('un «PNG» que por dentro no lo es se redibuja: no se deja pasar a ciegas', async () => {
      // Un JPEG con la extensión cambiada: el navegador lo abre igual, y su
      // EXIF viajaría entero.
      const l = lienzo(800, 600);
      const lista = await prepararImagen(archivo('falso.png', 'image/png', 50_000, 'no soy un png'), true, l);
      expect(l.codificados).toEqual([{ ancho: 800, alto: 600, tipo: 'image/png' }]);
      expect(lista.type).toBe('image/png');
    });
  });

  describe('quitarMetadatosPng', () => {
    it('saca eXIf, tEXt, zTXt, iTXt y tIME y deja los bloques que cambian cómo se ve', () => {
      const color = bloque('iCCP', [1]);
      const densidad = bloque('pHYs', [2]);
      const resultado = quitarMetadatosPng(
        png(IHDR, color, bloque('eXIf'), TEXTO_GPS, bloque('zTXt'), bloque('iTXt'), bloque('tIME'), densidad, IDAT, IEND),
      );
      expect(resultado?.quitados).toEqual(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
      expect(resultado?.limpio).toEqual(png(IHDR, color, densidad, IDAT, IEND));
    });

    it('devuelve null si no es un PNG o está cortado', () => {
      expect(quitarMetadatosPng(new Uint8Array([0xff, 0xd8, 0xff, 0xe1]))).toBeNull();
      expect(quitarMetadatosPng(png(IHDR, IDAT))).toBeNull();
      const cortado = png(IHDR, IDAT, IEND).subarray(0, 30);
      expect(quitarMetadatosPng(cortado)).toBeNull();
    });
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
