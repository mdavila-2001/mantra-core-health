/** El ejercicio completo del médico: recibir al paciente, atenderlo, dejar el
 *  diagnóstico y la receta, y cerrar el cobro. */
import { crearMotor } from './motor.mjs';

export async function grabar({ navegador, base, dir }) {
  const m = crearMotor({ navegador, base, dir, flujo: 'medico' });
  await m.sesion('medica@alovida.mock');
  const pg = m.pagina;

  /* ---------- 1 · la agenda del día ---------- */
  m.escena('La agenda del día');
  await m.ir('/schedule');
  m.rotulo('Médico', 'Motivo, seguro, estado y pago, en la misma fila.', 4.0);
  m.sostener(1.8);

  /* ---------- 2 · recibir al paciente ---------- */
  m.escena('Recibir al paciente');
  m.rotulo('Médico', 'Registra la llegada y el estado cambia solo.', 3.8);
  const llegada = pg.getByRole('button', { name: /Registrar llegada/i }).first();
  if (await llegada.count()) { await m.clic(llegada, { tras: 22 }); m.sostener(1.0); }

  /* ---------- 3 · atender ---------- */
  m.escena('Atender la consulta');
  const atender = pg.getByRole('button', { name: /Continuar consulta|Iniciar consulta/i }).first();
  await m.clic(atender, { tras: 26 });
  m.sostener(.8);
  m.rotulo('Médico', 'Todo lo que se registra, en una sola pantalla.', 4.0);
  m.sostener(1.4);

  /* ---------- 4 · el diagnóstico ---------- */
  m.escena('El diagnóstico');
  await m.clic(pg.locator('.consulta__casilla').filter({ hasText: 'Diagnóstico' }).first(), { tras: 24 });
  m.rotulo('Médico', 'Del catálogo CIE-10: es lo único obligatorio.', 4.2);
  m.sostener(.8);
  const caso = pg.getByText(/Hipertensión \(I10\)/).first();
  if (await caso.count()) { await m.clic(caso, { tras: 20 }); m.sostener(1.2); }
  const cerrar = pg.getByRole('button', { name: /^Cerrar$/ }).first();
  if (await cerrar.count()) { await m.clic(cerrar, { tras: 16 }); }

  /* ---------- 5 · la receta ---------- */
  m.escena('La receta');
  await m.clic(pg.locator('.consulta__casilla').filter({ hasText: 'Receta' }).first(), { tras: 24 });
  m.rotulo('Médico', 'Prescribir, firmar y emitir, desde el mismo lugar.', 4.0);
  m.sostener(1.8);
  const cerrar2 = pg.getByRole('button', { name: /^Cerrar$/ }).first();
  if (await cerrar2.count()) { await m.clic(cerrar2, { tras: 14 }); }

  /* ---------- 6 · el cobro ---------- */
  m.escena('El cobro');
  await m.ir('/schedule');
  m.rotulo('Médico', 'El estado del pago se marca sin salir de la agenda.', 4.2);
  await m.clic(pg.locator('tbody').getByRole('button', { name: /pago/i }).nth(1), { tras: 16 });
  const pagada = pg.locator('app-menu.menu--open .menu-item').filter({ hasText: /^\s*Pagada\s*$/ }).first();
  if (await pagada.count()) { await m.clic(pagada, { tras: 24 }); } 
  m.sostener(1.6);
  m.ocultarPuntero();
  m.sostener(.8);

    m.guardar();
  }
