import type { Block, BlockType, Component, Project, Screen, StateName, StyleProps, Tokens } from './model';
import { builtInStyle } from './tokens';
import { uid } from './ids';

// Plantilla «Banco New»: app de banca móvil construida a partir de capturas de referencia.
// Todos los datos son ficticios: nombres, cuentas, montos y tarjetas.

export const FONT_OVERPASS = "'Overpass', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

export function bancoNewTokens(): Tokens {
  return {
    fontFamily: FONT_OVERPASS,
    colors: [
      { name: 'background', light: '#EAF1FA', dark: '#0E1520', description: 'Fondo celeste de la app' },
      { name: 'surface', light: '#FFFFFF', dark: '#18202B', description: 'Tarjetas y encabezados' },
      { name: 'subtle', light: '#F2F5F9', dark: '#202A36', description: 'Fondos secundarios' },
      { name: 'onSurface', light: '#35414C', dark: '#E6ECF2', description: 'Texto principal' },
      { name: 'muted', light: '#5F6B78', dark: '#9AA7B5', description: 'Texto secundario' },
      { name: 'border', light: '#E1E7EE', dark: '#2D3A48', description: 'Divisores' },
      { name: 'primary', light: '#1A66CC', dark: '#6FA8F0', description: 'Acción y selección' },
      { name: 'primaryHover', light: '#165AB4', dark: '#86B7F3' },
      { name: 'primaryPressed', light: '#124C99', dark: '#A2C8F6' },
      { name: 'primarySubtle', light: '#E7F0FC', dark: '#13283F' },
      { name: 'onPrimary', light: '#FFFFFF', dark: '#081A30', description: 'Texto sobre acción' },
      { name: 'focus', light: '#E0A100', dark: '#FFC940', description: 'Anillo de foco' },
      { name: 'success', light: '#2E7D3E', dark: '#6FD08A', description: 'Ingresos y confirmación' },
      { name: 'successSubtle', light: '#E6F4EA', dark: '#16301F' },
      { name: 'warning', light: '#C96A12', dark: '#F2A65A', description: 'Egresos y alertas' },
      { name: 'danger', light: '#D0343A', dark: '#FF8A8A' },
      { name: 'dangerSubtle', light: '#FCEBEC', dark: '#3A1E20' },
      { name: 'star', light: '#F5C518', dark: '#F5C518', description: 'Calificación y perfil' },
      { name: 'cardDark', light: '#3A3A3F', dark: '#3A3A3F', description: 'Tarjeta de crédito' },
      { name: 'cardDarkEnd', light: '#111113', dark: '#111113' },
      { name: 'onDark', light: '#FFFFFF', dark: '#FFFFFF', description: 'Texto sobre tarjeta oscura' },
    ],
    space: [
      { name: 'xs', value: 4 },
      { name: 'sm', value: 8 },
      { name: 'md', value: 12 },
      { name: 'lg', value: 18 },
      { name: 'xl', value: 24 },
      { name: 'xxl', value: 32 },
    ],
    radius: [
      { name: 'sm', value: 8 },
      { name: 'md', value: 12 },
      { name: 'lg', value: 18 },
      { name: 'pill', value: 999 },
    ],
    type: [
      { role: 'display', size: 30, lineHeight: 36, weight: 700 },
      { role: 'title', size: 20, lineHeight: 26, weight: 600 },
      { role: 'body', size: 16, lineHeight: 24, weight: 400 },
      { role: 'label', size: 16, lineHeight: 22, weight: 600 },
      { role: 'caption', size: 13, lineHeight: 18, weight: 400 },
    ],
  };
}

const comp = (id: string, name: string, type: BlockType, variant?: string, patch: Partial<Record<StateName, StyleProps>> = {}): Component => {
  const states = builtInStyle(type, variant);
  for (const [st, props] of Object.entries(patch)) states[st as StateName] = { ...states[st as StateName], ...props };
  return { id, name, type, variant, states };
};

