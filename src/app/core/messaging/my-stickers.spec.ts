import { TestBed } from '@angular/core/testing';

import { MyStickers, STICKER_BYTES_LIMIT } from './my-stickers';
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
      expect(MyStickers.rejection(archivo(tipo))).toBeNull();
    }
  });

  it('rechaza lo que no es imagen y lo que pesa más de 1 MB', () => {
    expect(MyStickers.rejection(archivo('application/pdf'))).toContain('PNG');
    expect(MyStickers.rejection(archivo('image/gif', STICKER_BYTES_LIMIT + 1))).toContain('1 MB');
  });

  it('guarda el sticker, lo deja en la lista y lo puede volver a armar como archivo', async () => {
    const servicio = TestBed.inject(MyStickers);
    const guardado = await servicio.save(archivo('image/gif', 20, 'hola.gif'));

    expect(guardado).toBe(true);
    expect(servicio.list().length).toBe(1);
    const otra = MyStickers.fileOf(servicio.list()[0]);
    expect(otra?.type).toBe('image/gif');
    expect(otra?.size).toBe(20);
  });

  it('el mismo archivo dos veces no ocupa dos lugares', async () => {
    const servicio = TestBed.inject(MyStickers);
    await servicio.save(archivo('image/png', 20));
    await servicio.save(archivo('image/png', 20));

    expect(servicio.list().length).toBe(1);
  });

  it('uno demasiado pesado para guardar igual se puede mandar, pero no queda en «Míos»', async () => {
    const servicio = TestBed.inject(MyStickers);

    expect(await servicio.save(archivo('image/gif', 500 * 1024))).toBe(false);
    expect(servicio.list().length).toBe(0);
  });

  it('sobrevive a recargar y descarta basura del almacenamiento', () => {
    localStorage.setItem(
      'alovida.chat-mis-stickers',
      JSON.stringify([
        { id: 'a', nombre: 'a', tipo: 'image/png', url: 'data:image/png;base64,AAAA' },
        { id: 'b', nombre: 'b', tipo: 'image/png', url: 'javascript:alert(1)' },
      ]),
    );
    expect(TestBed.inject(MyStickers).list().map((s) => s.id)).toEqual(['a']);
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
