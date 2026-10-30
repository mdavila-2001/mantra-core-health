import { vistaPreviaDe, TEXTO_DE_ADJUNTO } from './preview';
import { PACK_DE_STICKERS } from '../../../core/messaging/sticker-pack.generated';
import { textoDeContexto } from '../../../core/messaging/chat-context';

/**
 * Lo que estas pruebas fijan de la segunda línea de una fila de la bandeja.
 *
 * Que cada tipo de último mensaje se anuncia **por lo que es** —tarjeta del
 * pedido, sticker, archivo, texto— y que nunca se afirma lo que el contrato no
 * dice: la bandeja no trae el tipo MIME del adjunto, así que un archivo no se
 * convierte en «Foto» por adivinanza.
 */
describe('vistaPreviaDe', () => {
  const base = { id: 'm-1', senderProfileId: 'pp-2' } as const;

  it('sin último mensaje no dice nada', () => {
    expect(vistaPreviaDe(undefined)).toEqual({ tipo: 'nada', texto: '' });
  });

  it('un texto se muestra en una sola línea', () => {
    expect(vistaPreviaDe({ ...base, bodyText: 'Hola,\n¿tienen\n  ibuprofeno?' })).toEqual({
      tipo: 'texto',
      texto: 'Hola, ¿tienen ibuprofeno?',
    });
  });

  it('una tarjeta de pedido se resume como «Pedido · Farmacia»', () => {
    const cuerpo = textoDeContexto({
      tipo: 'pedido',
      titulo: 'Farmacia Chávez · Sucursal Miraflores',
      detalle: '2 productos · Bs 69,00',
      ruta: '/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6',
    });

    const vista = vistaPreviaDe({ ...base, bodyText: cuerpo });

    expect(vista).toEqual({
      tipo: 'contexto',
      contexto: 'pedido',
      texto: 'Pedido · Farmacia Chávez · Sucursal Miraflores',
    });
    // La ruta interna nunca aparece en la fila.
    expect(vista.texto).not.toContain('/my-account');
  });

  it('cada tipo de tarjeta conserva su tipo, que decide el ícono', () => {
    const rutas = {
      producto: '/pharmacies-directory/farmacia-vida',
      servicio: '/clinics-directory/clinica-sur',
      farmacia: '/pharmacies-directory/farmacia-vida',
    } as const;
    for (const tipo of ['producto', 'servicio', 'farmacia'] as const) {
      const cuerpo = textoDeContexto({ tipo, titulo: 'Algo', ruta: rutas[tipo] });
      expect(vistaPreviaDe({ ...base, bodyText: cuerpo })).toMatchObject({
        tipo: 'contexto',
        contexto: tipo,
      });
    }
  });

  it('un texto que se parece a una tarjeta pero no calza queda como texto', () => {
    const vista = vistaPreviaDe({ ...base, bodyText: 'Pedido: mañana\nhttps://otro.sitio' });
    expect(vista.tipo).toBe('texto');
  });

  it('un sticker del pack se anuncia como sticker, no como archivo', () => {
    expect(
      vistaPreviaDe({ ...base, attachmentFileId: PACK_DE_STICKERS[0].id }),
    ).toEqual({ tipo: 'sticker', texto: 'Sticker' });
  });

  it('un adjunto sin texto es «Archivo adjunto», nunca «Foto» sin saberlo', () => {
    const vista = vistaPreviaDe({ ...base, attachmentFileId: 'file-cualquiera' });
    expect(vista).toEqual({ tipo: 'adjunto', texto: TEXTO_DE_ADJUNTO });
    expect(vista.texto).not.toMatch(/foto|imagen|audio/iu);
  });

  it('un adjunto con leyenda muestra la leyenda con el clip', () => {
    expect(
      vistaPreviaDe({ ...base, attachmentFileId: 'file-1', bodyText: 'La receta' }),
    ).toEqual({ tipo: 'adjunto', texto: 'La receta' });
  });

  it('un mensaje sin cuerpo ni adjunto conocido sigue siendo un archivo', () => {
    // Es lo que manda la bandeja de un adjunto antes de F4.3: sin cuerpo no
    // puede ser otra cosa.
    expect(vistaPreviaDe({ ...base, bodyText: '   ' })).toEqual({
      tipo: 'adjunto',
      texto: TEXTO_DE_ADJUNTO,
    });
  });
});
