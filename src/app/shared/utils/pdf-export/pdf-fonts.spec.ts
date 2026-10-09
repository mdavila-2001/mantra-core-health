import {
  aBase64,
  FONT_FILES,
  setDocumentFonts,
  documentFonts,
  prepareFonts,
  TYPEFACES_PATH,
} from './pdf-fonts';

/** Unos bytes cualesquiera que se reconocen al volver. */
function bytes(texto: string): ArrayBuffer {
  return new TextEncoder().encode(texto).buffer as ArrayBuffer;
}

describe('prepararFuentes', () => {
  beforeEach(() => setDocumentFonts(null));

  it('baja las dos fuentes de la carpeta pública y las deja en base64', async () => {
    const pedidas: string[] = [];
    const bajar = vi.fn(async (url: string) => {
      pedidas.push(url);
      return bytes(url.endsWith(FONT_FILES.titulos) ? 'poppins' : 'inter');
    });

    const fuentes = await prepareFonts(bajar);

    expect(pedidas).toEqual([
      `${TYPEFACES_PATH}${FONT_FILES.titulos}`,
      `${TYPEFACES_PATH}${FONT_FILES.cuerpo}`,
    ]);
    expect(fuentes).toEqual({
      titulos: { archivo: FONT_FILES.titulos, base64: btoa('poppins') },
      cuerpo: { archivo: FONT_FILES.cuerpo, base64: btoa('inter') },
    });
  });

  /**
   * Un papel con los títulos en Poppins y el cuerpo en Helvetica se vería como
   * un error de maquetado: si falta una, se descartan las dos.
   */
  it('si una sola falla no devuelve ninguna', async () => {
    const bajar = vi.fn(async (url: string) =>
      url.endsWith(FONT_FILES.cuerpo) ? null : bytes('poppins'),
    );

    expect(await prepareFonts(bajar)).toBeNull();
  });

  it('nunca rechaza: un error de red deja el papel en Helvetica', async () => {
    const bajar = vi.fn(async () => {
      throw new Error('sin red');
    });

    await expect(prepareFonts(bajar)).resolves.toBeNull();
  });

  it('un archivo vacío cuenta como ausente', async () => {
    const bajar = vi.fn(async () => new ArrayBuffer(0));

    expect(await prepareFonts(bajar)).toBeNull();
  });
});

describe('el holder de fuentes', () => {
  it('arranca vacío y guarda lo que se le pone', () => {
    setDocumentFonts(null);
    expect(documentFonts()).toBeNull();

    const fuentes = {
      titulos: { archivo: 'poppins-600.ttf', base64: 'AA==' },
      cuerpo: { archivo: 'inter-400.ttf', base64: 'AA==' },
    };
    setDocumentFonts(fuentes);
    expect(documentFonts()).toBe(fuentes);
    setDocumentFonts(null);
  });
});

describe('aBase64', () => {
  it('codifica igual que btoa sobre la cadena binaria', () => {
    expect(aBase64(bytes('AloVida'))).toBe(btoa('AloVida'));
  });

  /** Un TTF pesa cientos de KB: más que el tope de argumentos de una llamada. */
  it('aguanta un archivo de cientos de KB sin desbordar la pila', () => {
    const grande = new Uint8Array(400_000).fill(65);

    expect(aBase64(grande.buffer).length).toBe(Math.ceil(400_000 / 3) * 4);
  });
});
