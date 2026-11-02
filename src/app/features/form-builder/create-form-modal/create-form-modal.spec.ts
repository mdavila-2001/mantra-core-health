import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateFormModal } from './create-form-modal';

describe('CreateFormModal', () => {
  let fixture: ComponentFixture<CreateFormModal>;
  let component: CreateFormModal;

  const ESPECIALIDADES = [
    { id: 'esp-cardio', label: 'Cardiología' },
    { id: 'esp-neuro', label: 'Neurología' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateFormModal],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateFormModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('especialidades', ESPECIALIDADES);
    fixture.detectChanges();
  });

  it('se crea correctamente e inicializa la especialidad por defecto', () => {
    expect(component).toBeTruthy();
    expect(component['especialidadId']()).toBe('esp-cardio');
  });

  it('sugiere automáticamente un código a partir del nombre', () => {
    component['onNombreInput']('Control Diario');
    expect(component['nombre']()).toBe('Control Diario');
    expect(component['codigo']()).toBe('FORM_CONTROL_DIARIO');
  });

  it('emite el evento crear con los datos completados al enviar', () => {
    let emitido: unknown = null;
    component.crear.subscribe((datos) => (emitido = datos));

    component['onNombreInput']('Ficha Postquirurgica');
    component['enviar']();

    expect(emitido).toEqual({
      name: 'Ficha Postquirurgica',
      code: 'FORM_FICHA_POSTQUIRURGICA',
      specialtyConceptId: 'esp-cardio',
    });
  });

  it('emite cerrar al cancelar', () => {
    let cerrado = false;
    component.cerrar.subscribe(() => (cerrado = true));
    component['onClosed']();
    expect(cerrado).toBe(true);
  });
});
