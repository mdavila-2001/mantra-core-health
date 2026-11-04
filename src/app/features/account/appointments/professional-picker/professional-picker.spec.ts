import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  BookableResourcesClient,
  type BookableResource,
} from '../../../../core/data-access/scheduling/bookable-resources.client';
import { PROFESSIONAL_PAGE_SIZE, ProfessionalPicker } from './professional-picker';

const persona = (n: number, tenantId = 't-1', organizationName = 'AloVida'): BookableResource => ({
  tenantId,
  organizationName,
  resourceId: `r-${n}`,
  resourceRefType: 'health_practitioner_profiles',
  resourceRefId: `p-${n}`,
  name: `Dra. ${n}`,
});

interface Interno {
  options(): readonly { value: string; label: string }[];
  buscar(q: string): void;
  verMas(): void;
  elegir(opcion: { value: string; label: string } | null): void;
}

function montar(responder: (q: { q: string; offset: number; resourceType: string }) => unknown) {
  const list = vi.fn((q) => responder(q));
  TestBed.configureTestingModule({
    imports: [ProfessionalPicker],
    providers: [{ provide: BookableResourcesClient, useValue: { list } }],
  });
  const fixture: ComponentFixture<ProfessionalPicker> = TestBed.createComponent(ProfessionalPicker);
  fixture.componentRef.setInput('resourceType', 'PRACTITIONER');
  fixture.detectChanges();
  const comp = fixture.componentInstance as unknown as Interno;
  const picked: (BookableResource | null)[] = [];
  fixture.componentInstance.picked.subscribe((p) => picked.push(p));
  return { fixture, comp, list, picked };
}

const texto = (f: ComponentFixture<unknown>): string => (f.nativeElement as HTMLElement).textContent ?? '';

describe('ProfessionalPicker · doctors from every organization, paged', () => {
  it('asks for the first page and labels each person with their organization', () => {
    const { comp, list } = montar(() => of({ items: [persona(1), persona(2, 't-2', 'Clínica X')], total: 2 }));

    expect(list).toHaveBeenCalledWith({ resourceType: 'PRACTITIONER', q: '', limit: PROFESSIONAL_PAGE_SIZE, offset: 0 });
    expect(comp.options().map((o) => o.label)).toEqual(['Dra. 1 · AloVida', 'Dra. 2 · Clínica X']);
  });

  it('«Ver más» appends the next page from where the list ends', () => {
    const { fixture, comp, list } = montar(({ offset }) =>
      of({ items: offset === 0 ? [persona(1), persona(2)] : [persona(3)], total: 3 }),
    );
    expect(texto(fixture)).toContain('Ver más (2 de 3)');

    comp.verMas();
    fixture.detectChanges();

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 2 }));
    expect(comp.options()).toHaveLength(3);
    expect(texto(fixture)).not.toContain('Ver más');
  });

  it('searching asks the server again from the first page and replaces the list', () => {
    const { comp, list } = montar(({ q }) => of({ items: q === 'ana' ? [persona(9)] : [persona(1), persona(2)], total: 2 }));

    comp.buscar('ana');

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'ana', offset: 0 }));
    expect(comp.options().map((o) => o.label)).toEqual(['Dra. 9 · AloVida']);
  });

  it('choosing emits the entry with its organization; clearing emits null', () => {
    const { comp, picked } = montar(() => of({ items: [persona(1, 't-7', 'Clínica X')], total: 1 }));

    comp.elegir(comp.options()[0]);
    comp.elegir(null);

    expect(picked[0]).toEqual(expect.objectContaining({ tenantId: 't-7', resourceId: 'r-1' }));
    expect(picked[1]).toBeNull();
  });

  it('nobody with hours anywhere says so instead of an empty search box', () => {
    const { fixture } = montar(() => of({ items: [], total: 0 }));

    expect(texto(fixture)).toContain('Todavía no hay profesionales con horarios');
  });

  it('laboratories are their own list, and their empty state keeps the counter way out', () => {
    const { fixture, list } = montar(() => of({ items: [], total: 0 }));

    fixture.componentRef.setInput('resourceType', 'ROOM');
    fixture.detectChanges();

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ resourceType: 'ROOM', offset: 0 }));
    expect(texto(fixture)).toContain('Todavía no hay laboratorios con horarios');
    expect(texto(fixture)).toContain('mostrador');
  });

  it('a failed read is not «nobody has hours»: it says it could not load and offers a retry', () => {
    const { fixture } = montar(() => throwError(() => new Error('500')));

    expect(texto(fixture)).toContain('No pudimos cargar la lista');
    expect(texto(fixture)).not.toContain('Todavía no hay profesionales');
  });
});
