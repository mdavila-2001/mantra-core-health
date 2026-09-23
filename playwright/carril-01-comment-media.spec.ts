import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';

/**
 * REQ-01-011 — imágenes, stickers y GIFs en cada comentario.
 *
 * ## Qué prueba esto y por qué por la vista pública
 *
 * La vista pública (sin sesión) es la que nombra la asignación. El backend ya
 * queda probado por unidad (`community-social.service.spec.ts`,
 * `community-public.service.spec.ts`): que el `fileId` que llega en `media`
 * se persiste con el rol que le corresponde y que la lectura pública lo
 * resuelve a `/public/media/:fileId` + `kind`, nunca al uuid interno. Lo que
 * ESTE archivo prueba es la mitad que esas pruebas no pueden ver: que
 * `app-public-post-comments` pinta esa URL como una imagen dentro de la
 * tarjeta, contra la API real.
 *
 * ## Por qué no entra por el compositor con sesión
 *
 * `app-post-card` (el compositor autenticado) sólo vive en `/feed`, y `/feed`
 * depende del fan-out a `community.feed_items` — un worker aparte (UC-19-15)
 * que este entorno no tiene corriendo; con la tabla vacía el muro está vacío
 * para cualquier cuenta, antes de que este carril tocara una sola línea. Se
 * documenta como `BLOCKED-EXTERNAL` y no se simula un `/feed` con contenido.
 *
 * Por eso el comentario con adjunto de este archivo se crea por API —mismo
 * patrón que ya usa `carril-p5-medios.spec.ts` para lo que la pantalla
 * todavía no cubre— y lo que se afirma con el navegador es la lectura.
 */

async function ingresar(
  api: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const respuesta = await api.post('/iam/auth/login', {
    data: { email, password },
  });
  expect(respuesta.status(), `login de ${email}`).toBe(200);
  const { accessToken } = (await respuesta.json()) as { accessToken: string };
  return accessToken;
}

test.describe('REQ-01-011 · adjuntos de comentario, vista pública @critical', () => {
  let api: APIRequestContext;
  let token: string;
  let profileId: string;
  let postId: string;
  let fileId: string;
  const cuerpoComentario = `Comentario con sticker — ${Date.now()}`;

  test.beforeAll(async () => {
    api = await contextoDeApi();
    expect(await apiViva(api), `la API no responde en ${urlDeApi()}`).toBe(true);

    // Cuenta de demostración ya sembrada por `cuenta-doctor-demo.mjs`.
    token = await ingresar(
      api,
      process.env['E2E_DOCTOR_EMAIL'] ?? 'pabliarca@gmail.com',
      process.env['E2E_DOCTOR_PASSWORD'] ?? 'D3mo-passw0rd!',
    );
    const auth = { Authorization: `Bearer ${token}` };

    // Vitrina pública propia. El `tenantId` sale de un tenant ya sembrado por
    // el stack de desarrollo (`tools/alovida/seed-dev-data.mjs`): no se
    // inventa un uuid, y `E2E_TENANT_ID` lo sobreescribe si el entorno usa otro.
    const tenantId =
      process.env['E2E_TENANT_ID'] ?? '1befcfea-44c0-563a-81cd-337ec6acc840';

    const perfil = await api.put('/community/profiles/me', {
      headers: auth,
      data: {
        tenantId,
        slug: `e2e-req-01-011-${Date.now()}`,
        displayName: 'E2E REQ-01-011',
        visibility: 'PUBLIC',
      },
    });
    expect(perfil.status(), await perfil.text()).toBe(200);
    profileId = (await perfil.json()).id as string;

    const post = await api.post(`/community/profiles/${profileId}/posts`, {
      headers: auth,
      data: { bodyText: 'Post de prueba REQ-01-011 (Playwright)' },
    });
    expect(post.status(), await post.text()).toBe(201);
    postId = (await post.json()).id as string;

    const subida = await api.post('/common/files/upload', {
      headers: auth,
      multipart: {
        file: {
          name: 'sticker.png',
          mimeType: 'image/png',
          buffer: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d, 0x49, 0x48, 0x44, 0x52,
          ]),
        },
        category: 'IMAGE',
        sensitivity: 'NORMAL',
      },
    });
    expect(subida.status(), await subida.text()).toBe(201);
    fileId = (await subida.json()).id as string;

    const comentario = await api.post('/community/comments', {
      headers: auth,
      data: {
        authorProfileId: profileId,
        commentableType: 'POST',
        commentableRefId: postId,
        bodyText: cuerpoComentario,
        media: [{ fileId, mediaRole: 'STICKER', altText: 'un sticker de prueba' }],
      },
    });
    expect(comentario.status(), await comentario.text()).toBe(201);
  });

  test.afterAll(async () => {
    // Vuelve la vitrina a `PRIVATE`: pública, el post que crea este archivo
    // pasa a ser «el más reciente» del feed público y le corre el `.first()`
    // a cualquier otra prueba que no fije un post por id — exactamente lo que
    // le pasó a `carril-01-publicaciones-publicas.spec.ts` mientras se
    // verificaba este mismo carril. No se borra el perfil ni el post —no hay
    // endpoint para eso, y no hace falta—: alcanza con que dejen de contar
    // como públicos.
    if (token) {
      await api.put('/community/profiles/me', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tenantId: process.env['E2E_TENANT_ID'] ?? '1befcfea-44c0-563a-81cd-337ec6acc840',
          slug: `e2e-req-01-011-cerrado-${Date.now()}`,
          displayName: 'E2E REQ-01-011',
          visibility: 'PRIVATE',
        },
      });
    }
    await api.dispose();
  });

  async function abrirSinSesion(page: Page, ruta: string): Promise<void> {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' });
    await page.locator('app-public-nav-rail').first().waitFor({ state: 'attached' });
  }

  test('la lectura pública sirve el adjunto con /public/media, sin exponer el fileId', async ({
    request,
  }) => {
    const respuesta = await request.get(`/public/posts/${postId}/comments`);
    expect(respuesta.ok(), await respuesta.text()).toBe(true);
    const pagina = (await respuesta.json()) as {
      items: { bodyText: string; media: { url: string; kind: string; altText: string | null }[] }[];
    };
    const propio = pagina.items.find((c) => c.bodyText === cuerpoComentario);
    expect(propio, 'el comentario recién creado aparece en la lectura pública').toBeTruthy();
    expect(propio!.media).toEqual([
      { url: `/public/media/${fileId}`, kind: 'STICKER', altText: 'un sticker de prueba' },
    ]);
  });

  test('la tarjeta pública pinta el adjunto como <img> con esa URL', async ({ page }) => {
    await abrirSinSesion(page, `/posts`);

    // El post recién publicado es el más nuevo: el feed público ordena por
    // fecha, así que su tarjeta es la primera.
    const tarjeta = page
      .locator('article', { hasText: 'Post de prueba REQ-01-011 (Playwright)' })
      .first();
    await tarjeta.waitFor({ state: 'attached', timeout: 15_000 });

    const contadorComentarios = tarjeta.locator('[data-testid="post-comments"]');
    await contadorComentarios.click();

    const desplegable = tarjeta.locator('app-public-post-comments');
    await expect(desplegable.getByText(cuerpoComentario)).toBeVisible({ timeout: 15_000 });

    const miniatura = desplegable.locator(`img[src="/public/media/${fileId}"]`);
    await expect(miniatura).toHaveCount(1);
    await expect(miniatura).toHaveAttribute('alt', 'un sticker de prueba');
  });
});
