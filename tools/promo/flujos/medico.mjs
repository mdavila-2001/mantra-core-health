/**
 * El ejercicio del médico: darse de alta de punta a punta —las trece páginas—,
 * aceptar la solicitud de un paciente, consultar el glosario, recorrer las guías
 * de clínicas e imagenología y armar una cotización sobre su propio catálogo.
 *
 * El diagnóstico y la consulta **no** están acá a propósito: son un ejercicio
 * aparte, con su propio video.
 *
 * **De dónde salen los datos.** El guion trae una profesional de ejemplo
 * inventada, y `PROMO_PERSONA=<ruta al .json>` la cambia por otra sin que esos
 * datos pasen por el repositorio. Las claves son las de `MEDICA_DE_EJEMPLO`.
 */
import { readFileSync } from 'node:fs';
import { crearMotor } from './motor.mjs';

const MEDICA_DE_EJEMPLO = {
  nombre: 'Lorena',
  segundo: 'Beatriz',
  apellidoPaterno: 'Peredo',
  apellidoMaterno: 'Arteaga',
  documento: '4102938',
  emitido: 'Santa Cruz',
  sexo: 'Femenino',
  nacimiento: '03/09/1986',
  celular: '70044556',
  correo: 'lorena.peredo@ejemplo.com',
  consultorio: 'Consultorio Dental Peredo',
  consultorioDireccion: 'Av. Cristo Redentor, 4.º anillo, Edificio Torre Sur, piso 3',
  titulo: 'Odont',
  tituloOpcion: /Odont[óo]logo/i,
  universidad: 'Universidad Autónoma Gabriel René Moreno',
  pais: 'Bolivia',
  ciudad: 'Santa Cruz de la Sierra',
  matricula: 'MP-7788',
  credencial: 'T.I. 101/15',
  especialidad: 'Odontología',
  clave: 'alovida2026',
};

function leerMedica() {
  const ruta = process.env.PROMO_PERSONA;
  if (!ruta) return MEDICA_DE_EJEMPLO;
  const leido = JSON.parse(readFileSync(ruta, 'utf8'));
  return { ...MEDICA_DE_EJEMPLO, ...(leido.medica ?? {}) };
}

