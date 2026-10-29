import { PROVINCIA_POR_INE, provinceFromCatalog } from './bo-provinces';

describe('provinceFromCatalog', () => {
  it('correcto: la provincia sale del código del INE', () => {
    expect(provinceFromCatalog('SC', '070101', 'Santa Cruz de la Sierra')).toBe('Andrés Ibáñez');
    expect(provinceFromCatalog('LP', '020101', 'La Paz')).toBe('Murillo');
    expect(provinceFromCatalog('CH', '010101', 'Sucre')).toBe('Oropeza');
  });

  it('borde: un código legado (la maqueta siembra SC-SCZ) se resuelve por nombre, sin tildes', () => {
    expect(provinceFromCatalog('SC', 'SC-SCZ', 'Santa Cruz de la Sierra')).toBe('Andrés Ibáñez');
    expect(provinceFromCatalog('CB', 'CB-SACABA', 'sacaba')).toBe('Chapare');
    expect(provinceFromCatalog('PA', 'PA-COB', 'Cobija')).toBe('Nicolás Suárez');
  });

  it('inválido: lo que el catálogo no conoce es null, no una provincia inventada', () => {
    expect(provinceFromCatalog('SC', 'SC-XYZ', 'Pueblo inexistente')).toBeNull();
    expect(provinceFromCatalog('SC', '999999', 'Pueblo inexistente')).toBeNull();
  });

  it('cubre las 112 provincias de Bolivia', () => {
    expect(Object.keys(PROVINCIA_POR_INE)).toHaveLength(112);
  });
});
