import { expect, type APIRequestContext } from '@playwright/test';

import { doctora } from './actores';

/**
 * Deja al menos una publicación pública en el entorno, creada por el camino
 * real: la médica entra, abre su vitrina pública y publica.
 *
 * ## Por qué existe
 *
 * Las pruebas de la tarjeta de publicación (carril 01) daban por hecho que el
 * entorno ya tenía publicaciones — las que siembra `yarn seed:e2e` en el stack
 * E2E propio. Contra la API de desarrollo, con la base sin publicaciones, el
 * `/posts` muestra su estado vacío (correcto) y cinco pruebas esperaban 180 s
 * una tarjeta que nunca iba a llegar. Sembrar lo que la prueba necesita la
 * vuelve independiente del orden y del entorno; lo que se afirma no cambia.
 *
 * Mismo patrón que `carril-01-comment-media.spec.ts` (vitrina por
 * `PUT /community/profiles/me` y publicación por `POST …/posts`).
 */
export async function asegurarPublicacionPublica(api: APIRequestContext): Promise<void> {
  const medica = doctora();
  const login = await api.post('/iam/auth/login', {
    data: { email: medica.identificador, password: medica.clave },
  });
  expect(login.status(), `login de la médica: ${await login.text()}`).toBe(200);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const auth = { Authorization: `Bearer ${accessToken}` };

  // El `tenantId` sale de un tenant ya sembrado por el stack de desarrollo,
  // igual que en `carril-01-comment-media.spec.ts`; `E2E_TENANT_ID` lo cambia.
  const tenantId = process.env['E2E_TENANT_ID'] ?? '1befcfea-44c0-563a-81cd-337ec6acc840';
  const sello = Date.now();
  const perfil = await api.put('/community/profiles/me', {
    headers: auth,
    data: {
      tenantId,
      slug: `e2e-carril-01-${sello}`,
      displayName: 'E2E Carril 01',
      visibility: 'PUBLIC',
    },
  });
  expect(perfil.status(), await perfil.text()).toBe(200);
  const profileId = (await perfil.json()).id as string;

  const publicacion = await api.post(`/community/profiles/${profileId}/posts`, {
    headers: auth,
    data: { bodyText: `Publicación de prueba del carril 01 (${sello})` },
  });
  expect(publicacion.status(), await publicacion.text()).toBe(201);
}
