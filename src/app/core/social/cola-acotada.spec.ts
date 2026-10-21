import { Subject, throwError, EMPTY } from 'rxjs';

import { ColaAcotada } from './cola-acotada';

describe('ColaAcotada', () => {
  it('arranca a lo sumo N trabajos a la vez', () => {
    const cola = new ColaAcotada(2);
    const arrancados: number[] = [];
    const trabajos = Array.from({ length: 4 }, () => new Subject<void>());

    trabajos.forEach((t, n) =>
      cola.encolar(() => {
        arrancados.push(n);
        return t;
      }),
    );

    expect(arrancados).toEqual([0, 1]);
  });

  it('al terminar uno arranca el siguiente', () => {
    const cola = new ColaAcotada(1);
    const arrancados: number[] = [];
    const a = new Subject<void>();

    cola.encolar(() => {
      arrancados.push(0);
      return a;
    });
    cola.encolar(() => {
      arrancados.push(1);
      return EMPTY;
    });
    expect(arrancados).toEqual([0]);

    a.complete();

    expect(arrancados).toEqual([0, 1]);
  });

  it('un trabajo que falla libera su plaza y no frena a los demás', () => {
    const cola = new ColaAcotada(1);
    const arrancados: number[] = [];

    cola.encolar(() => {
      arrancados.push(0);
      return throwError(() => new Error('falla'));
    });
    cola.encolar(() => {
      arrancados.push(1);
      return EMPTY;
    });

    expect(arrancados).toEqual([0, 1]);
  });

  it('vaciar descarta lo que no arrancó', () => {
    const cola = new ColaAcotada(1);
    const arrancados: number[] = [];
    const a = new Subject<void>();

    cola.encolar(() => {
      arrancados.push(0);
      return a;
    });
    cola.encolar(() => {
      arrancados.push(1);
      return EMPTY;
    });
    cola.vaciar();
    a.complete();

    expect(arrancados).toEqual([0]);
  });
});
