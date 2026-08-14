import type { ProfesionalEnListado } from './profesionales-listado.types';

const PERFIL = '/buscar/perfil-profesional-detalle';

/**
 * Los cinco profesionales de la maqueta V65-02.
 *
 * **Son los mismos datos que ya estaban escritos a mano en el HTML portado**, no
 * unos nuevos: se movieron del marcado a un archivo tipado para que la pantalla
 * pueda recorrerlos con `@for` en vez de repetir la tarjeta cinco veces.
 *
 * ## Por qué siguen siendo de mentira
 *
 * `CommunityClient` ya existe y sabe leer perfiles públicos, pero sus endpoints
 * **no son públicos todavía** —cero `@Public()` en `community`— así que un
 * visitante sin sesión recibiría 401. Cuando eso entre, este archivo se
 * reemplaza por la llamada y la pantalla no cambia: ya recorre una lista.
 *
 * Se conservan los datos bolivianos de la maqueta —La Paz, Santa Cruz, aymara,
 * quechua— porque una pantalla poblada con «Lorem ipsum» no deja evaluar ni el
 * ancho de las columnas ni qué pasa cuando un nombre es largo.
 */
export const PROFESIONALES_DE_MUESTRA: readonly ProfesionalEnListado[] = [
  {
    resultado: {
      id: 'marisol-quispe-ticona',
      title: 'Dra. Marisol Quispe Ticona',
      link: PERFIL,
      figureText: 'MQ',
      kind: { label: 'Profesional', tone: 'info' },
      meta: [
        { text: 'Cardiología · 14 años' },
        { text: 'Clínica Los Olivos' },
        { text: 'Sopocachi · 1,2 km' },
        { text: 'Español, aymara' },
        { text: '4,8 · 312 opiniones' },
      ],
      seals: [
        { label: 'Verificado', tone: 'ok' },
        { label: 'Matrícula verificada', tone: 'ok' },
        { label: 'Presencial y virtual', tone: 'neutro' },
      ],
    },
    precio: 'Bs 250',
    precioNota: 'consulta',
    disponibilidad: 'Hoy 16:30',
    disponibilidadTono: 'ok',
  },
  {
    resultado: {
      id: 'ariel-mendoza-villarroel',
      title: 'Dr. Ariel Mendoza Villarroel',
      link: PERFIL,
      figureText: 'AM',
      kind: { label: 'Profesional', tone: 'info' },
      meta: [
        { text: 'Pediatría · 9 años' },
        { text: 'Hospital Arco Iris' },
        { text: 'Calacoto · 4,1 km' },
        { text: 'Español' },
        { text: '4,9 · 187 opiniones' },
      ],
      seals: [
        { label: 'Verificado', tone: 'ok' },
        { label: 'Matrícula verificada', tone: 'ok' },
        { label: 'Atiende a domicilio', tone: 'neutro' },
      ],
    },
    precio: 'Bs 300',
    precioNota: 'consulta',
    disponibilidad: 'Jue 09:00',
    disponibilidadTono: 'aviso',
  },
  {
    resultado: {
      id: 'nayra-condori-mamani',
      title: 'Dra. Nayra Condori Mamani',
      link: PERFIL,
      figureText: 'NC',
      kind: { label: 'Profesional', tone: 'info' },
      meta: [
        { text: 'Ginecología y obstetricia · 17 años' },
        { text: 'Clínica Los Olivos' },
        { text: 'Miraflores · 2,6 km' },
        { text: 'Español, quechua' },
        { text: '4,7 · 421 opiniones' },
      ],
      seals: [
        { label: 'Verificado', tone: 'ok' },
        { label: 'Matrícula verificada', tone: 'ok' },
        { label: 'Convenio BCS', tone: 'neutro' },
      ],
    },
    precio: 'Bs 280',
    precioNota: 'consulta',
    disponibilidad: 'Hoy 18:00',
    disponibilidadTono: 'ok',
  },
  {
    // El único sin verificar: sus sellos son `neutro` y `aviso`, no `ok`. Es lo
    // que la decisión D7 del plan tiene que resolver — qué se indexa de un
    // perfil declarado — y por eso conviene que la maqueta lo muestre.
    resultado: {
      id: 'rodrigo-ferrufino-anez',
      title: 'Dr. Rodrigo Ferrufino Áñez',
      link: PERFIL,
      figureText: 'RF',
      kind: { label: 'Profesional', tone: 'info' },
      meta: [
        { text: 'Traumatología · 6 años' },
        { text: 'Clínica Foianini' },
        { text: 'Equipetrol, Santa Cruz' },
        { text: 'Español' },
        { text: '4,4 · 58 opiniones' },
      ],
      seals: [
        { label: 'Declarado', tone: 'neutro' },
        { label: 'Verificación en trámite', tone: 'aviso' },
      ],
    },
    precio: 'Bs 350',
    precioNota: 'consulta',
    disponibilidad: 'Sin agenda abierta',
    disponibilidadTono: 'neutro',
  },
  {
    resultado: {
      id: 'elena-vaca-peredo',
      title: 'Dra. Elena Vaca Peredo',
      link: PERFIL,
      figureText: 'EV',
      kind: { label: 'Profesional', tone: 'info' },
      meta: [
        { text: 'Dermatología · 11 años' },
        { text: 'Consulta independiente' },
        { text: 'Atiende en línea' },
        { text: 'Español, inglés' },
        { text: '4,6 · 233 opiniones' },
      ],
      seals: [
        { label: 'Verificado', tone: 'ok' },
        { label: 'Matrícula verificada', tone: 'ok' },
        { label: 'Solo virtual', tone: 'neutro' },
      ],
    },
    precio: 'Bs 200',
    precioNota: 'teleconsulta',
    disponibilidad: 'Hoy 20:00',
    disponibilidadTono: 'ok',
  },
];
