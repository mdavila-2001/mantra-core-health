import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';
import {
  ImagenRechazada,
  LADO_MAXIMO,
  LIENZO_DEL_NAVEGADOR,
  orientacionExif,
  prepararImagen,
  quitarMetadatosGif,
  quitarMetadatosPng,
  quitarMetadatosWebp,
  renombrarComoJpeg,
  type Lienzo,
} from './prepare-image';

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

const letras = (texto: string): number[] => Array.from(texto, (c) => c.charCodeAt(0));
const u32le = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/** Un chunk RIFF: FourCC + tamaño LE + datos + relleno si es impar. */
const chunk = (tipo: string, datos: number[]): number[] => [
  ...letras(tipo),
  ...u32le(datos.length),
  ...datos,
  ...(datos.length % 2 ? [0] : []),
];
/** Un WEBP: `RIFF` + tamaño (todo lo que sigue a esos 8 bytes) + `WEBP` + chunks. */
const webp = (...chunks: number[][]): Uint8Array => {
  const cuerpo = chunks.flat();
  return new Uint8Array([...letras('RIFF'), ...u32le(4 + cuerpo.length), ...letras('WEBP'), ...cuerpo]);
};
/** `VP8X` con los flags dados, lienzo de 1×1 (ancho-1 y alto-1 en 24 bits). */
const vp8x = (flags: number): number[] => chunk('VP8X', [flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const ALPH = chunk('ALPH', [0, 0xaa, 0xbb]);
const VP8 = chunk('VP8 ', [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 1, 0, 1, 0, 0x11]);
const ICCP = chunk('ICCP', [7, 7, 7, 7]);
/** TIFF big-endian con un IFD0 de una entrada: orientación (0x0112) = `valor`. */
const tiff = (valor: number): number[] => [
  ...letras('MM'), 0, 42, 0, 0, 0, 8,
  0, 1,
  0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, valor, 0, 0,
  0, 0, 0, 0,
];
/** Un EXIF con GPS «escondido» detrás de la orientación normal. */
const EXIF_GPS = chunk('EXIF', [...tiff(1), ...letras('GPS-34.6,-58.4')]);
const XMP = chunk('XMP ', letras('<x:xmpmeta><exif:GPSLatitude>34,36S</exif:GPSLatitude></x:xmpmeta>'));
const FLAG_ICC = 0x20;
const FLAG_ALFA = 0x10;
const FLAG_EXIF = 0x08;
const FLAG_XMP = 0x04;

/** GIF89a 1×1 con paleta global de 2 colores. */
const GIF_CABECERA = [...letras('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 0xff, 0xff, 0xff];
const NETSCAPE = [0x21, 0xff, 11, ...letras('NETSCAPE2.0'), 3, 1, 0, 0, 0];
const CONTROL = [0x21, 0xf9, 4, 0x04, 10, 0, 0, 0];
const CUADRO = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0];
const COMENTARIO = [0x21, 0xfe, 9, ...letras('GPS -34.6'), 0];
/** XMP como lo escribe Photoshop: `XMP DataXMP` y el paquete en sub-bloques. */
const XMP_GIF = [0x21, 0xff, 11, ...letras('XMP DataXMP'), 12, ...letras('<x:xmpmeta/>'), 0];
const gif = (...bloques: number[][]): Uint8Array => new Uint8Array([...GIF_CABECERA, ...bloques.flat(), 0x3b]);

/**
 * Lo que estas pruebas fijan: un JPEG **se redibuja siempre**, para que el
 * EXIF —el GPS— no salga del teléfono; a un PNG chico se le sacan los
 * metadatos sin recomprimirlo; a un WEBP chico, los chunks EXIF y XMP; a un
 * GIF, los comentarios y el XMP, sin tocar el loop; una imagen enorme en
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

  it('deja pasar sin tocar un WEBP aceptado, liviano, sin metadatos y de tamaño razonable', async () => {
    const original = archivo('sticker.webp', 'image/webp', 800_000, webp(vp8x(FLAG_ALFA), ALPH, VP8) as BlobPart);
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

  describe('WEBP: EXIF y XMP fuera, sin recomprimir', () => {
    it('a un WEBP chico le saca EXIF y XMP byte a byte y deja la transparencia', async () => {
      const original = archivo(
        'sticker.webp',
        'image/webp',
        50_000,
        webp(vp8x(FLAG_ICC | FLAG_ALFA | FLAG_EXIF | FLAG_XMP), ICCP, ALPH, VP8, EXIF_GPS, XMP) as BlobPart,
      );
      const l = lienzo(800, 600);
      const lista = await prepararImagen(original, true, l);
      expect(lista).not.toBe(original);
      expect(lista.type).toBe('image/webp');
      expect(lista.name).toBe('sticker.webp');
      expect(new Uint8Array(await lista.arrayBuffer())).toEqual(webp(vp8x(FLAG_ICC | FLAG_ALFA), ICCP, ALPH, VP8));
      expect(l.codificados).toEqual([]);
    });

    it('un WEBP cuyo EXIF lo gira se redibuja como WEBP: sin GPS y sin quedar acostado', async () => {
      const girado = chunk('EXIF', tiff(6));
      const original = archivo('de-costado.webp', 'image/webp', 50_000, webp(vp8x(FLAG_EXIF), VP8, girado) as BlobPart);
      const l = lienzo(800, 600);
      const lista = await prepararImagen(original, true, l);
      expect(l.codificados).toEqual([{ ancho: 800, alto: 600, tipo: 'image/webp' }]);
      expect(lista.type).toBe('image/webp');
      expect(lista.name).toBe('de-costado.webp');
    });

    it('un WEBP cortado se redibuja como WEBP en vez de pasar con lo que traiga', async () => {
      const entero = webp(vp8x(FLAG_EXIF), VP8, EXIF_GPS);
      const original = archivo('cortado.webp', 'image/webp', 50_000, entero.subarray(0, entero.length - 5) as BlobPart);
      const l = lienzo(800, 600);
      const lista = await prepararImagen(original, true, l);
      expect(l.codificados).toEqual([{ ancho: 800, alto: 600, tipo: 'image/webp' }]);
      expect(lista.type).toBe('image/webp');
    });

    it('si el navegador no codifica WEBP, el redibujo sale como PNG (conserva la transparencia)', async () => {
      const l = lienzo(800, 600);
      const comoPng: Lienzo = {
        decodificar: l.decodificar,
        codificar: async () => new Blob([new Uint8Array(10)], { type: 'image/png' }),
      };
      const lista = await prepararImagen(archivo('falso.webp', 'image/webp', 50_000, 'no soy un webp'), true, comoPng);
      expect(lista.type).toBe('image/png');
      expect(lista.name).toBe('falso.png');
    });
  });

  describe('quitarMetadatosWebp', () => {
    it('recalcula el tamaño RIFF y apaga sólo los bits de EXIF y XMP del VP8X', () => {
      const entrada = webp(vp8x(0x3e), ICCP, ALPH, VP8, EXIF_GPS, XMP);
      const copia = entrada.slice();
      const resultado = quitarMetadatosWebp(entrada);
      expect(resultado?.quitados).toEqual(['EXIF', 'XMP ']);
      const limpio = resultado?.limpio ?? new Uint8Array();
      expect(limpio).toEqual(webp(vp8x(0x3e & ~(FLAG_EXIF | FLAG_XMP)), ICCP, ALPH, VP8));
      expect(new DataView(limpio.buffer, limpio.byteOffset).getUint32(4, true)).toBe(limpio.length - 8);
      expect(limpio[20]).toBe(FLAG_ICC | FLAG_ALFA | 0x02);
      // Ni rastro del GPS ni del XMP.
      const texto = String.fromCharCode(...limpio);
      expect(texto).not.toContain('GPS');
      expect(texto).not.toContain('xmpmeta');
      // El arreglo de quien llama queda como estaba.
      expect(entrada).toEqual(copia);
    });

    it('respeta el relleno de los chunks de tamaño impar', () => {
      const impar = chunk('ALPH', [1, 2, 3]);
      const resultado = quitarMetadatosWebp(webp(vp8x(FLAG_XMP), impar, chunk('XMP ', [9]), VP8));
      expect(resultado?.limpio).toEqual(webp(vp8x(0), impar, VP8));
    });

    it('un WEBP simple (sin VP8X) con nada que sacar sale igual', () => {
      expect(quitarMetadatosWebp(webp(VP8))?.limpio).toEqual(webp(VP8));
    });

    it('devuelve el EXIF quitado para leer su orientación', () => {
      const resultado = quitarMetadatosWebp(webp(vp8x(FLAG_EXIF), VP8, chunk('EXIF', [...letras('Exif\0\0'), ...tiff(8)])));
      expect(orientacionExif(resultado?.exif ?? new Uint8Array())).toBe(8);
      expect(orientacionExif(new Uint8Array(tiff(1)))).toBe(1);
      expect(orientacionExif(new Uint8Array([1, 2, 3]))).toBeNull();
    });

    it('devuelve null si no es un RIFF/WEBP o está cortado', () => {
      expect(quitarMetadatosWebp(png(IHDR, IDAT, IEND))).toBeNull();
      expect(quitarMetadatosWebp(new Uint8Array([...letras('RIFF'), ...u32le(4), ...letras('WAVE')]))).toBeNull();
      const entero = webp(vp8x(FLAG_EXIF), VP8, EXIF_GPS);
      expect(quitarMetadatosWebp(entero.subarray(0, entero.length - 1))).toBeNull();
      // Un chunk que dice ser más largo que el RIFF.
      const mentiroso = webp(VP8);
      mentiroso[16] = 0xff;
      expect(quitarMetadatosWebp(mentiroso)).toBeNull();
    });
  });

  describe('GIF: comentarios y XMP fuera, la animación intacta', () => {
    it('saca comentarios y el XMP y conserva el loop NETSCAPE2.0, los controles y los cuadros', () => {
      const resultado = quitarMetadatosGif(gif(NETSCAPE, COMENTARIO, XMP_GIF, CONTROL, CUADRO, CONTROL, CUADRO));
      expect(resultado?.quitados).toEqual(['comentario', 'aplicación XMP DataXMP']);
      expect(resultado?.limpio).toEqual(gif(NETSCAPE, CONTROL, CUADRO, CONTROL, CUADRO));
      const texto = String.fromCharCode(...(resultado?.limpio ?? []));
      expect(texto).toContain('NETSCAPE2.0');
      expect(texto).not.toContain('GPS');
      expect(texto).not.toContain('xmpmeta');
    });

    it('conserva ANIMEXTS1.0 y una paleta local', () => {
      const animexts = [0x21, 0xff, 11, ...letras('ANIMEXTS1.0'), 3, 1, 0, 0, 0];
      const conPaleta = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x80, 1, 2, 3, 4, 5, 6, 2, 2, 0x44, 0x01, 0];
      const resultado = quitarMetadatosGif(gif(animexts, COMENTARIO, conPaleta));
      expect(resultado?.limpio).toEqual(gif(animexts, conPaleta));
    });

    it('devuelve null si no es un GIF o está cortado', () => {
      expect(quitarMetadatosGif(png(IHDR, IDAT, IEND))).toBeNull();
      const entero = gif(NETSCAPE, CUADRO);
      expect(quitarMetadatosGif(entero.subarray(0, entero.length - 1))).toBeNull();
      expect(quitarMetadatosGif(entero.subarray(0, entero.length - 6))).toBeNull();
      expect(quitarMetadatosGif(new Uint8Array([...GIF_CABECERA, 0x99, 0x3b]))).toBeNull();
    });

    it('prepararImagen manda el GIF limpio, sin redibujarlo', async () => {
      const l = lienzo(4000, 3000);
      const original = archivo('risa.gif', 'image/gif', 1_000_000, gif(NETSCAPE, XMP_GIF, CONTROL, CUADRO) as BlobPart);
      const lista = await prepararImagen(original, true, l);
      expect(lista.type).toBe('image/gif');
      expect(lista.name).toBe('risa.gif');
      expect(new Uint8Array(await lista.arrayBuffer())).toEqual(gif(NETSCAPE, CONTROL, CUADRO));
      expect(l.codificados).toEqual([]);
    });

    it('prepararImagen rechaza un GIF dañado en vez de mandarlo con sus metadatos', async () => {
      const entero = gif(NETSCAPE, XMP_GIF, CUADRO);
      const cortado = archivo('roto.gif', 'image/gif', 1_000, entero.subarray(0, 40) as BlobPart);
      await expect(prepararImagen(cortado, true, lienzo(10, 10))).rejects.toThrow(/dañado o incompleto/);
      await expect(prepararImagen(cortado, false, lienzo(10, 10))).rejects.toBeInstanceOf(ImagenRechazada);
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
    const chico = archivo('risa.gif', 'image/gif', 1_000_000, gif(NETSCAPE, CONTROL, CUADRO) as BlobPart);
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
