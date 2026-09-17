/** El ejercicio completo de la aseguradora: darla de alta. Siete pasos —la empresa,
 *  cómo se la identifica, sus datos, la documentación legal en PDF y el usuario
 *  administrador— hasta que la cuenta queda creada. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMotor } from './motor.mjs';

/* los PDF de ejemplo que se adjuntan en el paso 4 viven al lado de este archivo */
const DOCS = join(dirname(fileURLToPath(import.meta.url)), 'documentos');

export async function grabar({ navegador, base, dir }) {
  const m = crearMotor({ navegador, base, dir, flujo: 'aseguradora' });

  await m.sesion(null);
  const pg = m.pagina;
  const campo = (etiqueta) => pg.locator('app-form-field').filter({ hasText: etiqueta }).first();
  const siguiente = () => pg.getByRole('button', { name: /^Siguiente$/ }).first();

  /* ---------- 1 · la puerta de entrada ---------- */
  m.escena('La puerta de entrada');
  await m.ir('/auth/register');
  m.rotulo('Aseguradora', 'El alta empieza donde empiezan todas las cuentas.', 3.6);
  await m.clic(pg.locator('.tipos__card').nth(2), { tras: 22 });
  m.sostener(.8);

  /* ---------- 2 · la empresa ---------- */
  m.escena('La empresa');
  m.rotulo('Aseguradora · paso 1', 'Razón social, país de constitución y figura jurídica.', 4.4);
  await m.escribir(campo('Nombre de la empresa').locator('input'), 'Seguros Cordillera S.A.', { cps: 26 });
  await campo('País de constitución').locator('select').selectOption({ label: 'Bolivia' });
  await m.animar(8);
  await campo('Tipo societario').locator('select').selectOption({ label: 'S.A. · Sociedad Anónima' });
  await m.animar(10);
  await m.escribir(campo('Nombre comercial').locator('input'), 'Seguros Cordillera', { cps: 28 });
  m.sostener(.6);
  await m.clic(siguiente(), { tras: 18 });

  /* ---------- 3 · cómo se la identifica ---------- */
  m.escena('Cómo se la identifica');
  m.rotulo('Aseguradora · paso 2', 'Su código, su sigla y el código de aseguradora.', 4.2);
  await m.escribir(campo('Código').first().locator('input'), 'CORDILLERA', { cps: 26 });
  await m.escribir(campo('Sigla').locator('input'), 'SCOR', { cps: 20, apuntar: false });
  await m.escribir(pg.locator('app-form-field').filter({ hasText: 'Código de aseguradora' }).locator('input'), 'CORD', { cps: 20, apuntar: false });
  m.sostener(.6);
  await m.clic(siguiente(), { tras: 18 });

  /* ---------- 4 · sus datos ---------- */
  m.escena('Sus datos');
  m.rotulo('Aseguradora · paso 3', 'NIT y domicilio de la casa matriz.', 4.0);
  await m.escribir(campo('NIT').locator('input'), '1028495023', { cps: 22 });
  await m.escribir(campo('Dirección').locator('input'), 'Av. San Martín 1250, Equipetrol, Santa Cruz', { cps: 30, apuntar: false });
  m.sostener(.8);
  await m.clic(siguiente(), { tras: 18 });

  /* ---------- 5 · la documentación legal ---------- */
  m.escena('La documentación legal');
  m.rotulo('Aseguradora · paso 4', 'Cuatro documentos legales, en PDF y obligatorios.', 2.9);
  const adjuntar = async (etiqueta, archivo) => {
    const ff = pg.locator('app-form-field').filter({ hasText: etiqueta }).first();
    await ff.scrollIntoViewIfNeeded().catch(() => {});
    await ff.locator('input[type="file"]').setInputFiles(join(DOCS, archivo));
    await m.animar(10);
  };
  await adjuntar('Escritura de constitución', 'escritura-constitucion.pdf');
  await adjuntar('Certificado de NIT', 'certificado-nit.pdf');
  await adjuntar('Matrícula de comercio', 'matricula-seprec.pdf');
  await adjuntar('Licencia de funcionamiento municipal', 'licencia-municipal.pdf');
  m.sostener(1.2);
  await m.clic(siguiente(), { tras: 18 });
  m.rotulo('Aseguradora · paso 5', 'Y el certificado del SEDES.', 3.4);
  await adjuntar('Certificado del SEDES', 'autorizacion-aps.pdf');
  m.sostener(1.0);
  await m.clic(siguiente(), { tras: 18 });

  /* ---------- 6 · el usuario administrador ---------- */
  m.escena('El usuario administrador');
  m.rotulo('Aseguradora · paso 6', 'Cada nombre y cada apellido, en su propio campo.', 4.4);
  await m.escribir(campo('Nombre').first().locator('input'), 'Renata', { cps: 22 });
  await m.escribir(campo('Apellido paterno').locator('input'), 'Balcázar', { cps: 22, apuntar: false });
  await m.escribir(campo('Apellido materno').locator('input'), 'Ortiz', { cps: 22, apuntar: false });
  m.sostener(.6);
  await m.clic(siguiente(), { tras: 18 });
  m.rotulo('Aseguradora · paso 7', 'El acceso con el que va a entrar.', 3.8);
  await m.escribir(campo('Correo').locator('input'), 'renata.balcazar@seguroscordillera.bo', { cps: 30 });
  await m.escribir(campo('Contraseña').locator('input'), 'Cordillera2026*', { cps: 24, apuntar: false });
  m.sostener(.8);

  /* ---------- 7 · el alta ---------- */
  m.escena('La cuenta queda creada');
  m.rotulo('Aseguradora', 'Se crea la organización y su administrador, de una vez.', 4.4);
  await m.clic(pg.getByRole('button', { name: /Crear cuenta de la aseguradora/i }).first(), { tras: 34 });
  m.sostener(2.2);
  m.ocultarPuntero();
  m.sostener(.8);

    m.guardar();
  }
