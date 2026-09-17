/** El ejercicio completo de la aseguradora: su catálogo y coberturas, los corredores,
 *  lo presentado a cada compañía y el dictamen de una solicitud, ítem por ítem. */
import { crearMotor } from './motor.mjs';

export async function grabar({ navegador, base, dir }) {
  const m = crearMotor({ navegador, base, dir, flujo: 'aseguradora' });

  await m.sesion('admin@alovida.mock', 'Clínica Los Olivos');
  const pg = m.pagina;

  /* ---------- 1 · el catálogo y sus coberturas ---------- */
  m.escena('El catálogo de la aseguradora');
  await m.ir('/administration/insurance');
  m.rotulo('Aseguradora', 'La compañía, su registro ante el regulador y sus planes.', 4.0);
  m.sostener(1.6);
  m.rotulo('Aseguradora', 'Cada plan, prestación por prestación: cobertura, copago y tope.', 4.4);
  await m.desplazar(620, 1.6);
  m.sostener(1.8);
  await m.desplazar(1240, 1.4);
  m.sostener(1.6);

  /* ---------- 2 · la red y los corredores ---------- */
  m.escena('Los corredores');
  await m.ir('/administration/brokers');
  m.rotulo('Aseguradora', 'Los corredores, con su matrícula y su verificación.', 4.0);
  m.sostener(2.2);

  /* ---------- 3 · lo presentado a cada compañía ---------- */
  m.escena('Lo presentado a cada compañía');
  await m.ir('/administration/insurance-claims');
  m.rotulo('Aseguradora', 'Lo que se presentó, con lo que cada compañía aprobó.', 4.0);
  m.sostener(1.6);
  m.rotulo('Aseguradora', 'Se filtra por aseguradora y la tabla responde.', 3.8);
  const filtro = pg.locator('main select').first();
  await m.clic(filtro, { tras: 6 });
  await filtro.selectOption({ label: 'Seguros Andina S.A.' });
  await m.animar(20);
  m.sostener(1.4);
  await filtro.selectOption({ label: 'Todas las aseguradoras' });
  await m.animar(16);
  m.sostener(1.0);

  /* ---------- 4 · el dictamen, ítem por ítem ---------- */
  m.escena('El dictamen, ítem por ítem');
  await m.clic(pg.getByText('CLM-2026-0177').first(), { tras: 26 });
  m.rotulo('Aseguradora', 'Lo solicitado, lo aprobado y lo denegado, con su motivo.', 4.2);
  m.sostener(1.4);
  await m.desplazar(520, 1.4);
  m.sostener(2.0);

  /* ---------- 5 · reclamar sin borrar nada ---------- */
  m.escena('Reclamar sin borrar nada');
  m.rotulo('Aseguradora', 'El dictamen no se edita: el reclamo es una fila nueva.', 4.4);
  const reclamar = pg.getByRole('button', { name: /^Reclamar$/ }).first();
  if (await reclamar.count()) { await m.clic(reclamar, { tras: 26 }); m.sostener(2.0); }
  m.ocultarPuntero();
  m.sostener(.8);

    m.guardar();
  }
