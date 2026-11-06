import { signal } from '@angular/core';

/** One executive of the insurer sign-up accordion (subtarea 1.4). */
export interface InsurerExecutive {
  readonly key: 'generalManager' | 'commercialManager' | 'marketingManager';
  readonly heading: string;
  readonly testId: string;
  readonly expanded: ReturnType<typeof signal<boolean>>;
}

/** The three executives, in the order of the process registry; a fresh set per screen. */
export function insurerExecutives(): readonly InsurerExecutive[] {
  return [
    {
      key: 'generalManager',
      heading: '1. Gerente General',
      testId: 'general-manager',
      // Abierta por defecto: es la primera que se completa, y un acordeón que
      // arranca con las tres plegadas obligaría a un clic antes de escribir
      // nada.
      expanded: signal(true),
    },
    {
      key: 'commercialManager',
      heading: '2. Gerente Comercial',
      testId: 'commercial-manager',
      expanded: signal(false),
    },
    {
      key: 'marketingManager',
      heading: '3. Gerente de Marketing',
      testId: 'marketing-manager',
      expanded: signal(false),
    },
  ];
}

/** Celular y correo de una gerencia (subtarea 1.4): lo único que no es nombre. */
export const EXECUTIVE_CONTACT_FIELDS: readonly {
  readonly key: 'phone' | 'email';
  readonly label: string;
  readonly hint?: string;
  readonly control: 'tel' | 'email';
  readonly autocomplete?: string;
}[] = [
  {
    key: 'phone',
    label: 'Celular',
    hint: 'Con WhatsApp activo.',
    control: 'tel',
    autocomplete: 'tel',
  },
  { key: 'email', label: 'Correo corporativo', control: 'email', autocomplete: 'email' },
];
