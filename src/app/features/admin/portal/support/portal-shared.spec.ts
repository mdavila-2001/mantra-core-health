import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { Subject, of, throwError, type Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { empty } from '../../../../core/view-state/view-state';
import { operationQuery } from './operation-query';
import { pagedList, type PagedResult } from './paged-list';
import { hasAny, nonEmpty, queryFilters } from './route-query';

describe('route-query', () => {
  it('los filtros sólo cambian cuando cambia alguno de los suyos', () => {
    const params = signal(convertToParamMap({ q: 'a', vista: 'x' }));
    const filters = queryFilters(params, ['q', 'riesgo'] as const);
    const antes = filters();
    expect(antes).toEqual({ q: 'a', riesgo: '' });
    params.set(convertToParamMap({ q: 'a', vista: 'y' }));
    expect(filters()).toBe(antes);
    params.set(convertToParamMap({ q: 'b' }));
    expect(filters()).toEqual({ q: 'b', riesgo: '' });
  });

  it('nonEmpty y hasAny ignoran los vacíos', () => {
    expect(nonEmpty({ q: '', modulo: 'iam' })).toEqual({ modulo: 'iam' });
    expect(hasAny({ q: '', modulo: '' })).toBe(false);
  });
});

describe('operationQuery', () => {
  const vacios = { q: '', modulo: '', flujo: '', riesgo: '', metodo: '', origen: '', senal: '' };

  it('pasa los códigos que la API acepta y descarta los demás', () => {
    expect(
      operationQuery({ ...vacios, riesgo: 'MEDIO', metodo: 'GET', origen: 'CONTRATO_AUSENTE' }, { limit: 25 }),
    ).toEqual({ riesgo: 'MEDIO', metodo: 'GET', origen: 'CONTRATO_AUSENTE', limit: 25 });
    expect(operationQuery({ ...vacios, riesgo: 'alto', metodo: 'HEAD' }, { cursor: 'c', limit: 25 })).toEqual({
      cursor: 'c',
      limit: 25,
    });
  });
});

describe('pagedList', () => {
  const vacio = () => empty({ label: 'Volver', route: '/' }, 'Nada');

  function crear(fetch: (cursor: string | undefined) => Observable<PagedResult<string>>) {
    return TestBed.runInInjectionContext(() => pagedList<string>(fetch, vacio));
  }

  it('pasa por cargando y llega a los datos, con el total y el cursor siguiente', () => {
    const lista = crear(() => of({ items: ['a'], nextCursor: 'n1', total: 3 }));
    lista.restart();
    expect(lista.state()).toEqual({ status: 'ready', data: ['a'] });
    expect(lista.total()).toBe(3);
    expect(lista.cursor().nextCursor).toBe('n1');
  });

  it('una página vacía es S3 con su próxima acción', () => {
    const lista = crear(() => of({ items: [], nextCursor: null }));
    lista.restart();
    expect(lista.state().status).toBe('empty');
  });

  it('avanza con el cursor y «anterior» vuelve sin él', () => {
    const pedidos: (string | undefined)[] = [];
    const lista = crear((cursor) => {
      pedidos.push(cursor);
      return of({ items: ['x'], nextCursor: 'n1' });
    });
    lista.restart();
    lista.move('n1');
    lista.move(lista.cursor().prevCursor!);
    expect(pedidos).toEqual([undefined, 'n1', undefined]);
  });

  it('una consulta nueva cancela la anterior: la respuesta vieja no pisa a la nueva', () => {
    const vieja = new Subject<PagedResult<string>>();
    let llamada = 0;
    const lista = crear(() => (llamada++ === 0 ? vieja : of({ items: ['nueva'], nextCursor: null })));
    lista.restart();
    lista.restart();
    vieja.next({ items: ['vieja'], nextCursor: null });
    expect(lista.state()).toEqual({ status: 'ready', data: ['nueva'] });
  });

  it('un fallo de la API se traduce a su estado M34', () => {
    const lista = crear(() => throwError(() => new HttpErrorResponse({ status: 0 })));
    lista.restart();
    expect(lista.state().status).toBe('offline');
  });
});
