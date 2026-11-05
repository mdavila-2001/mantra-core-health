import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { LaboratoryResults } from './laboratory-results';

describe('LaboratoryResults', () => {
  let fixture: ComponentFixture<LaboratoryResults>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dropzone = (): HTMLElement => host().querySelector('[data-testid="results-dropzone"]')!;
  const input = (testId: string): HTMLInputElement =>
    host().querySelector(`[data-testid="${testId}"]`)!;

  function dragOverEvent(): DragEvent & { dataTransfer: { dropEffect: string } } {
    const event = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent & {
      dataTransfer: { dropEffect: string };
    };
    Object.defineProperty(event, 'dataTransfer', { value: { dropEffect: 'copy', files: [] } });
    return event;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LabPortalClient,
          useValue: {
            listResultTargets: vi.fn(() => of({ items: [], count: 0 })),
            listResultFiles: vi.fn(() => of({ items: [], count: 0 })),
          },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(LaboratoryResults);
    await fixture.whenStable();
  });

  describe('la zona de soltar con un selector nativo abierto', () => {
    it.each(['results-file-input', 'results-folder-input'])(
      'con %s abierto no se ilumina, el cursor dice que no y cambia el título',
      async (testId) => {
        input(testId).dispatchEvent(new Event('click', { bubbles: true }));
        const event = dragOverEvent();

        dropzone().dispatchEvent(event);
        await fixture.whenStable();

        expect(event.dataTransfer.dropEffect).toBe('none');
        expect(dropzone().classList.contains('results__drop--active')).toBe(false);
        expect(dropzone().classList.contains('results__drop--picker-open')).toBe(true);
        expect(dropzone().textContent).toContain('Elija en la ventana de su dispositivo');
      },
    );

    it('al cerrarse el diálogo vuelve a aceptar arrastrar', async () => {
      input('results-folder-input').dispatchEvent(new Event('click', { bubbles: true }));
      input('results-folder-input').dispatchEvent(new Event('cancel', { bubbles: true }));
      const event = dragOverEvent();

      dropzone().dispatchEvent(event);
      await fixture.whenStable();

      expect(event.dataTransfer.dropEffect).toBe('copy');
      expect(dropzone().classList.contains('results__drop--active')).toBe(true);
      expect(dropzone().textContent).toContain('Arrastre archivos o carpetas enteras acá');
    });
  });
});
