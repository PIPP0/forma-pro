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

### Escuchar las grabaciones

En Resultados hay una sección **Grabaciones** con todas las sesiones que tienen audio: se reproducen ahí mismo, se descargan una a una (`.webm`) y muestran su peso. Las que están en la nube se traen al pulsar «Escuchar» y quedan en caché para la próxima vez.

### Limpiar resultados

En Resultados, cada fila de **Sesiones** trae una ✕ para eliminarla. Pide confirmación y, al aceptar, quita sus respuestas, sus eventos y su grabación; las métricas, el mapa de calor y los hallazgos se recalculan sin ella. Si la sesión llegó por la nube, también se borra allá para que no vuelva al sincronizar.

### Ensayar sin ensuciar los resultados

«Abrir como participante» abre la prueba con `?ensayo=1`. Antes de empezar pregunta si esa sesión debe contar: **Probar sin guardar** no escribe sesión, ni borrador, ni sube nada a la nube, y lo recuerda con una insignia durante toda la prueba. **Guardar esta sesión** se comporta como cualquier participante.

## Importar desde Figma

En **Diseñar** hay un botón «Importar desde Figma» (barra de herramientas del lienzo). Pega el enlace del archivo o del prototipo y trae cada frame como una pantalla-imagen:

- Se leen las transiciones del prototipo igual que en Maze: **al tocar → ir a**, **volver** y **cerrar superposición**, **abrir como superposición** (si es más baja que la pantalla, se muestra como hoja encima) y **después de N segundos** (la pantalla avanza sola).
- Lo que no cambia de pantalla se ignora a propósito: al pasar el mouse, desplazar dentro de la misma pantalla, cambiar de variante y abrir una URL.
- El destino de cada zona se edita en Propiedades → **Zonas tocables**.
- Las imágenes se copian a la nube de Forma (las de Figma vencen a los 30 días).
- Necesitas un **token personal de lectura** de Figma: Ajustes → Figma. Se guarda solo en ese navegador.
- En las pruebas se registran toques, mapa de calor, tiempos, abandono y audio igual que en las pantallas hechas con componentes.
- **¿Tu Figma no tiene flechas de prototipo?** En Propiedades → Zonas tocables, «Dibujar zona» permite marcarlas a mano sobre la imagen, y «Toda la pantalla» marca la imagen completa para avanzar a la siguiente.
- **Volver a importar:** si cambias el diseño, importa otra vez el mismo archivo. Las pantallas que ya trajiste se actualizan en su lugar, conservando su nombre y los destinos que apuntaban a ellas.
- **Cambiar de prototipo:** la etiqueta «Flujo de Figma · N» del encabezado del lienzo (o el propio diálogo de importar) quita las pantallas traídas y deja el proyecto listo para otro archivo.

### La vista se adapta al tipo de proyecto

Un flujo importado de Figma no se dibuja con bloques, así que en Diseñar desaparecen los controles que no cambiarían nada: fidelidad (wireframe / alta fidelidad), modo oscuro, tokens globales, nota al pie, la pestaña de componentes cuando la biblioteca está vacía y los dispositivos sin pantallas. Todo vuelve en cuanto el proyecto tiene una pantalla hecha con componentes.

### Modo prototipo

La pestaña **Diseño / Prototipo**, sobre el lienzo, cambia a un modo parecido al de Figma:

