import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { InfrastructureCatalogStore } from '../../../../core/data-access/infrastructure/infrastructure-catalog.store';
import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type {
  CareSpaceDetail,
  CareSpaceNode,
  InfrastructureCatalog,
  SiteStructure,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { uuid } from '../../../../core/mock/mock-store';
import { BulkCreateDialog } from './bulk-create-dialog/bulk-create-dialog';
import { CsvImportDialog } from './csv-import-dialog/csv-import-dialog';
import { RetireBlockersDialog } from './retire-blockers-dialog/retire-blockers-dialog';
import { SpaceFormDialog } from './space-form-dialog/space-form-dialog';
import { infraHttp } from './testing/infra-test-http';

const SAN_LUCAS = uuid('site-sanlucas');
const NORTE = uuid('site-sanlucas-norte');
const id = (c: string): string => uuid(`infra-sanlucas-${c}`);

const el = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
const q = (f: ComponentFixture<unknown>, testId: string): HTMLElement | null => el(f).querySelector(`[data-testid="${testId}"]`);
const texto = (f: ComponentFixture<unknown>, testId: string): string => q(f, testId)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

async function cargar(
  siteId: string,
  usuario: 'superadmin' | 'medica' = 'superadmin',
): Promise<{ structure: SiteStructure; catalog: InfrastructureCatalog; peticiones: ReturnType<typeof infraHttp>['peticiones'] }> {
  const http = infraHttp(usuario);
  TestBed.configureTestingModule({ providers: [...http.providers, provideRouter([])] });
  const client = TestBed.inject(InfrastructureClient);
  const structure = await new Promise<SiteStructure>((r) => client.getStructure(siteId).subscribe(r));
  const catalog = await new Promise<InfrastructureCatalog>((r) => TestBed.inject(InfrastructureCatalogStore).catalog().subscribe(r));
  return { structure, catalog, peticiones: http.peticiones };
}

async function estable(f: ComponentFixture<unknown>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

describe('SpaceFormDialog', () => {
  async function montar(opciones: { modo: 'create' | 'edit'; siteId?: string; padre?: string | null; espacio?: string }) {
    const base = await cargar(opciones.siteId ?? SAN_LUCAS);
    const nodo = (codigo: string): CareSpaceNode => base.structure.spaces.find((s) => s.code === codigo)!;
    const fixture = TestBed.createComponent(SpaceFormDialog);
    fixture.componentRef.setInput('mode', opciones.modo);
    fixture.componentRef.setInput('site', base.structure.site);
    fixture.componentRef.setInput('catalog', base.catalog);
    fixture.componentRef.setInput('units', base.structure.units);
    if (opciones.padre !== undefined && opciones.padre !== null) fixture.componentRef.setInput('parent', nodo(opciones.padre));
    if (opciones.espacio !== undefined) {
      const detalle = await new Promise<CareSpaceDetail>((r) => TestBed.inject(InfrastructureClient).getCareSpace(nodo(opciones.espacio!).id).subscribe(r));
      fixture.componentRef.setInput('space', detalle);
    }
    await estable(fixture);
    const form = (fixture.componentInstance as unknown as { form: FormGroup }).form;
    const submit = (): void => (fixture.componentInstance as unknown as { submit(): void }).submit();
    const paginas = (): { titulo: string; campos: { key: string; options?: { value: string }[] }[] }[] =>
      (fixture.componentInstance as unknown as { paginas(): never }).paginas() as never;
    return { fixture, form, submit, paginas, peticiones: base.peticiones };
  }

  it('bajo una habitación sólo se ofrece la cama; no hay nada que elegir y la forma queda puesta', async () => {
    const { form, paginas } = await montar({ modo: 'create', padre: 'HAB-301' });
    const forma = paginas()[0].campos.find((c) => c.key === 'formCode')!;
    expect(forma.options!.map((o) => o.value)).toEqual(['LOC_FORM_BED']);
    expect(form.controls['formCode'].value).toBe('LOC_FORM_BED');
  });

  it('las funciones salen del perfil de la forma: una cama ofrece camas, no quirófanos', async () => {
    const { paginas } = await montar({ modo: 'create', padre: 'HAB-301' });
    const funciones = paginas()[1].campos.find((c) => c.key === 'functionCode')!.options!.map((o) => o.value);
    expect(funciones).toContain('SPACE_FN_BED_STANDARD');
    expect(funciones).not.toContain('SPACE_FN_OPERATING_ROOM');
  });

  it('la tipología del establecimiento recorta las funciones (centro ambulatorio sin quirófano)', async () => {
    const { form, paginas } = await montar({ modo: 'create', siteId: NORTE, padre: null });
    form.controls['formCode'].setValue('LOC_FORM_ROOM');
    const funciones = paginas()[1].campos.find((c) => c.key === 'functionCode')!.options!.map((o) => o.value);
    expect(funciones).toContain('SPACE_FN_CONSULTING_ROOM');
    expect(funciones).not.toContain('SPACE_FN_OPERATING_ROOM');
  });

  it('las páginas de atributos aparecen según el perfil y ninguna pasa de cuatro campos', async () => {
    const { form, paginas } = await montar({ modo: 'create', padre: 'ED-A-P2' });
    form.controls['formCode'].setValue('LOC_FORM_ROOM');
    form.controls['functionCode'].setValue('SPACE_FN_OPERATING_ROOM');
    const titulos = paginas().map((p) => p.titulo);
    expect(titulos).toEqual(expect.arrayContaining(['Ambiente y climatización', 'Tiempos de quirófano']));
    expect(titulos).not.toContain('Cama');
    for (const p of paginas()) expect(p.campos.length).toBeLessThanOrEqual(4);
    // La superficie es obligatoria porque el PERFIL lo exige, no porque la pantalla sepa de quirófanos.
    expect(form.controls['areaM2'].hasError('required')).toBe(true);
  });

  it('crear manda sólo lo completado y vuelve la ficha por `saved`', async () => {
    const { fixture, form, submit, peticiones } = await montar({ modo: 'create', padre: 'ED-B-P1' });
    const guardados: CareSpaceDetail[] = [];
    fixture.componentInstance.saved.subscribe((d) => guardados.push(d));
    form.patchValue({ code: 'CONS-B77', name: 'Consultorio B77', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_CONSULTING_ROOM' });
    submit();
    await estable(fixture);
    const envio = peticiones.find((p) => p.method === 'POST' && p.url.endsWith('/care-spaces'))!;
    expect(envio.body).toEqual(expect.objectContaining({ code: 'CONS-B77', formCode: 'LOC_FORM_ROOM', parentSpaceId: id('ED-B-P1') }));
    expect(Object.keys(envio.body as object)).not.toContain('gln');
    expect(guardados).toHaveLength(1);
    expect(guardados[0].status.code).toBe('SPACE_PLANNED');
  });

  it('un código repetido se dice anclado al campo y no cierra el diálogo', async () => {
    const { fixture, form, submit } = await montar({ modo: 'create', padre: 'ED-B-P1' });
    const guardados: unknown[] = [];
    fixture.componentInstance.saved.subscribe((d) => guardados.push(d));
    form.patchValue({ code: 'CONS-B01', name: 'Repetido', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_CONSULTING_ROOM' });
    submit();
    await estable(fixture);
    expect(guardados).toEqual([]);
    expect(texto(fixture, 'infra-issue-alert')).toContain('code:');
    expect(texto(fixture, 'infra-issue-alert')).toContain('no se reutiliza');
    expect(texto(fixture, 'infra-issue-alert')).toContain('req-infra-');
  });

  it('un formulario inválido no sale a la red', async () => {
    const { fixture, submit, peticiones } = await montar({ modo: 'create', padre: 'ED-B-P1' });
    submit();
    await estable(fixture);
    expect(peticiones.filter((p) => p.method === 'POST')).toEqual([]);
  });

  it('editar un espacio activo deja el código y la forma de sólo lectura y manda If-Match', async () => {
    const { fixture, form, submit, peticiones } = await montar({ modo: 'edit', espacio: 'CONS-101' });
    expect(form.controls['code'].disabled).toBe(true);
    expect(form.controls['formCode'].disabled).toBe(true);
    form.patchValue({ name: 'Consultorio 101 (cardiología)' });
    submit();
    await estable(fixture);
    const envio = peticiones.find((p) => p.method === 'PATCH')!;
    expect(envio.ifMatch).toBe('1');
    expect(envio.body).toEqual(expect.not.objectContaining({ code: expect.anything() }));
    expect((envio.body as { name: string }).name).toBe('Consultorio 101 (cardiología)');
  });

  it('editar un planificado permite cambiar el código', async () => {
    const { form } = await montar({ modo: 'edit', espacio: 'QX-3' });
    expect(form.controls['code'].enabled).toBe(true);
  });

  it('una edición con la versión vieja da el conflicto de concurrencia (412) sin perder lo escrito', async () => {
    const { fixture, form, submit } = await montar({ modo: 'edit', espacio: 'CONS-102' });
    // Otra persona edita primero: la versión mostrada queda vieja.
    const api = TestBed.inject(InfrastructureClient);
    const actual = await new Promise<CareSpaceDetail>((r) => api.getCareSpace(id('CONS-102')).subscribe(r));
    await new Promise((r) => api.updateCareSpace(id('CONS-102'), actual.rowVersion, { name: 'Cambiado por otra persona' }).subscribe(r));
    form.patchValue({ name: 'Mi cambio' });
    submit();
    await estable(fixture);
    expect(texto(fixture, 'infra-issue-alert')).toContain('Otra persona cambió este dato');
    expect(form.controls['name'].value).toBe('Mi cambio');
  });
});

describe('BulkCreateDialog', () => {
  async function montar(codigoPadre = 'HAB-302') {
    const base = await cargar(SAN_LUCAS);
    const fixture = TestBed.createComponent(BulkCreateDialog);
    const padre = base.structure.spaces.find((s) => s.code === codigoPadre)!;
    fixture.componentRef.setInput('site', base.structure.site);
    fixture.componentRef.setInput('catalog', base.catalog);
    fixture.componentRef.setInput('parent', padre);
    fixture.componentRef.setInput('takenCodes', new Set(base.structure.spaces.map((s) => s.code)));
    await estable(fixture);
    const inst = fixture.componentInstance as unknown as { form: FormGroup; verVistaPrevia(): void; crear(): void; volver(): void };
    return { fixture, inst, peticiones: base.peticiones };
  }

  const llenar = (inst: { form: FormGroup }, codigo: string, nombre: string): void =>
    inst.form.patchValue({ formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', codePattern: codigo, namePattern: nombre });

  it('«Cama 301-A…H» muestra la vista previa con las ocho camas ANTES de crear nada', async () => {
    const { fixture, inst, peticiones } = await montar('HAB-301');
    llenar(inst, '301-{I..P}', 'Cama 301-{I..P}');
    inst.verVistaPrevia();
    await estable(fixture);
    expect(texto(fixture, 'masiva-resumen')).toContain('8 espacios');
    expect(el(fixture).querySelectorAll('tbody tr')).toHaveLength(8);
    expect(peticiones.filter((p) => p.method === 'POST')).toEqual([]);
  });

  it('un código que ya existe se marca y bloquea «Crear»', async () => {
    const { fixture, inst } = await montar('HAB-301');
    llenar(inst, '301-{A..C}', 'Cama 301-{A..C}');
    inst.verVistaPrevia();
    await estable(fixture);
    expect(texto(fixture, 'masiva-resumen')).toContain('2 con código ya usado');
    expect(q(fixture, 'masiva-crear')!.getAttribute('aria-disabled') === 'true' || (q(fixture, 'masiva-crear') as HTMLButtonElement).disabled).toBe(true);
  });

  it('un patrón inválido o de más de 200 no pasa a la vista previa', async () => {
    const { fixture, inst } = await montar();
    llenar(inst, 'X-{1..201}', 'X {1..201}');
    inst.verVistaPrevia();
    await estable(fixture);
    expect(texto(fixture, 'infra-issue-alert')).toContain('máximo por alta masiva es 200');
    expect(q(fixture, 'masiva-resumen')).toBeNull();
  });

  it('crear manda el patrón tal cual y devuelve las camas creadas', async () => {
    const { fixture, inst, peticiones } = await montar('HAB-302');
    const creadas: (readonly CareSpaceDetail[])[] = [];
    fixture.componentInstance.created.subscribe((c) => creadas.push(c));
    llenar(inst, '302-{C..F}', 'Cama 302-{C..F}');
    inst.verVistaPrevia();
    await estable(fixture);
    inst.crear();
    await estable(fixture);
    const envio = peticiones.find((p) => p.url.endsWith('/bulk'))!;
    expect(envio.body).toEqual(expect.objectContaining({ codePattern: '302-{C..F}', parentSpaceId: id('HAB-302') }));
    expect(creadas[0].map((c) => c.code)).toEqual(['302-C', '302-D', '302-E', '302-F']);
  });
});

describe('CsvImportDialog', () => {
  async function montar() {
    const base = await cargar(SAN_LUCAS);
    const fixture = TestBed.createComponent(CsvImportDialog);
    fixture.componentRef.setInput('site', base.structure.site);
    await estable(fixture);
    const inst = fixture.componentInstance as unknown as { texto: { set(v: string): void }; validar(): void; importar(): void };
    return { fixture, inst, peticiones: base.peticiones };
  }

  const CABECERA = 'code,name,formCode,functionCode,parentCode';
  const fila = (c: string, extra = ''): string => `${c},${c},LOC_FORM_ROOM,SPACE_FN_CONSULTING_ROOM,${extra || 'ED-B-P1'}`;

  it('muestra EXACTAMENTE las líneas con error, con la línea del archivo, el campo y el motivo', async () => {
    const { fixture, inst } = await montar();
    inst.texto.set([CABECERA, fila('CSV-1'), fila('CONS-B01'), fila('CSV-3', 'NO-EXISTE'), fila('CSV-4')].join('\n'));
    inst.validar();
    await estable(fixture);
    const lineas = Array.from(el(fixture).querySelectorAll('[data-testid="csv-error-fila"]')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent!.trim()),
    );
    expect(lineas.map((l) => l[0])).toEqual(['3', '4']);
    expect(lineas[0][1]).toBe('code');
    expect(lineas[1][1]).toBe('parentCode');
    expect(q(fixture, 'csv-importar')).toBeNull();
  });

  it('los problemas del archivo mismo (número mal escrito) salen en la tabla y no se manda nada al servidor', async () => {
    const { fixture, inst, peticiones } = await montar();
    inst.texto.set([`${CABECERA},areaM2`, `${fila('CSV-9')},abc`].join('\n'));
    inst.validar();
    await estable(fixture);
    expect(texto(fixture, 'csv-errores')).toContain('«abc» no es un número');
    expect(peticiones.some((p) => p.url.includes('/import'))).toBe(false);
  });

  it('con el archivo corregido: «Importar» aparece, manda las MISMAS filas con dryRun=false y avisa cuántas se crearon', async () => {
    const { fixture, inst, peticiones } = await montar();
    const importados: number[] = [];
    fixture.componentInstance.imported.subscribe((n) => importados.push(n));
    inst.texto.set([CABECERA, fila('CSV-A'), fila('CSV-B')].join('\n'));
    inst.validar();
    await estable(fixture);
    expect(q(fixture, 'csv-importar')).not.toBeNull();
    inst.importar();
    await estable(fixture);
    const llamadas = peticiones.filter((p) => p.url.includes('/import'));
    expect(llamadas.map((p) => p.url.split('?')[1])).toEqual(['dryRun=true', 'dryRun=false']);
    expect(llamadas[1].body).toEqual(llamadas[0].body);
    expect(importados).toEqual([2]);
  });

  it('cambiar el texto invalida la validación anterior: no se importa lo que no se validó', async () => {
    const { fixture, inst } = await montar();
    inst.texto.set([CABECERA, fila('CSV-C')].join('\n'));
    inst.validar();
    await estable(fixture);
    expect(q(fixture, 'csv-importar')).not.toBeNull();
    (fixture.componentInstance as unknown as { alCambiarTexto(v: string): void }).alCambiarTexto([CABECERA, fila('CSV-D')].join('\n'));
    await estable(fixture);
    expect(q(fixture, 'csv-importar')).toBeNull();
  });
});

describe('RetireBlockersDialog', () => {
  @Component({
    imports: [RetireBlockersDialog],
    template: `
      <app-retire-blockers-dialog
        spaceName="Habitación 302"
        spaceCode="HAB-302"
        [blockers]="blockers()"
        [asOf]="asOf"
        (recheck)="vueltas.set(vueltas() + 1)"
        (closed)="cerrado.set(true)"
      />
    `,
  })
  class Anfitrion {
    readonly blockers = signal([
      { kind: 'ACTIVE_CHILDREN' as const, count: 2, sampleIds: ['aaaa1111-0000-4000-8000-000000000001', 'bbbb2222-0000-4000-8000-000000000002'], nextAction: 'Clausure o mueva los 2 espacios hijos (302-A, 302-B).' },
      { kind: 'FUTURE_PROCEDURE' as const, count: 1, sampleIds: ['cccc3333-0000-4000-8000-000000000003'], nextAction: 'Reprogramar o cancelar la cirugía.' },
    ]);
    readonly asOf = new Date(Date.now() - 7 * 60_000).toISOString();
    readonly vueltas = signal(0);
    readonly cerrado = signal(false);
  }

  async function montar() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Anfitrion);
    await estable(fixture);
    return fixture;
  }

  it('lista TODOS los bloqueos, cada uno con su conteo y su próxima acción (S3)', async () => {
    const f = await montar();
    const items = el(f).querySelectorAll('[data-testid="bloqueo"]');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Espacios hijos vigentes');
    expect(items[0].textContent).toContain('Clausure o mueva');
    expect(items[1].textContent).toContain('Reprogramar');
  });

  it('los bloqueos de espacios enlazan a su ficha; los de otros módulos, no', async () => {
    const f = await montar();
    const enlaces = Array.from(el(f).querySelectorAll('[data-testid="bloqueo"]')[0].querySelectorAll('a'));
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].getAttribute('href')).toContain('/administration/medical-organization/spaces/aaaa1111');
    expect(el(f).querySelectorAll('[data-testid="bloqueo"]')[1].querySelectorAll('a')).toHaveLength(0);
  });

  it('dice la antigüedad de la comprobación (S7) y permite volver a comprobar', async () => {
    const f = await montar();
    expect(texto(f, 'bloqueos-antiguedad')).toContain('hace 7 min');
    (q(f, 'bloqueos-recomprobar') as HTMLButtonElement).click();
    expect(f.componentInstance.vueltas()).toBe(1);
  });

  it('no ofrece «Clausurar»: con bloqueos no hay nada que confirmar', async () => {
    const f = await montar();
    const botones = Array.from(el(f).querySelectorAll('button')).map((b) => b.textContent!.trim());
    expect(botones.some((t) => /^Clausurar/.test(t))).toBe(false);
  });
});
