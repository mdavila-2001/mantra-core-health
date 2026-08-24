import { FormGroup } from '@angular/forms';

import {
  controlesDeClaveDeFirma,
  leerClaveDeFirma,
  SECCION_CLAVE_DE_FIRMA,
} from './signing-key-fields';
import { MAX_CAMPOS_POR_PAGINA } from '../../../shared/forms/paginated/paginated-form.types';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';

/**
 * Los campos de una clave de firma, compartidos por publicar y rotar.
 *
 * Eran un componente con `FormGroup` propio que el padre leía por `viewChild`;
 * ahora son controles que el padre mezcla en el suyo, una sección que agrega a
 * sus páginas y un lector que arma el cuerpo. Lo que se prueba acá es el lector
 * y la forma de la sección: cómo se dibujan es del motor.
 */
describe('campos de clave de firma', () => {
  function grupo(): FormGroup {
    return new FormGroup(controlesDeClaveDeFirma());
  }

  it('los controles nacen vacíos y el grupo inválido: tres son obligatorios', () => {
    const form = grupo();

    expect(form.invalid).toBe(true);
    expect(form.controls['keyId']?.invalid).toBe(true);
    expect(form.controls['algorithm']?.invalid).toBe(true);
    expect(form.controls['publicKey']?.invalid).toBe(true);
    // El certificado y las fechas son opcionales.
    expect(form.controls['certificate']?.valid).toBe(true);
    expect(form.controls['keyValidFrom']?.valid).toBe(true);
  });

  it('lo mínimo viaja recortado y sin las claves que no se cargaron', () => {
    const form = grupo();
    form.patchValue({
      keyId: '  kid-1  ',
      algorithm: ' RS256 ',
      publicKey: ' -----BEGIN PUBLIC KEY----- ',
    });

    expect(leerClaveDeFirma(form.getRawValue())).toEqual({
      keyId: 'kid-1',
      algorithm: 'RS256',
      publicKey: '-----BEGIN PUBLIC KEY-----',
    });
  });

  it('el certificado y las fechas viajan cuando se cargan, y las fechas en ISO', () => {
    const form = grupo();
    form.patchValue({
      keyId: 'kid-1',
      algorithm: 'RS256',
      publicKey: 'pem',
      certificate: ' cert ',
      keyValidFrom: new Date('2026-09-01T00:00:00.000Z'),
      keyValidTo: new Date('2027-09-01T00:00:00.000Z'),
    });

    expect(leerClaveDeFirma(form.getRawValue())).toEqual({
      keyId: 'kid-1',
      algorithm: 'RS256',
      publicKey: 'pem',
      certificate: 'cert',
      validFrom: '2026-09-01T00:00:00.000Z',
      validTo: '2027-09-01T00:00:00.000Z',
    });
  });

  it('cada campo de la sección existe en el grupo: sin eso no se guardaría nada', () => {
    const form = grupo();

    for (const campo of SECCION_CLAVE_DE_FIRMA.campos) {
      expect(form.get(campo.key)).not.toBeNull();
    }
  });

  it('la sección se sirve en páginas de cuatro, conservando su nombre', () => {
    const paginas = paginarCampos([SECCION_CLAVE_DE_FIRMA]);

    expect(paginas).toHaveLength(2);
    expect(paginas[0]?.titulo).toBe('La clave (1 de 2)');
    for (const pagina of paginas) {
      expect(pagina.campos.length).toBeLessThanOrEqual(MAX_CAMPOS_POR_PAGINA);
    }
  });
});
