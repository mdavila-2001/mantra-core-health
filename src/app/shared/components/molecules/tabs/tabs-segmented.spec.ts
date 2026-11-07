import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { TabsAppearance } from './tabs.types';
import { Tab } from './tab/tab';
import { Tabs } from './tabs';

@Component({
  imports: [Tabs, Tab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tabs [appearance]="appearance()" [orientation]="orientation()">
      <app-tab label="Buzón">A</app-tab>
      <app-tab label="Encuestas por servicio">B</app-tab>
    </app-tabs>
  `,
})
class SegmentedHost {
  readonly appearance = signal<TabsAppearance>('segmented');
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

describe('Tabs · apariencia segmented', () => {
  async function render(appearance: TabsAppearance, orientation: 'horizontal' | 'vertical' = 'horizontal'): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [SegmentedHost] }).compileComponents();
    const fixture = TestBed.createComponent(SegmentedHost);
    fixture.componentInstance.appearance.set(appearance);
    fixture.componentInstance.orientation.set(orientation);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('app-tabs')!;
  }

  it('marca el anfitrión con tabs--segmented y conserva la semántica de pestañas', async () => {
    const host = await render('segmented');
    expect(host.classList.contains('tabs--segmented')).toBe(true);
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Buzón');
  });

  it('las otras apariencias y la orientación vertical no la llevan', async () => {
    expect((await render('underline')).classList.contains('tabs--segmented')).toBe(false);
    TestBed.resetTestingModule();
    expect((await render('segmented', 'vertical')).classList.contains('tabs--segmented')).toBe(false);
  });
});
