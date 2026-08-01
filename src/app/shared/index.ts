/* ============================================================================
    API pública de `shared/` — el "common" de la arquitectura.

    Todo lo que se exporta acá es reutilizable por cualquier feature. Lo que no
    aparece en este archivo es interno y no debe importarse desde afuera.

    Regla inviolable: `shared/` NUNCA importa de `features/`. Si algo en shared
    necesita saber de un dominio, es que no pertenece a shared.
    ========================================================================== */

export * from './components/atoms';
export * from './components/molecules';
export * from './components/organisms';

/* Contrato de accesibilidad entre un campo y el control que envuelve. */
export { FORM_CONTROL_CONTEXT, nextControlId } from './forms/form-control.context';
export type { FormControlContext } from './forms/form-control.context';
