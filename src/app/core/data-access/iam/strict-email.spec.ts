import { CORREO_CON_DOMINIO } from './strict-email';

describe('CORREO_CON_DOMINIO', () => {
  it.each(['ana@gmail.com', 'dir@clinica.bo', 'a.b+c@sub.dominio.com.bo', 'x@y.co'])('«%s» pasa', (correo) => {
    expect(CORREO_CON_DOMINIO.test(correo)).toBe(true);
  });

  it.each(['ana@gmail', 'dir@clinica', 'a@b', 'dir@clinica.', '@clinica.bo', 'sin-arroba', 'a b@x.com', 'a@x.c'])(
    '«%s» no pasa (la API lo rechaza con 400)',
    (correo) => {
      expect(CORREO_CON_DOMINIO.test(correo)).toBe(false);
    },
  );
});
