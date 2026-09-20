import type { Block, BlockType, ColorToken, Component, ComponentCategory, Mode, Project, StateName, StyleProps, Tokens } from './model';
import { builtInStyle, componentStyle, contrast, hexToRgb, resolve } from './tokens';

// Catálogo de patrones: la biblioteca completa que tiene cada proyecto, con su guía de uso
// y contenido de ejemplo por variante. Es la fuente de las vistas previas y de lo que se inserta.

export type Category = 'navegacion' | 'acciones' | 'formularios' | 'contenido' | 'listas' | 'finanzas';

export const CATEGORIES: { id: Category | string; label: string }[] = [
  { id: 'navegacion', label: 'Navegación' },
  { id: 'acciones', label: 'Acciones' },
  { id: 'formularios', label: 'Formularios' },
  { id: 'contenido', label: 'Contenido y feedback' },
  { id: 'listas', label: 'Listas y tarjetas' },
  { id: 'finanzas', label: 'Finanzas' },
];

export interface CatalogEntry {
  key: string;
  id: string;
  name: string;
  type: BlockType;
  variant?: string;
  variantLabel?: string;
  category: Category;
  summary: string;
  use: string[];
  avoid: string[];
  anatomy: string[];
  a11y: string;
  sample: Partial<Block>;
}

const DEFAULT_VARIANT: Partial<Record<BlockType, string>> = { button: 'primary', heading: 'title', carousel: 'promo' };

/** Clave de patrón: tipo y variante, con la variante por omisión de cada tipo. */
export const variantKey = (type: BlockType, variant?: string) => `${type}:${variant || DEFAULT_VARIANT[type] || ''}`;

type Seed = Omit<CatalogEntry, 'key'>;

