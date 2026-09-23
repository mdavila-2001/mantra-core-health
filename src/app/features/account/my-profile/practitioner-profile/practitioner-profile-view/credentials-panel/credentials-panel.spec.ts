import { TestBed } from '@angular/core/testing';

import { CredentialsPanel } from './credentials-panel';
import type {
  EspecialidadVisible,
  FormacionVisible,
  IdiomaVisible,
  MatriculaVisible,
} from '../practitioner-profile-view.types';

const MATRICULA: MatriculaVisible = {
  id: 'lic-1',
  jurisdiccion: 'Nacional',
  numero: 'LIC-3',
  autoridad: 'Colegio Médico',
  estado: 'Verificada',
  sello: 'approved',
  hasta: new Date(2030, 5, 30),
};

const ESPECIALIDAD: EspecialidadVisible = {
  id: 'esp-1',
  nombre: 'Cardiología',
  certificada: true,
  alcance: '',
  desde: new Date(2015, 1, 1),
  hasta: null,
  estado: 'Pendiente',
  sello: 'in-review',
};

const FORMACION: FormacionVisible = {
  id: 'cr-1',
  tipo: 'Título de grado',
  numero: 'TIT-9',
  institucion: 'UMSA',
  desde: new Date(2010, 10, 1),
  hasta: null,
  estado: 'Verificada',
  sello: 'approved',
  vencida: false,
  fuenteVerificacion: 'https://registro.test/tit-9',
};

const IDIOMA: IdiomaVisible = {
  id: 'idi-1',
  nombre: 'Español',
  nivel: 'Nativo',
  interpreta: true,
};

/**
 * La pestaña «Credenciales» rehecha el 19/09/2026: rejilla de tarjetas con
 * ícono por clase y un filtro en vez de repetir la lista.
 *
 * El toast que reemplazó a la caja de ayuda lo lanza la ficha, no este panel
 * —acá se instanciaría con la pestaña cerrada—, y tiene su prueba allá.
 */
describe('CredentialsPanel', () => {
  function montar(
    over: {
      matriculas?: readonly MatriculaVisible[];
      especialidades?: readonly EspecialidadVisible[];
      formacion?: readonly FormacionVisible[];
      idiomas?: readonly IdiomaVisible[];
    } = {},
  ) {
    TestBed.configureTestingModule({ imports: [CredentialsPanel] });
    const fixture = TestBed.createComponent(CredentialsPanel);
    fixture.componentRef.setInput('matriculas', over.matriculas ?? [MATRICULA]);
    fixture.componentRef.setInput('especialidades', over.especialidades ?? [ESPECIALIDAD]);
    fixture.componentRef.setInput('formacion', over.formacion ?? [FORMACION]);
    fixture.componentRef.setInput('idiomas', over.idiomas ?? [IDIOMA]);
    fixture.detectChanges();
    return fixture;
  }

  function tarjetas(fixture: ReturnType<typeof montar>): readonly string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="credencial"]'),
    ].map((tarjeta) => tarjeta.getAttribute('data-kind') ?? '');
  }

  it('cada credencial es UNA tarjeta, con la clase que la identifica', () => {
    // Antes cada una aparecía dos veces: en la lista de su clase y otra vez en
    // la agrupación «Verificado»/«Declarado».
    const fixture = montar();

    expect(tarjetas(fixture)).toEqual(['license', 'specialty', 'education', 'language']);
    const texto = ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(texto.match(/Matrícula N\.º LIC-3/g) ?? []).toHaveLength(1);
  });

  it('la tarjeta de una especialidad no dice si es la principal (D-01)', () => {
    const fixture = montar({ matriculas: [], formacion: [], idiomas: [] });

    const tarjeta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="credencial"][data-kind="specialty"]',
    );
    const texto = (tarjeta?.textContent ?? '').replace(/\s+/g, ' ');
    expect(texto).toContain('Cardiología');
    expect(texto).toContain('Certificada por el consejo');
    expect(texto).not.toMatch(/principal/i);
  });

  it('el filtro corta el mismo conjunto, no repite la lista', () => {
    const fixture = montar();
    const raiz = fixture.nativeElement as HTMLElement;

    raiz
      .querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-verificadas"]')!
      .click();
    fixture.detectChanges();
    // Verificadas: la matrícula aprobada y el título con fuente. La
    // especialidad pendiente y el idioma —que no tramita nada— quedan afuera.
    expect(tarjetas(fixture)).toEqual(['license', 'education']);

    raiz
      .querySelector<HTMLButtonElement>('[data-testid="credenciales-filtro-declaradas"]')!
      .click();
    fixture.detectChanges();
    expect(tarjetas(fixture)).toEqual(['specialty', 'language']);
  });

  it('un idioma no lleva sello: no tramita nada', () => {
    const fixture = montar({ matriculas: [], especialidades: [], formacion: [] });
    const tarjeta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="credencial"]',
    );

    expect(tarjeta?.getAttribute('data-kind')).toBe('language');
    expect(tarjeta?.querySelector('app-status-seal')).toBeNull();
  });

  it('sin nada cargado explica qué falta, no una caja vacía', () => {
    const fixture = montar({ matriculas: [], especialidades: [], formacion: [], idiomas: [] });

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.credenciales__vacio')?.textContent,
    ).toContain('Todavía no cargaste credenciales');
  });
});
