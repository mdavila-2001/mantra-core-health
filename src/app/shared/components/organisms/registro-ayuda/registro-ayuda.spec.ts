import { TestBed } from '@angular/core/testing';

import { RegistroAyuda } from './registro-ayuda';

/**
 * El sello «Tus datos están a salvo» le habla a quien se registra. Una
 * farmacia o un laboratorio no tienen «información clínica»: lo que cuidan
 * son los papeles de la empresa.
 */
function montar(para?: 'persona' | 'empresa'): string {
  const fixture = TestBed.createComponent(RegistroAyuda);
  if (para !== undefined) fixture.componentRef.setInput('para', para);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('.ayuda__lista')?.textContent ?? '';
}

describe('RegistroAyuda', () => {
  it('a una persona le promete que su información clínica la ve sólo quien la atiende', () => {
    expect(montar()).toContain('Tu información clínica la ve el profesional que te atiende');
  });

  it('a una empresa no le habla de información clínica sino de sus papeles', () => {
    const texto = montar('empresa');
    expect(texto).not.toContain('información clínica');
    expect(texto).toContain('Los papeles de la empresa');
    expect(texto).toContain('ficha de tu empresa');
  });
});
