import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { EditorSectionAnchor, editorLink, requestedTab } from './editor-deep-link';

/**
 * Deep links into «Editar perfil»: the link names the tab (`?pestana=`) and
 * the section (fragment); the editor opens that tab and brings the section
 * into view once it is drawn.
 */
describe('editor deep link', () => {
  describe('editorLink', () => {
    it('licenses and degrees live in «Credenciales» (5), specialties in «Datos personales» (0)', () => {
      expect(editorLink('licenses')).toEqual({
        route: '/my-account/edit',
        queryParams: { pestana: 5 },
        fragment: 'licenses',
      });
      expect(editorLink('credentials').queryParams).toEqual({ pestana: 5 });
      expect(editorLink('specialties').queryParams).toEqual({ pestana: 0 });
    });
  });

  describe('requestedTab', () => {
    const tab = (pestana?: string) =>
      requestedTab(convertToParamMap(pestana === undefined ? {} : { pestana }));

    it('reads the tab the link asked for', () => {
      expect(tab('5')).toBe(5);
      expect(tab('0')).toBe(0);
    });

    it('without a usable number keeps the first tab (null): missing, out of range or not a number', () => {
      expect(tab()).toBeNull();
      expect(tab('99')).toBeNull();
      expect(tab('-1')).toBeNull();
      expect(tab('1.5')).toBeNull();
      expect(tab('credenciales')).toBeNull();
    });
  });

  describe('EditorSectionAnchor', () => {
    @Component({
      imports: [EditorSectionAnchor],
      template: `<section appEditorSection="licenses">Matrículas</section>`,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Host {}

    // jsdom does not implement `scrollIntoView`: each test plants a spy and puts back what was there.
    const original = Element.prototype.scrollIntoView;
    afterEach(() => {
      Element.prototype.scrollIntoView = original;
    });

    function render(fragment: string | null): { section: HTMLElement; scroll: ReturnType<typeof vi.fn> } {
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      TestBed.configureTestingModule({
        providers: [{ provide: ActivatedRoute, useValue: { snapshot: { fragment } } }],
      });
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      TestBed.tick();
      const section = (fixture.nativeElement as HTMLElement).querySelector('section')!;
      return { section, scroll };
    }

    it('gives the section its id, the one the fragment names', () => {
      expect(render(null).section.id).toBe('licenses');
    });

    it('brings the section into view when the URL points at it, once it is drawn', () => {
      const { scroll } = render('licenses');
      expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    });

    it('does not move the page for another section or without a fragment', () => {
      expect(render('credentials').scroll).not.toHaveBeenCalled();
      TestBed.resetTestingModule();
      expect(render(null).scroll).not.toHaveBeenCalled();
    });
  });
});