export function bancoNewComponents(): Component[] {
  return [
    comp('cmp-bn-appbar', 'Barra de la app', 'navbar', 'app'),
    comp('cmp-bn-titlebar', 'Barra de título', 'navbar', 'title'),
    comp('cmp-bn-closebar', 'Barra de cierre', 'navbar', 'close'),
    comp('cmp-bn-tabs', 'Pestañas', 'tabs', 'underline'),
    comp('cmp-bn-tabbar', 'Barra inferior', 'tabBar'),
    comp('cmp-bn-account', 'Tarjeta de cuenta', 'accountCard'),
    comp('cmp-bn-summary', 'Tarjeta de resumen', 'accountCard', 'summary'),
    comp('cmp-bn-credit', 'Tarjeta de crédito', 'creditCard'),
    comp('cmp-bn-finance', 'Resumen financiero', 'financeCard'),
    comp('cmp-bn-menu', 'Lista de opciones', 'menuList'),
    comp('cmp-bn-info', 'Lista de datos', 'menuList', 'info'),
    comp('cmp-bn-menu-plain', 'Menú lateral', 'menuList', 'plain'),
    comp('cmp-bn-contacts', 'Carrusel de contactos', 'carousel', 'contacts'),
    comp('cmp-bn-promos', 'Carrusel de promociones', 'carousel', 'promo'),
    comp('cmp-bn-feature', 'Destacado', 'carousel', 'feature'),
    comp('cmp-bn-grid', 'Accesos rápidos', 'iconGrid'),
    comp('cmp-bn-row', 'Fila destacada', 'listItem', 'icon'),
    comp('cmp-bn-profile', 'Fila de perfil', 'listItem', 'profile'),
    comp('cmp-bn-contact', 'Fila de contacto', 'listItem', 'contact'),
    comp('cmp-bn-notification', 'Notificación', 'listItem', 'notification'),
    comp('cmp-bn-logout', 'Cerrar sesión', 'listItem', 'logout'),
    comp('cmp-bn-search', 'Buscador', 'input', 'search'),
    comp('cmp-bn-input', 'Campo de texto', 'input'),
    comp('cmp-bn-textarea', 'Área de texto', 'textarea'),
    comp('cmp-bn-amount', 'Campo de monto', 'amount'),
    comp('cmp-bn-cuotas', 'Selector de cuotas', 'radio', 'numbers'),
    comp('cmp-bn-rating', 'Calificación', 'rating'),
    comp('cmp-bn-button', 'Botón principal', 'button', 'primary', { default: { radius: '{radius.pill}', padY: '{space.lg}' } }),
    comp('cmp-bn-button-secondary', 'Botón secundario', 'button', 'secondary', { default: { radius: '{radius.pill}', padY: '{space.lg}' } }),
    comp('cmp-bn-survey', 'Botón de encuesta', 'button', 'success'),
    comp('cmp-bn-help', 'Mensaje informativo', 'help', undefined, { default: { bg: '{color.surface}' } }),
    comp('cmp-bn-title', 'Título de sección', 'heading', 'title'),
    comp('cmp-bn-status', 'Ícono de estado', 'statusIcon'),
    comp('cmp-bn-avatar', 'Avatar', 'avatar'),
  ];
}

const b = (id: string, type: BlockType, label: string, extra: Partial<Block> = {}): Block => ({ id, type, label, ...extra });

const TAB_OPTIONS = ['Inicio|wallet', 'Transferir|transfer', 'Más|plus', 'Créditos|credits', 'Inversiones|investments'];
const TAB_TARGETS = { Inicio: 's-bn-inicio', Transferir: 's-bn-transferir', Más: 's-bn-accesos', Créditos: 's-bn-creditos', Inversiones: 's-bn-inversiones' };

