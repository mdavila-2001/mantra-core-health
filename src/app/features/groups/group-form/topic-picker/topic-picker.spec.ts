import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import type { Topic } from '../../../../core/data-access/community/community.types';
import { GENERAL_TOPIC, GroupTopicPicker, NEW_TOPIC, topicFilterGroups, topicGroups } from './topic-picker';

const TEMAS: Topic[] = [
  { id: 'c1', code: 'CAT_CIRUGIA', name: 'Cirugía' },
  { id: 't1', code: 'NEUROCIRUGIA', name: 'Neurocirugía', parentTopicId: 'c1' },
  { id: 'own', code: 'CAT_TEMAS_PROPIOS', name: 'Temas propios' },
  { id: 't2', code: 'PROPIO_VIAJERO', name: 'Medicina del viajero', parentTopicId: 'own' },
];

describe('GroupTopicPicker · temas categorizados y tema propio', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('agrupa por categoría, con General primero y «Crear un tema propio» al final', () => {
    const groups = topicGroups(TEMAS);
    expect(groups.map((g) => g.label)).toEqual(['General', 'Cirugía', 'Temas propios']);
    expect(groups[0].items[0].value).toBe(GENERAL_TOPIC);
    expect(groups[1].items.map((i) => i.label)).toEqual(['Neurocirugía']);
    expect(groups[2].items.map((i) => i.value)).toEqual(['t2', NEW_TOPIC]);
  });

  it('un tema suelto, sin categoría, cae en «Otros temas»', () => {
    const groups = topicGroups([...TEMAS, { id: 'x', code: 'DIABETES', name: 'Diabetes' }]);
    expect(groups.find((g) => g.label === 'Otros temas')?.items.map((i) => i.value)).toEqual(['x']);
  });

  it('el filtro no ofrece crear y empieza por «Todos los temas»', () => {
    const groups = topicFilterGroups(TEMAS);
    expect(groups[0].items[0].label).toBe('Todos los temas');
    expect(groups.flatMap((g) => g.items).some((i) => i.value === NEW_TOPIC)).toBe(false);
  });

  it('crear un tema propio lo pide a la API y queda elegido', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(GroupTopicPicker);
    fixture.componentRef.setInput('temas', TEMAS);
    fixture.detectChanges();
    const picker = fixture.componentInstance as unknown as {
      choose(v: string): void;
      newName: { set(v: string): void };
      create(): void;
    };
    picker.choose(NEW_TOPIC);
    picker.newName.set('Medicina hiperbárica');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nombre del tema propio');
    picker.create();
    const req = http.expectOne((r) => r.url.endsWith('/community/topics') && r.method === 'POST');
    expect(req.request.body).toEqual({ name: 'Medicina hiperbárica' });
    req.flush({ id: 'nuevo', code: 'PROPIO_MEDICINA_HIPERBARICA', name: 'Medicina hiperbárica', parentTopicId: 'own' });
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('nuevo');
    expect(fixture.nativeElement.textContent).not.toContain('Nombre del tema propio');
    http.verify();
  });
});
