/**
 * El ejercicio completo del paciente: crear la cuenta de punta a punta —las diez
 * páginas del alta, con cada dato en la casilla que el layout le da—, entrar,
 * pedir turno con un profesional del directorio, recorrer las guías y seguir su
 * receta hasta el pedido de farmacia.
 *
 * **De dónde salen los datos.** El guion trae una persona de ejemplo inventada.
 * Para grabar con los datos del registro del stakeholder se le pasa un archivo
 * aparte por `PROMO_PERSONA=<ruta al .json>`: esos datos son de personas reales
 * —cédula, celular, correo y domicilio— y por eso no viven en el repositorio.
 * El archivo tiene las mismas claves que `PERSONA_DE_EJEMPLO`, más `profesional`
 * para decir con quién se pide el turno.
 */
import { readFileSync } from 'node:fs';
import { crearMotor } from './motor.mjs';

const PERSONA_DE_EJEMPLO = {
  nombre: 'Camila',
  segundo: 'Andrea',
  apellidoPaterno: 'Vaca',
  apellidoMaterno: 'Ibáñez',
  documento: '8451207',
  emitido: 'Santa Cruz',
  nacimiento: '14/05/1998',
  sexo: 'Femenino',
  ocupacion: 'Estudiante',
  celular: '70011223',
  contactoNombre: 'Marta Ibáñez Rojas',
  contactoTelefono: '70998877',
  contactoRelacion: 'Madre',
  departamento: 'Santa Cruz',
  municipio: 'Santa Cruz de la Sierra',
  domicilio: 'Av. Banzer, 4.º anillo, calle Los Tajibos #212',
  correo: 'camila.vaca@ejemplo.com',
  clave: 'alovida2026',
  nit: '1023456789',
  razonSocial: 'Camila Vaca Ibáñez',
};

function leerPersona() {
  const ruta = process.env.PROMO_PERSONA;
  if (!ruta) return PERSONA_DE_EJEMPLO;
  return { ...PERSONA_DE_EJEMPLO, ...JSON.parse(readFileSync(ruta, 'utf8')) };
}

/**
 * Con quién se pide el turno. Por omisión, el odontólogo que la maqueta ya trae;
 * el archivo de `PROMO_PERSONA` puede nombrar a otro con la clave `profesional`.
 */
const PROFESIONAL_POR_OMISION = 'Marco Antonio Suárez Landívar';
/** El apellido alcanza para el buscador, y se ve escribir menos letras. */
const apellidoDe = (nombreCompleto) => nombreCompleto.split(' ').slice(-2, -1)[0] ?? nombreCompleto;

