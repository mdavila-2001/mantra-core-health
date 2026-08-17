import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  administrador,
  apiViva,
  contextoDeApi,
  doctora,
  urlDeApi,
} from './support/actores';
import { entrar, esperarAplicacionLista } from './support/sesion';

/**
 * Carril P5 — medios e imágenes reales.
 *
 * ## Qué prueba y qué no
 *
 * El contrato del carril prohíbe declarar nada verde por apariencia: cada caso
 * de acá mueve **bytes binarios de verdad** contra la API viva, que los escribe
 * en el object storage configurado y los devuelve por su propia ruta de
 * servicio. No hay `route.fulfill`, ni fixtures de respuesta, ni un solo estado
 * escrito a mano en la base para que un caso pase.
 *
 * ## Por qué la mayor parte va por `APIRequestContext` y no por pantalla
 *
 * Porque hoy **no existe la pantalla**. El selector de medios del composer es
 * fase B del carril y depende de que P3 esté integrado en `dev`; escribir aquí
 * una interacción con un botón que nadie construyó daría una prueba que falla
 * por el motivo equivocado. Lo que sí existe y se puede afirmar es el contrato
 * HTTP, y eso es lo que se ejercita. El último caso sí abre el navegador: entra
 * con una sesión real y comprueba que el navegador **decodifica** la imagen que
 * devolvió la API — `naturalWidth > 0`, no «la petición respondió 200».
 *
 * ## Lo que este archivo NO puede afirmar todavía
 *
 * No hay antivirus cableado en el despliegue: toda versión queda en
 * `SCAN_PENDING`. Por eso no hay ningún caso que diga «el escaneo salió limpio»
 * — sería mentira. El único estado de escaneo que se afirma es el rechazo de lo
 * que ya se sabe infectado, que se cubre en las pruebas unitarias del backend
 * porque no hay forma honesta de producir un infectado real sin scanner.
 */

/** Los binarios viven junto a la suite; `__dirname` los ubica sin depender del cwd. */
const fixture = (nombre: string): Buffer =>
  readFileSync(join(__dirname, 'fixtures', 'p5', nombre));

/** Cabecera PNG auténtica seguida de relleno, para superar el límite de tamaño. */
function pngSobredimensionado(mib: number): Buffer {
  const buffer = Buffer.alloc(mib * 1024 * 1024);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  return buffer;
}

interface Subida {
  status: number;
  body: Record<string, unknown>;
}

async function ingresar(
  api: APIRequestContext,
  identificador: string,
  clave: string,
): Promise<string> {
  const respuesta = await api.post('/iam/auth/login', {
    data: { email: identificador, password: clave },
  });
  expect(respuesta.status(), `login de ${identificador}`).toBe(200);
  const { accessToken } = (await respuesta.json()) as { accessToken: string };
  expect(accessToken, 'el login real devuelve token').toBeTruthy();
  return accessToken;
}

async function subir(
  api: APIRequestContext,
  token: string,
  archivo: { name: string; mimeType: string; buffer: Buffer },
  category: 'IMAGE' | 'DOCUMENT',
): Promise<Subida> {
  const respuesta = await api.post('/common/files/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: { file: archivo, category, sensitivity: 'NORMAL' },
  });
  const body = (await respuesta.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { status: respuesta.status(), body };
}

