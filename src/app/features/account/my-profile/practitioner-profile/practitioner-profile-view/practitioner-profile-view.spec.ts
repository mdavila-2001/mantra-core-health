import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PractitionerProfileView } from './practitioner-profile-view';
import type { PerfilProfesionalVisible } from './practitioner-profile-view.types';

/**
 * La vista del perfil profesional — presentacional pura (carril R2-4).
 *
 * Se prueba con **datos fijos, sin `HttpTestingController`**: la vista no
 * inyecta ningún cliente, así que sus pruebas tampoco. Eso es exactamente el
 * contrato que la guía de profesionales (R2-1) va a consumir.
 *
 * Lo que se fija:
 *
 * 1. **La jerarquía nueva**: portada elevada (única tarjeta `elevated`) y las
 *    credenciales agrupadas en tres pestañas, no apiladas.
 * 2. **`esPropio` decide las acciones**: el dueño ve los enlaces a las otras
 *    cuatro pantallas del perfil; un visitante no ve ningún botón.
 * 3. **Los casos vacíos hablan**: sin especialidades el texto lo dice, no
 *    queda una lista muda.
 */

const PERFIL: PerfilProfesionalVisible = {
  nombre: 'Dra. Lucía Salas',
  titulo: 'Médica cardióloga',
  especialidadPrincipal: 'Cardiología',
  codigo: 'MED-7',
  fotoUrl: null,
  verificacion: { label: 'Verificada', variant: 'approved' },
  estadoDePractica: 'En ejercicio',
  aceptaPacientesNuevos: true,
  telemedicina: true,
  bio: 'Quince años en cardiología clínica.',
  actividad: [
    { clave: 'encuentros', rotulo: 'Encuentros atendidos', valor: 12 },
    { clave: 'documentos', rotulo: 'Documentos publicados', valor: 2 },
  ],
  especialidades: [
    {
      id: 'sp-1',
      nombre: 'Cardiología',
      principal: true,
      certificada: true,
      alcance: '',
      desde: new Date('2015-03-01'),
      hasta: null,
      estado: 'Verificada',
    },
  ],
  formacion: [
    {
      id: 'cr-1',
      tipo: 'Título de grado',
      numero: 'TIT-9',
      institucion: 'UMSA',
      desde: new Date('2010-12-01'),
      hasta: null,
      estado: 'Verificada',
      sello: 'approved',
      vencida: false,
    },
  ],
  matriculas: [
    {
      id: 'li-1',
      jurisdiccion: 'Nacional',
      numero: 'LIC-3',
      autoridad: 'Colegio Médico',
      estado: 'Verificada',
      sello: 'approved',
      hasta: null,
    },
  ],
  idiomas: [{ id: 'idi-es', nombre: 'Español', nivel: '', interpreta: true }],
  perfilId: 'per-1',
  personaId: 'per-1',
  desde: new Date('2014-02-01'),
};

describe('PractitionerProfileView', () => {
  let fixture: ComponentFixture<PractitionerProfileView>;

  function montar(perfil: PerfilProfesionalVisible = PERFIL, esPropio = false): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(PractitionerProfileView);
    fixture.componentRef.setInput('perfil', perfil);
    fixture.componentRef.setInput('esPropio', esPropio);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('pinta la identidad completa en la portada', () => {
    const host = montar();

    const portada = host.querySelector('.profesional__portada');
    expect(portada?.textContent).toContain('Dra. Lucía Salas');
    expect(portada?.textContent).toContain('Médica cardióloga');
    expect(portada?.textContent).toContain('Cardiología');
    expect(portada?.textContent).toContain('MED-7');
    expect(portada?.textContent).toContain('En ejercicio');
  });

  /** La jerarquía: la portada es la ÚNICA tarjeta elevada de la pantalla. */
  it('la portada es la única tarjeta elevada', () => {
    const host = montar();

    const elevadas = host.querySelectorAll('app-card.card--elevated');
    expect(elevadas).toHaveLength(1);
    expect(elevadas[0].classList.contains('profesional__portada')).toBe(true);
  });

  /** Especialidades, formación y matrículas agrupadas, no apiladas. */
  it('agrupa las credenciales en tres pestañas', () => {
    const host = montar();

    const pestanas = Array.from(host.querySelectorAll('[role="tab"]')).map(
      (boton) => boton.textContent?.trim() ?? '',
    );
    expect(pestanas).toHaveLength(3);
    expect(pestanas[0]).toContain('Especialidades (1)');
    expect(pestanas[1]).toContain('Formación (1)');
    expect(pestanas[2]).toContain('Matrículas (1)');
  });

  it('la disponibilidad se dice con palabras', () => {
    const host = montar();

    expect(host.textContent).toContain('Acepta pacientes nuevos');
    expect(host.textContent).toContain('Atiende por telemedicina');
    expect(host.textContent).toContain('Español · interpreta en consulta');
  });

  /* -- esPropio ------------------------------------------------------------ */

  it('el dueño ve los enlaces a las otras cuatro pantallas del perfil', () => {
    const host = montar(PERFIL, true);

    const destinos = Array.from(host.querySelectorAll<HTMLAnchorElement>('a[app-button]')).map(
      (enlace) => enlace.getAttribute('href') ?? '',
    );
    expect(destinos).toContain('/my-account/edit');
    expect(destinos).toContain('/my-account/preview');
    expect(destinos).toContain('/my-account/articles');
    expect(destinos.some((destino) => destino.includes('trayectoria-laboral'))).toBe(true);
    expect(host.textContent).toContain('Tu actividad en la plataforma');
  });

  /** La ficha de un colega no ofrece configurar el perfil de otro. */
  it('un visitante no ve ninguna acción de dueño', () => {
    const host = montar(PERFIL, false);

    expect(host.querySelectorAll('a[app-button]')).toHaveLength(0);
    expect(host.textContent).toContain('Actividad en la plataforma');
    expect(host.textContent).not.toContain('Tu actividad');
  });

  /* -- Casos vacíos --------------------------------------------------------- */

  it('sin especialidades el caso vacío habla', () => {
    const host = montar({ ...PERFIL, especialidades: [] });

    expect(host.textContent).toContain('Todavía no hay especialidades registradas');
  });

  it('sin biografía no queda una tarjeta de presentación vacía', () => {
    const host = montar({ ...PERFIL, bio: '' });

    expect(host.textContent).not.toContain('Presentación');
  });
});
