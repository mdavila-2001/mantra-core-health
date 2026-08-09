import { toCaseStatusPresentation } from './case-status';

/**
 * Lo que estas pruebas fijan: que cada estado del caso —un UUID de concepto—
 * se traduce a la variante y la palabra correctas, y que un estado desconocido
 * degrada a neutro en vez de romper la pantalla.
 */
describe('toCaseStatusPresentation', () => {
  const CASOS: readonly {
    nombre: string;
    conceptId: string;
    variant: string;
    label: string;
  }[] = [
    { nombre: 'CASE_OPEN', conceptId: '31f822ab-b48c-5570-a83c-cf16c37b5b9a', variant: 'pending', label: 'Pendiente' },
    { nombre: 'CASE_IN_VERIFICATION', conceptId: 'ba5a0b9d-8a27-5379-8662-eea142b98a22', variant: 'in-review', label: 'En revisión' },
    // A la persona verificada no se le revela la marca de riesgo.
    { nombre: 'CASE_AT_RISK', conceptId: 'c919c1c1-e013-5542-914e-1fe706203cd2', variant: 'in-review', label: 'En revisión' },
    { nombre: 'CASE_MANUAL_REVIEW', conceptId: 'a02659b9-802a-5acb-ac8f-093e0ddcdbf0', variant: 'in-review', label: 'En revisión' },
    { nombre: 'CASE_VERIFIED', conceptId: '6fb20fdf-1c92-502c-8e1f-54a9bb85ff98', variant: 'approved', label: 'Aprobado' },
    { nombre: 'CASE_ASSERTED', conceptId: 'd41fde09-6752-5bb6-8237-b786fe062ab2', variant: 'approved', label: 'Aprobado' },
    { nombre: 'CASE_REJECTED', conceptId: '05c426b8-86f5-5709-a939-d6baa864fd21', variant: 'rejected', label: 'Rechazado' },
    { nombre: 'CASE_REVOKED', conceptId: '235c658e-7679-5604-baba-764055398964', variant: 'rejected', label: 'Revocado' },
    { nombre: 'CASE_EXPIRED', conceptId: '9d172ffe-1b1f-5318-9378-c924732d7967', variant: 'expired', label: 'Vencido' },
  ];

  for (const caso of CASOS) {
    it(`${caso.nombre} → ${caso.variant} «${caso.label}»`, () => {
      expect(toCaseStatusPresentation(caso.conceptId)).toEqual({
        variant: caso.variant,
        label: caso.label,
      });
    });
  }

  it('un UUID que esta versión no conoce degrada a «Desconocido»', () => {
    expect(toCaseStatusPresentation('00000000-0000-0000-0000-000000000000')).toEqual({
      variant: 'unknown',
      label: 'Desconocido',
    });
  });

  it('sin estado (undefined o null) también degrada, sin lanzar', () => {
    expect(toCaseStatusPresentation(undefined)).toEqual({ variant: 'unknown', label: 'Desconocido' });
    expect(toCaseStatusPresentation(null)).toEqual({ variant: 'unknown', label: 'Desconocido' });
  });
});