const appBar = (id: string) => b(id, 'navbar', 'New', { componentId: 'cmp-bn-appbar', optionTargets: { menu: 's-bn-menu', bell: 's-bn-notificaciones' } });
const titleBar = (id: string, title: string, extra: Partial<Block> = {}) => b(id, 'navbar', title, { componentId: 'cmp-bn-titlebar', action: 'back', ...extra });
const tabBar = (id: string, active: string) => b(id, 'tabBar', 'Navegación principal', { componentId: 'cmp-bn-tabbar', options: TAB_OPTIONS, value: active, optionTargets: { ...TAB_TARGETS } });
const homeTabs = (id: string, active: string) =>
  b(id, 'tabs', 'Secciones de inicio', {
    componentId: 'cmp-bn-tabs',
    options: ['Cuentas', 'Tarjetas', 'Mis Finanzas'],
    value: active,
    optionTargets: { Cuentas: 's-bn-inicio', Tarjetas: 's-bn-tarjetas', 'Mis Finanzas': 's-bn-finanzas' },
  });
const investTabs = (id: string, active: string) =>
  b(id, 'tabs', 'Secciones de inversiones', {
    componentId: 'cmp-bn-tabs',
    options: ['Mis Inversiones', 'Invierte'],
    value: active,
    optionTargets: { 'Mis Inversiones': 's-bn-inversiones', Invierte: 's-bn-invierte' },
  });
const success = (prefix: string, title: string, text: string, primary: [string, string], link?: [string, string]): Block[] => [
  b(`${prefix}-icono`, 'statusIcon', title, { componentId: 'cmp-bn-status' }),
  b(`${prefix}-titulo`, 'heading', title, { componentId: 'cmp-bn-title', align: 'center' }),
  b(`${prefix}-texto`, 'text', text, { variant: 'muted', align: 'center' }),
  b(`${prefix}-boton`, 'button', primary[0], { componentId: 'cmp-bn-button', action: 'navigate', target: primary[1] }),
  ...(link ? [b(`${prefix}-enlace`, 'link', link[0], { action: 'navigate' as const, target: link[1], align: 'center' as const })] : []),
];

