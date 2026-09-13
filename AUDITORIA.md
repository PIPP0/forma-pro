# Auditoría de punta a punta — Forma Studio

**Fecha:** 13 de septiembre de 2026
**Alcance:** recorrido completo en producción (https://pipp0.github.io/forma-pro/) con criterio de product designer experto: acceso, proyectos, Diseñar, Sistema de diseño, Pruebas, participante, Resultados, Entrega, Biblioteca, Historial, Equipo y Ajustes, en 1440, 1280 y 1024 px.

**Niveles de criticidad**

- **Nivel 1:** bloquea el trabajo o induce a error a una persona experta.
- **Nivel 2:** genera fricción o confusión en tareas frecuentes.
- **Nivel 3:** pulido o límite conocido.

## Nivel 1 — Crítico

| # | Dónde | Qué no funcionaba | Mejora | Estado |
|---|---|---|---|---|
| 1.1 | Sistema › Componentes | La vista previa de los estados salía vacía en 19 de 32 tipos: accesos rápidos, barra inferior, tarjetas de cuenta y de crédito, carrusel, calificación y listas, entre otros. Las celdas medían 170 px y no servían para decidir nada. | Estudio de componente: escenario grande al ancho real de un teléfono, los cinco estados con contenido de ejemplo, modo interactivo, especificación con token y valor en claro y oscuro, contraste AA calculado, guía de uso, anatomía, accesibilidad, variantes relacionadas, código y uso en pantallas. | Corregido |
| 1.2 | Todos los proyectos | Cada proyecto tenía una biblioteca parcial: 19 componentes en «En blanco» y «Ahorro», 34 en Banco New. Faltaban patrones y los tokens que usan (calificación, tarjeta oscura). | Catálogo de 55 patrones en 6 categorías dentro de cada proyecto, con los tokens que necesita y contraste verificado. Los proyectos existentes se completan solos, sin tocar lo que ya tenían. | Corregido |
| 1.3 | Sistema › Importar | Importar solo funcionaba con clave de IA para imágenes y código, no aceptaba PDF, y el importador de tokens estaba escondido en un desplegable. | Asistente «Importar sistema»: PDF, JSON (Forma, W3C Design Tokens de Figma, Tokens Studio y Style Dictionary), CSS, SCSS, LESS, Tailwind, HTML e imágenes, leídos en el navegador. Mapeo de roles con contraste, vista previa en claro y oscuro, versión previa guardada y opción de completar con IA, PDF incluido. | Corregido |
| 1.4 | Diseñar › Agregar componente | Desde el explorador se insertaba contenido de otro patrón («marca» y «DEMO» en la barra de la app) y, sin selección, el bloque quedaba debajo de la barra inferior fija. | Contenido de ejemplo por patrón y variante, el mismo de las vistas previas, e inserción siempre antes de la barra inferior. | Corregido |
| 1.5 | Sistema › Exportar | Solo había un JSON de tokens: sin componentes, sin formato para Figma y sin documentación. | Menú «Exportar»: sistema completo en JSON de Forma (se reimporta tal cual), W3C Design Tokens para Figma, CSS con modo oscuro, Tailwind, Style Dictionary y documentación en PDF con una ficha por componente. | Corregido |

## Nivel 2 — Importante

| # | Dónde | Qué no funcionaba | Mejora | Estado |
|---|---|---|---|---|
| 2.1 | Diseñar › Explorador | El árbol ocultaba barras superiores y separadores, que no se podían seleccionar desde ahí. | El árbol muestra todos los bloques con su tipo. | Corregido |
| 2.2 | Diseñar | Solo se reordenaba con «Subir» y «Bajar». | Arrastrar y soltar en el árbol, con indicador de destino y deshacer. Se mantiene Alt + ↑ ↓. | Corregido |
| 2.3 | Diseñar › Interacción | Barra inferior, listas, carruseles, accesos y barra de la app mostraban «Al tocar» para todo el bloque, además de los destinos por opción. El prototipo ignoraba esa acción. | En los contenedores solo se configuran destinos por opción. | Corregido |
| 2.4 | Diseñar › Propiedades | Había campos que no aplicaban («Ícono a la derecha» en la barra de la app, valor en filas que no lo usan) y el «Nombre de pantalla» se repetía en cada bloque. | Campos según patrón y variante. El nombre de pantalla queda solo en las propiedades de la pantalla. | Corregido |
| 2.5 | Diseñar › Tokens globales | «Color principal» editaba solo el modo claro. | Principal en claro y en oscuro, lado a lado. | Corregido |
| 2.6 | Diseñar | No se podía duplicar una pantalla. | «Duplicar pantalla», con identificadores nuevos y deshacer. | Corregido |
| 2.7 | Proyecto | Nombre, marca y negocio no se podían cambiar después de crear el proyecto. | Campos editables en «Proyecto y lienzo». | Corregido |
| 2.8 | Diseñar entre 900 y 1080 px | El explorador desaparecía en laptops pequeñas. | Columnas compactas hasta 900 px. | Corregido |
| 2.9 | Sistema › Documentación | Una línea por componente, sin cuándo usarlo ni cuándo evitarlo. | Documentación por categoría con resumen, uso y exclusión. Ficha completa en el estudio y en el PDF. | Corregido |
| 2.10 | Sistema › Nuevo componente | Solo se elegía el tipo, sin variante ni vista previa. | Se elige el patrón exacto del catálogo, con vista previa y contraste ajustado a los tokens del proyecto. | Corregido |
| 2.11 | Tipografía | Una familia distinta de Inter u Overpass no se veía en el lienzo. | Carga automática desde Google Fonts. | Corregido |

## Nivel 3 — Pulido y límites

| # | Qué pasaba | Mejora | Estado |
|---|---|---|---|
| 3.1 | Los destinos por opción ofrecían la misma pantalla. | Se excluye la pantalla actual. | Corregido |
| 3.2 | El lector de PDF confundía «endstream» con el inicio de un flujo y se saltaba contenido. | Corregido, con prueba. | Corregido |
| 3.3 | La importación sugería como fondo un blanco casi igual al actual. | Se ignora cuando es prácticamente idéntico. | Corregido |
| 3.4 | El enlace público de un estudio mide unos 9.200 caracteres: sirve para copiar y compartir, no para QR ni SMS. | Enlaces cortos con backend. | Pendiente, requiere servidor |
| 3.5 | Las tareas de un estudio no se pueden reordenar. | Arrastrar tareas en «Crear estudio». | Pendiente |
| 3.6 | En PDF con texto convertido en curvas, sin IA solo se leen los colores de las muestras y las fuentes. | «Completar con IA» lee textos y componentes. | Límite conocido |
| 3.7 | Sin colaboración en vivo ni sesiones remotas que lleguen solas. | Backend descrito en el README. | Límite conocido |

**Descartado:** el aparente desborde de Resultados a 1280 px era el carrusel dentro del mapa de calor, recortado por su propio contenedor.

## Cómo se verificó

- **Pruebas unitarias (25):**
  - las tres plantillas cubren el catálogo sin errores del guardarraíl;
  - un proyecto antiguo se completa sin cambiar lo existente;
  - importadores de CSS con modo oscuro, SCSS, Tailwind, W3C Design Tokens y sistema de Forma;
  - derivación de tokens con contraste AA;
  - lectura de colores, textos y fuentes de PDF.
- **Navegador — sistema de diseño:**
  - los 55 componentes con vista previa y cinco estados;
  - exportación de los cinco archivos y del PDF de documentación con 55 fichas.
- **Navegador — importación real:** un PDF de marca de dos páginas, una captura PNG y un tailwind.config dieron primario #1A66CC, error #D0343A, éxito #2E7D3E, texto #35414C, advertencia #C96A12, Overpass y radio de 20 px. Se aplicó (con la versión previa guardada) y se deshizo.
- **Navegador — Diseñar:** arrastrar, duplicar e insertar antes de la barra inferior, con deshacer en cada caso; explorador visible a 1024 px.
- **Consola:** sin errores en todo el recorrido.