const ENTRIES: Seed[] = [
  // ---------- Navegación ----------
  {
    id: 'cmp-navbar',
    name: 'Barra de marca',
    type: 'navbar',
    category: 'navegacion',
    summary: 'Encabezado con la marca y, si corresponde, la acción de volver.',
    use: ['Flujos donde la marca debe estar presente en cada paso.', 'Pantallas internas que necesitan volver al paso anterior.'],
    avoid: ['Pantallas principales con barra de la app: duplica la marca.'],
    anatomy: ['Marca', 'Texto junto a la marca', 'Campana', 'Acción volver'],
    a11y: 'El botón volver tiene nombre accesible y área táctil de 44 px.',
    sample: { label: '@brand', detail: 'DEMO', action: 'back' },
  },
  {
    id: 'cmp-navbar-app',
    name: 'Barra de la app',
    type: 'navbar',
    variant: 'app',
    variantLabel: 'app',
    category: 'navegacion',
    summary: 'Encabezado de las secciones principales con menú, marca, código QR y notificaciones.',
    use: ['Pantallas de primer nivel: inicio, productos, perfil.'],
    avoid: ['Pasos de un flujo: usa la barra de título con volver.'],
    anatomy: ['Menú', 'Marca', 'Código QR', 'Notificaciones'],
    a11y: 'Cada ícono tiene etiqueta («Menú», «Notificaciones») y se conecta a su pantalla por opción.',
    sample: { label: '@brand' },
  },
  {
    id: 'cmp-navbar-title',
    name: 'Barra de título',
    type: 'navbar',
    variant: 'title',
    variantLabel: 'título',
    category: 'navegacion',
    summary: 'Título de la pantalla con volver y una acción opcional a la derecha.',
    use: ['Pasos de un flujo y pantallas de detalle.'],
    avoid: ['Pantallas de primer nivel: no hay dónde volver.'],
    anatomy: ['Volver', 'Título', 'Ícono de acción'],
    a11y: 'El título es el nombre de la pantalla; el ícono derecho necesita una etiqueta que diga qué hace.',
    sample: { label: 'Detalle del movimiento', action: 'back', value: 'info', detail: 'Más información' },
  },
  {
    id: 'cmp-navbar-close',
    name: 'Barra de cierre',
    type: 'navbar',
    variant: 'close',
    variantLabel: 'cierre',
    category: 'navegacion',
    summary: 'Título y botón cerrar para hojas inferiores, menús y modales.',
    use: ['Hojas inferiores y pantallas que se cierran en vez de volver.'],
    avoid: ['Flujos de varios pasos: cerrar hace perder el avance.'],
    anatomy: ['Título', 'Cerrar'],
    a11y: 'El botón cerrar se llama «Cerrar» y vuelve a la pantalla anterior.',
    sample: { label: 'Accesos rápidos', action: 'back' },
  },
  {
    id: 'cmp-tabbar',
    name: 'Barra inferior',
    type: 'tabBar',
    category: 'navegacion',
    summary: 'Navegación principal fija abajo, con la sección actual destacada.',
    use: ['Entre tres y cinco secciones de primer nivel.'],
    avoid: ['Acciones puntuales o más de cinco destinos.'],
    anatomy: ['Ícono', 'Etiqueta', 'Estado activo', 'Botón central opcional'],
    a11y: 'La sección actual se anuncia como página actual; cada opción tiene texto visible.',
    sample: { label: 'Navegación principal', options: ['Inicio|wallet', 'Pagos|receipt', 'Más|plus', 'Productos|card', 'Perfil|user'], value: 'Inicio' },
  },
  {
    id: 'cmp-tabs',
    name: 'Pestañas segmentadas',
    type: 'tabs',
    category: 'navegacion',
    summary: 'Cambia entre vistas de un mismo contenido sin salir de la pantalla.',
    use: ['Filtros de periodo o estado con dos a cuatro opciones.'],
    avoid: ['Navegar a secciones distintas: usa pestañas subrayadas o la barra inferior.'],
    anatomy: ['Contenedor', 'Opción', 'Opción seleccionada'],
    a11y: 'Funciona como grupo de pestañas con la opción seleccionada anunciada.',
    sample: { label: 'Periodo', options: ['Semana', 'Mes', 'Año'], value: 'Mes' },
  },
  {
    id: 'cmp-tabs-underline',
    name: 'Pestañas',
    type: 'tabs',
    variant: 'underline',
    variantLabel: 'subrayadas',
    category: 'navegacion',
    summary: 'Secciones hermanas de una misma área, con subrayado en la actual.',
    use: ['Subsecciones de una sección principal, como Cuentas, Tarjetas y Finanzas.'],
    avoid: ['Filtros rápidos dentro de una lista.'],
    anatomy: ['Opción', 'Indicador activo', 'Divisor'],
    a11y: 'El indicador no depende solo del color: cambia también el grosor del subrayado.',
    sample: { label: 'Secciones', options: ['Cuentas', 'Tarjetas', 'Finanzas'], value: 'Cuentas' },
  },
  {
    id: 'cmp-link',
    name: 'Enlace',
    type: 'link',
    category: 'navegacion',
    summary: 'Acción terciaria o navegación secundaria dentro del contenido.',
    use: ['Ver más, ver detalle o acciones que no compiten con el botón principal.'],
    avoid: ['La acción principal de la pantalla.'],
    anatomy: ['Texto subrayado'],
    a11y: 'El texto dice adónde lleva; evita «clic aquí».',
    sample: { label: 'Ver todos los movimientos' },
  },

  // ---------- Acciones ----------
  {
    id: 'cmp-btn-primary',
    name: 'Botón',
    type: 'button',
    variant: 'primary',
    category: 'acciones',
    summary: 'La acción principal de la pantalla.',
    use: ['Continuar, confirmar o completar el objetivo de la pantalla.'],
    avoid: ['Más de un botón principal por pantalla.'],
    anatomy: ['Contenedor', 'Etiqueta', 'Chevron cuando navega'],
    a11y: 'Etiqueta con verbo que dice qué pasa. Contraste de 4,5:1 y foco visible.',
    sample: { label: 'Continuar' },
  },
  {
    id: 'cmp-btn-secondary',
    name: 'Botón secundario',
    type: 'button',
    variant: 'secondary',
    category: 'acciones',
    summary: 'Acción alternativa que acompaña a la principal.',
    use: ['Cancelar, volver a editar o una segunda opción válida.'],
    avoid: ['Acciones destructivas sin confirmación.'],
    anatomy: ['Contenedor con borde', 'Etiqueta'],
    a11y: 'Se distingue del principal por forma y color, no solo por color.',
    sample: { label: 'Cancelar' },
  },
  {
    id: 'cmp-btn-success',
    name: 'Botón de envío',
    type: 'button',
    variant: 'success',
    category: 'acciones',
    summary: 'Envía una respuesta o confirma un cierre positivo, como una encuesta.',
    use: ['Encuestas y formularios de opinión.'],
    avoid: ['Operaciones de dinero: usa el botón principal.'],
    anatomy: ['Contenedor redondeado', 'Etiqueta'],
    a11y: 'El verde no es el único indicador: la etiqueta dice la acción.',
    sample: { label: 'Enviar' },
  },

  // ---------- Formularios ----------
  {
    id: 'cmp-input',
    name: 'Campo de texto',
    type: 'input',
    category: 'formularios',
    summary: 'Texto corto con etiqueta visible y ejemplo dentro del campo.',
    use: ['Nombres, correos, alias y datos de una línea.'],
    avoid: ['Montos (usa campo de monto) o textos largos (usa área de texto).'],
    anatomy: ['Etiqueta', 'Campo', 'Texto de ejemplo', 'Mensaje de error'],
    a11y: 'La etiqueta está siempre visible; el ejemplo no la reemplaza.',
    sample: { label: 'Nombre completo', detail: 'Ej: Francisca Soto' },
  },
  {
    id: 'cmp-search',
    name: 'Buscador',
    type: 'input',
    variant: 'search',
    variantLabel: 'buscador',
    category: 'formularios',
    summary: 'Filtra una lista por texto.',
    use: ['Listas de contactos, movimientos o productos con más de diez elementos.'],
    avoid: ['Listas cortas que caben en pantalla.'],
    anatomy: ['Ícono de búsqueda', 'Campo', 'Texto de ejemplo'],
    a11y: 'La etiqueta existe aunque no se vea; el ejemplo dice qué se puede buscar.',
    sample: { label: 'Buscar', detail: 'Busca por nombre o alias' },
  },
  {
    id: 'cmp-textarea',
    name: 'Área de texto',
    type: 'textarea',
    category: 'formularios',
    summary: 'Texto largo, como comentarios o motivos.',
    use: ['Respuestas abiertas y descripciones.'],
    avoid: ['Datos con formato conocido.'],
    anatomy: ['Etiqueta', 'Área de texto', 'Texto de ejemplo'],
    a11y: 'Tres líneas visibles como mínimo; la etiqueta dice qué se espera.',
    sample: { label: 'Comentario', detail: 'Cuéntanos qué pasó' },
  },
  {
    id: 'cmp-amount',
    name: 'Campo de monto',
    type: 'amount',
    category: 'formularios',
    summary: 'Montos de dinero con formato automático.',
    use: ['Transferencias, pagos, simulaciones y metas.'],
    avoid: ['Cantidades que no son dinero.'],
    anatomy: ['Etiqueta', 'Monto en tamaño display', 'Nota con topes'],
    a11y: 'Abre el teclado numérico y muestra el formato mientras se escribe.',
    sample: { label: 'Monto a transferir', detail: '$ 0' },
  },
  {
    id: 'cmp-select',
    name: 'Selector',
    type: 'select',
    category: 'formularios',
    summary: 'Elegir una opción entre muchas.',
    use: ['Más de cinco opciones, como cuentas o bancos.'],
    avoid: ['Pocas opciones: muéstralas con opciones visibles.'],
    anatomy: ['Etiqueta', 'Valor', 'Indicador de lista'],
    a11y: 'Usa el selector nativo del sistema para lectores de pantalla.',
    sample: { label: 'Cuenta de origen', options: ['Cuenta corriente', 'Cuenta vista'], detail: 'Selecciona una cuenta' },
  },
  {
    id: 'cmp-radio',
    name: 'Opciones',
    type: 'radio',
    category: 'formularios',
    summary: 'Elegir una opción entre pocas, todas visibles.',
    use: ['Dos a cinco opciones excluyentes.'],
    avoid: ['Opciones que se pueden combinar: usa casillas.'],
    anatomy: ['Etiqueta del grupo', 'Círculo', 'Texto de la opción'],
    a11y: 'Grupo con nombre; la opción elegida se anuncia.',
    sample: { label: 'Frecuencia', options: ['Una vez', 'Cada mes'], value: 'Cada mes' },
  },
  {
    id: 'cmp-radio-numbers',
    name: 'Selector de cuotas',
    type: 'radio',
    variant: 'numbers',
    variantLabel: 'números',
    category: 'formularios',
    summary: 'Elegir un número entre valores en fila, como cuotas o plazos.',
    use: ['Cuotas, plazos o cantidades con pocos valores posibles.'],
    avoid: ['Valores con texto largo.'],
    anatomy: ['Números', 'Indicador del valor elegido'],
    a11y: 'Cada número se anuncia con su unidad, por ejemplo «12 cuotas».',
    sample: { label: 'Número de cuotas', options: ['6', '12', '24', '36'], value: '12' },
  },
  {
    id: 'cmp-checkbox',
    name: 'Casilla',
    type: 'checkbox',
    category: 'formularios',
    summary: 'Aceptar condiciones o activar una opción independiente.',
    use: ['Consentimientos y opciones combinables.'],
    avoid: ['Preferencias con efecto inmediato: usa interruptor.'],
    anatomy: ['Casilla', 'Texto'],
    a11y: 'Todo el texto es clicable y el estado se anuncia.',
    sample: { label: 'Acepto los términos y condiciones', value: 'true' },
  },
  {
    id: 'cmp-switch',
    name: 'Interruptor',
    type: 'switch',
    category: 'formularios',
    summary: 'Enciende o apaga una preferencia con efecto inmediato.',
    use: ['Notificaciones, biometría o recordatorios.'],
    avoid: ['Opciones que se aplican al enviar un formulario.'],
    anatomy: ['Texto', 'Riel', 'Perilla'],
    a11y: 'Se anuncia como interruptor con estado encendido o apagado.',
    sample: { label: 'Notificaciones push', value: 'true' },
  },
  {
    id: 'cmp-rating',
    name: 'Calificación',
    type: 'rating',
    category: 'formularios',
    summary: 'Calificación de 1 a 5 estrellas para encuestas de satisfacción.',
    use: ['Evaluar una experiencia recién terminada.'],
    avoid: ['Preguntas que necesitan una respuesta concreta.'],
    anatomy: ['Pregunta', 'Estrellas'],
    a11y: 'Cada estrella se anuncia como «4 de 5».',
    sample: { label: '¿Cómo evaluarías tu experiencia?', value: '4' },
  },

  // ---------- Contenido y feedback ----------
  {
    id: 'cmp-heading',
    name: 'Título',
    type: 'heading',
    variant: 'title',
    category: 'contenido',
    summary: 'Título de la pantalla o de una sección, con texto de apoyo opcional.',
    use: ['Encabezar la pantalla y sus secciones.'],
    avoid: ['Textos largos o párrafos.'],
    anatomy: ['Título', 'Texto de apoyo'],
    a11y: 'Un título por nivel; los lectores de pantalla navegan por títulos.',
    sample: { label: 'Tus movimientos', detail: 'Últimos 30 días' },
  },
  {
    id: 'cmp-heading-display',
    name: 'Cifra destacada',
    type: 'heading',
    variant: 'display',
    variantLabel: 'display',
    category: 'contenido',
    summary: 'Cifra o dato principal en tamaño grande.',
    use: ['Montos preaprobados, saldos o resultados de una simulación.'],
    avoid: ['Títulos de texto: usa el título.'],
    anatomy: ['Cifra'],
    a11y: 'La cifra se acompaña de un texto que explica qué es.',
    sample: { label: '$ 12.500.000' },
  },
  {
    id: 'cmp-text',
    name: 'Texto',
    type: 'text',
    category: 'contenido',
    summary: 'Explicaciones breves para dar contexto.',
    use: ['Instrucciones y descripciones cortas.'],
    avoid: ['Acciones: usa botón o enlace.'],
    anatomy: ['Párrafo'],
    a11y: 'Frases cortas, menos de 80 caracteres por línea.',
    sample: { label: 'Revisa los datos antes de confirmar la operación.' },
  },
  {
    id: 'cmp-text-muted',
    name: 'Texto secundario',
    type: 'text',
    variant: 'muted',
    variantLabel: 'secundario',
    category: 'contenido',
    summary: 'Información de apoyo que no compite con el contenido principal.',
    use: ['Fechas de actualización y aclaraciones.'],
    avoid: ['Información necesaria para decidir.'],
    anatomy: ['Párrafo atenuado'],
    a11y: 'Mantiene 4,5:1 de contraste aunque se vea atenuado.',
    sample: { label: 'Actualizado hace 5 minutos' },
  },
  {
    id: 'cmp-caption',
    name: 'Nota',
    type: 'text',
    variant: 'caption',
    variantLabel: 'nota',
    category: 'contenido',
    summary: 'Nota breve bajo un campo o una cifra.',
    use: ['Topes, costos y condiciones cortas.'],
    avoid: ['Mensajes de error.'],
    anatomy: ['Texto pequeño'],
    a11y: 'Tamaño mínimo de 12 px.',
    sample: { label: 'Sin costo. Tope diario: $5.000.000.' },
  },
  {
    id: 'cmp-help',
    name: 'Mensaje de ayuda',
    type: 'help',
    category: 'contenido',
    summary: 'Ayuda contextual antes de una decisión.',
    use: ['Tranquilizar o aclarar el siguiente paso.'],
    avoid: ['Errores: usa aviso de error.'],
    anatomy: ['Ícono de información', 'Título', 'Detalle'],
    a11y: 'El ícono es decorativo; el texto se entiende solo.',
    sample: { label: 'Transferencia sin costo', detail: 'Llega en segundos a cualquier banco.' },
  },
  {
    id: 'cmp-alert',
    name: 'Aviso',
    type: 'alert',
    category: 'contenido',
    summary: 'Mensaje de éxito después de una acción.',
    use: ['Confirmar que algo se guardó o se envió.'],
    avoid: ['Información permanente.'],
    anatomy: ['Contenedor', 'Mensaje', 'Detalle'],
    a11y: 'Se anuncia como estado sin mover el foco.',
    sample: { label: 'Transferencia enviada', detail: 'Te enviamos el comprobante por correo.' },
  },
  {
    id: 'cmp-alert-danger',
    name: 'Aviso de error',
    type: 'alert',
    variant: 'danger',
    variantLabel: 'error',
    category: 'contenido',
    summary: 'Explica qué falló y cómo resolverlo.',
    use: ['Errores de conexión, validación del servidor o rechazos.'],
    avoid: ['Errores de un campo: muéstralos bajo el campo.'],
    anatomy: ['Contenedor', 'Qué pasó', 'Cómo resolverlo'],
    a11y: 'No depende solo del rojo: el texto dice que es un error.',
    sample: { label: 'No pudimos completar la operación', detail: 'Revisa tu conexión e inténtalo de nuevo.' },
  },
  {
    id: 'cmp-tag',
    name: 'Etiqueta',
    type: 'tag',
    category: 'contenido',
    summary: 'Estado o categoría breve de un elemento.',
    use: ['Nuevo, pendiente o destacado.'],
    avoid: ['Acciones: una etiqueta no se toca.'],
    anatomy: ['Contenedor redondeado', 'Texto'],
    a11y: 'Una o dos palabras con contraste suficiente.',
    sample: { label: 'Nuevo' },
  },
  {
    id: 'cmp-avatar',
    name: 'Avatar',
    type: 'avatar',
    category: 'contenido',
    summary: 'Identifica a una persona con sus iniciales.',
    use: ['Perfil, menú lateral y contactos.'],
    avoid: ['Marcas o productos.'],
    anatomy: ['Iniciales', 'Nombre', 'Detalle'],
    a11y: 'Las iniciales son decorativas; el nombre está en texto.',
    sample: { label: 'Francisca Soto', detail: 'Cliente desde 2019' },
  },
  {
    id: 'cmp-status',
    name: 'Ícono de estado',
    type: 'statusIcon',
    category: 'contenido',
    summary: 'Confirma visualmente el resultado de una acción.',
    use: ['Pantallas de éxito.'],
    avoid: ['Como único mensaje: acompáñalo de un título.'],
    anatomy: ['Círculo', 'Ícono'],
    a11y: 'Tiene nombre accesible, por ejemplo «Operación exitosa».',
    sample: { label: 'Operación exitosa' },
  },
  {
    id: 'cmp-progress',
    name: 'Progreso',
    type: 'progress',
    category: 'contenido',
    summary: 'Avance hacia una meta o paso de un proceso.',
    use: ['Metas de ahorro y procesos de varios pasos.'],
    avoid: ['Cargas indeterminadas.'],
    anatomy: ['Etiqueta', 'Detalle', 'Barra', 'Relleno'],
    a11y: 'Expone el porcentaje como valor de la barra.',
    sample: { label: 'Meta de ahorro', detail: '40% de $500.000', value: '40' },
  },
  {
    id: 'cmp-image',
    name: 'Imagen',
    type: 'image',
    category: 'contenido',
    summary: 'Ilustración o foto de apoyo.',
    use: ['Pantallas de bienvenida o estados vacíos.'],
    avoid: ['Texto dentro de la imagen.'],
    anatomy: ['Imagen 16:9'],
    a11y: 'Texto alternativo que describe la imagen.',
    sample: { label: 'Ilustración de bienvenida' },
  },
  {
    id: 'cmp-divider',
    name: 'Separador',
    type: 'divider',
    category: 'contenido',
    summary: 'Separa grupos de contenido.',
    use: ['Agrupar secciones sin tarjetas.'],
    avoid: ['Separar cada fila de una lista: la lista ya tiene divisores.'],
    anatomy: ['Línea'],
    a11y: 'Es decorativo.',
    sample: { label: '' },
  },

  // ---------- Listas y tarjetas ----------
  {
    id: 'cmp-card',
    name: 'Tarjeta',
    type: 'card',
    category: 'listas',
    summary: 'Opción navegable con ícono, título y descripción.',
    use: ['Productos o caminos que se eligen tocando.'],
    avoid: ['Contenido que no lleva a ningún lugar.'],
    anatomy: ['Ícono', 'Título', 'Descripción', 'Indicador de navegación'],
    a11y: 'Toda la tarjeta es el área táctil y tiene un solo destino.',
    sample: { label: 'Alcancía', detail: 'Ahorra para tus metas' },
  },
  {
    id: 'cmp-list',
    name: 'Fila de lista',
    type: 'listItem',
    category: 'listas',
    summary: 'Filas de una lista, como movimientos.',
    use: ['Movimientos, pagos y elementos repetidos.'],
    avoid: ['Opciones de navegación agrupadas: usa lista de opciones.'],
    anatomy: ['Título', 'Detalle', 'Chevron cuando navega'],
    a11y: 'Cada fila es un solo elemento para el lector de pantalla.',
    sample: { label: 'Supermercado Central', detail: '12 sep · Compra con débito' },
  },
  {
    id: 'cmp-row-icon',
    name: 'Fila destacada',
    type: 'listItem',
    variant: 'icon',
    variantLabel: 'destacada',
    category: 'listas',
    summary: 'Fila en tarjeta con ícono para un dato que merece atención.',
    use: ['Cashback, beneficios o avisos que llevan a un detalle.'],
    avoid: ['Listas largas.'],
    anatomy: ['Ícono', 'Texto con énfasis', 'Chevron'],
    a11y: 'El énfasis también se entiende sin negritas.',
    sample: { label: 'Cashback disponible: **$1.450**', value: 'coin' },
  },
  {
    id: 'cmp-row-profile',
    name: 'Fila de perfil',
    type: 'listItem',
    variant: 'profile',
    variantLabel: 'perfil',
    category: 'listas',
    summary: 'Muestra un perfil asignado y lleva a conocerlo o cambiarlo.',
    use: ['Perfil de inversionista o nivel de cliente.'],
    avoid: ['Datos personales editables.'],
    anatomy: ['Ilustración', 'Perfil', 'Acción'],
    a11y: 'La ilustración es decorativa.',
    sample: { label: 'Tu perfil inversionista es **Moderado**', detail: 'Conoce más o cambia tu perfil' },
  },
  {
    id: 'cmp-row-contact',
    name: 'Fila de contacto',
    type: 'listItem',
    variant: 'contact',
    variantLabel: 'contacto',
    category: 'listas',
    summary: 'Destinatario con alias y datos bancarios.',
    use: ['Listas de destinatarios.'],
    avoid: ['Contactos sin datos que los diferencien.'],
    anatomy: ['Nombre y alias', 'Cuenta', 'Banco', 'Más opciones'],
    a11y: 'Nombre y alias se leen antes que los números de cuenta.',
    sample: { label: '**Martina Rojas** · Hermana', detail: 'Cuenta Corriente N.º 99001122\nBanco New' },
  },
  {
    id: 'cmp-row-notification',
    name: 'Notificación',
    type: 'listItem',
    variant: 'notification',
    variantLabel: 'notificación',
    category: 'listas',
    summary: 'Mensaje con hora y marca de no leído.',
    use: ['Centro de notificaciones.'],
    avoid: ['Mensajes que requieren una acción inmediata.'],
    anatomy: ['Ícono', 'Mensaje', 'Hora', 'Punto de no leído'],
    a11y: 'El punto de no leído tiene texto alternativo.',
    sample: { label: '¡Recibiste una transferencia! Ingresa para ver el detalle.', detail: '12:55 hrs.' },
  },
  {
    id: 'cmp-row-logout',
    name: 'Cerrar sesión',
    type: 'listItem',
    variant: 'logout',
    variantLabel: 'cerrar sesión',
    category: 'listas',
    summary: 'Salida de la cuenta al final del menú.',
    use: ['Menú lateral o perfil.'],
    avoid: ['Pantallas de un flujo.'],
    anatomy: ['Ícono de encendido', 'Texto', 'Versión'],
    a11y: 'La acción se confirma antes de cerrar la sesión.',
    sample: { label: 'Cerrar sesión', detail: 'Versión 1.0.0' },
  },
  {
    id: 'cmp-menu',
    name: 'Lista de opciones',
    type: 'menuList',
    category: 'listas',
    summary: 'Tarjeta con opciones navegables: título, descripción e ícono por fila.',
    use: ['Agrupar caminos relacionados, como tipos de transferencia.'],
    avoid: ['Datos que no navegan: usa lista de datos.'],
    anatomy: ['Título de la tarjeta', 'Ilustración opcional', 'Filas con ícono, título, descripción y chevron'],
    a11y: 'Cada fila es un botón con su título como nombre.',
    sample: { label: 'Opciones de tu cuenta', options: ['Cartola|Descarga tus movimientos|doc', 'Configuración|Límites y seguridad|gear'] },
  },
  {
    id: 'cmp-menu-info',
    name: 'Lista de datos',
    type: 'menuList',
    variant: 'info',
    variantLabel: 'datos',
    category: 'listas',
    summary: 'Resumen de datos sin navegación, como una confirmación.',
    use: ['Revisar antes de confirmar una operación.'],
    avoid: ['Opciones que se tocan.'],
    anatomy: ['Título', 'Filas con ícono, etiqueta y valor'],
    a11y: 'La etiqueta se lee antes que el valor.',
    sample: { label: 'Resumen de la operación', options: ['Destinatario|Martina Rojas|user', 'Monto|$ 50.000|cashCard'] },
  },
  {
    id: 'cmp-menu-plain',
    name: 'Menú lateral',
    type: 'menuList',
    variant: 'plain',
    variantLabel: 'menú',
    category: 'listas',
    summary: 'Opciones de cuenta sin tarjeta, a pantalla completa.',
    use: ['Menú de la app.'],
    avoid: ['Dentro de otras tarjetas.'],
    anatomy: ['Ícono', 'Opción', 'Chevron', 'Divisor'],
    a11y: 'Filas de 56 px de alto como mínimo.',
    sample: { label: 'Menú', options: ['Mi información||user', 'Ayuda y contacto||chat', 'Beneficios||gift'] },
  },
  {
    id: 'cmp-carousel-promo',
    name: 'Carrusel de promociones',
    type: 'carousel',
    variant: 'promo',
    variantLabel: 'promociones',
    category: 'listas',
    summary: 'Promociones deslizables con ilustración y texto corto.',
    use: ['Ofertas y novedades en el inicio.'],
    avoid: ['Información necesaria para completar una tarea.'],
    anatomy: ['Tarjetas', 'Ilustración', 'Texto con énfasis', 'Indicador de posición'],
    a11y: 'Se puede recorrer con teclado y no avanza solo.',
    sample: { label: 'Promociones', options: ['gift|Beneficios **exclusivos** para ti', 'rocket|Seguro de auto con **descuento**'] },
  },
  {
    id: 'cmp-carousel-contacts',
    name: 'Carrusel de contactos',
    type: 'carousel',
    variant: 'contacts',
    variantLabel: 'contactos',
    category: 'listas',
    summary: 'Destinatarios frecuentes para empezar una transferencia con un toque.',
    use: ['Accesos a los contactos más usados.'],
    avoid: ['La lista completa de destinatarios.'],
    anatomy: ['Iniciales', 'Nombre', 'Alias'],
    a11y: 'Cada tarjeta se anuncia con el nombre del contacto.',
    sample: { label: 'Destinatarios frecuentes', options: ['MR|Martina Rojas|Hermana', 'DF|Diego Fuentes|Arriendo'] },
  },
  {
    id: 'cmp-carousel-feature',
    name: 'Destacado',
    type: 'carousel',
    variant: 'feature',
    variantLabel: 'destacado',
    category: 'listas',
    summary: 'Producto destacado con descripción y enlace.',
    use: ['Presentar un producto recomendado.'],
    avoid: ['Más de tres destacados seguidos.'],
    anatomy: ['Título con énfasis', 'Descripción', 'Ilustración', 'Enlace'],
    a11y: 'El enlace dice adónde lleva.',
    sample: { label: 'Destacado', options: ['deposit|Conoce tu **Depósito a Plazo**|Invierte desde $5.000 y gana intereses.|Ver más'] },
  },
  {
    id: 'cmp-grid-card',
    name: 'Accesos rápidos en tarjeta',
    type: 'iconGrid',
    category: 'listas',
    summary: 'Accesos directos en grilla de íconos, dentro de una tarjeta.',
    use: ['Atajos a funciones frecuentes en una pantalla.'],
    avoid: ['Más de doce accesos.'],
    anatomy: ['Tarjeta', 'Ícono', 'Etiqueta'],
    a11y: 'Cada acceso tiene texto visible.',
    sample: { label: 'Accesos rápidos', options: ['Pagos|receipt', 'Seguros|shield', 'Beneficios|gift', 'Pago QR|qr'] },
  },
  {
    id: 'cmp-grid-flat',
    name: 'Accesos rápidos',
    type: 'iconGrid',
    variant: 'flat',
    variantLabel: 'sin tarjeta',
    category: 'listas',
    summary: 'Grilla de accesos sin tarjeta, pensada para hojas inferiores.',
    use: ['Dentro de una hoja inferior.'],
    avoid: ['Sobre fondos de color: pierde contraste.'],
    anatomy: ['Ícono', 'Etiqueta', 'Acceso activo'],
    a11y: 'El acceso activo se distingue por color y posición.',
    sample: { label: 'Accesos rápidos', options: ['Pagos|receipt', 'Seguros|shield', 'Beneficios|gift', 'Pago QR|qr'] },
  },

  // ---------- Finanzas ----------
  {
    id: 'cmp-balance',
    name: 'Saldo',
    type: 'balance',
    category: 'finanzas',
    summary: 'Saldo o monto destacado con su cuenta de referencia.',
    use: ['El dato principal del inicio.'],
    avoid: ['Listas de cuentas: usa tarjetas de cuenta.'],
    anatomy: ['Etiqueta', 'Monto', 'Cuenta', 'Referencia'],
    a11y: 'El monto se lee junto a su etiqueta.',
    sample: { label: 'Saldo disponible', value: '$ 1.850.000', detail: 'Cuenta corriente', options: ['•• 2840'] },
  },
  {
    id: 'cmp-account',
    name: 'Tarjeta de cuenta',
    type: 'accountCard',
    category: 'finanzas',
    summary: 'Saldo de una cuenta con su último movimiento y enlace al detalle.',
    use: ['Cada cuenta del cliente en el inicio.'],
    avoid: ['Resúmenes de varios productos.'],
    anatomy: ['Nombre de la cuenta', 'Saldo', 'Nota', 'Filas de movimiento', 'Enlace'],
    a11y: 'Ingresos y egresos se diferencian con ícono y texto, no solo color.',
    sample: { label: 'Cuenta Corriente 1048 2201', value: '$ 1.284.300', detail: 'Sobregiro disponible: $1.000.000', options: ['Abono|$610.000|De remuneraciones|in'], linkLabel: 'Más detalles' },
  },
  {
    id: 'cmp-account-summary',
    name: 'Tarjeta de resumen',
    type: 'accountCard',
    variant: 'summary',
    variantLabel: 'resumen',
    category: 'finanzas',
    summary: 'Resumen de un producto con cifra principal y filas de detalle.',
    use: ['Inversiones, simulaciones y confirmaciones.'],
    avoid: ['Cuentas con movimientos.'],
    anatomy: ['Título', 'Nota', 'Cifra', 'Filas de detalle', 'Enlace'],
    a11y: 'Las filas se leen como pares etiqueta y valor.',
    sample: { label: 'Resumen de inversiones', detail: 'Saldo al día de hoy', value: '$ 2.450.000', options: ['Rentabilidad|3,8%|Últimos 6 meses|up'], linkLabel: 'Ver detalle' },
  },
  {
    id: 'cmp-credit-card',
    name: 'Tarjeta de crédito',
    type: 'creditCard',
    category: 'finanzas',
    summary: 'Tarjeta con cupos utilizados y disponibles en pesos y dólares.',
    use: ['Resumen de cada tarjeta de crédito.'],
    avoid: ['Mostrar el número completo de la tarjeta.'],
    anatomy: ['Nombre', 'Titular y últimos dígitos', 'Red', 'Cupos', 'Acción'],
    a11y: 'Texto blanco sobre fondo oscuro con 7:1 de contraste.',
    sample: { label: 'Visa Signature', detail: 'Titular **** 4821', value: 'VISA', options: ['Utilizado|$ 185.400|US$ 0,00', 'Disponible|$ 2.814.600|US$ 1.200,00'], linkLabel: 'Ver datos' },
  },
  {
    id: 'cmp-finance',
    name: 'Resumen financiero',
    type: 'financeCard',
    category: 'finanzas',
    summary: 'Resumen con gráfico y métricas clave del mes.',
    use: ['Gastos, ingresos y proyecciones.'],
    avoid: ['Detalle de movimientos.'],
    anatomy: ['Título', 'Periodo', 'Gráfico', 'Métricas', 'Enlace'],
    a11y: 'El gráfico es decorativo: las métricas están en texto.',
    sample: { label: 'Compras del mes', detail: 'Septiembre', value: 'donut', options: ['Gasto total|$ 412.300|up', 'Transferencias|$ 208.900'], linkLabel: 'Ver detalle' },
  },
];

