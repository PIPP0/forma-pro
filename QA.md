# QA de punta a punta — Forma Studio

**Fecha:** 13 de septiembre de 2026
**Alcance:** recorrido completo como product designer senior, desde el acceso hasta los resultados de un estudio con personas.
**Entorno:** servidor local (Vite) en navegador de escritorio (1440 × 900) y móvil (375 × 812), datos limpios desde cero. Verificación final en https://pipp0.github.io/forma-pro/
**Automatización:** 14 pruebas unitarias (`npm test`), type-check estricto y build de producción en cada cambio.

## Proyecto construido para la prueba

| Elemento | Resultado |
|---|---|
| Personas | Valentina Rojas (dueña), Diego Soto (editor), Lucía Pérez (lectora) |
| Proyectos | «Ahorro con propósito» (flujo de ahorro) y «Onboarding cuenta digital» (en blanco) |
| Sistema de diseño | Color principal y radio ajustados, color de advertencia importado desde CSS, hover del botón editado, 19 componentes |
| Pantallas | 6 del flujo, 1 importada desde HTML, variantes tablet de «Inicio» y «Nueva meta» |
| Versiones | «Punto de partida», «Antes del test con clientes» y la restauración con respaldo automático |
| Biblioteca | v1.0.0 publicada y adoptada por el segundo proyecto |
| Estudio | «Primera meta de ahorro», 2 tareas, pide audio |
| Sesiones | 8: fluida, con dudas y bloqueo, con toque sin acción y desvío, con abandono, 2 desde móvil, 1 importada de otro dispositivo y 1 de verificación |
| Comentarios | 2, con mención y resuelto |

## Matriz de pruebas

| Área | Casos | Resultado |
|---|---|---|
| Acceso | Campos vacíos, correo inválido, normalización de correo, creación del proyecto base sin métricas inventadas, cerrar sesión, cambiar de perfil | Pasa |
| Proyectos | Crear en blanco, lista con rol, abrir desde la lista | Pasa |
| Sistema de diseño | Editar color desde la muestra, radio con control deslizante, tipografía, estado hover de un componente, documentación y salud, importar tokens CSS con modo oscuro, exportar JSON, importar referencia sin clave (bloqueado con aviso) | Pasa |
| Diseñar | Árbol del explorador, editar texto, agregar desde la biblioteca, subir, duplicar, deshacer, rehacer, eliminar con Supr y botón, error del guardarraíl y corrección, variante tablet, wireframe en grises, modo oscuro, zoom y ajustar | Pasa |
| Diseñar, parte 2 | Comentario con @mención y resolver, propiedades de pantalla y nota al pie, importar HTML (7 tipos y obligatorio), «Probar» con validación de obligatorios, formato de monto y cierre con Escape, cambiar pantalla de inicio y eliminar | Pasa |
| Asistente IA | Diálogo, sugerencias que completan la instrucción, «Generar propuesta» bloqueado sin clave | Pasa |
| Historial | Guardar versión, comparar, restaurar con respaldo previo, actividad por persona | Pasa |
| Equipo y roles | Invitar editor y lector; la lectora no edita, no guarda versiones ni crea pruebas, pero comenta; el editor edita pero no gestiona el equipo | Pasa |
| Biblioteca | Publicar v1.0.0, adoptar desde otro proyecto, panel de quién la usa y adopción | Pasa |
| Crear estudio | Tarea sin instrucción rechazada, 2 tareas, interruptor de audio, copia congelada de la versión | Pasa |
| Participante escritorio | Bienvenida, consentimiento obligatorio, interruptor de audio, tareas con éxito automático, abandono, calificación y comentario | Pasa |
| Participante móvil | Prototipo a pantalla completa (375 px), sin desborde horizontal | Pasa |
| Audio | Sin permiso de micrófono muestra aviso claro y la prueba continúa | Pasa (ver límites) |
| Resultados | Indicadores, tabla de tareas, embudo, 9 hallazgos con citas, comentarios, mapa de calor, detalle de sesión con momento resaltado, exportar JSON y CSV, importar sesión de otro dispositivo, cerrar y reabrir estudio | Pasa |
| Entrega | Medidas reales, tokens por propiedad en claro y oscuro, CSS, React y HTML, exportación de tokens y componentes | Pasa |
| Ajustes | Clave de API con formato inválido rechazada, respaldo exportado sin la clave, borrar todos los datos | Pasa |
| Sitio publicado | Carga, manifiesto, service worker activo, íconos | Pasa |

## Hallazgos

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Alta | Al terminar una sesión no se podía iniciar otra en el mismo dispositivo sin recargar. Bloquea las pruebas moderadas donde se pasa el celular a la siguiente persona. | Corregido: botón «Iniciar otra sesión» |
| 2 | Alta | La primera acción de cada tarea se registraba como «duda», aunque incluye el tiempo de leer la instrucción. Inflaba hallazgos como «2 de 6 personas dudaron en «Ver mis metas»». | Corregido en el registro de eventos |
| 3 | Media | El embudo se leía «5 de 61 se quedaron antes» en lectores de pantalla. | Corregido: «6 de 8, 2 se quedaron antes» |
| 4 | Media | Un selector importado sin etiqueta tomaba el nombre técnico del HTML («freq») y ocultaba el problema de accesibilidad. | Corregido: queda sin etiqueta y el guardarraíl lo marca |
| 5 | Baja | Concordancia: «1 de 6 personas se desvió… mientras intentaban». | Corregido, con prueba unitaria |
| 6 | Baja | Invitar con un correo inválido no mostraba un aviso propio de la app. | Corregido |
| 7 | Baja | Los atajos de teclado lanzaban un error en consola si el evento no venía de un elemento. | Corregido |
| 8 | Baja | El proyecto en blanco mostraba «Describe aquí el objetivo del flujo.» como contenido real. | Corregido |
| 9 | Mejora | Un texto editado se perdía si el campo desaparecía sin perder el foco. | Implementado: se guarda al desmontar |
| — | Descartado | Nota al pie no guardada y lista de proyectos vacía para la lectora: artefactos de la automatización, no se reproducen con uso real. | — |

## No probado o fuera del alcance de esta versión

- **Grabación de audio real:** el navegador de pruebas bloquea el micrófono. Se verificó el camino sin permiso.
- **IA con clave real:** no se usó una clave de API; se verificaron los estados sin conexión.
- **Instalación en un teléfono físico:** se verificó manifiesto, service worker e íconos, no la instalación en un dispositivo.
- **Varias personas en distintos dispositivos:** sin servidor, las invitaciones funcionan en el mismo navegador y las sesiones de otro dispositivo llegan por archivo.

## Recomendaciones de producto

1. **Backend para equipos y estudios remotos** (Workers + D1): sesiones que llegan solas, audio en almacenamiento de objetos y acceso con código por correo. Es lo que más acerca el producto a uso real.
2. **Arrastrar y soltar bloques en el lienzo**: hoy se reordena con Subir y Bajar; en una herramienta tipo Figma se espera arrastrar.
3. **Umbral de duda configurable por estudio**: 3,5 s funciona para flujos bancarios, pero no para lectura de contratos.
4. **Detección de sesiones duplicadas al importar**: hoy se evita por identificador; convendría avisar si la misma sesión llega con otro identificador.
