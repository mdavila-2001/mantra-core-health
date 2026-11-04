import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';

import { jsonLdDePerfil, serializarJsonLd } from './public-profile.jsonld';

/**
 * M-4 / O3-5 — `public-profile.ts:194`: el JSON-LD de la ficha pública se
 * escribe por DOM (`script.textContent`) en lugar de `[innerHTML]`. En el
 * navegador `textContent` nunca es marcado, pero **en el SSR** el documento se
 * serializa a HTML: un `</script>` en el nombre o la bio de un prestador
 * cerraría la etiqueta y lo que siga correría en la página de quien la abra.
 * Se reproduce ese camino exacto —crear el `<script>`, ponerle el texto,
 * serializar— y se exige que el HTML resultante tenga un solo `<script>` y que
 * el JSON vuelva intacto.
 */

const HOSTIL = '</script><script>alert(document.cookie)</script><img src=x onerror=alert(1)><!--';

function perfil(partial: Partial<PublicProfileDetail> = {}): PublicProfileDetail {
  return {
    kind: 'PRACTITIONER',
    slug: 'dra-lopez',
    displayName: `Dra. López ${HOSTIL}`,
    headline: HOSTIL,
    biography: null,
    avatarUrl: 'javascript:alert(1)',
    coverUrl: null,
    verified: true,
    city: `Cochabamba ${HOSTIL}`,
    address: null,
    location: null,
    specialties: [HOSTIL],
    trajectory: [],
    practiceSites: [],
    ratingAverage: null,
    ratingCount: 0,
    acceptsReviews: false,
    posts: [],
    ...partial,
  } as PublicProfileDetail;
}

/** Lo que hace `publicarDatosEstructurados` con el documento, y lo que el SSR emite. */
function serializadoComoEnSsr(texto: string): { html: string; script: HTMLScriptElement } {
  const contenedor = document.createElement('div');
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = texto;
  contenedor.appendChild(script);
  return { html: contenedor.innerHTML, script };
}

describe('PublicProfile · JSON-LD con texto hostil (M-4, public-profile.ts:194)', () => {
  it('el JSON serializado no contiene ningún `<`: no hay forma de cerrar el <script>', () => {
    const texto = serializarJsonLd(jsonLdDePerfil(perfil(), 'https://alovidasalud.com'));

    expect(texto).not.toContain('<');
    expect(texto).toContain('\\u003c/script>');
  });

  it('serializado como lo hace el SSR, queda UN solo <script> y ningún elemento inyectado', () => {
    const { html } = serializadoComoEnSsr(serializarJsonLd(jsonLdDePerfil(perfil(), 'https://alovidasalud.com')));
    const reparseado = document.createElement('template');
    reparseado.innerHTML = html;

    expect(reparseado.content.querySelectorAll('script')).toHaveLength(1);
    expect(reparseado.content.querySelectorAll('img')).toHaveLength(0);
    expect(reparseado.content.childNodes).toHaveLength(1);
    expect((html.match(/<\/script>/gi) ?? []).length).toBe(1);
  });

  it('el escape no altera el dato: quien lea el JSON-LD recibe el texto original', () => {
    const datos = jsonLdDePerfil(perfil(), 'https://alovidasalud.com');
    const { html } = serializadoComoEnSsr(serializarJsonLd(datos));
    const reparseado = document.createElement('template');
    reparseado.innerHTML = html;
    const leido = JSON.parse(reparseado.content.querySelector('script')!.textContent ?? '') as Record<string, unknown>;

    expect(leido).toEqual(datos);
    expect(leido['name']).toBe(`Dra. López ${HOSTIL}`);
  });

  it('una URL `javascript:` del avatar sólo viaja como dato del JSON, nunca como atributo', () => {
    const { html } = serializadoComoEnSsr(serializarJsonLd(jsonLdDePerfil(perfil(), 'https://alovidasalud.com')));
    const reparseado = document.createElement('template');
    reparseado.innerHTML = html;

    const conUrl = Array.from(reparseado.content.querySelectorAll('*')).filter((el) =>
      Array.from(el.attributes).some((a) => /javascript:/i.test(a.value)),
    );
    expect(conUrl).toEqual([]);
  });
});
