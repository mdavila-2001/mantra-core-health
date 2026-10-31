import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { IndiceDeTabla, RelacionDeTabla } from '../../../../core/data-access/admin-portal/portal.types';
import { TableRelations } from './table-relations';

/**
 * Relaciones e índices de una tabla del catálogo: a qué apunta (con enlace a
 * la tabla destino), quién la apunta y sus índices con el «para qué». Cada
 * lista vacía lo dice en palabras en vez de quedar en blanco.
 */

const SALIENTE: RelacionDeTabla = {
  constraint: 'fk_encounter_patient',
  resolucion: 'DECLARED_FK',
  fuente: 'SQL/05_clinical.sql:42',
  columnas: ['patient_id'],
  hacia: { schema: 'profiles', tabla: 'patient', columnas: ['id'] },
};

const ENTRANTE: RelacionDeTabla = {
  constraint: 'fk_note_encounter',
  resolucion: 'DECLARED_FK',
  fuente: 'SQL/05_clinical.sql:88',
  columnas: ['id'],
  desde: { schema: 'clinical', tabla: 'note', columnas: ['encounter_id'] },
};

const INDICE: IndiceDeTabla = {
  nombre: 'ux_encounter_code',
  unico: true,
  columnas: [{ columna: 'tenant_id' }, { columna: 'code' }],
  predicado: 'deleted_at IS NULL',
  metodo: null,
  origen: 'SQL',
  paraQue: [{ tipo: 'UNICIDAD', texto: 'Un código por tenant.' }],
};

describe('TableRelations', () => {
  let fixture: ComponentFixture<TableRelations>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(outgoing: readonly RelacionDeTabla[], incoming: readonly RelacionDeTabla[], indexes: readonly IndiceDeTabla[]): void {
    fixture = TestBed.createComponent(TableRelations);
    fixture.componentRef.setInput('outgoing', outgoing);
    fixture.componentRef.setInput('incoming', incoming);
    fixture.componentRef.setInput('indexes', indexes);
    fixture.componentRef.setInput('tableUrl', (s: string, t: string) => `/admin/portal/tablas/${s}/${t}`);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('lo que apunta: columnas, tabla destino enlazada, resolución y fuente', () => {
    pintar([SALIENTE], [], []);
    const item = root().querySelectorAll('.relations__list')[0]!.querySelector('.relations__item')!;

    expect(item.querySelector('a')?.getAttribute('href')).toBe('/admin/portal/tablas/profiles/patient');
    expect(item.textContent).toContain('(patient_id)');
    expect(item.textContent).toContain('Clave foránea declarada');
    expect(item.querySelector('.relations__source')?.textContent).toBe('fk_encounter_patient · SQL/05_clinical.sql:42');
  });

  it('quién la apunta: tabla origen enlazada', () => {
    pintar([], [ENTRANTE], []);
    const enlace = root().querySelectorAll('.relations__list')[1]!.querySelector('a')!;
    expect(enlace.getAttribute('href')).toBe('/admin/portal/tablas/clinical/note');
    expect(enlace.textContent?.trim()).toBe('clinical.note');
  });

  it('índices: único, columnas, predicado parcial y para qué', () => {
    pintar([], [], [INDICE]);
    const item = root().querySelectorAll('.relations__list')[2]!.querySelector('.relations__item')!;
    expect(item.textContent).toContain('Único');
    expect(item.textContent).toContain('sobre tenant_id, code');
    expect(item.textContent).toContain('Sólo donde deleted_at IS NULL');
    expect(item.querySelector('.relations__why')?.textContent).toBe('Un código por tenant.');
  });

  it('un índice sin «para qué» lo dice', () => {
    pintar([], [], [{ ...INDICE, unico: false, predicado: null, paraQue: [] }]);
    expect(root().textContent).toContain('Nadie anotó para qué sirve.');
    expect(root().textContent).not.toContain('Único');
  });

  it('las tres listas vacías se explican', () => {
    pintar([], [], []);
    expect(Array.from(root().querySelectorAll('.relations__muted')).map((li) => li.textContent?.trim())).toEqual([
      'No apunta a ninguna otra tabla.',
      'Ninguna tabla la apunta.',
      'No tiene índices.',
    ]);
  });
});