- En la prueba manda la zona más chica bajo el dedo **que lleve a alguna parte**: una zona suelta no tapa a la de pantalla completa. En el lienzo, en cambio, se selecciona la más chica para poder editarla.
- Arrastrar sobre cualquier pantalla-imagen crea una zona tocable.
- **Elegir un elemento del diseño:** el cursor resalta la capa de Figma que tiene debajo (botón, tarjeta, campo). Se ofrecen solo las capas que alguien podría tocar: se descartan las menores de 36 × 18 puntos, las que ocupan casi toda la pantalla y las repetidas (un botón, su fondo y su texto son una sola), y al apuntar a la etiqueta de un botón se marca el botón entero. Un toque la convierte en zona con su nombre, y arrastrar su punto la convierte en zona y saca la flecha en el mismo gesto. Funciona aunque otra zona cubra toda la pantalla.
- Tocar una flecha selecciona su zona. Arrastrarla mueve la flecha misma: la pantalla bajo el cursor se resalta y al soltar queda conectada; si se suelta en el fondo, la flecha se quita.
- Con una zona seleccionada, **Suprimir** la elimina y **Esc** (o tocarla otra vez) la deselecciona. Su flecha se destaca y las demás se atenúan.
- Varias flechas hacia la misma pantalla llegan a distinta altura, en el orden en que salen, para poder distinguirlas.
- Cada zona muestra un punto a su derecha: arrástralo hasta otra pantalla para conectarla.
- Las flechas entre zonas y pantallas se dibujan sobre el lienzo.
- Una zona seleccionada se mueve arrastrándola y se ajusta desde sus esquinas: sirve cuando Figma trae la flecha en el frame completo y solo un botón debería avanzar.

## Entregables de un estudio

En Resultados, el botón **Entregables** reúne todo lo que el estudio puede darle a otra persona, sin API y sin costo:

- **Presentación (`.pptx`)** — once láminas editables (doce si el estudio ya tiene resumen por IA vigente, que gana lámina propia y va identificada como tal) (`src/lib/deck.ts`, con PptxGenJS cargado solo al exportar): portada, Índice Forma, indicadores, resumen ejecutivo, los tres hallazgos más graves —uno por lámina, con evidencia, cita y acción—, desempeño por tarea, comparativa por perfil, método y próximos pasos. Cada lámina trae notas para quien presenta.
- **Informe (`.html`)** — seis hojas para leer y archivar, imprimibles a PDF.
- **Resumen en texto** — el mismo contenido al portapapeles.
- **Datos** — JSON con grabaciones o CSV de eventos.

Todo sale del mismo `construirInforme()`, así que las tres salidas dicen exactamente lo mismo. Cuando el estudio tiene un resumen por IA que sigue correspondiendo a sus sesiones, aparece además un botón **Crear PPT** en la barra, junto a «Importar resultados»: es el atajo para quien ya hizo el análisis y solo quiere el archivo.

## Entrar

La app pregunta con qué correo entras antes de abrir el espacio. Se entra con **correo y contraseña** (mínimo seis caracteres; si el correo es nuevo, esa pasa a ser su contraseña). Para un correo que se creó con enlace de acceso y todavía no tiene contraseña, «Crear o recuperar contraseña» envía el correo para ponerla. El enlace por correo sigue disponible como camino alternativo. Quien prefiera trabajar solo en un equipo puede decirlo una vez —«Seguir trabajando solo en este navegador»— y no se le vuelve a preguntar hasta que cierre sesión.

Entrar con un correo alinea las dos identidades que antes vivían separadas: la sesión local de la app y la cuenta de la nube. Lo que ya existía en el navegador no se pierde de vista: pasa a estar a nombre de quien entra.

## Sonido y vibración

Un prototipo se siente real cuando confirma por el oído y por el cuerpo, no solo por la pantalla. En **Diseñar → Propiedades** cada pantalla tiene «Al llegar aquí» y cada zona tocable sus propios selectores:

- Ocho sonidos (toque, éxito, error, aviso, transición, envío, abono, tecla) **sintetizados con Web Audio** en `src/lib/feedback.ts`: no hay archivos que subir, que pesar ni que cargar desde la nube, y cada uno se prueba al elegirlo.
- Cinco patrones de vibración vía `navigator.vibrate`. **Android vibra; el iPhone no**, porque Safari no expone esa API: el selector lo dice cuando el equipo no puede.
- El audio de un navegador solo arranca tras un gesto, así que el primer toque de la prueba despierta el `AudioContext` y el primer sonido no llega tarde.
- `silenciar()` existe para pruebas en sala, donde el sonido molesta o contamina la sesión.

## Imágenes que se ven en cualquier equipo