export const CATALOG: CatalogEntry[] = ENTRIES.map((e) => ({ ...e, key: variantKey(e.type, e.variant) }));

const BY_KEY = new Map(CATALOG.map((e) => [e.key, e]));

/** Entrada del catálogo para un tipo y variante; si la variante no existe, la del tipo. */
export function catalogEntry(type: BlockType, variant?: string): CatalogEntry {
  return BY_KEY.get(variantKey(type, variant)) ?? CATALOG.find((e) => e.type === type)!;
}

export const entryForComponent = (c: Pick<Component, 'type' | 'variant'>) => catalogEntry(c.type, c.variant);

// ---------- Categorías y contenido propios del proyecto ----------

export const projectCategories = (p: Pick<Project, 'categories'>): ComponentCategory[] => [...CATEGORIES, ...(p.categories ?? [])];

/** Categoría efectiva: la elegida si existe; si no, la del patrón. */
export function categoryOf(c: Pick<Component, 'type' | 'variant' | 'category'>, p?: Pick<Project, 'categories'>): string {
  if (c.category && (CATEGORIES.some((x) => x.id === c.category) || p?.categories?.some((x) => x.id === c.category))) return c.category;
  return catalogEntry(c.type, c.variant).category;
}

export const componentSummary = (c: Pick<Component, 'type' | 'variant' | 'description'>) => c.description?.trim() || catalogEntry(c.type, c.variant).summary;

