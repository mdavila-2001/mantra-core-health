import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { idDeEspacio, SITIOS_INFRA } from '../../../../core/mock/fixtures/infraestructura';
import { MaquetaDeInfraestructura } from '../../../../../testing/maqueta-de-infraestructura';
import { SpaceBulk } from './space-bulk';
import { SpaceImport } from './space-import';

const SAN_LUCAS = SITIOS_INFRA[0]!;

@Component({ template: 'otra' })
class Otra {}

describe('alta masiva e importación', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let maqueta: MaquetaDeInfraestructura;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'bulk', component: SpaceBulk },
          { path: 'import', component: SpaceImport },
          { path: '**', component: Otra },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    maqueta = new MaquetaDeInfraestructura();
    harness = await RouterTestingHarness.create();
  });

  const raiz = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  describe('SpaceBulk', () => {
    async function abrir(): Promise<SpaceBulk> {
      const c = await harness.navigateByUrl(`/bulk?site=${SAN_LUCAS.id}&parent=${idDeEspacio(SAN_LUCAS, '301')}`, SpaceBulk);
      maqueta.responderTodo(http, () => harness.detectChanges());
      harness.detectChanges();
      return c;
    }

    it('toma el padre de la URL y ofrece sólo camas bajo una habitación', async () => {
      const c = await abrir();
      expect(c['form'].controls.parentSpaceId.value).toBe(idDeEspacio(SAN_LUCAS, '301'));
      expect(c['formas']().map((f) => f.value)).toEqual(['LOC_FORM_BED']);
    });

    it('la vista previa muestra los códigos y marca los que ya existen', async () => {
      const c = await abrir();
      c['form'].patchValue({ formCode: 'LOC_FORM_BED' });
      c['form'].patchValue({ functionCode: 'SPACE_FN_BED_STANDARD', codePattern: '301-{A..D}', namePattern: 'Cama 301-{A..D}' });
      harness.detectChanges();
      const previa = raiz().querySelector('[data-testid=masiva-previa]')!;
      expect(previa.textContent).toContain('301-C');
      expect(previa.textContent).toContain('2 código(s) ya existen');
      expect(raiz().querySelector('[data-testid=masiva-crear]')!.getAttribute('aria-disabled')).toBe('true');
    });

    it('un patrón inválido se explica antes de enviar', async () => {
      const c = await abrir();
      c['form'].patchValue({ codePattern: '301-{H..A}' });
      harness.detectChanges();
      expect(raiz().querySelector('[data-testid=masiva-previa]')!.textContent).toContain('de menor a mayor');
    });

    it('crea todo de una vez y lleva a los hijos del padre', async () => {
      const c = await abrir();
      c['form'].patchValue({ formCode: 'LOC_FORM_BED' });
      c['form'].patchValue({ functionCode: 'SPACE_FN_BED_STANDARD', codePattern: '301-{C..E}', namePattern: 'Cama' });
      harness.detectChanges();
      c['enviar']();
      const req = http.expectOne(`/sites/${SAN_LUCAS.id}/care-spaces/bulk`);
      expect(req.request.body).toMatchObject({ codePattern: '301-{C..E}', namePattern: 'Cama', parentSpaceId: idDeEspacio(SAN_LUCAS, '301') });
      maqueta.responder(req);
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toContain('tab=children');
    });
  });

  describe('SpaceImport', () => {
    async function abrir(): Promise<SpaceImport> {
      const c = await harness.navigateByUrl(`/import?site=${SAN_LUCAS.id}`, SpaceImport);
      maqueta.responderTodo(http, () => harness.detectChanges());
      harness.detectChanges();
      return c;
    }

    it('parsea en el cliente y muestra los problemas por línea del archivo', async () => {
      const c = await abrir();
      c['escribir']('code,name,form,function\nX1,,ROOM,GENERIC');
      harness.detectChanges();
      expect(raiz().querySelector('[data-testid=importar-errores-forma]')!.textContent).toContain('Campo obligatorio vacío');
      expect(raiz().querySelector('[data-testid=importar-validar]')!.getAttribute('aria-disabled')).toBe('true');
    });

    it('dry-run con errores de negocio: tabla por línea y no deja confirmar', async () => {
      const c = await abrir();
      c['escribir']('code,name,form,function,parent\nNUEVO-1,Local nuevo,ROOM,STORAGE,A-PB\nCAMA-X,Cama,BED,BED_STANDARD,BLD-A');
      harness.detectChanges();
      c['validar']();
      const req = http.expectOne((r) => r.url.endsWith('/care-spaces/import'));
      expect(req.request.params.get('dryRun')).toBe('true');
      maqueta.responder(req);
      harness.detectChanges();
      const tabla = raiz().querySelector('[data-testid=importar-resultado]')!;
      expect(tabla.textContent).toContain('CAMA-X');
      expect(tabla.textContent).toContain('Esa forma no puede colgar de ese padre');
      expect(raiz().querySelector('[data-testid=importar-confirmar]')!.getAttribute('aria-disabled')).toBe('true');
    });

    it('dry-run limpio habilita confirmar, que escribe con dryRun=false', async () => {
      const c = await abrir();
      c['escribir']('code;name;form;function;parent\nIMP-1;Depósito de piso;ROOM;STORAGE;A-PB');
      harness.detectChanges();
      c['validar']();
      maqueta.responder(http.expectOne((r) => r.url.endsWith('/care-spaces/import')));
      harness.detectChanges();
      expect(raiz().querySelector('[data-testid=importar-confirmar]')!.getAttribute('aria-disabled')).toBe('false');
      c['confirmar']();
      const real = http.expectOne((r) => r.url.endsWith('/care-spaces/import'));
      expect(real.request.params.get('dryRun')).toBe('false');
      maqueta.responder(real);
      harness.detectChanges();
      expect(raiz().querySelector('[data-testid=importar-ok]')!.textContent).toContain('Se crearon 1');
    });

    it('cambiar el texto después de validar invalida la validación', async () => {
      const c = await abrir();
      c['escribir']('code,name,form,function,parent\nIMP-2,Otro,ROOM,STORAGE,A-PB');
      c['validar']();
      maqueta.responder(http.expectOne((r) => r.url.endsWith('/care-spaces/import')));
      c['escribir']('code,name,form,function,parent\nIMP-3,Otro,ROOM,STORAGE,A-PB');
      harness.detectChanges();
      expect(raiz().querySelector('[data-testid=importar-confirmar]')!.getAttribute('aria-disabled')).toBe('true');
    });
  });
});
