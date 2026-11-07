import { EQUIPMENT_CATALOG, inputFromCatalog, searchCatalog } from './equipment-catalog';
import { modalidad, type ModalityCode } from './modalidades';

const name = (code: ModalityCode | null): string => (code === null ? 'Analizador' : modalidad(code).label);

describe('equipment catalog', () => {
  it('tiene ids únicos', () => {
    expect(new Set(EQUIPMENT_CATALOG.map((i) => i.id)).size).toBe(EQUIPMENT_CATALOG.length);
  });

  it('filtra por modalidad y deja los analizadores aparte', () => {
    expect(searchCatalog(EQUIPMENT_CATALOG, 'MG', '', name).every((i) => i.modalityCode === 'MG')).toBe(true);
    expect(searchCatalog(EQUIPMENT_CATALOG, 'ANALYZER', '', name).every((i) => i.modalityCode === null)).toBe(true);
    expect(searchCatalog(EQUIPMENT_CATALOG, 'ALL', '', name)).toHaveLength(EQUIPMENT_CATALOG.length);
  });

  it('busca sin tildes ni mayúsculas, con todas las palabras', () => {
    const found = searchCatalog(EQUIPMENT_CATALOG, 'ALL', 'mamografia hologic', name);
    expect(found.map((i) => i.id)).toEqual(['hologic-selenia-dimensions', 'hologic-3dimensions']);
    expect(searchCatalog(EQUIPMENT_CATALOG, 'ALL', 'japon', name).every((i) => i.country === 'Japón')).toBe(true);
  });

  it('el equipo elegido arma la entrada del formulario', () => {
    const vida = EQUIPMENT_CATALOG.find((i) => i.id === 'siemens-magnetom-vida')!;
    expect(inputFromCatalog(vida)).toEqual({ name: 'Resonador MAGNETOM Vida', manufacturer: 'Siemens Healthineers', serialNumber: null, modalityCode: 'RM' });
    const sysmex = EQUIPMENT_CATALOG.find((i) => i.id === 'sysmex-xn-1000')!;
    expect(inputFromCatalog(sysmex).modalityCode).toBeNull();
  });
});