test.describe('P5 · medios reales @critical', () => {
  let api: APIRequestContext;
  let tokenDoctora: string;
  let tokenAdmin: string;

  test.beforeAll(async () => {
    api = await contextoDeApi();
    expect(
      await apiViva(api),
      `no hay API viva en ${urlDeApi()}; el carril no se puede afirmar`,
    ).toBe(true);
    tokenDoctora = await ingresar(
      api,
      doctora().identificador,
      doctora().clave,
    );
    tokenAdmin = await ingresar(
      api,
      administrador().identificador,
      administrador().clave,
    );
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('P5-E2E-001 · imagen real sube, se almacena y se sirve idéntica', async () => {
    const original = fixture('post-1.jpg');

    const subida = await subir(
      api,
      tokenDoctora,
      { name: 'post-1.jpg', mimeType: 'image/jpeg', buffer: original },
      'IMAGE',
    );
    expect(subida.status).toBe(201);
    const fileId = subida.body['id'] as string;
    expect(fileId).toBeTruthy();

    const servida = await api.get(`/common/files/${fileId}/content`, {
      headers: { Authorization: `Bearer ${tokenDoctora}` },
    });
    expect(servida.status()).toBe(200);
    // El tipo lo pone el servidor a partir de los bytes, no el cliente.
    expect(servida.headers()['content-type']).toContain('image/jpeg');

    const devuelta = await servida.body();
    expect(devuelta.byteLength, 'el tamaño servido es el subido').toBe(
      original.byteLength,
    );
    expect(devuelta.equals(original), 'los bytes servidos son los subidos').toBe(
      true,
    );
  });

  test('P5-E2E-001b · WEBP y PNG reales atraviesan el mismo camino', async () => {
    for (const [nombre, mime] of [
      ['post-2.webp', 'image/webp'],
      ['avatar.png', 'image/png'],
    ] as const) {
      const subida = await subir(
        api,
        tokenDoctora,
        { name: nombre, mimeType: mime, buffer: fixture(nombre) },
        'IMAGE',
      );
      expect(subida.status, `subida de ${nombre}`).toBe(201);

      const servida = await api.get(
        `/common/files/${subida.body['id'] as string}/content`,
        { headers: { Authorization: `Bearer ${tokenDoctora}` } },
      );
      expect(servida.headers()['content-type'], nombre).toContain(mime);
    }
  });

  test('P5-NEG-001 · el contenido que no es imagen se rechaza aunque lo declare', async () => {
    const casos = [
      {
        nombre: 'texto plano con extensión .txt',
        archivo: {
          name: 'no-es-imagen.txt',
          mimeType: 'text/plain',
          buffer: fixture('no-es-imagen.txt'),
        },
      },
      {
        // El vector que cierra la validación por firma: sin ella, este archivo
        // se guardaba con `mimeType: image/png` y se servía como tal.
        nombre: 'HTML declarado como image/png',
        archivo: {
          name: 'disfrazado.png',
          mimeType: 'image/png',
          buffer: fixture('disfrazado.png'),
        },
      },
    ];

    for (const caso of casos) {
      const subida = await subir(api, tokenDoctora, caso.archivo, 'IMAGE');
      expect(subida.status, caso.nombre).toBeGreaterThanOrEqual(400);
      expect(subida.status, caso.nombre).toBeLessThan(500);
    }
  });

  test('P5-NEG-002 · la categoría acota el formato', async () => {
    const pdf = {
      name: 'informe.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
    };

    const comoImagen = await subir(api, tokenDoctora, pdf, 'IMAGE');
    expect(comoImagen.status, 'un PDF no es una imagen').toBe(422);

    const comoDocumento = await subir(api, tokenDoctora, pdf, 'DOCUMENT');
    expect(comoDocumento.status, 'el mismo PDF sí es un documento').toBe(201);
  });

  test('P5-NEG-003 · el límite de tamaño lo aplica el servidor', async () => {
    const subida = await subir(
      api,
      tokenDoctora,
      {
        name: 'grande.png',
        mimeType: 'image/png',
        buffer: pngSobredimensionado(11),
      },
      'IMAGE',
    );
    expect(subida.status).toBe(413);
  });

  test('P5-NEG-004 · un archivo ajeno no se descarga', async () => {
    const delAdmin = await subir(
      api,
      tokenAdmin,
      {
        name: 'avatar.png',
        mimeType: 'image/png',
        buffer: fixture('avatar.png'),
      },
      'IMAGE',
    );
    expect(delAdmin.status).toBe(201);

    const intento = await api.get(
      `/common/files/${delAdmin.body['id'] as string}/content`,
      { headers: { Authorization: `Bearer ${tokenDoctora}` } },
    );
    expect(intento.status()).toBe(403);
  });

  test('P5-E2E-002 · el navegador decodifica la imagen que sirvió la API', async ({
    page,
  }) => {
    await entrar(page, doctora());
    await esperarAplicacionLista(page);

    const resultado = await page.evaluate(async () => {
      // La sesión del navegador guarda sólo el refresh; el access vive en memoria.
      const refreshToken = localStorage.getItem('mantra.refresh-token');
      const renovada = await fetch('/iam/auth/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const { accessToken } = await renovada.json();

      // PNG binario pintado por el propio navegador: una subida como la de un usuario.
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 360;
      const ctx = canvas.getContext('2d')!;
      const degradado = ctx.createLinearGradient(0, 0, 600, 360);
      degradado.addColorStop(0, '#0b5d8a');
      degradado.addColorStop(1, '#12a37f');
      ctx.fillStyle = degradado;
      ctx.fillRect(0, 0, 600, 360);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('P5 · imagen real', 40, 120);
      const blob: Blob = await new Promise((listo) =>
        canvas.toBlob((b) => listo(b!), 'image/png'),
      );

      const formulario = new FormData();
      formulario.append('file', new File([blob], 'p5-navegador.png', { type: 'image/png' }));
      formulario.append('category', 'IMAGE');
      formulario.append('sensitivity', 'NORMAL');
      const subida = await fetch('/common/files/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formulario,
      });
      const { id } = await subida.json();

      const servida = await fetch(`/common/files/${id}/content`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const recibida = await servida.blob();

      // El CSP de la aplicación declara `img-src 'self' data:`: una URL `blob:`
      // queda bloqueada por política, así que la evidencia visual va por `data:`.
      const dataUrl: string = await new Promise((listo) => {
        const lector = new FileReader();
        lector.onload = () => listo(lector.result as string);
        lector.readAsDataURL(recibida);
      });
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      return {
        statusSubida: subida.status,
        statusServida: servida.status,
        contentType: servida.headers.get('content-type'),
        bytesEnviados: blob.size,
        bytesRecibidos: recibida.size,
        ancho: img.naturalWidth,
        alto: img.naturalHeight,
      };
    });

    expect(resultado.statusSubida).toBe(201);
    expect(resultado.statusServida).toBe(200);
    expect(resultado.contentType).toContain('image/png');
    expect(resultado.bytesRecibidos).toBe(resultado.bytesEnviados);
    // La afirmación que separa «respondió 200» de «es una imagen».
    expect(resultado.ancho).toBe(600);
    expect(resultado.alto).toBe(360);
  });
});