/** Contenido de ejemplo de un componente: el propio sobre el del patrón. */
export function componentSample(c: Pick<Component, 'type' | 'variant' | 'sample'>, brand?: string): Partial<Block> {
  const own = Object.fromEntries(Object.entries(c.sample ?? {}).filter(([, v]) => v !== undefined));
  return { ...sampleContent(c.type, c.variant, brand), ...own };
}

/** Qué contenido se puede editar en cada patrón. */
export function contentFields(type: BlockType, variant?: string): { detail: boolean; value?: string; options: boolean; linkLabel: boolean } {
  const VALUE: Partial<Record<BlockType, string>> = {
    balance: 'Monto',
    progress: 'Porcentaje (0 a 100)',
    tabs: 'Opción seleccionada',
    tabBar: 'Opción seleccionada',
    iconGrid: 'Acceso activo',
    accountCard: 'Monto',
    creditCard: 'Red de la tarjeta',
    financeCard: 'Gráfico: donut, bars o vacío',
    rating: 'Valor (1 a 5)',
    radio: 'Opción seleccionada',
    checkbox: 'Marcada: escribe true',
    switch: 'Encendido: escribe true',
  };
  let value = VALUE[type];
  if (type === 'navbar' && variant === 'title') value = 'Ícono a la derecha (ej: info, gear)';
  if (type === 'listItem' && variant === 'icon') value = 'Ícono (ej: coin, card, info)';
  if (type === 'listItem' && variant === 'notification') value = 'Estado: escribe read si ya se leyó';
  if (type === 'menuList' && !variant) value = 'Ilustración (money, rocket, deposit…)';
  return {
    detail: ['navbar', 'heading', 'balance', 'help', 'card', 'input', 'textarea', 'amount', 'select', 'listItem', 'alert', 'avatar', 'progress', 'menuList', 'accountCard', 'creditCard', 'financeCard'].includes(type),
    value,
    options: ['select', 'radio', 'tabs', 'tabBar', 'menuList', 'accountCard', 'creditCard', 'carousel', 'financeCard', 'iconGrid', 'balance'].includes(type),
    linkLabel: ['accountCard', 'creditCard', 'financeCard'].includes(type),
  };
}

