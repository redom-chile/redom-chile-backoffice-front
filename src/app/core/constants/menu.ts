import { MenuItem } from '../models/menu.model';

export class Menu {
  public static pages: MenuItem[] = [
    {
      group: 'Operación',
      separator: false,
      items: [
        {
          icon: 'dashboard',
          label: 'Resumen',
          route: '/dashboard/admin',
        },
        {
          icon: 'point_of_sale',
          label: 'POS',
          route: '/pos',
          children: [
            { label: 'Tomar pedido', route: '/pos' },
            { label: 'Pedidos', route: '/orders' },
            { label: 'Pagos', route: '/payments' },
            { label: 'Turnos de caja', route: '/cash' },
          ],
        },
        {
          icon: 'table_bar',
          label: 'Mesas',
          route: '/tables',
          children: [
            { label: 'Mesas', route: '/tables' },
            { label: 'Sectores', route: '/sectors' },
            { label: 'Reservas', route: '/bookings' },
          ],
        },
        {
          icon: 'restaurant',
          label: 'Cocina',
          route: '/kitchen',
        },
        {
          icon: 'groups',
          label: 'Clientes',
          route: '/customers',
        },
      ],
    },
    {
      group: 'Administración',
      separator: true,
      items: [
        {
          icon: 'inventory_2',
          label: 'Carta',
          route: '/products',
          children: [
            { label: 'Productos', route: '/products' },
            { label: 'Categorías', route: '/products/categories' },
            { label: 'Modificadores', route: '/products/modifiers' },
          ],
        },
        {
          icon: 'account_balance_wallet',
          label: 'Finanzas',
          route: '/finance',
          children: [
            { label: 'Gastos', route: '/finance/expenses' },
            { label: 'Cuentas por pagar', route: '/finance/payables' },
            { label: 'Propinas', route: '/finance/tips' },
            { label: 'Plata por llegar', route: '/finance/settlements' },
            { label: 'Gastos recurrentes', route: '/finance/recurring' },
            { label: 'Categorías de gasto', route: '/finance/categories' },
          ],
        },
        {
          icon: 'inventory',
          label: 'Inventario',
          route: '/inventory',
          feature: 'inventory',
          children: [
            { label: 'Stock', route: '/inventory' },
            { label: 'Compras', route: '/inventory/purchases' },
            { label: 'Órdenes de compra', route: '/inventory/purchase-orders' },
            { label: 'Ajustes', route: '/inventory/adjustments' },
            { label: 'Conteos', route: '/inventory/counts' },
            // Solo si el negocio tiene más de un local.
            { label: 'Transferencias', route: '/inventory/transfers', feature: 'multiLocation' },
            { label: 'Kardex', route: '/inventory/kardex' },
            { label: 'Ingredientes', route: '/inventory/ingredients', feature: 'ingredients' },
            { label: 'Recetas', route: '/inventory/recipes', feature: 'ingredients' },
            { label: 'Producción', route: '/inventory/productions', feature: 'ingredients' },
            { label: 'Lotes', route: '/inventory/lots' },
            { label: 'Food cost', route: '/inventory/food-cost' },
            { label: 'Consumo', route: '/inventory/consumption' },
            { label: 'Unidades', route: '/inventory/units' },
          ],
        },
        {
          icon: 'factory',
          label: 'Negocio',
          route: '/business',
          children: [
            { label: 'Mi negocio', route: '/business' },
            { label: 'Sucursales', route: '/business/location' },
          ],
        },
        {
          // Planes y, en las próximas fases, la suscripción y los cobros del negocio.
          icon: 'workspace_premium',
          label: 'Plan y facturación',
          route: '/billing',
          children: [{ label: 'Planes', route: '/billing/plans' }],
        },
        {
          icon: 'admin_panel_settings',
          label: 'Roles y permisos',
          route: '/roles-and-permissions',
          children: [
            { label: 'Módulos', route: '/roles-and-permissions/modules', permission: 'modules:see-modules' },
            { label: 'Permisos', route: '/roles-and-permissions/permissions', permission: 'permissions:see-module' },
            { label: 'Roles', route: '/roles-and-permissions/roles', permission: 'roles:see-module' },
            {
              label: 'Roles y permisos',
              route: '/roles-and-permissions/roles-permissions',
              icon: 'home',
              permission: 'roles-permissions:see-module',
            },
            {
              label: 'Usuarios y roles',
              route: '/roles-and-permissions/roles-user',
              permission: 'users-roles:see-module',
            },
            {
              label: 'Usuarios',
              route: '/roles-and-permissions/users',
              permission: 'users:see-module',
            },
          ],
        },
        {
          icon: 'assets/icons/heroicons/outline/exclamation-triangle.svg',
          label: 'Errors',
          route: '/errors',
          children: [
            { label: '404', route: '/errors/404' },
            { label: '500', route: '/errors/500' },
          ],
        },
        {
          icon: 'assets/icons/heroicons/outline/cube.svg',
          label: 'Components',
          route: '/components',
          children: [{ label: 'Table', route: '/components/table' }],
        },
      ],
    },
    {
      group: 'Collaboration',
      separator: true,
      items: [
        {
          icon: 'download',
          label: 'Download',
          route: '/download',
        },
        {
          icon: 'credit_card',
          label: 'Gift Card',
          route: '/gift',
        },
        {
          icon: 'groups',
          label: 'Users',
          route: '/users',
        },
      ],
    },
    {
      group: 'Config',
      separator: false,
      items: [
        {
          icon: 'settings',
          label: 'Configuración',
          route: '/settings',
          children: [
            { label: 'Horarios', route: '/settings/schedules' },
            { label: 'Estaciones', route: '/settings/stations' },
            { label: 'Impresoras', route: '/settings/printers' },
            { label: 'Medios de pago', route: '/settings/payment-methods' },
            { label: 'Cajas', route: '/settings/registers' },
            { label: 'Estación de impresión', route: '/settings/print-station' },
            { label: 'Terminal de salón', route: '/settings/terminal' },
          ],
        },
        {
          icon: 'help',
          label: 'Ayuda',
          route: '/help',
        },
        {
          icon: 'admin_panel_settings',
          label: 'Plataforma',
          route: '/platform',
          role: 'SUPERADMIN',
          children: [
            { label: 'Resumen', route: '/platform/summary' },
            { label: 'Negocios', route: '/platform/businesses' },
            { label: 'Planes', route: '/platform/plans' },
            { label: 'Descuentos', route: '/platform/discounts' },
            { label: 'Ajustes', route: '/platform/settings' },
          ],
        },
        {
          icon: 'support_agent',
          label: 'Centro de ayuda',
          route: '/help/admin',
          role: 'SUPERADMIN',
          children: [
            { label: 'Artículos', route: '/help/admin/articles' },
            { label: 'Categorías', route: '/help/admin/categories' },
            { label: 'Revisión del asistente', route: '/help/admin/review' },
            { label: 'Uso y costos', route: '/help/admin/usage' },
          ],
        },
        {
          icon: 'notifications',
          label: 'Notifications',
          route: '/gift',
        },
        {
          icon: 'folder',
          label: 'Folders',
          route: '/folders',
          children: [
            { label: 'Current Files', route: '/folders/current-files' },
            { label: 'Downloads', route: '/folders/download' },
            { label: 'Trash', route: '/folders/trash' },
          ],
        },
      ],
    },
  ];
}