Una pantalla importada guarda su imagen en la nube y la pide aparte. En equipos con bloqueadores de contenido o redes filtradas esa petición no llega y el marco queda vacío. El botón **Incrustar imágenes** (en Diseñar, junto a «Flujo de Figma») trae cada imagen y la guarda dentro del proyecto, en `screen.image.data`, sin borrar la URL:

- Se ejecuta desde un equipo donde las imágenes sí cargan; desde uno bloqueado no habría nada que traer.
- El proyecto pesa más (del orden de 1,5 MB por cada nueve pantallas), pero viaja completo por la sincronización.
- El enlace de una prueba **no** lleva esa copia (`sinIncrustadas()` en `share.ts`): sigue pesando unos kilobytes y usando la URL.
- Si una imagen no carga, la pantalla dice por qué y ofrece abrirla aparte, en vez de dejar un marco en blanco.

## Tu espacio en cualquier computador

Con el acceso guardado por correo, los proyectos y los estudios dejan de vivir solo en un navegador: se sincronizan con la cuenta y aparecen en cualquier equipo donde entres con ese correo.

- El índice está en Firestore (`espacios/{uid}/indice`) y el contenido en Storage (`espacios/{uid}/proyectos|estudios/{id}.json`), un archivo por pieza: así no pesa el tope de 1 MiB de un documento.
- Gana la versión guardada más tarde. Las sesiones de las pruebas no se pisan: se unen por id, porque nunca se editan.
- Lo que borras aquí deja una marca en el índice, o volvería en la próxima sincronización.
- En un navegador recién estrenado, los proyectos de ejemplo se descartan si la nube trae trabajo real: ver «Ahorro con propósito» junto a lo tuyo sería confuso.
- Todo lo que está en tu espacio es tuyo: si un proyecto llega a nombre de otra persona —los usuarios de demostración tienen el mismo id en todos los navegadores— se te da acceso al sincronizar.
- La decisión de qué mover vive en `planificar()` (`src/lib/sync.ts`), aparte de la red y con pruebas propias: es la parte que puede quitar cosas de este navegador.

## IA del equipo

La clave de Anthropic vive en el proyecto en la nube (`forma-pro-cl26`), no en los navegadores: quien tenga su correo en la lista autorizada usa el asistente y el resumen de investigación desde cualquier equipo, solo con guardar su acceso por correo en Ajustes.

- La función `ia` (Cloud Functions, `southamerica-west1`) valida el token de Firebase, comprueba que el correo esté autorizado, aplica la cuota del mes y recién entonces llama a la API con la clave del servidor.
- `config/ia` en Firestore guarda `correos`, `topeUsuarioClp`, `topeTotalClp` y `clpPorUsd`. Solo lo lee el servidor: las reglas lo bloquean para todo cliente. Hoy el tope es de $5.000 por persona y $5.000 para el proyecto al mes.
- El token de sesión viaja en la cabecera `X-Forma-Token`, no en `Authorization`: Cloud Run intercepta esa última y rechaza cualquier token que no sea de Google antes de que la petición llegue a la función.
- La clave se lee de Secret Manager en caliente, con caché de cinco minutos: cargar una versión nueva basta para que empiece a funcionar, sin volver a desplegar.
- Cada llamada anota el consumo real en `iaUso/{uid}_{AAAAMM}`, que es lo que Ajustes muestra como gasto del mes.
- Quien prefiera pagar de su cuenta puede guardar su propia clave en Ajustes; mientras exista, esa clave manda y el equipo no gasta.
- El resumen por IA se guarda junto al estudio con la huella de las sesiones que lo produjeron. Mientras esas sesiones no cambien, el botón dice «Al día» y no hay forma de pagar dos veces por el mismo resultado; si se agregan o quitan sesiones, avisa que quedó desactualizado.

Desplegar: `npm run deploy:ia` y `npm run deploy:iauso`. La clave se carga aparte, sin pasar por el repositorio:

```
printf %s "$(pbpaste)" | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=- --project=forma-pro-cl26
```