export const OPTION_HINT: Partial<Record<BlockType, string>> = {
  tabBar: 'Una por línea: Etiqueta|ícono. Ícono «plus» para el botón central.',
  menuList: 'Una por línea: Título|Subtítulo|ícono.',
  accountCard: 'Filas: Etiqueta|Valor|Detalle|in, out o up.',
  creditCard: 'Columnas: Etiqueta|Monto|Monto en dólares.',
  carousel: 'Contactos: Iniciales|Nombre|Detalle. Promociones: emoji|Texto. Destacado: emoji|Título|Descripción|Enlace.',
  financeCard: 'Métricas: Etiqueta|Valor|in o up.',
  iconGrid: 'Una por línea: Etiqueta|ícono.',
  balance: 'Referencia de la cuenta, ej: •• 2840.',
};

/** Contenido de ejemplo listo para un bloque, con la marca del proyecto donde corresponde. */
export function sampleContent(type: BlockType, variant?: string, brand?: string): Partial<Block> {
  const e = catalogEntry(type, variant);
  const sample = JSON.parse(JSON.stringify(e.sample)) as Partial<Block>;
  if (sample.label === '@brand') sample.label = brand || 'Marca';
  return sample;
}

// ---------- Completar el sistema de cada proyecto ----------

/** Colores que usan los estilos base. Si un proyecto no los tiene, se agregan con estos valores. */
export const REQUIRED_COLORS: ColorToken[] = [
  { name: 'background', light: '#FFFFFF', dark: '#0E1318', description: 'Fondo de pantalla' },
  { name: 'surface', light: '#FFFFFF', dark: '#182028', description: 'Tarjetas y campos' },
  { name: 'subtle', light: '#F3F5F8', dark: '#1F2731', description: 'Fondos secundarios' },
  { name: 'onSurface', light: '#1B1F24', dark: '#E8ECF0', description: 'Texto principal' },
  { name: 'muted', light: '#5F6773', dark: '#9BA7B4', description: 'Texto secundario' },
  { name: 'border', light: '#E3E7EC', dark: '#2F3A46', description: 'Bordes' },
  { name: 'primary', light: '#0074C8', dark: '#5AB0F0', description: 'Acción principal' },
  { name: 'primaryHover', light: '#0068B4', dark: '#78BFF3' },
  { name: 'primaryPressed', light: '#005A9C', dark: '#9ACFF6' },
  { name: 'primarySubtle', light: '#EAF3FB', dark: '#10283B', description: 'Fondo suave de marca' },
  { name: 'onPrimary', light: '#FFFFFF', dark: '#03203A', description: 'Texto sobre acción principal' },
  { name: 'focus', light: '#E0A100', dark: '#FFC940', description: 'Anillo de foco' },
  { name: 'danger', light: '#C62828', dark: '#FF8A80', description: 'Errores' },
  { name: 'dangerSubtle', light: '#FDECEC', dark: '#3A1F1E' },
  { name: 'success', light: '#1B7F50', dark: '#6FD69C', description: 'Confirmación' },
  { name: 'successSubtle', light: '#E6F6EE', dark: '#173327' },
  { name: 'warning', light: '#9A5B00', dark: '#F2A65A', description: 'Advertencias' },
  { name: 'star', light: '#F5C518', dark: '#F5C518', description: 'Calificación' },
  { name: 'cardDark', light: '#3A3A3F', dark: '#3A3A3F', description: 'Tarjeta de crédito' },
  { name: 'cardDarkEnd', light: '#111113', dark: '#111113' },
  { name: 'onDark', light: '#FFFFFF', dark: '#FFFFFF', description: 'Texto sobre tarjeta oscura' },
];

