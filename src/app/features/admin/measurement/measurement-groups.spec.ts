import { FUNCIONALIDADES, OTROS, TODAS_LAS_FUNCIONALIDADES, funcionalidadDe } from './measurement-groups';

describe('agrupación de endpoints por funcionalidad', () => {
  it('la tabla no tiene un prefijo repetido ni dos funcionalidades con el mismo id', () => {
    const prefijos = FUNCIONALIDADES.flatMap((f) => f.prefixes);
    expect(new Set(prefijos).size).toBe(prefijos.length);
    const ids = TODAS_LAS_FUNCIONALIDADES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('los prefijos van en minúsculas y sin barras de más', () => {
    for (const p of FUNCIONALIDADES.flatMap((f) => f.prefixes)) {
      expect(p).toBe(p.toLowerCase());
      expect(p.startsWith('/')).toBe(false);
      expect(p.endsWith('/')).toBe(false);
    }
  });

  it('correcto: una plantilla cae en su funcionalidad', () => {
    expect(funcionalidadDe('/appointments').id).toBe('agenda');
    expect(funcionalidadDe('/scheduling/bookings/:id').id).toBe('agenda');
    expect(funcionalidadDe('/patients/:id').id).toBe('personas');
    expect(funcionalidadDe('/iam/auth/login').id).toBe('identidad');
    expect(funcionalidadDe('/payments/qr').id).toBe('facturacion');
    expect(funcionalidadDe('/admin/ops/readiness').id).toBe('administracion');
  });

  it('límite: gana el prefijo más largo', () => {
    expect(funcionalidadDe('/clinical/prescriptions/:id').id).toBe('farmacia');
    expect(funcionalidadDe('/clinical/observations').id).toBe('historia-clinica');
    expect(funcionalidadDe('/community/conversations/:id/messages').id).toBe('mensajeria');
    expect(funcionalidadDe('/community/topics').id).toBe('comunidad');
  });

  it('límite: el prefijo se compara por segmento entero, no por texto', () => {
    expect(funcionalidadDe('/scheduling-nuevo')).toBe(OTROS);
    expect(funcionalidadDe('/patientsx/:id')).toBe(OTROS);
    expect(funcionalidadDe('/Patients/:id').id).toBe('personas');
  });

  it('inválido: UNMATCHED, __overflow__, la raíz y lo desconocido van a «Otros», no se descartan', () => {
    expect(funcionalidadDe('UNMATCHED')).toBe(OTROS);
    expect(funcionalidadDe('__overflow__')).toBe(OTROS);
    expect(funcionalidadDe('/')).toBe(OTROS);
    expect(funcionalidadDe('')).toBe(OTROS);
    expect(funcionalidadDe('/ruta-que-nadie-conoce/:id')).toBe(OTROS);
  });

  it('«Otros» siempre figura al final de la lista completa', () => {
    expect(TODAS_LAS_FUNCIONALIDADES.at(-1)).toBe(OTROS);
  });
});
