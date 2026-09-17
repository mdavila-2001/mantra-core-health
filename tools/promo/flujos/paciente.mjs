/** El ejercicio completo del paciente: crear la cuenta, pedir turno, ver la cita,
 *  mirar sus resultados y seguir su receta hasta la farmacia. */
import { crearMotor } from './motor.mjs';

export async function grabar({ navegador, base, dir }) {
  const m = crearMotor({ navegador, base, dir, flujo: 'paciente' });

  /* ---------- 1 · crear la cuenta ---------- */
  await m.sesion(null);
  m.escena('Crear la cuenta');
  await m.ir('/auth/register');
  m.rotulo('Paciente', 'Cinco tipos de cuenta: la primera es la suya.', 3.4);
  const pg = m.pagina;
  await m.clic(pg.locator('.tipos__card').first(), { tras: 18 });
  m.sostener(.5);

  m.rotulo('Paciente · registro', 'Cada nombre y cada apellido, en su propio campo.', 4.4);
  /* el layout separa primer, segundo y tercer nombre, y los dos apellidos: se llenan separados */
  await m.escribir(pg.locator('main input').nth(0), 'María');
  await m.escribir(pg.locator('main input').nth(1), 'Fernanda', { apuntar: false });
  await m.escribir(pg.locator('main input').nth(3), 'Áñez');
  await m.escribir(pg.locator('main input').nth(4), 'Suárez', { apuntar: false });
  m.sostener(.7);
  await m.clic(pg.getByRole('button', { name: /Siguiente|Continuar/i }).or(pg.locator('button[type="submit"]')).first(), { tras: 16 });
  m.sostener(.6);
  m.rotulo('Paciente · registro', 'Diez pasos, y el asistente dice en cuál va.', 3.4);
  m.sostener(1.4);

  /* ---------- 2 · pedir el turno ---------- */
  await m.sesion('paciente@alovida.mock');
  const pac = m.pagina;
  m.escena('Pedir el turno');
  await m.ir('/my-account/appointments?seccion=pedir');
  m.rotulo('Paciente', 'Busca al profesional por su nombre.', 3.6);
  await m.escribir(pac.locator('main input[type="text"], main input:not([type])').first(), 'Rojas');
  await m.animar(14);
  await m.clic(pac.locator('main').getByText('Valeria Rojas Mendoza').first(), { tras: 20 });
  m.sostener(.8);
  m.rotulo('Paciente', 'Elige sede y pide el horario que le sirve.', 3.8);
  await m.clic(pac.getByRole('link', { name: /Pedir este horario/i }).first(), { tras: 22 });
  m.sostener(1.2);

  /* ---------- 3 · la cita queda pedida ---------- */
  m.escena('La cita, con su estado');
  await m.ir('/my-account/appointments');
  m.rotulo('Paciente', 'Queda pedida: el estado se lee en palabras.', 3.6);
  m.sostener(1.6);

  /* ---------- 4 · resultados ---------- */
  m.escena('Sus resultados');
  await m.ir('/my-account/diagnostic-results');
  m.rotulo('Paciente', 'Sólo lo que un profesional ya firmó y liberó.', 3.8);
  m.sostener(1.8);

  /* ---------- 5 · la receta en la farmacia ---------- */
  m.escena('La receta, en la farmacia');
  await m.ir('/my-account/pharmacy-orders');
  m.rotulo('Paciente', 'Y el pedido de farmacia, del envío al retiro.', 3.8);
  m.sostener(1.0);
  const pedido = pac.locator('main').getByText(/Listo para retirar/).first();
  if (await pedido.count()) { await m.clic(pedido, { tras: 20 }); m.sostener(1.6); }
  m.ocultarPuntero();
  m.sostener(.8);

    m.guardar();
  }
