import { TestBed } from '@angular/core/testing';

import { MisStickers, TOPE_DE_STICKER_BYTES } from './my-stickers';
import { reaccionesConMia } from './chat.store';

const archivo = (tipo: string, bytes = 10, nombre = 'a.png'): File =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });

describe('MisStickers', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('acepta PNG, WEBP, GIF y JPG livianos', () => {
    for (const tipo of ['image/png', 'image/webp', 'image/gif', 'image/jpeg']) {
      expect(MisStickers.rechazo(archivo(tipo))).toBeNull();
    }
  });

  it('rechaza lo que no es imagen y lo que pesa más de 1 MB', () => {
    expect(MisStickers.rechazo(archivo('application/pdf'))).toContain('PNG');
    expect(MisStickers.rechazo(archivo('image/gif', TOPE_DE_STICKER_BYTES + 1))).toContain('1 MB');
  });

  it('guarda el sticker, lo deja en la lista y lo puede volver a armar como archivo', async () => {
    const servicio = TestBed.inject(MisStickers);
    const guardado = await servicio.guardar(archivo('image/gif', 20, 'hola.gif'));

    expect(guardado).toBe(true);
    expect(servicio.lista().length).toBe(1);
    const otra = MisStickers.archivoDe(servicio.lista()[0]);
    expect(otra?.type).toBe('image/gif');
    expect(otra?.size).toBe(20);
  });

  it('el mismo archivo dos veces no ocupa dos lugares', async () => {
    const servicio = TestBed.inject(MisStickers);
    await servicio.guardar(archivo('image/png', 20));
    await servicio.guardar(archivo('image/png', 20));

    expect(servicio.lista().length).toBe(1);
  });

  it('uno demasiado pesado para guardar igual se puede mandar, pero no queda en «Míos»', async () => {
    const servicio = TestBed.inject(MisStickers);

    expect(await servicio.guardar(archivo('image/gif', 500 * 1024))).toBe(false);
    expect(servicio.lista().length).toBe(0);
  });

  it('sobrevive a recargar y descarta basura del almacenamiento', () => {
    localStorage.setItem(
      'alovida.chat-mis-stickers',
      JSON.stringify([
        { id: 'a', nombre: 'a', tipo: 'image/png', url: 'data:image/png;base64,AAAA' },
        { id: 'b', nombre: 'b', tipo: 'image/png', url: 'javascript:alert(1)' },
      ]),
    );
    expect(TestBed.inject(MisStickers).lista().map((s) => s.id)).toEqual(['a']);
  });
});

describe('reaccionesConMia', () => {
  it('suma la reacción propia a un emoji nuevo', () => {
    expect(reaccionesConMia(undefined, 'yo', '👍')).toEqual([{ emoji: '👍', profileIds: ['yo'] }]);
  });

  it('elegir otro emoji reemplaza el anterior: una reacción por persona', () => {
    const antes = [{ emoji: '👍', profileIds: ['yo', 'otro'] }];
    expect(reaccionesConMia(antes, 'yo', '❤️')).toEqual([
      { emoji: '👍', profileIds: ['otro'] },
      { emoji: '❤️', profileIds: ['yo'] },
    ]);
  });

  it('null quita la propia y un emoji sin nadie desaparece', () => {
    expect(reaccionesConMia([{ emoji: '👍', profileIds: ['yo'] }], 'yo', null)).toEqual([]);
  });
});
