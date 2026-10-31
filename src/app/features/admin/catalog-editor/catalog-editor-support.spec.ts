import { HttpErrorResponse } from '@angular/common/http';

import { errorDeIdentificador, errorDePrecio, errorDeTexto, fallosDeCatalogo, fechaCorta, rotuloDeTipoDeOrganizacion } from './catalog-editor-support';

function http(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('catalog-editor-support', () => {
  describe('errorDePrecio', () => {
    it.each(['150', '150.5', '0.01', '1000000.00'])('acepta %s', (precio) => {
      expect(errorDePrecio(precio)).toBeNull();
    });
    it.each([
      ['', 'Indique el precio.'],
      ['0', 'El precio debe ser mayor que cero.'],
      ['0.00', 'El precio debe ser mayor que cero.'],
    ])('rechaza «%s»', (precio, motivo) => {
      expect(errorDePrecio(precio)).toBe(motivo);
    });
    it.each(['10,5', '-3', '1.234', 'abc', '1e3'])('rechaza el formato de «%s»', (precio) => {
      expect(errorDePrecio(precio)).toMatch(/punto y hasta dos decimales/);
    });
  });

  it('errorDeIdentificador pide kebab-case en minúsculas y hasta 80 caracteres', () => {
    expect(errorDeIdentificador('presion-arterial')).toBeNull();
    expect(errorDeIdentificador('')).toBe('Indique el identificador.');
    expect(errorDeIdentificador('Presion Arterial')).toMatch(/minúsculas/);
    expect(errorDeIdentificador('a'.repeat(81))).toMatch(/80/);
  });

  it('errorDeTexto exige contenido y respeta el tope', () => {
    expect(errorDeTexto('  ', 'el nombre', 10)).toBe('Indique el nombre.');
    expect(errorDeTexto('x'.repeat(11), 'el nombre', 10)).toMatch(/10 caracteres/);
    expect(errorDeTexto('ok', 'el nombre', 10)).toBeNull();
  });

  it('fechaCorta no inventa: un texto no fechable se devuelve tal cual', () => {
    expect(fechaCorta('no-es-fecha')).toBe('no-es-fecha');
    expect(fechaCorta('2026-10-31T10:00:00.000Z')).toMatch(/2026|26/);
  });

  it('rotuloDeTipoDeOrganizacion traduce los tipos conocidos y deja el texto de la API para los demás', () => {
    expect(rotuloDeTipoDeOrganizacion('PR_TYPE_OFFICE', 'Medical office (consultorio) practice type')).toBe('Consultorio');
    expect(rotuloDeTipoDeOrganizacion('PR_TYPE_NUEVO', 'Tipo nuevo')).toBe('Tipo nuevo');
  });

  describe('fallosDeCatalogo', () => {
    it('409 de versión: marca el conflicto y no habla de reintentar', () => {
      const fallo = fallosDeCatalogo(http(409, { code: 'CONFLICT', message: 'x', reason: 'SERVICE_CATALOG_VERSION_MISMATCH', details: { expected: 1, actual: 2 } }), 'No se pudo.');
      expect(fallo.conflictoDeVersion).toBe(true);
      expect(fallo.general).toMatch(/Otra persona modificó/);
    });

    it('código repetido se ancla al campo `code`', () => {
      const fallo = fallosDeCatalogo(http(409, { code: 'CONFLICT', message: 'x', reason: 'SERVICE_CATALOG_CODE_ALREADY_EXISTS' }), 'No se pudo.');
      expect(fallo.conflictoDeVersion).toBe(false);
      expect(fallo.campos['code']).toMatch(/Ya existe/);
    });

    it('precio no positivo (422) se ancla a `defaultPrice`; identificador repetido a `slug`', () => {
      expect(fallosDeCatalogo(http(422, { code: 'PRECONDITION_FAILED', message: 'x', reason: 'SERVICE_CATALOG_PRICE_NOT_POSITIVE' }), 'x').campos['defaultPrice']).toBeTruthy();
      expect(fallosDeCatalogo(http(409, { code: 'CONFLICT', message: 'x', reason: 'GLOSSARY_TERM_ALREADY_EXISTS' }), 'x').campos['slug']).toBeTruthy();
    });

    it('violaciones de campo del servidor llegan al campo; `text.es` cae en `text`', () => {
      const fallo = fallosDeCatalogo(
        http(400, { code: 'VALIDATION_FAILED', message: 'x', details: { fields: [{ field: 'text.es', constraints: ['length'], messages: ['text.es must be shorter'] }, { field: 'name', constraints: ['isNotEmpty'], messages: ['name should not be empty'] }] } }),
        'No se pudo.',
      );
      expect(fallo.campos['text']).toBe('text.es must be shorter');
      expect(fallo.campos['name']).toBe('name should not be empty');
      expect(fallo.general).toBe('Revise los campos marcados.');
    });

    it('403 y 404 se explican sin mostrar el error crudo', () => {
      expect(fallosDeCatalogo(http(403, { code: 'FORBIDDEN', message: 'Forbidden resource' }), 'x').general).toMatch(/no tiene permiso/i);
      expect(fallosDeCatalogo(http(404, { code: 'NOT_FOUND', message: 'x' }), 'x').general).toMatch(/ya no existe/);
    });

    it('un fallo que no es HTTP usa el texto de la pantalla', () => {
      expect(fallosDeCatalogo(new Error('boom'), 'No se pudo guardar.').general).toBe('No se pudo guardar.');
    });
  });
});
