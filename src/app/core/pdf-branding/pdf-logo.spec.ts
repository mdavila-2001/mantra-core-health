import { contenerLogo, establecerLogoDeDocumentos, logoDeDocumentos, prepararLogo } from './pdf-logo';

const CAJA = { ancho: 120, alto: 34 } as const;

describe('contenerLogo', () => {
  it('un logo apaisado más ancho que la caja se ajusta al ancho', () => {
    const caja = contenerLogo({ ancho: 360, alto: 120 }, CAJA)!;

    // 360×120 es 3:1; la caja es ~3,5:1, así que manda el alto.
    expect(caja.alto).toBeCloseTo(34, 5);
    expect(caja.ancho).toBeCloseTo(102, 5);
    expect(caja.arriba).toBeCloseTo(0, 5);
  });

  it('un logo más apaisado que la caja se ajusta al ancho y se centra en vertical', () => {
    const caja = contenerLogo({ ancho: 1000, alto: 100 }, CAJA)!;

    expect(caja.ancho).toBeCloseTo(120, 5);
    expect(caja.alto).toBeCloseTo(12, 5);
    expect(caja.arriba).toBeCloseTo((34 - 12) / 2, 5);
  });

  it('un logo alto se ajusta al alto', () => {
    const caja = contenerLogo({ ancho: 100, alto: 300 }, CAJA)!;

    expect(caja.alto).toBeCloseTo(34, 5);
    expect(caja.ancho).toBeCloseTo(34 / 3, 5);
  });

  it('agranda un logo diminuto hasta llenar la caja: la ranura tiene tamaño fijo', () => {
    const caja = contenerLogo({ ancho: 4, alto: 4 }, CAJA)!;

    expect(caja.alto).toBeCloseTo(34, 5);
  });

  it.each([
    [0, 10],
    [10, 0],
    [-5, 10],
    [Number.NaN, 10],
  ])('proporciones imposibles (%s×%s) devuelven null', (ancho, alto) => {
    expect(contenerLogo({ ancho, alto }, CAJA)).toBeNull();
  });
});

describe('el logo de la sesión', () => {
  afterEach(() => establecerLogoDeDocumentos(null));

  it('empieza vacío y se puede fijar y limpiar', () => {
    expect(logoDeDocumentos()).toBeNull();

    const logo = { dataUrl: 'data:image/png;base64,AAAA', formato: 'PNG' as const, ancho: 2, alto: 1 };
    establecerLogoDeDocumentos(logo);
    expect(logoDeDocumentos()).toBe(logo);

    establecerLogoDeDocumentos(null);
    expect(logoDeDocumentos()).toBeNull();
  });
});

describe('prepararLogo', () => {
  afterEach(() => vi.useRealTimers());

  it('con una imagen que nunca responde devuelve null pasado el tope, sin rechazar', async () => {
    vi.useFakeTimers();

    const listo = prepararLogo('data:image/png;base64,esto-no-es-una-imagen');
    await vi.advanceTimersByTimeAsync(3500);

    await expect(listo).resolves.toBeNull();
  });
});
