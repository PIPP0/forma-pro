# Forma Pro

Diseña, prueba con personas reales y entrega a desarrollo desde un solo modelo de datos. El bloque que se diseña es el mismo que se prueba y el mismo que se mide: no hay exportación ni reimportación entre pasos.

Implementación del [PRD v1.0](PRD.md), construida desde cero.

## Qué incluye

| Módulo del PRD | Estado | Dónde |
|---|---|---|
| 01 Sistema de diseño | Tokens de color con modo claro y oscuro, espaciado, radios, escala tipográfica con roles; componentes con cinco estados (reposo, hover, presionado, deshabilitado, foco); instancias que heredan del maestro; detección de sobrescrituras con valores sueltos; renombrar un token actualiza todas sus referencias | `Sistema` |
| 02 Prototipado multi-breakpoint | Pantallas conectadas por acciones; variantes móvil, tablet y escritorio de una misma pantalla; guardarraíl de flujo (destinos rotos, pantallas inalcanzables, callejones sin salida, campos obligatorios sin botón); modo wireframe con el mismo dato; prototipo jugable con estados reales | `Pantallas` |
| Historial con nombre | Versiones completas y restaurables; restaurar guarda antes el estado actual; comparación contra el estado actual; registro de actividad por operación | `Historial` |
| Guardado por operación | Cada cambio es una operación invertible (`set`, `insert`, `remove`, `move`) con deshacer y rehacer (Cmd/Ctrl+Z) | `src/lib/ops.ts` |
| 03 Pruebas con usuarios | Estudios con varias tareas sobre una copia congelada; enlace público sin cuenta; consentimiento de participación y de grabación de audio por separado; mapa de calor por pantalla; hallazgos agregados con cita a la sesión y al segundo exacto («6 de 15 personas dudaron en «Monto»»); resumen por IA que descarta todo tema sin citas verificables; exportación JSON y CSV | `Pruebas` |
| 04 Colaboración | Comentarios anclados a pantalla o bloque, con menciones y estado resuelto. La presencia en vivo requiere servidor (ver abajo) | `Pantallas › Comentarios` |
| 05 Entrega a desarrollo | Inspección con medidas reales, token y valor por propiedad en ambos modos; export de tokens a CSS, JS y Style Dictionary; CSS con estados, React y HTML de referencia por componente | `Entrega` |
| 06 Copiloto de IA | Propone pantallas con memoria de la conversación usando los componentes del sistema; modo crítica que señala sin modificar. Nada se aplica sin confirmación | `Pantallas › Copiloto` |
| 07 Biblioteca y roles | Publicación versionada (mayor, menor, parche) del sistema; adopción desde otros proyectos; panel de quién usa una versión vieja y porcentaje de adopción; roles dueño, editor y lector aplicados en cada acción | `Biblioteca`, `Equipo` |
| 08 Accesibilidad e importación | Contraste WCAG AA de cada componente y estado en ambos modos y foco visible, verificados en el guardarraíl; no se puede publicar un estudio con errores críticos; importador de tokens (JSON, Style Dictionary, variables CSS) y de pantallas desde HTML | `Sistema`, `Pantallas` |

Un proyecto de ejemplo («Transferencias», con 6 pantallas y un estudio de 15 sesiones simuladas y marcadas como ejemplo) se crea al entrar por primera vez.

## Correr en local

```bash
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

## Arquitectura

- **React 19 + Vite + TypeScript estricto**, sin librerías de UI.
- **Un solo modelo** en [`src/lib/model.ts`](src/lib/model.ts): proyectos, pantallas, bloques, componentes, versiones, membresías, releases de biblioteca, estudios, sesiones y eventos, siguiendo el apéndice del PRD.
- **Operaciones invertibles** en [`src/lib/ops.ts`](src/lib/ops.ts); el store ([`src/lib/store.ts`](src/lib/store.ts)) valida permisos antes de aplicar cada una y registra quién hizo qué.
- **Guardarraíl** en [`src/lib/flowCheck.ts`](src/lib/flowCheck.ts) y **análisis de estudios** trazable en [`src/lib/analysis.ts`](src/lib/analysis.ts).
- **IA como servicio externo e intercambiable** en [`src/lib/ai.ts`](src/lib/ai.ts): API de Anthropic con salidas estructuradas, cargada solo al usarla. La clave se guarda en el navegador de quien la configura.
- **Enlace de estudio sin servidor**: la copia congelada viaja comprimida en el propio enlace ([`src/lib/share.ts`](src/lib/share.ts)).

## Límites de esta versión (sin servidor)

Todo corre en el navegador y se guarda en `localStorage` (y el audio en IndexedDB). Eso hace que funcione sin infraestructura, pero implica:

- **Acceso:** el perfil se identifica con nombre y correo, sin código de verificación. Las invitaciones y roles se aplican a quien entra con ese correo en el mismo navegador.
- **Sesiones de prueba desde otro dispositivo:** quien participa descarga un archivo de resultados al terminar y se importa en `Pruebas › Importar resultados`. En el mismo navegador llegan solas.
- **Colaboración en vivo y presencia:** no disponibles.
- **Figma:** la importación vía API oficial no está implementada; sí la importación desde código.

El siguiente paso para uso en equipo es un backend (por ejemplo Cloudflare Workers + D1, como propone el PRD) que reciba las mismas operaciones que hoy aplica el store, con autenticación por correo y código y las tablas del apéndice del PRD.