export async function grabar({ navegador, base, dir, seco = false }) {
  const m = crearMotor({ navegador, base, dir, flujo: 'medico', seco });
  const d = leerMedica();
  /**
   * Graba un tramo suelto en vez del ejercicio entero.
   *
   * `PROMO_TRAMO=cotizaciones` salta el alta, la aceptación, el glosario y las
   * guías, y deja sólo la última escena con su cierre de marca. Sirve para
   * reemplazar ese tramo en un video ya aprobado —cuando la pantalla cambió—
   * sin volver a grabar los dos minutos anteriores, que siguen valiendo.
   */
  const soloCotizaciones = process.env.PROMO_TRAMO === 'cotizaciones';
  /* El rótulo va sobre la pantalla que describe y dura lo que ella dura: por eso
     se pone después de la acción, no antes, y siempre pegado a su `sostener`. */
  const mirar = (titulo, texto, seg) => { m.rotulo(titulo, texto, seg); m.sostener(seg); };

  /* ---------- 1 · el alta, las trece páginas ---------- */
  if (!soloCotizaciones) {
  await m.sesion(null);
  const pg = m.pagina;
  /* Unos componentes ponen el identificador de prueba sobre el `<input>` y otros
     sobre su envoltorio, así que se piden las dos formas y se toma la primera. */
  const campo = (id) => pg.locator(`input[data-testid="${id}"], [data-testid="${id}"] input`).first();
  const siguiente = pg.getByRole('button', { name: /Siguiente|Crear cuenta/i }).first();
  /* Cierra una página del alta: rotula lo que se llenó, lo sostiene y recién ahí
     avanza, para que los campos recién escritos duren lo que se tarda en leerlos. */
  const cerrarPagina = async (titulo, texto, quieto = 2.2) => {
    m.rotulo(titulo, texto, quieto);
    m.sostener(quieto);
    await m.clic(siguiente, { tras: 14 });
  };
  /* Una página opcional que se pasa de largo, sin rótulo: no hay nada que decir. */
  const saltar = async () => { m.sostener(.7); await m.clic(siguiente, { tras: 14 }); };
  const ESCRITO = { cps: 17 };

  m.escena('Crear tu cuenta');
  await m.ir('/auth/register');
  m.rotulo('Crear tu cuenta', 'Elegí «Médico» y date de alta vos mismo, con tu matrícula.', 2.2);
  m.sostener(2.2);
  m.cortar();
  await m.clic(pg.locator('.tipos__card').nth(1), { tras: 18 });
  m.sostener(.5);

  /* 1 · el nombre, cada parte en su casilla */
  await m.escribir(campo('registro-pro-nombre'), d.nombre, ESCRITO);
  await m.escribir(campo('registro-pro-segundo-nombre'), d.segundo, { ...ESCRITO, apuntar: false });
  await m.escribir(campo('registro-pro-apellido-paterno'), d.apellidoPaterno, ESCRITO);
  await m.escribir(campo('registro-pro-apellido-materno'), d.apellidoMaterno, { ...ESCRITO, apuntar: false });
  await cerrarPagina('Paso 1 de 13', 'Tu nombre completo, con cada nombre y cada apellido en su casilla.', 2.6);

  /* 2 · la cédula */
  await m.escribir(campo('registro-pro-documento'), d.documento, ESCRITO);
  await m.elegir(pg.getByTestId('registro-pro-departamento-ci').locator('select'), { label: d.emitido });
  await cerrarPagina('Paso 2 de 13', 'Tu cédula queda como tu documento oficial en la red.', 2.4);

  /* 3 · sexo y fecha */
  await m.elegir(pg.getByTestId('registration-practitioner-sex').locator('select'), { label: d.sexo });
  await m.pegar(pg.getByPlaceholder('DD/MM/AAAA'), d.nacimiento);
  await cerrarPagina('Paso 3 de 13', 'Unos datos tuyos, los mismos que figuran en tu documento.', 2.4);

  /* 4 · el contacto privado, que además es con lo que entra */
  await m.escribir(campo('registro-pro-celular-personal'), d.celular, ESCRITO);
  await m.escribir(campo('registro-pro-correo-personal'), d.correo, { cps: 24 });
  await cerrarPagina('Paso 4 de 13', 'Con tu correo personal vas a entrar a AloVida.', 2.6);

  /* 5 y 6 · el contacto del trabajo y el domicilio: opcionales */
  await saltar();
  await saltar();

  /* 7 · el consultorio propio */
  await m.escribir(campo('registration-practitioner-office-name'), d.consultorio, { cps: 22 });
  await m.escribir(campo('registration-practitioner-office-address'), d.consultorioDireccion, { cps: 26 });
  await cerrarPagina('Paso 7 de 13', 'Si atendés en tu propio consultorio, tus pacientes lo ven acá.', 2.6);

  /* 8 · el título profesional y dónde lo estudió */
  await m.escribir(pg.getByTestId('registro-pro-titulo').getByRole('combobox'), d.titulo, ESCRITO);
  await m.animar(14);
  await m.clic(pg.getByRole('option', { name: d.tituloOpcion }).first(), { tras: 16 });
  await m.escribir(campo('registro-pro-titulo-universidad'), d.universidad, { cps: 26 });
  await m.escribir(campo('registro-pro-titulo-pais'), d.pais, { ...ESCRITO, apuntar: false });
  await m.escribir(campo('registro-pro-titulo-ciudad'), d.ciudad, { cps: 24, apuntar: false });
  await cerrarPagina('Paso 8 de 13', 'Tu título sale del catálogo, y decís dónde lo estudiaste.', 2.8);

  /* 9 · la habilitación */
  await m.escribir(campo('registro-pro-matricula'), d.matricula, ESCRITO);
  await m.escribir(campo('registro-pro-credencial'), d.credencial, ESCRITO);
  await cerrarPagina('Paso 9 de 13', 'Tu matrícula y tu credencial son lo que te habilita a atender.', 2.6);

  /* 10 y 11 · respaldos y títulos: opcionales */
  await cerrarPagina('Paso 10 de 13', 'Podés adjuntar los respaldos ahora o cuando los tengas a mano.', 2.2);
  await saltar();

  /* 12 · las especialidades */
  await m.elegir(pg.locator('main select').first(), { label: d.especialidad });
  await cerrarPagina('Paso 12 de 13', 'Tus especialidades son lo que un paciente busca cuando te necesita.', 2.6);

  /* 13 · la contraseña y el alta */
  await m.escribir(campo('registro-pro-password'), d.clave, ESCRITO);
  m.rotulo('Paso 13 de 13', 'Lo último: tu contraseña, y tu cuenta queda creada.', 2.4);
  m.sostener(2.4);
  await m.clic(siguiente, { tras: 30 });
  /* Sin `catch`: si el alta no llegó a crear la cuenta, la grabación tiene que
     parar acá. Un video que muestra trece páginas llenas y sigue de largo sin la
     pantalla de «tu cuenta está lista» estaría afirmando algo que no pasó. */
  await pg.getByTestId('registro-exito').waitFor({ timeout: 20000 });
  await m.foto(1);
  mirar('Tu cuenta está lista', 'Desde acá ya podés recibir pacientes, cobrar y llevar tu agenda.', 3.2);
  }

  /* ---------- 2 · aceptar al paciente ---------- */
  /* La maqueta entra con sus cuentas de demostración: el alta de recién no crea
     una sesión, así que acá se entra con la de la médica que ya trae. */
  await m.sesion('medica@alovida.mock', 'Clínica Los Olivos');
  const ag = m.pagina;
  if (!soloCotizaciones) {
  m.escena('Aceptar al paciente');
  await m.ir('/schedule');
  mirar('Tus consultas', 'Motivo, seguro, estado y pago de cada consulta, en la misma fila.', 3.0);
  /* La fila que espera respuesta: se busca por su estado, no por su posición. */
  const solicitada = ag.locator('tbody tr').filter({ hasText: 'Solicitada' }).first();
  await m.desplazar(420, 1.1);
  await m.clic(solicitada.getByRole('button', { name: /Aceptar solicitud/i }).first(), { tras: 30 });
  await ag.locator('tbody tr').filter({ hasText: 'Confirmada' }).first().waitFor({ timeout: 15000 });
  mirar('Aceptar al paciente', 'Aceptás la solicitud y la consulta queda confirmada para los dos.', 3.4);

  /* ---------- 3 · el glosario ---------- */
  m.escena('El glosario');
  await m.ir('/glossary');
  mirar('El glosario', 'Una enciclopedia de términos clínicos, explicados también en palabras simples.', 3.2);
  await m.escribir(ag.getByLabel(/Buscar un término/i).first(), 'Taquicardia', { cps: 18 });
  await m.animar(22);
  m.sostener(2.4);

  /* ---------- 4 · las guías ---------- */
  m.escena('Los directorios');
  await m.ir('/directories');
  mirar('Los directorios', 'Desde acá encontrás clínicas, hospitales, laboratorios e imagenología.', 2.6);
  m.cortar();
  await m.clic(ag.getByRole('link', { name: /Directorio de clínicas/i }).first(), { tras: 26 });
  await m.clic(ag.locator('[aria-label="Santa Cruz"]').first(), { tras: 26 });
  mirar('Clínicas y hospitales', 'Tocá un departamento y la guía te muestra lo que hay ahí.', 3.2);
  /* De una guía a la otra se VUELVE por la portada, no se salta por URL: si no,
     el segundo directorio aparece de la nada, sin que nadie lo haya abierto. */
  await m.desplazar(0, .7);
  m.cortar();
  await m.clic(ag.getByRole('link', { name: 'Directorios', exact: true }).first(), { tras: 22 });
  m.sostener(.6);
  m.cortar();
  await m.clic(ag.getByRole('link', { name: /Directorio de laboratorios/i }).first(), { tras: 26 });
  m.cortar();
  await m.clic(ag.locator('main').getByText(/Imagenología diagnóstica/i).first(), { tras: 26 });
  mirar('Imagenología', 'Rayos, ecografía, tomografía: a dónde mandás a tu paciente y qué ofrecen.', 3.4);
  }

  /* ---------- 5 · servicios y cotizaciones ---------- */
  m.escena('Servicios y cotizaciones');
  await m.ir('/my-services');
  mirar('Tus servicios', 'Lo que ofrecés y su precio de referencia, propio de cada práctica.', 3.2);
  await m.ir('/my-quotations/new');
  /* Los buscadores de esta pantalla son `app-search-field`: el `placeholder` cae
     en el host y no en el `<input>`, así que hay que bajar al control. Y no
     despliegan opciones: contestan con una TABLA, y se elige con el «Elegir» de
     la fila. Un clic al primer «Elegir» de la página se iba a la de al lado. */
  const buscar = (que) => ag.locator(`app-search-field[placeholder*="${que}"] input`).first();
  /* El «Elegir» de una fila viene de dos formas según la tabla: en el formulario
     dice a quién elige —«Elegir: Ana Lucía Pérez Quiroga»— y en la lista es sólo
     «Elegir». Se aceptan las dos, y la segunda se acota a su fila: un clic al
     primer «Elegir» de la página elegía la fila de la tabla de al lado. */
  const elegirEn = (texto) => ag.getByRole('button', { name: `Elegir: ${texto}` })
    .or(ag.locator('tr').filter({ hasText: texto }).getByRole('button', { name: /^Elegir$/ }))
    .first();

  await m.escribir(buscar('paciente'), 'Ana Lucía', { cps: 18 });
  await m.animar(22);
  await m.clic(elegirEn('Ana Lucía Pérez Quiroga'), { tras: 22 });
  await m.pegar(ag.locator('input[placeholder="DD/MM/AAAA"]').first(), '25/09/2026');
  mirar('Una cotización', 'Buscás al paciente por su nombre o su código y lo elegís.', 3.0);
  await m.desplazar(430, 1.1);
  await m.clic(elegirEn('Consulta cardiológica'), { tras: 24 });
  mirar('Una cotización', 'El tratamiento sale de tu catálogo, con su precio de referencia.', 3.2);

  /* El plan de pagos: sin interés, y armado a la medida de la persona. Se pone
     un anticipo y unas cuotas, y el plan se dibuja solo; después cada cuota se
     puede cambiar a mano, sacar o agregar. */
  await m.desplazar(760, 1.2);
  await m.escribir(ag.getByTestId('quotation-form-down-payment'), '50', { cps: 6, limpiar: true });
  await m.escribir(ag.getByTestId('quotation-form-installment-count'), '4', { cps: 6, limpiar: true });
  await m.animar(22);
  mirar('El plan de pagos', 'Sin interés: ponés un anticipo y las cuotas, y el plan se arma solo.', 3.6);
  await m.desplazar(1080, 1.2);
  await m.clic(ag.getByTestId('quotation-form-add-installment'), { tras: 26 });
  mirar('El plan de pagos', 'Y lo acomodás a la persona: cambiás una cuota, la sacás o agregás otra.', 3.8);

  /* La oferta tiene vencimiento, y sin él «Guardar» no se habilita. */
  await m.pegar(ag.locator('input[placeholder="DD/MM/AAAA"]').last(), '31/10/2026');
  await m.clic(ag.getByTestId('quotation-form-save'), { tras: 32 });
  /* Guardar devuelve a la lista, que nace vacía: las cotizaciones se piden por
     paciente. Así que se lo busca, y ahí está la que se acaba de crear. Sin
     `catch`: si no aparece, no se guardó y no hay nada que mostrar. */
  await m.escribir(buscar('paciente'), 'Ana Lucía', { cps: 18 });
  await m.animar(20);
  await m.clic(elegirEn('Ana Lucía Pérez Quiroga'), { tras: 26 });
  await ag.locator('main').getByText(/Consulta cardiol[óo]gica/i).first().waitFor({ timeout: 15000 });
  mirar('Una cotización', 'Queda guardada entre las del paciente, con su precio y su vencimiento.', 3.6);

  m.ocultarPuntero();
  m.sostener(1.0);
  m.guardar();
}