const mixHex = (a: string, b: string, t: number) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

/** Colores derivados del éxito del proyecto, para que hover y presionado del botón de envío sigan su verde. */
const DERIVED: Record<string, (success: ColorToken) => ColorToken> = {
  successHover: (s) => ({ name: 'successHover', light: mixHex(s.light, '#000000', 0.12), dark: mixHex(s.dark, '#FFFFFF', 0.15) }),
  successPressed: (s) => ({ name: 'successPressed', light: mixHex(s.light, '#000000', 0.24), dark: mixHex(s.dark, '#FFFFFF', 0.3) }),
};

export function ensureColors(t: Tokens): Tokens {
  const missing = REQUIRED_COLORS.filter((c) => !t.colors.some((x) => x.name === c.name));
  const colors = [...t.colors, ...missing.map((c) => ({ ...c }))];
  const success = colors.find((c) => c.name === 'success')!;
  const derived = Object.entries(DERIVED)
    .filter(([name]) => !colors.some((c) => c.name === name))
    .map(([, make]) => make(success));
  return missing.length || derived.length ? { ...t, colors: [...colors, ...derived] } : t;
}

/** Versión actual de los estados base. */
export const STATES_REV = 3;

/**
 * Completa los estados de un componente creado antes de que cada patrón definiera sus cinco estados.
 * Solo rellena estados vacíos o el deshabilitado antiguo; lo que la persona personalizó se conserva.
 */
