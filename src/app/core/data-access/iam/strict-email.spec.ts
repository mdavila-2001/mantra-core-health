import { CORREO_CON_DOMINIO, CORREO_ESTRICTO, esCorreoComoLaApi } from './strict-email';

describe('CORREO_CON_DOMINIO', () => {
  it.each(['ana@gmail.com', 'dir@clinica.bo', 'a.b+c@sub.dominio.com.bo', 'x@y.co'])(
    '«%s» pasa',
    (correo) => {
      expect(CORREO_CON_DOMINIO.test(correo)).toBe(true);
    },
  );

  it.each([
    'ana@gmail',
    'dir@clinica',
    'a@b',
    'dir@clinica.',
    '@clinica.bo',
    'sin-arroba',
    'a b@x.com',
    'a@x.c',
  ])('«%s» no pasa (la API lo rechaza con 400)', (correo) => {
    expect(CORREO_CON_DOMINIO.test(correo)).toBe(false);
  });
});

describe('esCorreoComoLaApi (sólo el simulador)', () => {
  it.each(['a@b.12', 'a@b.c0m', 'dir@clinica.123', 'ana@gmail', 'a@b'])(
    '«%s» no pasa',
    (correo) => {
      expect(esCorreoComoLaApi(correo)).toBe(false);
    },
  );

  it.each(['dir@clinica.bo', 'a.b+c@sub.dominio.com.bo', 'x@y.co', 'x@y.xn--p1ai'])(
    '«%s» pasa',
    (correo) => {
      expect(esCorreoComoLaApi(correo)).toBe(true);
    },
  );

  it('el patrón de los formularios no cambió: a@b.12 sigue pasándolo (lo frena la API)', () => {
    expect(CORREO_CON_DOMINIO.test('a@b.12')).toBe(true);
  });
});

describe('CORREO_ESTRICTO', () => {
  it.each(['ana@gmail.com', 'a.b_c@sub.dominio.com.bo', 'juan_perez-1@mi-clinica.bo', 'x@y.co'])(
    '«%s» passes',
    (correo) => expect(CORREO_ESTRICTO.test(correo)).toBe(true),
  );

  it.each([
    '---++++-++--+++++',
    '-ana@gmail.com',
    'ana-@gmail.com',
    'ana.-paz@gmail.com',
    'ana+promo@gmail.com',
    'qqoewqw*[]@gmail.com',
    'ana perez@gmail.com',
    'ana@gmail .com',
    'josé@gmail.com',
    '.ana@gmail.com',
    'ana.@gmail.com',
    'ana..p@gmail.com',
    'ana@-gmail.com',
    'ana@gmail-.com',
    'ana@gm--ail.com',
    'ana@gm_ail.com',
    'ana@gmail.c0m',
    'ana@gmail',
    'ana@@gmail.com',
  ])('«%s» is rejected', (correo) => expect(CORREO_ESTRICTO.test(correo)).toBe(false));
});
