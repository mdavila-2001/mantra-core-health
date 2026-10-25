import { roleAssignmentState, roleAssignmentStatusText } from './role-assignment-status';

describe('roleAssignmentStatusText', () => {
  it('traduce INVITED y PENDING a lo que espera la otra parte', () => {
    expect(roleAssignmentStatusText('ROLE_ASG_INVITED')).toBe('Pendiente de aceptación del médico');
    expect(roleAssignmentStatusText('ROLE_ASG_PENDING')).toBe('Pendiente del centro');
  });

  it('traduce los estados finales', () => {
    expect(roleAssignmentStatusText('ROLE_ASG_ACTIVE')).toBe('Activa');
    expect(roleAssignmentStatusText('ROLE_ASG_REJECTED')).toBe('Rechazada');
  });

  it('acepta el código con el prefijo del módulo', () => {
    expect(roleAssignmentStatusText('practice:ROLE_ASG_ACTIVE')).toBe('Activa');
    expect(roleAssignmentState('practice:ROLE_ASG_INVITED')).toBe('INVITED');
  });

  it('un código desconocido nunca se lee «Activa»', () => {
    expect(roleAssignmentStatusText('')).toBe('Estado desconocido');
    expect(roleAssignmentStatusText('15fb063e-479c-56e6-b5d1-ebd5a36b62db')).toBe('Estado desconocido');
    expect(roleAssignmentStatusText('ACTIVE')).toBe('Estado desconocido');
  });
});
