import { TestBed } from '@angular/core/testing';

import { MedicalNoteBlock } from './medical-note-block';

describe('MedicalNoteBlock · contrato C0', () => {
  it('expone el aviso sin ofrecer una escritura ficticia', async () => {
    const fixture = TestBed.createComponent(MedicalNoteBlock);
    fixture.componentRef.setInput('patientProfileId', 'patient-synthetic');
    fixture.componentRef.setInput('encounterId', 'encounter-synthetic');
    const saved = vi.fn();
    fixture.componentInstance.guardada.subscribe(saved);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('En construcción (C1)');
    expect(fixture.nativeElement.querySelector('button, form, input, textarea')).toBeNull();
    expect(fixture.componentInstance.encounterId()).toBe('encounter-synthetic');
    expect(saved).not.toHaveBeenCalled();
  });
});
