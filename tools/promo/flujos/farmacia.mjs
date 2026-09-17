/** El ejercicio completo de la farmacia: la bandeja del mostrador, el pedido que
 *  llega con su receta electrónica, y la confirmación. */
import { crearMotor } from './motor.mjs';

export async function grabar({ navegador, base, dir }) {
  const m = crearMotor({ navegador, base, dir, flujo: 'farmacia' });
  await m.sesion('admin@alovida.mock', 'Clínica Los Olivos');
  const pg = m.pagina;

  /* ---------- 1 · la bandeja del mostrador ---------- */
  m.escena('La bandeja del mostrador');
  await m.ir('/administration/pharmacy-orders');
  m.rotulo('Farmacia', 'Lo que llega, lo que espera y lo que sale.', 4.0);
  m.sostener(2.0);

  /* ---------- 2 · el pedido que llegó ---------- */
  m.escena('El pedido que llegó');
  m.rotulo('Farmacia', 'Cada pedido trae su receta electrónica.', 3.8);
  await m.clic(pg.locator('main').getByText('Daniela Flores Cuéllar').first(), { tras: 26 });
  m.sostener(1.6);

  /* ---------- 3 · confirmarlo con lo que hay ---------- */
  m.escena('Confirmarlo con lo que hay');
  m.rotulo('Farmacia', 'Tal cual, un sustituto, o no disponible.', 4.0);
  const talCual = pg.getByText(/Tal cual/).first();
  if (await talCual.count()) { await m.clic(talCual, { tras: 16 }); m.sostener(.8); }
  const confirmar = pg.getByRole('button', { name: /Confirmar pedido/i }).first();
  if (await confirmar.count()) {
    m.rotulo('Farmacia', 'Se confirma y el paciente lo ve al instante.', 4.0);
    await m.clic(confirmar, { tras: 28 });
    m.sostener(1.8);
  }

  /* ---------- 4 · de vuelta a la bandeja ---------- */
  m.escena('De vuelta a la bandeja');
  const volver = pg.getByRole('button', { name: /Volver a la bandeja/i })
    .or(pg.getByRole('link', { name: /Volver a la bandeja/i })).first();
  if (await volver.count()) { await m.clic(volver, { tras: 24 }); }
  else { await m.ir('/administration/pharmacy-orders'); }
  m.rotulo('Farmacia', 'La columna del pedido cambió: el mostrador sigue el hilo.', 4.2);
  m.sostener(2.0);
  m.ocultarPuntero();
  m.sostener(.8);

    m.guardar();
  }
