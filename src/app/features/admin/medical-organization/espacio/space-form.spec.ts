import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { idDeEspacio, SITIOS_INFRA } from '../../../../core/mock/fixtures/infraestructura';
import type { PaginaDeFormulario } from '../../../../shared/forms/paginated/paginated-form.types';
import { MaquetaDeInfraestructura } from '../../../../../testing/maqueta-de-infraestructura';
import { SpaceForm } from './space-form';

const SAN_LUCAS = SITIOS_INFRA[0]!;

@Component({ template: 'ficha', changeDetection: ChangeDetectionStrategy.OnPush })
class FichaFalsa {}

describe('SpaceForm', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let maqueta: MaquetaDeInfraestructura;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/medical-organization/spaces/new', component: SpaceForm },
          { path: 'administration/medical-organization/spaces/:id/edit', component: SpaceForm },
          { path: 'administration/medical-organization/spaces/:id', component: FichaFalsa },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    maqueta = new MaquetaDeInfraestructura();
    harness = await RouterTestingHarness.create();
  });

  async function abrir(url: string): Promise<SpaceForm> {
    const componente = await harness.navigateByUrl(url, SpaceForm);
    maqueta.responderTodo(http, () => harness.detectChanges());
    harness.detectChanges();
    return componente;
  }

  const paginas = (c: SpaceForm): readonly PaginaDeFormulario[] => c['paginas']();
  const titulos = (c: SpaceForm) => paginas(c).map((p) => p.titulo);
  const claves = (c: SpaceForm) => paginas(c).flatMap((p) => p.campos.map((k) => k.key));

  function alta(padre: string): Promise<SpaceForm> {
    return abrir(`/administration/medical-organization/spaces/new?site=${SAN_LUCAS.id}&parent=${idDeEspacio(SAN_LUCAS, padre)}`);
  }

  it('bajo una sala sólo ofrece las formas que la regla admite (local o cama)', async () => {
    const c = await alta('A-PN-P3-SI');
    const forma = paginas(c)[0]!.campos.find((k) => k.key === 'formCode')!;
    expect(forma.options?.map((o) => o.value)).toEqual(['LOC_FORM_ROOM', 'LOC_FORM_BED']);
  });

  it('un quirófano pide superficie y climatización; una sala de espera no', async () => {
    const c = await alta('BQ');
    c['form'].patchValue({ formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_OPERATING_ROOM' });
    harness.detectChanges();
    expect(titulos(c)).toContain('Superficie');
    expect(titulos(c)).toContain('Climatización y asepsia');
    expect(claves(c)).toContain('prepMinutes');

    c['form'].patchValue({ functionCode: 'SPACE_FN_WAITING' });
    harness.detectChanges();
    expect(titulos(c)).not.toContain('Superficie');
    expect(titulos(c)).not.toContain('Climatización y asepsia');
    expect(claves(c)).not.toContain('prepMinutes');
  });

  it('sólo una cama pide categoría de cama y censable', async () => {
    const c = await alta('301');
    c['form'].patchValue({ formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD' });
    harness.detectChanges();
    expect(claves(c)).toEqual(expect.arrayContaining(['bedCategoryCode', 'censable']));
    expect(claves(c)).not.toContain('capacity');
  });

  it('cada página respeta el tope de cuatro campos', async () => {
    const c = await alta('BQ');
    c['form'].patchValue({ formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_OPERATING_ROOM' });
    expect(paginas(c).every((p) => p.campos.length <= 4)).toBe(true);
  });

  it('crea y navega a la ficha; lo que el perfil no pide no viaja', async () => {
    const c = await alta('A-PB');
    c['form'].patchValue({
      formCode: 'LOC_FORM_ROOM',
      functionCode: 'SPACE_FN_WAITING',
      code: 'ESP-2',
      name: 'Sala de espera 2',
      areaM2: '30',
    });
    c['enviar']();
    const req = http.expectOne(`/sites/${SAN_LUCAS.id}/care-spaces`);
    expect(req.request.body).toMatchObject({ code: 'ESP-2', parentSpaceId: idDeEspacio(SAN_LUCAS, 'A-PB') });
    expect('areaM2' in req.request.body).toBe(false);
    maqueta.responder(req);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toMatch(/\/spaces\/[^/]+$/);
  });

  it('409 de código repetido se muestra arriba del formulario (S4)', async () => {
    const c = await alta('A-PB');
    c['form'].patchValue({ formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_WAITING', code: 'FAR', name: 'Repetido' });
    c['enviar']();
    maqueta.responder(http.expectOne(`/sites/${SAN_LUCAS.id}/care-spaces`));
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).querySelector('[data-testid=formulario-fallo]')?.textContent).toContain(
      'Ya hay un espacio con ese código',
    );
  });

  it('en edición de un espacio activo, código y forma quedan bloqueados', async () => {
    const c = await abrir(`/administration/medical-organization/spaces/${idDeEspacio(SAN_LUCAS, 'CE-02')}/edit`);
    expect(c['form'].controls.code.disabled).toBe(true);
    expect(c['form'].controls.formCode.disabled).toBe(true);
    expect(c['form'].controls.name.value).toContain('Consultorio 2');
    expect(claves(c)).not.toContain('parentSpaceId');
  });

  it('sin establecimiento en la URL ofrece volver a elegirlo (S3 con ruta)', async () => {
    await abrir('/administration/medical-organization/spaces/new');
    const enlace = Array.from((harness.routeNativeElement as HTMLElement).querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Elegir el establecimiento'),
    );
    expect(enlace?.getAttribute('href')).toContain('tab=infrastructure');
  });
});
