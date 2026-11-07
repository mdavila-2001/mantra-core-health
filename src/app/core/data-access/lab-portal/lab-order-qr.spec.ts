import { orderIdFromQrCode, orderQrCode } from './lab-order-qr';

const ID = '3f2a9c1e-5b7d-4e8a-9c0f-1a2b3c4d5e6f';

describe('código QR de una orden', () => {
  it('lo que se escribe se lee de vuelta', () => {
    expect(orderIdFromQrCode(orderQrCode(ID))).toBe(ID);
  });

  it('tolera los espacios y saltos de línea de un pegado, y mayúsculas del id', () => {
    expect(orderIdFromQrCode(`  \n${orderQrCode(ID.toUpperCase())}\n `)).toBe(ID);
  });

  it.each([
    ['vacío', ''],
    ['otro prefijo', `OTRA-COSA:v1:${ID}`],
    ['otra versión', `ALOVIDA-ORDEN:v2:${ID}`],
    ['id que no es uuid', 'ALOVIDA-ORDEN:v1:123'],
    ['id con basura detrás', `ALOVIDA-ORDEN:v1:${ID}xyz`],
    ['una URL cualquiera', 'https://ejemplo.com/orden'],
  ])('rechaza %s', (_nombre, texto) => {
    expect(orderIdFromQrCode(texto)).toBeNull();
  });
});
