import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { ColumnaDeTabla } from '../../../../core/data-access/admin-portal/portal.types';
import { TableColumns, toColumnRow } from './table-columns';

/**
 * Las columnas de una tabla del catálogo: tipo, si admite vacío, claves (PK,
 * FK, única) con la referencia de la FK, descripción y si coincide con la
 * entidad del ORM. Una columna sin descripción lo dice.
 */

function columna(partial: Partial<ColumnaDeTabla>): ColumnaDeTabla {
  return {
    nombre: 'id',
    ordinal: 1,
    tipo: 'uuid',
    nulable: false,
    defecto: null,
    pk: true,
    fk: [],
    uk: [],
    restricciones: '',
    rol: [],
    descripcion: { texto: 'Identificador' },
    clasificacion: {} as ColumnaDeTabla['clasificacion'],
    orm: { estado: 'COINCIDE' },
    ...partial,
  } as ColumnaDeTabla;
}

const COLUMNAS: readonly ColumnaDeTabla[] = [
  columna({}),
  columna({
    nombre: 'patient_id',
    ordinal: 2,
    pk: false,
    nulable: true,
    fk: [{ hacia: { schema: 'profiles', tabla: 'patient', columna: 'id' } }],
    uk: [{}],
    descripcion: null,
    orm: { estado: 'NULABILIDAD_DIVERGE' },
  } as Partial<ColumnaDeTabla>),
];

describe('TableColumns', () => {
  describe('toColumnRow', () => {
    it('traduce claves, nulabilidad, referencia y descripción', () => {
      expect(toColumnRow(COLUMNAS[0]!)).toEqual(
        expect.objectContaining({ keys: ['PK'], nullable: 'Obligatoria', references: null, description: 'Identificador' }),
      );
      expect(toColumnRow(COLUMNAS[1]!)).toEqual(
        expect.objectContaining({ keys: ['FK', 'Única'], nullable: 'Admite vacío', references: 'profiles.patient.id', description: 'Sin descripción' }),
      );
    });

    it('una FK sin destino reconocible no inventa referencia', () => {
      expect(toColumnRow(columna({ fk: [{ algo: 1 }] })).references).toBeNull();
    });
  });

  describe('componente', () => {
    let fixture: ComponentFixture<TableColumns>;
    const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(TableColumns);
      fixture.componentRef.setInput('columns', COLUMNAS);
      fixture.detectChanges();
    });

    it('una fila por columna, con sus claves como insignias y la referencia de la FK', () => {
      const tabla = root().querySelector('[data-testid="portal-table-columns"]')!;
      expect(tabla.querySelector('caption')?.textContent).toContain('Columnas de la tabla');
      expect(tabla.textContent).toContain('patient_id');
      expect(tabla.textContent).toContain('→ profiles.patient.id');
      expect(tabla.textContent).toContain('Sin descripción');
    });

    it('el estado del ORM se rotula en palabras', () => {
      const texto = root().textContent!;
      expect(texto).toContain('Coincide');
      expect(texto).toContain('Nulabilidad distinta');
    });
  });
});