export function upgradeStates(c: Component, t: Tokens): Component {
  if ((c.rev ?? 0) >= STATES_REV) return c;
  const base = builtInStyle(c.type, c.variant);
  const states = { ...c.states };
  for (const st of ['hover', 'pressed', 'disabled', 'focus'] as StateName[]) {
    const current = Object.fromEntries(Object.entries(states[st] ?? {}).filter(([, v]) => v));
    const empty = !Object.keys(current).length;
    const oldDisabled = st === 'disabled' && JSON.stringify(current) === JSON.stringify({ fg: '{color.muted}' });
    const oldFocus = st === 'focus' && JSON.stringify(current) === JSON.stringify({ outline: '{color.focus}' }) && Object.keys(base.focus).length > 1;
    if (empty || oldDisabled || oldFocus) states[st] = { ...base[st] };
  }
  return fixContrast({ ...c, states, rev: STATES_REV }, t);
}

export function upgradeProjectStates(p: Project): Project {
  const tokens = ensureColors(p.tokens);
  const components = p.components.map((c) => upgradeStates(c, tokens));
  return tokens === p.tokens && components.every((c, i) => c === p.components[i]) ? p : { ...p, tokens, components };
}

const MODES: Mode[] = ['light', 'dark'];
const CHECKED: StateName[] = ['default', 'hover', 'pressed', 'focus'];
const FG_CANDIDATES = ['{color.onPrimary}', '{color.onSurface}', '{color.surface}', '{color.background}', '{color.onDark}'];
const BG_CANDIDATES = ['{color.primary}', '{color.primaryPressed}', '{color.onSurface}'];

