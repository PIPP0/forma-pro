# Forma Studio

Diseña, prueba con personas reales y entrega a desarrollo desde un solo modelo de datos. El bloque que se diseña es el mismo que se prueba y el mismo que se mide: no hay exportación ni reimportación entre pasos.

Implementación del [PRD v1.0](PRD.md). Publicado en https://pipp0.github.io/forma-pro/

## Recorrido de punta a punta

1. **Sistema de diseño.** Crea tokens (color para modo claro y oscuro, espaciado, radios, tipografía) y componentes con cinco estados. Puedes crearlo con IA a partir de capturas de tu interfaz o de código y estilos.
2. **Diseñar.** Todas las pantallas del flujo en un lienzo tipo Figma con zoom, explorador de pantallas y componentes, propiedades por instancia y tokens globales. Alterna wireframe y alta fidelidad sobre el mismo dato. El copiloto propone pantallas usando solo los componentes del sistema, también desde una captura o un boceto.
3. **Probar.** El prototipo es funcional: navega, valida campos obligatorios y registra cada interacción. Un guardarraíl revisa flujo, contraste y consistencia antes de publicar.
4. **Pruebas con usuarios.** Estudios con varias tareas sobre una copia congelada, enlace público sin cuenta e instalable como app en el celular. Consentimiento de participación aparte del audio: quien participa ve un interruptor que le pregunta si quiere grabar y puede apagarlo cuando quiera.
5. **Resultados.** Indicadores del estudio, embudo por tarea, mapa de calor por pantalla, hallazgos con cita a la sesión y al segundo exacto («6 de 15 personas dudaron en «¿Cuánto quieres ahorrar?»»), resumen por IA que descarta todo tema sin citas verificables y exportación JSON y CSV.
6. **Entrega.** Inspección con medidas reales, tokens a CSS, JS y Style Dictionary, y CSS, React y HTML de referencia por componente.

## Módulos del PRD

| Módulo | Dónde |
|---|---|
| 01 Sistema de diseño con estados, sobrescrituras detectadas y creación con IA | `Sistema de diseño` |
| 02 Prototipado multi-breakpoint, guardarraíl y wireframe | `Diseñar` |
| Historial con nombre y guardado por operación con deshacer | `Historial`, ícono de guardar |
| 03 Pruebas con usuarios, grabación opcional, mapa de calor y resumen por IA | `Pruebas`, `Resultados` |
| 04 Comentarios anclados con menciones | `Diseñar › Comentarios` |
| 05 Entrega a desarrollo | `Entrega` |
| 06 Copiloto con memoria, imágenes y modo crítica | `Diseñar › Asistente IA` |
| 07 Biblioteca versionada, adopción y roles | `Biblioteca`, `Equipo` |
| 08 Accesibilidad en el guardarraíl, importación de tokens, HTML, código e imágenes | `Sistema de diseño`, `Diseñar` |

## Proyecto de ejemplo completo

[`examples/proyecto-qa-completo.json`](examples/proyecto-qa-completo.json) es el proyecto construido durante el QA: sistema de diseño ajustado, 7 pantallas con variantes, versiones, biblioteca publicada y adoptada, equipo con tres roles, un estudio con 2 tareas y 8 sesiones con resultados. Para verlo, entra al sitio y ve a **Ajustes › Importar respaldo** (reemplaza los datos de ese navegador) y entra como `valentina.rojas@banco.cl`. El detalle de la prueba está en [QA.md](QA.md).

### Banco New

[`examples/banco-new-completo.json`](examples/banco-new-completo.json) suma el proyecto **Banco New**: una app bancaria móvil de 19 pantallas (cuentas, tarjetas, mis finanzas, transferencias, créditos con simulación, encuesta, inversiones, menú y notificaciones) con 34 componentes. Incluye un estudio de 4 tareas con 6 sesiones y sus resultados. Los datos son ficticios. También puedes crearlo desde cero con **Nuevo proyecto › Banco New · app móvil**. Para mostrar en una pantalla lo que la persona escribió en otra, usa `{{id-del-bloque|ejemplo}}` en textos u opciones.

## Sistema de diseño

- **Biblioteca completa en cada proyecto:** 55 patrones en 6 categorías (navegación, acciones, formularios, contenido, listas y finanzas), cada uno con cinco estados, guía de uso, anatomía y accesibilidad. Los proyectos existentes se completan solos.
- **Estudio de componente:** vista previa al ancho real de un teléfono, estados, modo interactivo, especificación con tokens y contraste AA, variantes, código y uso en pantallas.
- **Importar sistema:** PDF de marca, JSON (Forma, W3C Design Tokens de Figma, Tokens Studio y Style Dictionary), CSS, SCSS, LESS, tailwind.config, HTML e imágenes. Se lee en el navegador y nada se aplica sin revisar. Con clave de IA también propone componentes desde PDF, capturas y código.
- **Exportar:** sistema completo, tokens para Figma, CSS con modo oscuro, Tailwind, Style Dictionary y documentación en PDF.

