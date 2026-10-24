import {
  aBase64,
  ARCHIVOS_DE_FUENTES,
  establecerFuentesDeDocumentos,
  fuentesDeDocumentos,
  prepararFuentes,
  RUTA_DE_TIPOGRAFIAS,
} from './pdf-fuentes';

/** Unos bytes cualesquiera que se reconocen al volver. */
function bytes(texto: string): ArrayBuffer {
  return new TextEncoder().encode(texto).buffer as ArrayBuffer;
}

describe('prepararFuentes', () => {
  beforeEach(() => establecerFuentesDeDocumentos(null));

  it('baja las cuatro fuentes de AloVida de la carpeta pública y las deja en base64', async () => {
    const pedidas: string[] = [];
    const bajar = vi.fn(async (url: string) => {
      pedidas.push(url);
      return bytes(url.slice(RUTA_DE_TIPOGRAFIAS.length));
    });

    const fuentes = await prepararFuentes(bajar);

    expect(pedidas).toEqual([
      `${RUTA_DE_TIPOGRAFIAS}poppins-600.ttf`,
      `${RUTA_DE_TIPOGRAFIAS}poppins-500.ttf`,
      `${RUTA_DE_TIPOGRAFIAS}nunito-sans-400.ttf`,
      `${RUTA_DE_TIPOGRAFIAS}nunito-sans-700.ttf`,
    ]);
    expect(fuentes).toEqual({
      titulos: { archivo: 'poppins-600.ttf', base64: btoa('poppins-600.ttf') },
      rotulos: { archivo: 'poppins-500.ttf', base64: btoa('poppins-500.ttf') },
      cuerpo: { archivo: 'nunito-sans-400.ttf', base64: btoa('nunito-sans-400.ttf') },
      cuerpoDestacado: { archivo: 'nunito-sans-700.ttf', base64: btoa('nunito-sans-700.ttf') },
    });
  });

  it('las cuatro existen en la carpeta pública', async () => {
    const { existsSync } = await import('node:fs');
    for (const archivo of Object.values(ARCHIVOS_DE_FUENTES)) {
      expect(existsSync(`public${RUTA_DE_TIPOGRAFIAS}${archivo}`), archivo).toBe(true);
    }
  });

  /**
   * Un papel con los títulos en Poppins y el cuerpo en Helvetica se vería como
   * un error de maquetado: si falta una, se descartan todas.
   */
  it.each(Object.values(ARCHIVOS_DE_FUENTES))('si sólo falla %s no devuelve ninguna', async (falla) => {
    const bajar = vi.fn(async (url: string) => (url.endsWith(falla) ? null : bytes('fuente')));

    expect(await prepararFuentes(bajar)).toBeNull();
  });

  it('nunca rechaza: un error de red deja el papel en Helvetica', async () => {
    const bajar = vi.fn(async () => {
      throw new Error('sin red');
    });

    await expect(prepararFuentes(bajar)).resolves.toBeNull();
  });

  it('un archivo vacío cuenta como ausente', async () => {
    const bajar = vi.fn(async () => new ArrayBuffer(0));

    expect(await prepararFuentes(bajar)).toBeNull();
  });
});

describe('el holder de fuentes', () => {
  it('arranca vacío y guarda lo que se le pone', () => {
    establecerFuentesDeDocumentos(null);
    expect(fuentesDeDocumentos()).toBeNull();

    const fuentes = {
      titulos: { archivo: 'poppins-600.ttf', base64: 'AA==' },
      rotulos: { archivo: 'poppins-500.ttf', base64: 'AA==' },
      cuerpo: { archivo: 'nunito-sans-400.ttf', base64: 'AA==' },
      cuerpoDestacado: { archivo: 'nunito-sans-700.ttf', base64: 'AA==' },
    };
    establecerFuentesDeDocumentos(fuentes);
    expect(fuentesDeDocumentos()).toBe(fuentes);
    establecerFuentesDeDocumentos(null);
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
