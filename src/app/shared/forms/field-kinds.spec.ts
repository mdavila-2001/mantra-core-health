import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import {
  FIELD_KINDS,
  fieldKindErrorMessage,
  fieldKindFilter,
  fieldKindInputMode,
  fieldKindMessage,
  fieldKindNormalize,
  fieldKindValidator,
  type FieldKind,
} from './field-kinds';

function errorDe(kind: FieldKind, valor: string) {
  return fieldKindValidator(kind)(new FormControl(valor));
}

describe('personName', () => {
  const { filter } = FIELD_KINDS.personName;

  it('deja letras con tildes y ñ', () => {
    expect(filter('José Ñandú')).toBe('José Ñandú');
  });

  it('conserva el espacio, el guion y el apóstrofo de un nombre compuesto', () => {
    expect(filter('De la Quintana')).toBe('De la Quintana');
    expect(filter('García-Lorca')).toBe('García-Lorca');
    expect(filter("D'Angelo")).toBe("D'Angelo");
  });

  it('quita dígitos y símbolos', () => {
    expect(filter('holaLTAD123')).toBe('holaLTAD');
    expect(filter('Ana 2.0 (Paz)!')).toBe('Ana Paz');
  });

  it('no deja empezar con un separador ni repetirlo', () => {
    expect(filter(' -Ana')).toBe('Ana');
    expect(filter('De  la--Cruz')).toBe('De la-Cruz');
  });

  it('valida la forma: palabras de letras separadas por un solo separador', () => {
    expect(errorDe('personName', 'De la Quintana')).toBeNull();
    expect(errorDe('personName', 'Ana ')).toBeNull();
    expect(errorDe('personName', 'Ana -Paz')).toEqual({
      fieldKind: { kind: 'personName', message: fieldKindMessage('personName') },
    });
    expect(errorDe('personName', 'Ana2')).not.toBeNull();
  });
});

describe('identityDocument', () => {
  const { filter } = FIELD_KINDS.identityDocument;

  it('deja letras sin tilde, dígitos, punto y guion', () => {
    expect(filter('CI-1234567.LP')).toBe('CI-1234567.LP');
  });

  it('quita espacios, tildes y símbolos', () => {
    expect(filter('541984844*///*/*/')).toBe('541984844');
    expect(filter('12 34 ñ')).toBe('1234');
  });

  it('valida el mismo piso que la API', () => {
    expect(errorDe('identityDocument', '1234567')).toBeNull();
    expect(errorDe('identityDocument', '4872190 SC')).not.toBeNull();
  });
});

describe('identityDocumentWithComplement', () => {
  const { filter } = FIELD_KINDS.identityDocumentWithComplement;

  it('admite un espacio entre el número y el complemento', () => {
    expect(filter('4872190 SC')).toBe('4872190 SC');
    expect(filter('4872190   SC')).toBe('4872190 SC');
    expect(errorDe('identityDocumentWithComplement', '4872190 SC')).toBeNull();
  });

  it('sigue quitando los símbolos', () => {
    expect(filter('541984844*///*/*/')).toBe('541984844');
  });
});

describe('email', () => {
  const { filter } = FIELD_KINDS.email;

  it('deja una dirección normal intacta', () => {
    expect(filter('ana.perez_1-x@mi-clinica.com.bo')).toBe('ana.perez_1-x@mi-clinica.com.bo');
  });

  it('quita espacios, tildes, + y símbolos, también al pegar', () => {
    expect(filter('qqoewqw*[]@gmail.com')).toBe('qqoewqw@gmail.com');
    expect(filter(' jo sé(1);@gmail .com ')).toBe('jos1@gmail.com');
    expect(filter('ana+promo@gmail.com')).toBe('anapromo@gmail.com');
  });

  it('de una tira de símbolos no deja nada', () => {
    expect(filter('---++++-++--+++++')).toBe('');
    expect(filter('._-')).toBe('');
    expect(filter('@gmail.com')).toBe('');
  });

  it('nunca empieza con un símbolo ni lo repite', () => {
    expect(filter('--ana')).toBe('ana');
    expect(filter('ana..--__paz')).toBe('ana.paz');
    expect(filter('ana.')).toBe('ana.');
  });

  it('quita el símbolo antes del arroba, limpia el dominio y deja un solo arroba', () => {
    expect(filter('ana.-@')).toBe('ana@');
    expect(filter('ana@-.gm__ail..com')).toBe('ana@gmail.com');
    expect(filter('ana@mi--clinica.bo')).toBe('ana@mi-clinica.bo');
    expect(filter('ana@@gm@ail.com')).toBe('ana@gmail.com');
  });

  it('el correo de la captura queda sin sus símbolos sueltos', () => {
    expect(filter('ojpiojkjmkl562651561--......+.+.+.+.-.-.-.-+-+.+-+-+-+-+-')).toBe(
      'ojpiojkjmkl562651561-',
    );
  });

  it('exige nombre@dominio.tld', () => {
    expect(errorDe('email', 'ana@dominio.com')).toBeNull();
    expect(errorDe('email', 'ana.paz@sub.dominio.bo')).toBeNull();
    expect(errorDe('email', 'ana@dominio')).not.toBeNull();
    expect(errorDe('email', 'ana.@dominio.com')).not.toBeNull();
    expect(errorDe('email', 'ana@-dominio.com')).not.toBeNull();
    expect(errorDe('email', 'ojpiojkjmkl562651561-')).not.toBeNull();
  });
});

