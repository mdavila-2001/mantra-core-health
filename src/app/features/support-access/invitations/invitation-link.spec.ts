import { codeFromPasted, invitationLink, normalizeInvitationCode, stripInvitationCode } from './invitation-link';

const CODIGO = 'aB3_xY-9QzLmN0pRsTuVwXyZ1a2B3c4D';

describe('invitationLink', () => {
  it('apunta a «Mis accesos» con el código en el fragmento y sin barras de más', () => {
    expect(invitationLink('https://app.mantra.test/', CODIGO)).toBe(`https://app.mantra.test/my-support#code=${CODIGO}`);
  });

  it('el código nunca va en la query: no llega a los logs ni al Referer', () => {
    const enlace = invitationLink('https://x.test', CODIGO);
    expect(enlace).not.toContain('?');
    expect(new URL(enlace).search).toBe('');
    expect(new URL(enlace).hash).toBe(`#code=${CODIGO}`);
  });

  it('escapa lo que no es seguro en una dirección', () => {
    expect(invitationLink('https://x.test', 'A B&C')).toBe('https://x.test/my-support#code=A%20B%26C');
  });
});

describe('codeFromPasted', () => {
  it('no cambia mayúsculas ni minúsculas: el código real distingue las dos', () => {
    expect(codeFromPasted(CODIGO)).toBe(CODIGO);
    expect(normalizeInvitationCode('aBc')).toBe('aBc');
  });

  it('solo quita los espacios que se cuelan al pegar', () => {
    expect(codeFromPasted(`  ${CODIGO.slice(0, 10)} ${CODIGO.slice(10)} `)).toBe(CODIGO);
  });

  it('si pegaron la dirección del QR, saca el código del fragmento sin tocarlo', () => {
    expect(codeFromPasted(`https://app.mantra.test/my-support#code=${CODIGO}`)).toBe(CODIGO);
  });

  it('un QR impreso con la query de antes también se entiende', () => {
    expect(codeFromPasted(`https://app.mantra.test/my-support?code=${CODIGO}`)).toBe(CODIGO);
  });

  it('una dirección sin código no inventa uno: devuelve el texto', () => {
    expect(codeFromPasted('https://app.mantra.test/my-support')).toBe('https://app.mantra.test/my-support');
  });
});

describe('stripInvitationCode', () => {
  it('saca el código del fragmento y devuelve la ruta limpia', () => {
    expect(stripInvitationCode(`/my-support#code=${CODIGO}`)).toEqual({ code: CODIGO, path: '/my-support' });
  });

  it('saca el código de la query (QR viejo) y conserva el resto de la query', () => {
    expect(stripInvitationCode(`/my-support?code=${CODIGO}&x=1`)).toEqual({ code: CODIGO, path: '/my-support?x=1' });
  });

  it('conserva el resto del fragmento', () => {
    expect(stripInvitationCode(`/my-support#code=${CODIGO}&otro=1`)).toEqual({ code: CODIGO, path: '/my-support#otro=1' });
  });

  it('sin código no cambia nada', () => {
    expect(stripInvitationCode('/my-support')).toEqual({ code: null, path: '/my-support' });
  });
});
