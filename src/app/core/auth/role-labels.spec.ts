import { esPaciente, etiquetaDeRol, etiquetasDeRoles, rolesConEtiqueta } from './role-labels';

/**
 * El diccionario es lo que decide que un paciente lea «Paciente» y no
 * `PATIENT`. Lo que fija acá es la regla, no la tabla: código conocido →
 * etiqueta, desconocido → se omite, y `USER` nunca se muestra.
 */
describe('etiquetaDeRol', () => {
  it('traduce un código conocido a su etiqueta', () => {
    expect(etiquetaDeRol('PATIENT')).toBe('Paciente');
    expect(etiquetaDeRol('SECURITY_ADMIN')).toBe('Administración de seguridad');
  });

  it('USER no tiene etiqueta: es el rol base y no informa nada', () => {
    expect(etiquetaDeRol('USER')).toBeNull();
  });

  it('un código desconocido se omite en vez de pintarse crudo', () => {
    expect(etiquetaDeRol('ROL_INVENTADO')).toBeNull();
    // Tampoco valen las propiedades heredadas de cualquier objeto.
    expect(etiquetaDeRol('toString')).toBeNull();
  });
});

describe('etiquetasDeRoles', () => {
  it('conserva el orden de entrada, sin nulos ni repetidos', () => {
    expect(
      etiquetasDeRoles(['USER', 'SECURITY_ADMIN', 'ROL_INVENTADO', 'PATIENT', 'SECURITY_ADMIN']),
    ).toEqual(['Administración de seguridad', 'Paciente']);
  });
});

describe('rolesConEtiqueta', () => {
  it('empareja cada código con su etiqueta y deja afuera los que no tienen', () => {
    expect(rolesConEtiqueta(['USER', 'PATIENT', 'INVENTADO'])).toEqual([
      { codigo: 'PATIENT', etiqueta: 'Paciente' },
    ]);
  });

  it('un código repetido en el token entra una sola vez: las insignias se rastrean por código', () => {
    expect(rolesConEtiqueta(['PATIENT', 'SUPERADMIN', 'PATIENT'])).toEqual([
      { codigo: 'PATIENT', etiqueta: 'Paciente' },
      { codigo: 'SUPERADMIN', etiqueta: 'Superadministración' },
    ]);
  });
});

describe('esPaciente', () => {
  it('es paciente quien trae PATIENT entre sus roles', () => {
    expect(esPaciente(['USER', 'PATIENT'])).toBe(true);
    expect(esPaciente(['USER', 'SECURITY_ADMIN'])).toBe(false);
    expect(esPaciente([])).toBe(false);
  });
});
