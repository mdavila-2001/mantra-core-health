import type { Routes } from '@angular/router';
import { APP_TITLE, ROLES_ROUTE_DATA } from '../core/navigation/navigation.types';
import { seccionRolesGuard } from '../core/navigation/section-roles.guard';
import { prescriptionDispenseRoutes } from '../features/prescription-dispense/prescription-dispense.routes';
import { chunkFallido } from './chunk-fallido';

/**
 * Pantallas hijas de contabilidad, encuestas y pedidos de farmacia.
 */
export const PANTALLAS_HIJAS_ACCOUNTING: Routes = [
  {
    path: 'administration/accounting/billing-setup',
    title: `${APP_TITLE} - Configuración para facturar`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/billing-setup/billing-setup')
        .then((m) => m.BillingSetup)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/accounting/cockpit',
    title: `${APP_TITLE} - Vista contable`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/accounting/cockpit/cockpit')
        .then((m) => m.Cockpit)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/accounting/assets-liabilities',
    title: `${APP_TITLE} - Activos y pasivos`,
    canActivate: [seccionRolesGuard],
    data: { [ROLES_ROUTE_DATA]: ['PRACTITIONER'] },
    loadComponent: () =>
      import('../features/assets-liabilities/assets-liabilities')
        .then((m) => m.AssetsLiabilities)
        .catch(() => chunkFallido()),
  },
  {
    path: 'administration/accounting/books',
    title: `${APP_TITLE} - Libros contables`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/accounting/accounting')
        .then((m) => m.Accounting)
        .catch(() => chunkFallido()),
  },
  {
    path: 'groups/:groupId',
    title: `${APP_TITLE} - Grupo`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/groups/group-detail/group-detail')
        .then((m) => m.GroupDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'questionnaires/:surveyId',
    title: `${APP_TITLE} - Encuesta`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/questionnaires/survey-detail/survey-detail')
        .then((m) => m.SurveyDetailScreen)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/questionnaires/:invitationId',
    title: `${APP_TITLE} - Responder cuestionario`,
    loadComponent: () =>
      import('../features/account/questionnaires/answer/answer')
        .then((m) => m.QuestionnaireAnswer)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/medical-record/where-to-buy/:requestId',
    title: `${APP_TITLE} - Dónde comprar mi receta`,
    loadComponent: () =>
      import('../features/account/medical-record/where-to-buy/where-to-buy')
        .then((m) => m.WhereToBuy)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/pharmacy/prescriptions',
    title: `${APP_TITLE} - Mis recetas`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/pharmacy/prescriptions/prescriptions-page')
        .then((m) => m.PrescriptionsPage)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/pharmacy/cart',
    title: `${APP_TITLE} - Su carrito`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/pharmacy/cart/cart-page')
        .then((m) => m.CartPage)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/pharmacy-orders/new',
    title: `${APP_TITLE} - Confirme su pedido`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/pharmacy-orders/new-order/new-order')
        .then((m) => m.NewOrder)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/pharmacy-orders/checkout',
    title: `${APP_TITLE} - Confirme su pedido`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/pharmacy-orders/checkout/checkout')
        .then((m) => m.Checkout)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/diagnostic-orders/:orderId/book',
    title: `${APP_TITLE} - Reservar estudio`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/diagnostic-orders/order-booking/order-booking')
        .then((m) => m.OrderBooking)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/pharmacy-orders/:orderId',
    title: `${APP_TITLE} - Pedido de farmacia`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/pharmacy-orders/order-detail/order-detail')
        .then((m) => m.OrderDetail)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/pharmacy-orders/:orderId/receipt',
    title: `${APP_TITLE} - Comprobante de pago`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/pharmacy-orders/order-receipt/order-receipt')
        .then((m) => m.OrderReceipt)
        .catch(() => chunkFallido()),
  },
  {
    path: 'my-account/pharmacy-orders/:orderId/invoice',
    title: `${APP_TITLE} - Factura`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/account/pharmacy-orders/order-invoice/order-invoice')
        .then((m) => m.OrderInvoice)
        .catch(() => chunkFallido()),
  },
  ...prescriptionDispenseRoutes(chunkFallido),
  {
    path: 'administration/pharmacy-orders/:orderId',
    title: `${APP_TITLE} - Pedido en el mostrador`,
    canActivate: [seccionRolesGuard],
    loadComponent: () =>
      import('../features/organization/pharmacy-inbox/inbox-order/inbox-order')
        .then((m) => m.InboxOrder)
        .catch(() => chunkFallido()),
  },
];