const passes = (style: StyleProps, fg: string | undefined, t: Tokens) =>
  MODES.every((m) => {
    const f = resolve(fg, t, m);
    const bg = resolve(style.bg, t, m) ?? resolve('{color.background}', t, m) ?? '#FFFFFF';
    const r = contrast(f, bg);
    if (r == null) return true;
    return r >= (style.type === 'display' || style.type === 'title' ? 3 : 4.5);
  });

/** Ajusta el color de texto de un componente nuevo si no cumple AA con los tokens del proyecto. */
export function fixContrast(c: Component, t: Tokens): Component {
  const states = JSON.parse(JSON.stringify(c.states)) as Component['states'];
  const next = { ...c, states };
  for (const st of CHECKED) {
    const style = componentStyle(next, st);
    if (!style.fg || passes(style, style.fg, t)) continue;
    const fg = FG_CANDIDATES.find((cand) => passes(style, cand, t));
    if (fg) {
      states[st] = { ...states[st], fg };
      continue;
    }
    // Ningún texto cumple sobre ese fondo con estos tokens: se prueba un fondo del sistema que sí cumpla.
    for (const bg of style.bg ? BG_CANDIDATES : []) {
      const withBg = { ...style, bg };
      const fg2 = [style.fg, ...FG_CANDIDATES].find((cand) => passes(withBg, cand, t));
      if (fg2) {
        states[st] = { ...states[st], bg, fg: fg2 };
        break;
      }
    }
  }
  return next;
}

/** Agrega al proyecto los patrones del catálogo y los colores que le faltan. No cambia lo existente. */
export function completeSystem(p: Project): Project {
  const tokens = ensureColors(p.tokens);
  // Un proyecto sin sistema de diseño conserva sus colores, pero no recibe componentes.
  if (p.noSystem) return tokens === p.tokens ? p : { ...p, tokens };
  const have = new Set(p.components.map((c) => variantKey(c.type, c.variant)));
  const ids = new Set(p.components.map((c) => c.id));
  const names = new Set(p.components.map((c) => c.name.toLowerCase()));
  const added: Component[] = [];
  for (const e of CATALOG) {
    if (have.has(e.key)) continue;
    let id = e.id;
    for (let n = 2; ids.has(id); n++) id = `${e.id}-${n}`;
    ids.add(id);
    let name = e.name;
    if (names.has(name.toLowerCase())) name = `${e.name} (${e.variantLabel ?? 'base'})`;
    names.add(name.toLowerCase());
    added.push(fixContrast({ id, name, type: e.type, variant: e.variant, states: builtInStyle(e.type, e.variant), rev: STATES_REV }, tokens));
  }
  if (!added.length && tokens === p.tokens) return p;
  return { ...p, tokens, components: [...p.components, ...added] };
}

/** Qué patrones del catálogo cubre el proyecto. */
export function coverage(p: Project) {
  const have = new Set(p.components.map((c) => variantKey(c.type, c.variant)));
  const covered = CATALOG.filter((e) => have.has(e.key)).length;
  return { covered, total: CATALOG.length };
}