La auditoría con los hallazgos por nivel de criticidad está en [AUDITORIA.md](AUDITORIA.md).

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

- **React 19 + Vite + TypeScript estricto**, sin librerías de UI. Tipografía Inter.
- **Un solo modelo** en [`src/lib/model.ts`](src/lib/model.ts) siguiendo el apéndice del PRD.
- **Operaciones invertibles** en [`src/lib/ops.ts`](src/lib/ops.ts); el store ([`src/lib/store.ts`](src/lib/store.ts)) valida permisos antes de aplicar cada una.
- **Guardarraíl** en [`src/lib/flowCheck.ts`](src/lib/flowCheck.ts) y **análisis de estudios** trazable en [`src/lib/analysis.ts`](src/lib/analysis.ts).
- **IA** en [`src/lib/ai.ts`](src/lib/ai.ts): API de Anthropic con salidas estructuradas y visión, cargada solo al usarla. La clave se guarda en el navegador de quien la configura.
- **App instalable** (PWA) con [`public/manifest.webmanifest`](public/manifest.webmanifest) y [`public/sw.js`](public/sw.js): al abrirse instalada vuelve al último prototipo.

## Límites de esta versión (sin servidor)

Todo corre en el navegador y se guarda en `localStorage` (el audio, en IndexedDB):

- **Acceso:** nombre y correo, sin contraseña ni código. Las invitaciones y roles aplican a quien entra con ese correo en el mismo navegador.
- **Sesiones desde otro dispositivo:** al terminar, quien participa envía su archivo de resultados (compartir o descargar) y se importa en `Pruebas › Importar resultados`. En el mismo navegador llegan solas. El audio se queda en el dispositivo donde se grabó.
- **Colaboración en vivo:** no disponible. **Figma:** sin importación vía API.

El siguiente paso para uso en equipo es un backend (por ejemplo Cloudflare Workers + D1, como propone el PRD) que reciba las mismas operaciones que hoy aplica el store, con autenticación por correo y código, sesiones que llegan solas y audio en almacenamiento de objetos.

## Importar desde Figma

En **Diseñar** hay un botón «Importar desde Figma» (barra de herramientas del lienzo). Pega el enlace del archivo o del prototipo y trae cada frame como una pantalla-imagen:

- Se leen las transiciones del prototipo igual que en Maze: **al tocar → ir a**, **volver** y **cerrar superposición**, **abrir como superposición** (si es más baja que la pantalla, se muestra como hoja encima) y **después de N segundos** (la pantalla avanza sola).
- Lo que no cambia de pantalla se ignora a propósito: al pasar el mouse, desplazar dentro de la misma pantalla, cambiar de variante y abrir una URL.
- El destino de cada zona se edita en Propiedades → **Zonas tocables**.
- Las imágenes se copian a la nube de Forma (las de Figma vencen a los 30 días).
- Necesitas un **token personal de lectura** de Figma: Ajustes → Figma. Se guarda solo en ese navegador.
- En las pruebas se registran toques, mapa de calor, tiempos, abandono y audio igual que en las pantallas hechas con componentes.
- **¿Tu Figma no tiene flechas de prototipo?** En Propiedades → Zonas tocables, «Dibujar zona» permite marcarlas a mano sobre la imagen.
- **Volver a importar:** si cambias el diseño, importa otra vez el mismo archivo. Las pantallas que ya trajiste se actualizan en su lugar, conservando su nombre y los destinos que apuntaban a ellas.
- **Cambiar de prototipo:** la etiqueta «Flujo de Figma · N» del encabezado del lienzo (o el propio diálogo de importar) quita las pantallas traídas y deja el proyecto listo para otro archivo.

### Modo prototipo

La pestaña **Diseño / Prototipo**, sobre el lienzo, cambia a un modo parecido al de Figma:

- Arrastrar sobre cualquier pantalla-imagen crea una zona tocable.
- Cada zona muestra un punto a su derecha: arrástralo hasta otra pantalla para conectarla.
- Las flechas entre zonas y pantallas se dibujan sobre el lienzo.
- Una zona seleccionada se mueve arrastrándola y se ajusta desde sus esquinas: sirve cuando Figma trae la flecha en el frame completo y solo un botón debería avanzar.