describe('taxId, digits y phone', () => {
  it('el NIT deja dígitos y guion, y tiene que empezar por un dígito', () => {
    expect(FIELD_KINDS.taxId.filter('1020304-5 A')).toBe('1020304-5');
    expect(errorDe('taxId', '1020304-5')).toBeNull();
    expect(errorDe('taxId', '-1020304')).not.toBeNull();
  });

  it('digits deja sólo dígitos', () => {
    expect(FIELD_KINDS.digits.filter('12a3-4 5')).toBe('12345');
    expect(errorDe('digits', '12345')).toBeNull();
  });

  it('el teléfono deja lo que acepta la API', () => {
    expect(FIELD_KINDS.phone.filter('+591 (2) 244-1234 ext')).toBe('+591 (2) 244-1234 ');
    expect(errorDe('phone', '+591 (2) 244-1234')).toBeNull();
    expect(errorDe('phone', '2+2')).not.toBeNull();
  });
});

describe('fieldKindValidator', () => {
  it('el vacío y el solo-espacios no son su asunto', () => {
    expect(errorDe('email', '')).toBeNull();
    expect(errorDe('email', '   ')).toBeNull();
    expect(fieldKindValidator('email')(new FormControl(null))).toBeNull();
  });

  it('mira el valor recortado, que es el que viaja', () => {
    expect(errorDe('identityDocument', '  1234567  ')).toBeNull();
  });

  it('deja el mensaje en el error, para quien lo muestre sin conocer el catálogo', () => {
    const control = new FormControl('sin-arroba', fieldKindValidator('email'));
    expect(fieldKindErrorMessage(control.errors)).toBe(fieldKindMessage('email'));
    expect(fieldKindErrorMessage(null)).toBeNull();
    expect(fieldKindErrorMessage({ required: true })).toBeNull();
  });
});

describe('ayudas del catálogo', () => {
  it('sin tipo no hay filtro ni teclado', () => {
    expect(fieldKindFilter(null)).toBeNull();
    expect(fieldKindFilter(undefined)).toBeNull();
    expect(fieldKindInputMode(null)).toBeNull();
  });

  it('cada tipo con teclado propio lo declara', () => {
    expect(fieldKindInputMode('email')).toBe('email');
    expect(fieldKindInputMode('digits')).toBe('numeric');
    expect(fieldKindInputMode('phone')).toBe('tel');
    expect(fieldKindInputMode('personName')).toBeNull();
  });

  it('todo tipo deja pasar por su filtro lo que su validador acepta', () => {
    const muestras: Record<FieldKind, string> = {
      personName: 'María José De la Cruz',
      identityDocument: 'E-1234567',
      identityDocumentWithComplement: '4872190 SC',
      email: 'ana_paz-alta@salud.com.bo',
      taxId: '1020304-5',
      digits: '123456',
      phone: '+591 (2) 244-1234',
    };
    for (const [kind, muestra] of Object.entries(muestras) as [FieldKind, string][]) {
      expect(FIELD_KINDS[kind].filter(muestra), kind).toBe(muestra);
      expect(errorDe(kind, muestra), kind).toBeNull();
    }
  });
});

describe('bordes de los filtros (revisión)', () => {
  it('el apóstrofo tipográfico de iOS pasa a ser el común, y no se borra', () => {
    expect(FIELD_KINDS.personName.filter('O’Brien')).toBe("O'Brien");
  });

  it('un nombre no empieza con una marca combinante suelta', () => {
    expect(FIELD_KINDS.personName.filter('\u0301Ana')).toBe('Ana');
  });

  it('al salir del campo, el nombre pierde el separador colgado', () => {
    expect(fieldKindNormalize('personName')(' Quispe- ')).toBe('Quispe');
    expect(fieldKindNormalize('personName')("D' ")).toBe('D');
    expect(fieldKindNormalize('email')(' ana@x.com ')).toBe('ana@x.com');
    expect(fieldKindNormalize(null)(' x ')).toBe('x');
  });

  it('el teléfono admite el + sólo al principio, y el NIT no empieza con guion', () => {
    expect(FIELD_KINDS.phone.filter('+591+7')).toBe('+5917');
    expect(FIELD_KINDS.taxId.filter('-102-3')).toBe('102-3');
  });
});
