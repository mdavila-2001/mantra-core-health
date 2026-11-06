import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ENTRADA_DE_ALERTAS_DEMO } from '../red-clinica.demo';
import { alertasDeApoyo, type AlertaDeApoyo } from '../red-clinica-alertas';
import { ALERTAS_A_LA_VISTA, RedClinicaAlertasLista } from './red-clinica-alertas-lista';

@Component({
  imports: [RedClinicaAlertasLista],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-red-clinica-alertas-lista
      [alertas]="alertas()"
      (nodoElegido)="elegidos.push($event)"
      (resaltar)="resaltados.push($event)"
    />
  `,
})
class Anfitrion {
  readonly alertas = signal<readonly AlertaDeApoyo[]>(alertasDeApoyo(ENTRADA_DE_ALERTAS_DEMO));
  readonly elegidos: string[] = [];
  readonly resaltados: (readonly string[])[] = [];
}

describe('RedClinicaAlertasLista', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let host: Anfitrion;
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const items = () => Array.from(el().querySelectorAll<HTMLButtonElement>('[data-testid="red-alerta"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('muestra las primeras alertas, la cuenta y cuántas son de prioridad alta', () => {
    expect(items()).toHaveLength(ALERTAS_A_LA_VISTA);
    const cabecera = el().querySelector('header')!.textContent!.replace(/\s+/g, ' ');
    expect(cabecera).toContain('Para revisar 7');
    expect(cabecera).toContain('3 de prioridad alta');
  });

  it('la prioridad se lee en texto, no sólo en color', () => {
    expect(items()[0].textContent).toContain('Prioridad alta');
    expect(items()[0].classList).toContain('alerta--alta');
  });

  it('«Ver las 7 alertas» despliega el resto', async () => {
    const ver = el().querySelector<HTMLButtonElement>('[data-testid="red-alertas-todas"]')!;
    expect(ver.textContent).toContain('Ver las 7 alertas');
    ver.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(items()).toHaveLength(7);
    expect(ver.getAttribute('aria-expanded')).toBe('true');
  });

  it('el clic lleva al nodo de la alerta', () => {
    items()[0].click();
    expect(host.elegidos).toEqual(['dx3']);
  });

  it('puntero o foco resaltan todos sus nodos; al salir, nada', () => {
    const estudio = items().find((b) => b.dataset['tipo'] === 'estudio-sin-resultado')!;
    estudio.dispatchEvent(new Event('mouseenter'));
    estudio.dispatchEvent(new Event('mouseleave'));
    estudio.dispatchEvent(new FocusEvent('focus'));
    expect(host.resaltados).toEqual([['e3', 'dx2'], [], ['e3', 'dx2']]);
  });

  it('el pie aclara que no sugieren diagnósticos', () => {
    expect(el().textContent).toContain('No sugieren ni descartan diagnósticos');
  });

  it('vacía, lo dice sin callejón', async () => {
    host.alertas.set([]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(items()).toHaveLength(0);
    expect(el().querySelector('[data-testid="red-alertas-vacio"]')?.textContent).toContain('Nada abierto');
    expect(el().querySelector('[data-testid="red-alertas-todas"]')).toBeNull();
  });
});
