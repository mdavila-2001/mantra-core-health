import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ExpirySweep } from './expiry-sweep';

describe('ExpirySweep', () => {
  let fixture: ComponentFixture<ExpirySweep>;
  let component: ExpirySweep;
  let http: HttpTestingController;
  let confirmar: boolean;

  beforeEach(async () => {
    confirmar = true;

    await TestBed.configureTestingModule({
      imports: [ExpirySweep],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        // El diálogo real monta un componente aparte; acá solo importa la
        // respuesta: con «no» no puede salir ninguna petición.
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmar) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpirySweep);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  it('sin confirmación, el barrido no se dispara', async () => {
    confirmar = false;

    await interno<() => Promise<void>>('ejecutar')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('confirmado, va sin cuerpo y muestra los tres conteos', async () => {
    await interno<() => Promise<void>>('ejecutar')();

    const req = http.expectOne('/delegated-access/expiry-sweep');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();

    req.flush({ expiredGrants: 3, expiredDelegations: 1, expiredOrgAssignments: 0 });
    expect(interno<() => { expiredGrants: number } | null>('resultado')()?.expiredGrants).toBe(3);
  });

  it('un fallo se cuenta con el requestId para poder reportarlo', async () => {
    await interno<() => Promise<void>>('ejecutar')();

    http.expectOne('/delegated-access/expiry-sweep').flush(
      { code: 'INTERNAL', message: 'barrido en curso', correlationId: 'req-7' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(interno<() => string | null>('errorMessage')()).toContain('barrido en curso');
  });
});
