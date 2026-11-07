import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { ConceptSelect } from './concept-select';

const opcion = (code: string) => ({
  conceptId: `id-${code}`,
  code,
  display: code,
  ordinal: 0,
  isDefault: false,
});

describe('ConceptSelect: filtro por código', () => {
  function montar(accept: ((code: string) => boolean) | null) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SystemContextClient,
          useValue: {
            dynamicEnum: () => of({ options: [opcion('BLDV'), opcion('UR'), opcion('STL')] }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ConceptSelect);
    fixture.componentRef.setInput('target', 'clinical.service_requests.specimen_type_concept_id');
    fixture.componentRef.setInput('accept', accept);
    fixture.componentRef.setInput('clearable', false);
    fixture.detectChanges();
    return (fixture.componentInstance as unknown as { opciones: () => { label: string }[] })
      .opciones()
      .map((o) => o.label);
  }

  it('correcto: ofrece sólo las opciones cuyo código admite el filtro', () => {
    expect(montar((code) => code === 'BLDV' || code === 'STL')).toEqual(['BLDV', 'STL']);
  });

  it('límite: sin filtro ofrece todas', () => {
    expect(montar(null)).toEqual(['BLDV', 'UR', 'STL']);
  });

  it('inválido: un filtro que no admite nada deja la lista vacía, sin romper', () => {
    expect(montar(() => false)).toEqual([]);
  });
});
