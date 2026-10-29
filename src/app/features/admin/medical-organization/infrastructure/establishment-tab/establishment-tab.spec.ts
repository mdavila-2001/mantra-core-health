import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from '../../../../../core/mock/fixtures/agenda';
import { infraHttp } from '../testing/infra-test-http';
import { CapacityFormDialog } from './capacity-form-dialog';
import { EstablishmentTab } from './establishment-tab';
import { RegulatoryFormDialog } from './regulatory-form-dialog';

const SAN_LUCAS = { id: SITIO_SANLUCAS.id, code: 'SANLUCAS', name: 'Hospital San Lucas' };
const OLIVOS = { id: SITIO_OLIVOS.id, code: 'OLIVOS-C', name: 'Clínica Los Olivos' };
const CONSULTORIO = { id: SITIO_CONSULTORIO.id, code: 'ROJAS', name: 'Consultorio Dra. Rojas' };

describe('EstablishmentTab', () => {
  async function montar(sitio: typeof SAN_LUCAS, usuario: 'superadmin' | 'medica' = 'superadmin') {
    const http = infraHttp(usuario);
    TestBed.configureTestingModule({ providers: [...http.providers, provideRouter([])] });
    const fixture = TestBed.createComponent(EstablishmentTab);
    fixture.componentRef.setInput('sites', [sitio]);
    await estable(fixture);
    return { fixture, peticiones: http.peticiones };
  }

  async function estable(f: ComponentFixture<unknown>): Promise<void> {
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  }

  const el = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
  const q = (f: ComponentFixture<unknown>, testId: string): HTMLElement | null => el(f).querySelector(`[data-testid="${testId}"]`);
  const texto = (f: ComponentFixture<unknown>, testId: string): string => q(f, testId)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const pestana = async (f: ComponentFixture<unknown>, i: number): Promise<void> => {
    (el(f).querySelectorAll('[role="tab"]')[i] as HTMLElement).click();
    await estable(f);
  };

  it('es UNA tarjeta con tres pestañas: datos regulatorios, habilitaciones y capacidad', async () => {
    const { fixture } = await montar(SAN_LUCAS);
    expect(el(fixture).querySelectorAll('app-card')).toHaveLength(1);
    expect(Array.from(el(fixture).querySelectorAll('[role="tab"]')).map((t) => t.textContent!.trim())).toEqual([
      'Datos regulatorios',
      'Habilitaciones',
      'Capacidad',
    ]);
  });

  it('muestra los datos de Bolivia: SNIS verificado, subsector, nivel, tipología, red y SEDES', async () => {
    const { fixture } = await montar(SAN_LUCAS);
    const t = texto(fixture, 'regulatorio-datos');
    expect(t).toContain('DEMO-SNIS-0001');
    expect(t).toContain('Verificado por la plataforma');
    expect(t).toContain('Hospital de tercer nivel');
    expect(t).toContain('Red Santa Cruz Norte');
    expect(t).toContain('Santa Cruz');
  });

  it('un SNIS sin verificar se dice así', async () => {
    const { fixture } = await montar(OLIVOS);
    expect(texto(fixture, 'regulatorio-datos')).toContain('Sin verificar');
  });

  it('quien sólo lee ve los datos y la nota de que los registra la organización; sin botón de editar', async () => {
    const { fixture } = await montar(SAN_LUCAS, 'medica');
    expect(texto(fixture, 'regulatorio-datos')).toContain('DEMO-SNIS-0001');
    expect(q(fixture, 'regulatorio-editar')).toBeNull();
    expect(texto(fixture, 'regulatorio-solo-lectura')).toContain('SEDES');
  });

  it('habilitaciones: la guardada como vigente que venció ayer se lee «Vencida»', async () => {
    const { fixture } = await montar(SAN_LUCAS);
    await pestana(fixture, 1);
    const filas = Array.from(el(fixture).querySelectorAll('[data-testid="habilitaciones"] tbody tr'));
    expect(filas).toHaveLength(3);
    const vencida = filas.find((f) => f.textContent!.includes('RA-0112/2024'))!;
    expect(vencida.getAttribute('data-estado')).toBe('LIC_EXPIRED');
    expect(vencida.textContent).toContain('Vencida');
    expect(vencida.textContent).toContain('Quirófanos');
  });

  it('S3 de habilitaciones: ofrece «Registrar la primera habilitación»', async () => {
    const { fixture } = await montar(CONSULTORIO);
    await pestana(fixture, 1);
    expect(q(fixture, 'habilitaciones-vacio')).not.toBeNull();
    expect(q(fixture, 'habilitacion-primera')!.textContent).toContain('Registrar la primera habilitación');
  });

  it('capacidad: la real se cuenta del árbol y la diferencia con la declarada se dice sin corregir nada', async () => {
    const { fixture } = await montar(SAN_LUCAS);
    await pestana(fixture, 2);
    const fila = (tipo: string): HTMLElement => el(fixture).querySelector(`[data-tipo="${tipo}"]`) as HTMLElement;
    const camas = fila('CAP_BEDS_CENSABLE');
    expect(camas.textContent!.replace(/\s+/g, ' ')).toContain('10');
    expect(camas.querySelector('[data-testid="capacidad-real"]')!.textContent!.trim()).toBe('4');
    expect(camas.textContent).toContain('-6 respecto de lo declarado');
    expect(fila('CAP_OPERATING_ROOMS').textContent).toContain('Coincide');
    // Los quirófanos: dos activos y uno planificado, que no cuenta.
    expect(fila('CAP_OPERATING_ROOMS').querySelector('[data-testid="capacidad-real"]')!.textContent!.trim()).toBe('2');
  });

  it('capacidad: lo que la tipología exige y falta es una advertencia, no un bloqueo', async () => {
    const { fixture } = await montar(SAN_LUCAS);
    await pestana(fixture, 2);
    // El hospital de San Lucas tiene los tres espacios requeridos: sin advertencia.
    expect(q(fixture, 'capacidad-faltantes')).toBeNull();
  });

  it('S3 de capacidad: sin declaración, el vacío ofrece «Declarar capacidad»', async () => {
    const { fixture } = await montar(CONSULTORIO);
    await pestana(fixture, 2);
    expect(q(fixture, 'capacidad-vacio')).not.toBeNull();
    expect(q(fixture, 'capacidad-declarar-primera')!.textContent).toContain('Declarar capacidad');
  });

  it('declarar capacidad la agrega con su corte y la tabla la muestra tras releer', async () => {
    const { fixture, peticiones } = await montar(SAN_LUCAS);
    await pestana(fixture, 2);
    (q(fixture, 'capacidad-declarar') as HTMLButtonElement).click();
    await estable(fixture);
    const dialogo = fixture.debugElement.query((d) => d.componentInstance instanceof CapacityFormDialog).componentInstance as CapacityFormDialog;
    const form = (dialogo as unknown as { form: FormGroup }).form;
    form.patchValue({ capacityKindCode: 'CAP_DELIVERY_ROOMS', quantity: 3, resolutionNumber: 'RA-0999/2026' });
    (dialogo as unknown as { guardar(): void }).guardar();
    await estable(fixture);
    expect(peticiones.find((p) => p.url.endsWith('/declared-capacities'))!.status).toBe(201);
    const partos = el(fixture).querySelector('[data-tipo="CAP_DELIVERY_ROOMS"]')!;
    expect(partos.textContent!.replace(/\s+/g, ' ')).toContain('3');
    expect(partos.textContent).toContain('RA-0999/2026');
    expect(partos.textContent).toContain('-2 respecto de lo declarado');
  });

  it('cambiar a una tipología que los espacios incumplen lista cada espacio con enlace y no cambia nada', async () => {
    const { fixture } = await montar(SAN_LUCAS);
    (q(fixture, 'regulatorio-editar') as HTMLButtonElement).click();
    await estable(fixture);
    const dialogo = fixture.debugElement.query((d) => d.componentInstance instanceof RegulatoryFormDialog).componentInstance as RegulatoryFormDialog;
    (dialogo as unknown as { form: FormGroup }).form.patchValue({ typologyCode: 'TYPOLOGY_HEALTH_POST' });
    (dialogo as unknown as { guardar(): void }).guardar();
    await estable(fixture);
    const lista = q(fixture, 'regulatorio-conflictos')!;
    expect(lista.querySelectorAll('li').length).toBeGreaterThan(3);
    expect(lista.textContent).toContain('Quirófano 1');
    expect(lista.querySelector('a')!.getAttribute('href')).toContain('/administration/medical-organization/spaces/');
    expect(texto(fixture, 'regulatorio-datos')).toContain('Hospital de tercer nivel');
  });

  it('un SNIS ajeno ya verificado da un error genérico', async () => {
    const { fixture } = await montar(OLIVOS);
    (q(fixture, 'regulatorio-editar') as HTMLButtonElement).click();
    await estable(fixture);
    const dialogo = fixture.debugElement.query((d) => d.componentInstance instanceof RegulatoryFormDialog).componentInstance as RegulatoryFormDialog;
    (dialogo as unknown as { form: FormGroup }).form.patchValue({ snisCode: 'DEMO-SNIS-0001' });
    (dialogo as unknown as { guardar(): void }).guardar();
    await estable(fixture);
    const aviso = texto(fixture, 'infra-issue-alert');
    expect(aviso).toContain('no está disponible');
    expect(aviso).not.toContain('San Lucas');
  });

  it('un SNIS válido se guarda y la ficha lo muestra tras releer (versión + 1, sin verificar)', async () => {
    const { fixture, peticiones } = await montar(OLIVOS);
    (q(fixture, 'regulatorio-editar') as HTMLButtonElement).click();
    await estable(fixture);
    const dialogo = fixture.debugElement.query((d) => d.componentInstance instanceof RegulatoryFormDialog).componentInstance as RegulatoryFormDialog;
    (dialogo as unknown as { form: FormGroup }).form.patchValue({ snisCode: 'DEMO-SNIS-7777', municipalityName: 'Cotoca' });
    (dialogo as unknown as { guardar(): void }).guardar();
    await estable(fixture);
    const envio = peticiones.find((p) => p.method === 'PATCH' && p.url.endsWith('/regulatory'))!;
    expect(envio.ifMatch).toBe('2');
    expect(envio.body).toEqual({ snisCode: 'DEMO-SNIS-7777', municipalityName: 'Cotoca' });
    expect(texto(fixture, 'regulatorio-datos')).toContain('Cotoca');
    expect(texto(fixture, 'regulatorio-datos')).toContain('DEMO-SNIS-7777');
  });
});