export async function grabar({ navegador, base, dir, seco = false }) {
  const m = crearMotor({ navegador, base, dir, flujo: 'paciente', seco });
  const p = leerPersona();
  const profesional = p.profesional ?? PROFESIONAL_POR_OMISION;

  /* ---------- 1 · el alta, las diez páginas ---------- */
  await m.sesion(null);
  const pg = m.pagina;
  /* Unos componentes ponen el identificador de prueba sobre el `<input>` y otros
     sobre su envoltorio —la lupa de ocupación—, así que se piden las dos formas. */
  const campo = (id) => pg.locator(`input[data-testid="${id}"], [data-testid="${id}"] input`).first();
  const siguiente = pg.getByRole('button', { name: /Siguiente|Crear cuenta/i }).first();
  /* El rótulo va sobre la pantalla que describe y dura lo que ella dura: por eso
     se pone después de la acción, no antes, y siempre pegado a su `sostener`. */
  const mirar = (titulo, texto, seg) => { m.rotulo(titulo, texto, seg); m.sostener(seg); };
  /**
   * Cierra una página del alta: rotula lo que se acaba de llenar, lo sostiene y
   * recién entonces avanza.
   *
   * El orden importa y costó una grabación entera. Con el rótulo puesto **antes**
   * de escribir, la página cambiaba mientras el rótulo seguía en pantalla —se leía
   * «paso 9 de 10» sobre la página 10— y, peor, los campos recién llenos duraban
   * un cuadro: el video corría más rápido de lo que se lee un formulario.
   */
  const cerrarPagina = async (titulo, texto, quieto = 2.4) => {
    m.rotulo(titulo, texto, quieto);
    m.sostener(quieto);
    await m.clic(siguiente, { tras: 16 });
  };
  /* Se teclea más despacio que en los otros ejercicios: acá lo que se muestra es
     el dato entrando en su casilla, y a 22 pulsaciones por segundo no se lee. */
  const ESCRITO = { cps: 15 };

  m.escena('Crear tu cuenta');
  await m.ir('/auth/register');
  m.rotulo('Crear tu cuenta', 'Elegí tu tipo de cuenta y creala vos mismo, en unos minutos.', 2.2);
  m.sostener(2.2);
  m.cortar();
  await m.clic(pg.locator('.tipos__card').first(), { tras: 18 });
  m.sostener(.5);

  /* página 1 · ¿Cómo te llamás? — cinco casillas, una por nombre y por apellido */
  await m.escribir(campo('registro-nombre'), p.nombre, ESCRITO);
  await m.escribir(campo('registro-segundo-nombre'), p.segundo, { ...ESCRITO, apuntar: false });
  await m.escribir(campo('registro-apellido-paterno'), p.apellidoPaterno, ESCRITO);
  await m.escribir(campo('registro-apellido-materno'), p.apellidoMaterno, { ...ESCRITO, apuntar: false });
  await cerrarPagina('Paso 1 de 10', 'Tu nombre completo, con cada nombre y cada apellido en su casilla.', 3.0);

  /* página 2 · el documento, que además es con lo que se entra */
  await m.escribir(campo('registro-documento'), p.documento, ESCRITO);
  await m.elegir(pg.locator('select').first(), { label: p.emitido });
  await cerrarPagina('Paso 2 de 10', 'Con tu cédula vas a entrar a AloVida: no tenés que recordar ningún usuario.', 2.8);

  /* página 3 · fecha, sexo y oficio */
  await m.pegar(pg.getByPlaceholder('DD/MM/AAAA'), p.nacimiento);
  await m.elegir(pg.locator('select').first(), { label: p.sexo });
  await m.escribir(campo('registro-ocupacion'), p.ocupacion.slice(0, 6), ESCRITO);
  await m.animar(12);
  const oficio = pg.getByRole('option', { name: new RegExp(p.ocupacion, 'i') }).first();
  if (await oficio.count()) await m.clic(oficio, { tras: 14 });
  await cerrarPagina('Paso 3 de 10', 'Tu fecha, tu sexo y tu oficio ajustan a tu medida las dosis y los controles.', 2.8);

  /* página 4 · el celular y a quién avisar */
  await m.escribir(campo('registro-telefono'), p.celular, ESCRITO);
  await m.escribir(campo('registro-tutor-nombre'), p.contactoNombre, { cps: 20 });
  await m.escribir(campo('registro-tutor-telefono'), p.contactoTelefono, { ...ESCRITO, apuntar: false });
  await m.elegir(pg.locator('select').first(), { label: p.contactoRelacion });
  await cerrarPagina('Paso 4 de 10', 'Tu celular para los avisos, y a quién llamamos si hace falta.', 2.8);

  /* página 5 · el domicilio: primero el departamento en el mapa, después la ciudad */
  await m.clic(pg.locator(`[aria-label="${p.departamento}"]`).first(), { tras: 20 });
  await m.elegir(pg.locator('[data-testid="registration-residence-municipio"] select'), { label: p.municipio });
  await m.escribir(campo('registro-domicilio-calle'), p.domicilio, { cps: 24 });
  await cerrarPagina('Paso 5 de 10', 'Tocá tu departamento en el mapa y elegí tu ciudad.', 3.2);

  /* páginas 6 y 7 · el trabajo, que es opcional y acá se deja vacío */
  await cerrarPagina('Paso 6 de 10', 'Dónde trabajás es opcional: completalo ahora o cuando quieras.', 2.4);
  await cerrarPagina('Paso 7 de 10', 'Tu lugar de trabajo va aparte, y también podés dejarlo para después.', 2.4);

  /* página 8 · el acceso */
  await m.escribir(campo('registro-correo'), p.correo, { cps: 22 });
  await m.escribir(campo('registro-password'), p.clave, ESCRITO);
  await cerrarPagina('Paso 8 de 10', 'Con tu correo recuperás tu cuenta y te llegan los avisos de tus turnos.', 2.8);

  /* página 9 · el seguro, opcional */
  await cerrarPagina('Paso 9 de 10', 'Declarando tu seguro no vas a pagar lo que ya está cubierto.', 2.4);

  /* página 10 · facturación y el botón que crea la cuenta */
  await m.escribir(campo('registro-nit'), p.nit, ESCRITO);
  await m.escribir(campo('registro-razon-social'), p.razonSocial, { cps: 22 });
  m.rotulo('Paso 10 de 10', 'Tu NIT queda guardado para cuando necesites factura.', 2.8);
  m.sostener(2.8);
  await m.clic(siguiente, { tras: 30 });
  /* Sin `catch`: si el alta no llegó a crear la cuenta, la grabación tiene que
     parar acá. Un video que muestra diez páginas llenas y sigue de largo sin la
     pantalla de «tu cuenta está lista» estaría afirmando algo que no pasó. */
  await pg.getByTestId('registro-exito').waitFor({ timeout: 20000 });
  await m.foto(1);
  mirar('Tu cuenta está lista', 'Desde acá ya podés pedir turnos, ver tu historia y seguir tus recetas.', 3.2);

  /* ---------- 2 · pedir el turno ---------- */
  /* La maqueta entra con sus cuentas de demostración: el alta de recién no crea
     una sesión, así que acá se entra con la del paciente que ya trae. */
  await m.sesion('paciente@alovida.mock');
  const ap = m.pagina;
  m.escena('Pedir tu turno');
  await m.ir('/my-account/appointments?seccion=pedir');
  await m.escribir(ap.getByPlaceholder('Buscá por nombre'), apellidoDe(profesional));
  await m.animar(18);
  mirar('Pedir tu turno', 'Buscá al profesional con el que te querés atender.', 2.0);
  await m.clic(ap.locator('main').getByText(profesional).first(), { tras: 22 });
  await m.desplazar(320, 1.0);
  mirar('Pedir tu turno', 'Mirá sus horarios libres, día por día, y elegí el que te sirve.', 2.4);
  m.cortar();
  await m.clic(ap.getByRole('link', { name: /Pedir este horario/i }).first(), { tras: 24 });
  m.sostener(.6);
  await m.escribir(ap.locator('main textarea').first(), 'Control y limpieza dental', { cps: 22 });
  await m.animar(10);
  mirar('Pedir tu turno', 'Contale qué te pasa: lo lee antes de atenderte.', 2.2);
  /* La reserva son dos pasos y así se graba: primero se retiene el cupo —queda
     guardado unos minutos— y recién después se confirma. */
  await m.clic(ap.getByRole('button', { name: /Retener el cupo/i }).first(), { tras: 30 });
  mirar('Pedir tu turno', 'Te guardamos el horario unos minutos mientras confirmás.', 2.6);
  await m.clic(ap.getByRole('button', { name: /Confirmar la reserva/i }).first(), { tras: 32 });
  mirar('Pedir tu turno', 'Confirmás, y el turno ya es tuyo.', 2.4);

  /* el turno queda en la lista: es el cambio de estado, no una pantalla dibujada */
  m.escena('Tus citas');
  await m.ir('/my-account/appointments');
  await m.escribir(ap.getByLabel(/Buscar en tus citas/i).first(), apellidoDe(profesional), { cps: 15 });
  await m.animar(20);
  await ap.locator('main').getByText('Control y limpieza dental').first().waitFor({ timeout: 10000 });
  mirar('Tus citas', 'Acá tenés todas tus citas, con su estado y la opción de cancelar.', 3.0);

  /* ---------- 3 · los directorios ---------- */
  m.escena('Los directorios');
  await m.ir('/directories');
  mirar('Los directorios', 'Desde acá encontrás médicos, laboratorios, clínicas y farmacias de la red.', 2.6);
  m.cortar();
  await m.clic(m.pagina.getByRole('link', { name: /Directorio de médicos/i }).first(), { tras: 24 });
  await m.desplazar(420, 1.3);
  mirar('Directorio de médicos', 'Elegí la especialidad que buscás y mirá quién atiende.', 3.0);
  /* De una guía a la otra se VUELVE por la portada, no se salta por URL. */
  await m.desplazar(0, .8);
  m.cortar();
  await m.clic(m.pagina.getByRole('link', { name: 'Directorios', exact: true }).first(), { tras: 24 });
  m.sostener(.8);
  m.cortar();
  await m.clic(m.pagina.getByRole('link', { name: /Directorio de clínicas/i }).first(), { tras: 26 });
  mirar('Directorio de clínicas', 'Clínicas, hospitales y centros de salud verificados.', 2.6);
  await m.clic(m.pagina.locator('[aria-label="Santa Cruz"]').first(), { tras: 26 });
  mirar('Directorio de clínicas', 'Tocá tu departamento y te mostramos sólo lo que tenés cerca.', 3.4);
  await m.desplazar(360, 1.2);
  m.sostener(1.0);

  /* ---------- 4 · la historia clínica ---------- */
  m.escena('Tu historia clínica');
  await m.ir('/my-account/medical-record');
  mirar('Tu historia clínica', 'Tus atenciones, tus recetas, tus alergias y tus estudios, en un solo lugar.', 2.8);
  await m.ir('/my-account/diagnostic-results');
  await m.desplazar(300, 1.1);
  mirar('Tus resultados', 'Tus estudios te llegan firmados, con su informe y su archivo para descargar.', 3.0);

  /* ---------- 5 · de la receta a la farmacia ----------
     El tramo de fármacos entero, sin saltos: la receta, dónde conseguirla, el
     pedido a la sucursal y el pedido ya enviado con su recorrido. */
  const far = m.pagina;
  m.escena('De la receta a la farmacia');
  await m.ir('/my-account/medical-record?seccion=recetas');
  mirar('Tus recetas', 'Lo que te recetaron, con la dosis y cómo tomar cada cosa.', 3.2);
  m.cortar();
  await m.clic(far.getByRole('link', { name: /Dónde comprarla/i })
    .or(far.getByRole('button', { name: /Dónde comprarla/i })).first(), { tras: 30 });
  m.sostener(.8);
  await m.desplazar(560, 1.3);
  mirar('Dónde comprarla', 'Te mostramos qué farmacias tienen todo lo tuyo, y dónde quedan.', 3.6);
  m.cortar();
  await m.clic(far.getByRole('button', { name: /^Enviar pedido$/i }).first(), { tras: 30 });
  mirar('Tu pedido', 'Revisás qué pedís, dónde lo retirás y cuánto te sale.', 2.8);
  m.cortar();
  await m.clic(far.getByRole('button', { name: /^Enviar pedido$/i }).first(), { tras: 34 });
  /* Sin `catch`: si el pedido no se creó, no hay nada que mostrar. */
  await far.locator('main').getByText(/Listo para retirar/i).first().waitFor({ timeout: 15000 });
  mirar('Tu pedido', 'Seguí tu pedido paso a paso, desde que lo enviás hasta que lo retirás.', 3.6);
  await m.desplazar(420, 1.3);
  m.sostener(1.6);
  await m.ir('/my-account/pharmacy-orders');
  mirar('Tus pedidos', 'Acá llevás todos tus pedidos, con su total y en qué anda cada uno.', 3.4);

  m.ocultarPuntero();
  m.sostener(1.0);
  m.guardar();
}
