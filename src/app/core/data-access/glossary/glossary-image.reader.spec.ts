import { readImageAsDataUrl, safeImageUrl } from './glossary-image.reader';

describe('safeImageUrl', () => {
  it('admite una ilustración propia y una URL https', () => {
    expect(safeImageUrl('/glossary-images/asma-bronquial.svg')).toBe(
      '/glossary-images/asma-bronquial.svg',
    );
    expect(safeImageUrl('https://upload.wikimedia.org/a.jpg')).toBe(
      'https://upload.wikimedia.org/a.jpg',
    );
  });

  it('rechaza http, rutas fuera de la carpeta propia, recorridos y valores que no son URL', () => {
    expect(safeImageUrl('http://upload.wikimedia.org/a.jpg')).toBeNull();
    expect(safeImageUrl('/otra-carpeta/a.svg')).toBeNull();
    expect(safeImageUrl('/glossary-images/../secreto.svg')).toBeNull();
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('no es una url')).toBeNull();
  });
});

/** Una respuesta mínima: `blob()` con el tipo dado (el `Response` de Node no entiende el `Blob` del entorno). */
const answer = (ok: boolean, type = 'image/svg+xml', body = '<svg/>') => ({
  ok,
  blob: () => Promise.resolve(new Blob([body], { type })),
});

describe('readImageAsDataUrl', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve la imagen como data URL y pide sin credenciales', async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer(true));
    vi.stubGlobal('fetch', fetchMock);

    const dataUrl = await readImageAsDataUrl('/glossary-images/asma-bronquial.svg');

    expect(dataUrl.startsWith('data:image/svg+xml')).toBe(true);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit' });
  });

  it('rechaza una URL insegura sin pedir nada', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(readImageAsDataUrl('http://ejemplo.org/a.png')).rejects.toThrow('URL segura');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza una respuesta que no es imagen y una que no respondió', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(true, 'text/html', '<html/>')));
    await expect(readImageAsDataUrl('https://ejemplo.org/a.png')).rejects.toThrow(
      'formato o tamaño',
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(false)));
    await expect(readImageAsDataUrl('https://ejemplo.org/a.png')).rejects.toThrow('no respondió');
  });

  it('si el navegador bloquea la petición (connect-src), el rechazo llega a quien llama', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(readImageAsDataUrl('https://upload.wikimedia.org/a.jpg')).rejects.toThrow(
      'Failed to fetch',
    );
  });
});