export function bancoNewScreens(): Screen[] {
  return [
    {
      id: 's-bn-inicio',
      name: 'Inicio · Cuentas',
      breakpoint: 'mobile',
      blocks: [
        appBar('bn-in-app'),
        homeTabs('bn-in-tabs', 'Cuentas'),
        b('bn-in-cashback', 'listItem', 'Cashback disponible: **$1.450**', { componentId: 'cmp-bn-row', value: 'coin', action: 'none' }),
        b('bn-in-cuenta', 'accountCard', 'Cuenta Corriente 1048 2201', {
          componentId: 'cmp-bn-account',
          value: '$ 1.284.300',
          detail: 'Sobregiro disponible: $1.000.000',
          options: ['Abono|$610.000|De remuneraciones|in'],
          linkLabel: 'Más detalles',
          action: 'none',
        }),
        b('bn-in-promos', 'carousel', 'Promociones', {
          componentId: 'cmp-bn-promos',
          options: [
            'money|Por ser cliente New tienes **$12.500.000** con tasa preferencial',
            'rocket|Asegura tu auto con **precios exclusivos** en la App New',
            'trophy|Vive el Mundial con tu **tarjeta New**',
          ],
          optionTargets: { 'Por ser cliente New tienes **$12.500.000** con tasa preferencial': 's-bn-creditos' },
        }),
        tabBar('bn-in-nav', 'Inicio'),
      ],
    },
    {
      id: 's-bn-tarjetas',
      name: 'Inicio · Tarjetas',
      breakpoint: 'mobile',
      blocks: [
        appBar('bn-ta-app'),
        homeTabs('bn-ta-tabs', 'Tarjetas'),
        b('bn-ta-visa', 'creditCard', 'New Visa Signature', {
          componentId: 'cmp-bn-credit',
          detail: 'Titular **** 4821',
          value: 'VISA',
          options: ['Utilizado|$ 185.400|US$ 0,00', 'Disponible|$ 2.814.600|US$ 1.200,00'],
          linkLabel: 'Ver datos',
          action: 'none',
        }),
        b('bn-ta-detalle', 'listItem', 'Ver detalle de tarjetas', { componentId: 'cmp-bn-row', value: 'card', action: 'none' }),
        b('bn-ta-opciones', 'menuList', 'Opciones de tus tarjetas', {
          componentId: 'cmp-bn-menu',
          options: ['Pago de tarjetas||cardPay', 'Configuración de tarjetas||cardSettings', 'Solicitar avance||cardCash', 'Agregar a billetera digital||wallet'],
        }),
        tabBar('bn-ta-nav', 'Inicio'),
      ],
    },
    {
      id: 's-bn-finanzas',
      name: 'Inicio · Mis Finanzas',
      breakpoint: 'mobile',
      blocks: [
        appBar('bn-fi-app'),
        homeTabs('bn-fi-tabs', 'Mis Finanzas'),
        b('bn-fi-compras', 'financeCard', 'Compras del mes', {
          componentId: 'cmp-bn-finance',
          detail: 'Septiembre 2026',
          value: 'donut',
          options: ['Gasto total|$ 412.300|up', 'Transferencias|$ 208.900'],
          linkLabel: 'Ver detalle',
          action: 'none',
        }),
        b('bn-fi-ingresos', 'financeCard', 'Ingresos y egresos', {
          componentId: 'cmp-bn-finance',
          detail: 'Septiembre 2026',
          value: 'bars',
          options: ['Ingresos|$ 1.310.000|in', 'Egresos|$ 980.450|up'],
          linkLabel: 'Ver detalle',
          action: 'none',
        }),
        b('bn-fi-deudas', 'financeCard', 'Proyección de deudas', {
          componentId: 'cmp-bn-finance',
          detail: 'Próximos 3 meses',
          options: ['Deuda total octubre|$ 185.400'],
          linkLabel: 'Ver detalle',
          action: 'none',
        }),
        tabBar('bn-fi-nav', 'Inicio'),
      ],
    },
    {
      id: 's-bn-accesos',
      name: 'Accesos rápidos',
      breakpoint: 'mobile',
      blocks: [
        b('bn-ac-cerrar', 'navbar', 'Accesos rápidos', { componentId: 'cmp-bn-closebar', action: 'back' }),
        b('bn-ac-grid', 'iconGrid', 'Accesos rápidos', {
          componentId: 'cmp-bn-grid',
          options: ['Alcancía|piggy', 'Beneficios|gift', 'Seguros|shield', 'Pagos|receipt', 'Pago QR|qr', 'Cripto|bitcoin', 'Inicio|wallet', 'Transferir|transfer', 'Créditos|credits', 'Inversiones|investments'],
          value: 'Inicio',
          optionTargets: { Inicio: 's-bn-inicio', Transferir: 's-bn-transferir', Créditos: 's-bn-creditos', Inversiones: 's-bn-inversiones' },
        }),
        b('bn-ac-texto', 'text', 'Elige un acceso para ir directo a esa sección.', { variant: 'muted', align: 'center' }),
      ],
    },
    {
      id: 's-bn-transferir',
      name: 'Transferir',
      breakpoint: 'mobile',
      blocks: [
        appBar('bn-tr-app'),
        b('bn-tr-frecuentes', 'carousel', 'Destinatarios frecuentes', {
          componentId: 'cmp-bn-contacts',
          options: ['CE|Comunidad Edificio Los Aromos|Gastos comunes', 'MR|Martina Rojas|Hermana', 'DF|Diego Fuentes|Arriendo'],
          optionTargets: { 'Comunidad Edificio Los Aromos': 's-bn-monto', 'Martina Rojas': 's-bn-monto', 'Diego Fuentes': 's-bn-monto' },
        }),
        b('bn-tr-opciones', 'menuList', 'Opciones de transferencias', {
          componentId: 'cmp-bn-menu',
          options: [
            'Transferir a destinatario|Con datos bancarios o N.º de celular.|transfer',
            'Transferir a nuevo destinatario|Con datos bancarios.|userAdd',
            'Transferir entre mis cuentas|A tu cuenta corriente o de ahorro.|swap',
          ],
          optionTargets: { 'Transferir a destinatario': 's-bn-destinatario' },
        }),
        b('bn-tr-importar', 'menuList', '', { componentId: 'cmp-bn-menu', options: ['Importar mis destinatarios desde otro banco||import'] }),
        tabBar('bn-tr-nav', 'Transferir'),
      ],
    },
    {
      id: 's-bn-destinatario',
      name: 'Transferir a destinatario',
      breakpoint: 'mobile',
      blocks: [
        titleBar('bn-de-titulo', 'Transferir a destinatario'),
        b('bn-de-tabs', 'tabs', 'Tipo de destinatario', { componentId: 'cmp-bn-tabs', options: ['Bancarios', 'Celular New'], value: 'Bancarios' }),
        b('bn-de-buscar', 'input', 'Buscar destinatario', { componentId: 'cmp-bn-search', detail: 'Escribe el nombre, apellido o alias' }),
        b('bn-de-letra-a', 'text', 'A', { variant: 'muted' }),
        b('bn-de-andres', 'listItem', '**Andrés Barrios** · Vecino', { componentId: 'cmp-bn-contact', detail: 'Cuenta Corriente N.º 11223344\nBanco Estrella', action: 'navigate', target: 's-bn-monto' }),
        b('bn-de-camila', 'listItem', '**Camila Ortega** · Profe de yoga', { componentId: 'cmp-bn-contact', detail: 'Cuenta Vista N.º 55667788\nBanco Austral', action: 'navigate', target: 's-bn-monto' }),
        b('bn-de-letra-m', 'text', 'M', { variant: 'muted' }),
        b('bn-de-martina', 'listItem', '**Martina Rojas** · Hermana', { componentId: 'cmp-bn-contact', detail: 'Cuenta Corriente N.º 99001122\nBanco New', action: 'navigate', target: 's-bn-monto' }),
      ],
    },
    {
      id: 's-bn-monto',
      name: 'Monto a transferir',
      breakpoint: 'mobile',
      blocks: [
        titleBar('bn-mo-titulo', 'Monto a transferir'),
        b('bn-mo-origen', 'accountCard', 'Desde Cuenta Corriente 1048 2201', { componentId: 'cmp-bn-summary', detail: 'Saldo disponible', value: '$ 1.284.300', action: 'none' }),
        b('bn-mo-monto', 'amount', '¿Cuánto quieres transferir?', { componentId: 'cmp-bn-amount', detail: '$ 0', required: true }),
        b('bn-mo-tope', 'text', 'Sin costo. Tope diario: $5.000.000.', { variant: 'caption' }),
        b('bn-mo-mensaje', 'input', 'Mensaje (opcional)', { componentId: 'cmp-bn-input', detail: 'Ej: arriendo septiembre' }),
        b('bn-mo-continuar', 'button', 'Continuar', { componentId: 'cmp-bn-button', action: 'navigate', target: 's-bn-confirmar', disableUntilValid: true }),
      ],
    },
    {
      id: 's-bn-confirmar',
      name: 'Confirmar transferencia',
      breakpoint: 'mobile',
      blocks: [
        titleBar('bn-co-titulo', 'Confirma tu transferencia'),
        b('bn-co-resumen', 'menuList', 'Revisa antes de transferir', {
          componentId: 'cmp-bn-info',
          options: ['Destinatario|Martina Rojas · Banco New|user', 'Monto|El monto que ingresaste|cashCard', 'Desde|Cuenta Corriente 1048 2201|wallet'],
        }),
        b('bn-co-ayuda', 'help', 'Transferencia sin costo', { componentId: 'cmp-bn-help', detail: 'Llega en segundos a cuentas de cualquier banco.' }),
        b('bn-co-transferir', 'button', 'Transferir', { componentId: 'cmp-bn-button', action: 'navigate', target: 's-bn-transfer-exito' }),
        b('bn-co-cancelar', 'button', 'Cancelar', { componentId: 'cmp-bn-button-secondary', action: 'navigate', target: 's-bn-transferir' }),
      ],
    },
    {
      id: 's-bn-transfer-exito',
      name: 'Transferencia exitosa',
      breakpoint: 'mobile',
      terminal: true,
      blocks: success('bn-te', '¡Transferencia exitosa!', 'Martina recibirá el dinero en segundos. Te enviamos el comprobante por correo.', ['Volver al inicio', 's-bn-inicio'], ['Hacer otra transferencia', 's-bn-transferir']),
    },
    {
      id: 's-bn-creditos',
      name: 'Créditos',
      breakpoint: 'mobile',
      blocks: [
        appBar('bn-cr-app'),
        b('bn-cr-preaprobado', 'menuList', 'Tienes un **crédito preaprobado**', {
          componentId: 'cmp-bn-menu',
          detail: 'Simula y pide tu crédito por hasta **$12.500.000**',
          value: 'money',
          options: ['Simular nuevo crédito|Con abono inmediato a tu cuenta|cashCard', 'Simula y compara|Te ofrecemos distintas alternativas para una misma simulación.|compare'],
          optionTargets: { 'Simular nuevo crédito': 's-bn-simulacion', 'Simula y compara': 's-bn-simulacion' },
        }),
        b('bn-cr-deudas', 'menuList', 'Agrupa tus deudas en un solo crédito', { componentId: 'cmp-bn-menu', options: ['Consolida tus deudas|Monto para ordenar tus deudas|debts'] }),
        b('bn-cr-opinion', 'menuList', '', {
          componentId: 'cmp-bn-menu',
          options: ['Ayúdanos a mejorar tu experiencia|Déjanos tus comentarios sobre lo que te gustaría encontrar en esta sección.|feedback'],
          optionTargets: { 'Ayúdanos a mejorar tu experiencia': 's-bn-encuesta' },
        }),
        tabBar('bn-cr-nav', 'Créditos'),
      ],
    },
    {
      id: 's-bn-simulacion',
      name: 'Simulación crédito consumo',
      breakpoint: 'mobile',
      blocks: [
        titleBar('bn-si-titulo', 'Simulación crédito consumo', { value: 'feedback', detail: 'Danos tu opinión', optionTargets: { right: 's-bn-encuesta' } }),
        b('bn-si-intro', 'text', 'Tienes un monto preaprobado, con abono inmediato a tu cuenta de hasta:'),
        b('bn-si-tope', 'heading', '$ 12.500.000', { variant: 'display' }),
        b('bn-si-monto', 'amount', '¿Cuánto necesitas?', { componentId: 'cmp-bn-amount', detail: '$', required: true }),
        b('bn-si-minimo', 'text', 'Solicita montos desde $100.000', { variant: 'caption' }),
        b('bn-si-cuotas-titulo', 'heading', '¿En cuántas cuotas?', { componentId: 'cmp-bn-title', detail: 'Desliza y selecciona para simular hasta en 48 cuotas.' }),
        b('bn-si-cuotas', 'radio', 'Número de cuotas', { componentId: 'cmp-bn-cuotas', options: ['6', '12', '18', '24', '36', '48'], required: true }),
        b('bn-si-ayuda', 'help', 'Cantidad mínima de cuotas', { componentId: 'cmp-bn-help', detail: 'La cantidad mínima de cuotas se calcula según el monto de tu solicitud.' }),
        b('bn-si-continuar', 'button', 'Continuar', { componentId: 'cmp-bn-button', action: 'navigate', target: 's-bn-resumen-credito', disableUntilValid: true }),
      ],
    },
    {
      id: 's-bn-resumen-credito',
      name: 'Resumen del crédito',
      breakpoint: 'mobile',
      blocks: [
        titleBar('bn-rc-titulo', 'Resumen de tu crédito'),
        b('bn-rc-cuota', 'accountCard', 'Valor cuota aproximado', {
          componentId: 'cmp-bn-summary',
          detail: 'Primera cuota en octubre de 2026',
          value: '$ 246.900',
          options: ['Tasa de interés mensual|1,29%', 'Carga anual equivalente (CAE)|17,4%', 'Costo total del crédito|$ 5.925.600'],
          action: 'none',
        }),
        b('bn-rc-ayuda', 'help', 'Simulación referencial', { componentId: 'cmp-bn-help', detail: 'Este prototipo no solicita ningún crédito real.' }),
        b('bn-rc-solicitar', 'button', 'Solicitar crédito', { componentId: 'cmp-bn-button', action: 'navigate', target: 's-bn-credito-exito' }),
        b('bn-rc-volver', 'button', 'Volver a simular', { componentId: 'cmp-bn-button-secondary', action: 'back' }),
      ],
    },
    {
      id: 's-bn-credito-exito',
      name: 'Crédito solicitado',
      breakpoint: 'mobile',
      terminal: true,
      blocks: success('bn-ce', '¡Tu crédito está en camino!', 'Abonaremos el monto en tu cuenta corriente en minutos.', ['Evaluar mi experiencia', 's-bn-encuesta'], ['Volver al inicio', 's-bn-inicio']),
    },
    {
      id: 's-bn-encuesta',
      name: 'Encuesta de satisfacción',
      breakpoint: 'mobile',
      blocks: [
        titleBar('bn-en-titulo', 'Tu opinión'),
        b('bn-en-nota', 'rating', '¿Cómo evaluarías la solicitud de crédito de consumo?', { componentId: 'cmp-bn-rating', required: true }),
        b('bn-en-comentario', 'textarea', '¿Por qué nos evalúas con esta nota?', { componentId: 'cmp-bn-textarea', detail: 'Escribe tu comentario', required: true }),
        b('bn-en-enviar', 'button', 'ENVIAR', { componentId: 'cmp-bn-survey', action: 'navigate', target: 's-bn-gracias' }),
      ],
    },
    {
      id: 's-bn-gracias',
      name: 'Gracias por tu opinión',
      breakpoint: 'mobile',
      terminal: true,
      blocks: success('bn-gr', '¡Gracias por tu opinión!', 'Tus comentarios nos ayudan a mejorar la solicitud de créditos.', ['Volver al inicio', 's-bn-inicio']),
    },
    {
      id: 's-bn-inversiones',
      name: 'Mis Inversiones',
      breakpoint: 'mobile',
      blocks: [
        appBar('bn-inv-app'),
        investTabs('bn-inv-tabs', 'Mis Inversiones'),
        b('bn-inv-perfil', 'listItem', 'Tu perfil inversionista asignado es: **Balanceado**', { componentId: 'cmp-bn-profile', detail: 'Conoce más o cambia tu perfil', action: 'none' }),
        b('bn-inv-resumen', 'accountCard', 'Resumen total inversiones', {
          componentId: 'cmp-bn-summary',
          detail: 'Saldo al día 12/09/2026',
          value: '$ 2.450.000',
          options: ['Rentabilidad|3,8%|Últimos 6 meses|up'],
          linkLabel: 'Ver detalle',
          action: 'none',
        }),
        b('bn-inv-hoy', 'menuList', 'Qué quieres hacer hoy', { componentId: 'cmp-bn-menu', options: ['Seguimiento de tus carteras|Conoce la evolución y rentabilidad de cada una de tus carteras.|briefcase'] }),
        tabBar('bn-inv-nav', 'Inversiones'),
      ],
    },
    {
      id: 's-bn-invierte',
      name: 'Invierte',
      breakpoint: 'mobile',
      blocks: [
        appBar('bn-iv-app'),
        investTabs('bn-iv-tabs', 'Invierte'),
        b('bn-iv-perfil', 'listItem', 'Tu perfil de inversionista es: **Balanceado**', { componentId: 'cmp-bn-profile', detail: 'Conoce más o cambia tu perfil', action: 'none' }),
        b('bn-iv-destacado', 'carousel', 'Productos destacados', {
          componentId: 'cmp-bn-feature',
          options: [
            'deposit|Conoce la tasa de tu **Depósito a Plazo**|Invierte desde $5.000 en Depósito a Plazo y comienza a ganar intereses.|Ver más',
            'chart|Fondos Mutuos para **tu perfil**|Diversifica tus ahorros según tu perfil de riesgo.|Ver más',
          ],
        }),
        b('bn-iv-alternativas', 'menuList', 'Alternativas de inversión para ti', {
          componentId: 'cmp-bn-menu',
          options: ['Fondos Mutuos|Reúne los aportes de dinero en un fondo común para obtener ganancias.|funds', 'Depósito a Plazo|Invierte un monto por un plazo definido y con tasa conocida.|clock'],
        }),
        tabBar('bn-iv-nav', 'Inversiones'),
      ],
    },
    {
      id: 's-bn-menu',
      name: 'Menú',
      breakpoint: 'mobile',
      blocks: [
        b('bn-me-cerrar', 'navbar', '', { componentId: 'cmp-bn-closebar', action: 'back' }),
        b('bn-me-avatar', 'avatar', 'Valentina Rojas', { componentId: 'cmp-bn-avatar', detail: 'Cliente New desde 2019' }),
        b('bn-me-opciones', 'menuList', 'Menú de cuenta', {
          componentId: 'cmp-bn-menu-plain',
          options: ['Mi información||user', 'Mis configuraciones||gear', 'Ayuda y contacto||chat', 'Beneficios||gift', 'Vale vista||voucher', 'Danos tu opinión||feedback'],
          optionTargets: { 'Danos tu opinión': 's-bn-encuesta' },
        }),
        b('bn-me-salir', 'listItem', 'Cerrar sesión', { componentId: 'cmp-bn-logout', detail: 'Versión 1.0.0', action: 'none' }),
      ],
    },
    {
      id: 's-bn-notificaciones',
      name: 'Notificaciones',
      breakpoint: 'mobile',
      blocks: [
        titleBar('bn-no-titulo', 'Notificaciones', { value: 'gear', detail: 'Configurar notificaciones' }),
        b('bn-no-ayer', 'heading', 'Ayer', { componentId: 'cmp-bn-title' }),
        b('bn-no-pago', 'listItem', '¡Recibiste un pago! Ingresa a la App para ver tu saldo.', { componentId: 'cmp-bn-notification', detail: '00:29 hrs.', action: 'none' }),
        b('bn-no-domingo', 'heading', 'Domingo 6 de septiembre', { componentId: 'cmp-bn-title' }),
        b('bn-no-compra', 'listItem', 'El 06/09/2026 a las 15:40 hrs. se realizó una compra por $9.000 con tu tarjeta de débito terminada en 4821.', { componentId: 'cmp-bn-notification', detail: '15:40 hrs.', action: 'none' }),
        b('bn-no-martes', 'heading', 'Martes 1 de septiembre', { componentId: 'cmp-bn-title' }),
        b('bn-no-transferencia', 'listItem', '¡Recibiste una transferencia! Ingresa a la App para ver más detalles.', { componentId: 'cmp-bn-notification', detail: '12:55 hrs.', value: 'read', action: 'none' }),
      ],
    },
  ];
}

export function bancoNewProject(ownerId: string, name = 'Banco New'): Project {
  const now = Date.now();
  return {
    id: uid('p_'),
    name,
    brand: 'New',
    business: 'Banca personal',
    tagline: 'Tu banco, en simple.',
    summary: 'App móvil · Cuentas, transferencias, créditos e inversiones',
    flowName: 'App Banco New',
    statusBar: 'wave',
    backgroundStyle: 'gradient',
    owner: ownerId,
    version: 1,
    startScreenId: 's-bn-inicio',
    tokens: bancoNewTokens(),
    components: bancoNewComponents(),
    screens: bancoNewScreens(),
    createdAt: now,
    updatedAt: now,
  };
}
