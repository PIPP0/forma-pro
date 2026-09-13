# Forma Pro
PRD · Producto nuevo

**Versión:** 1.0 — Draft
**Fecha:** 13 de septiembre, 2026
**Tipo de producto:** Build desde cero (greenfield)
**Audiencia:** Product designers senior · leads de sistema de diseño
**Estado:** Para discusión

## 1. Resumen ejecutivo

Un product designer senior hoy diseña en Figma, prueba en Maze o UserTesting, documenta decisiones en Notion y entrega a desarrollo con capturas y links sueltos. Cada salto de herramienta es un punto donde se pierde contexto: el prototipo que se prueba ya no es exactamente el que se diseñó, y lo que aprende research rara vez vuelve limpio al archivo de diseño.

Forma Pro es un producto nuevo que colapsa ese ciclo en un solo modelo de datos: el mismo bloque que se diseña es el que se prueba con una persona real y el que se mide en resultados — sin exportar, sin reimportar. Se construye validando primero un núcleo pequeño y honesto (tokens, pantallas, componentes, un flujo de prueba con usuarios) antes de sumar colaboración en vivo, gobernanza de biblioteca o integración con Figma.

## 2. El problema

Seis fricciones concretas que un product designer senior enfrenta hoy con las herramientas separadas:

1. **El prototipo que se prueba nunca es el diseño real.** Exportar de Figma a una herramienta de pruebas rompe interacciones, tokens y estados.
2. **Los componentes no llevan sus estados.** Un botón se diseña en "default" y su estado de hover, pressed o disabled se improvisa aparte.
3. **No hay un solo lienzo para todos los tamaños.** Diseñar en móvil, tablet y escritorio implica archivos desconectados que se desincronizan.
4. **El research se queda en la cabeza de quien lo hizo.** Sin agregación de evidencia entre sesiones, cada hallazgo depende de notas prolijas.
5. **La entrega a desarrollo es informal.** Capturas, un link y un mensaje de Slack reemplazan un modo de inspección real.
6. **Nadie es dueño claro de nada.** Sin roles ni versiones nombradas, "quién cambió esto" se resuelve preguntando.

## 3. A quién sirve

**Valentina, Product Designer Senior** — Lidera el sistema de diseño de un equipo de producto bancario · 6+ años de oficio

- Diseñar un flujo completo y probarlo con 5 personas reales en el mismo día.
- Que su sistema de diseño tenga una sola fuente de verdad, con estados de componente ya resueltos.
- Que un ingeniero pueda medir espaciados y copiar el token correcto sin preguntar por Slack.
- Poder volver a una versión anterior sin depender de su memoria.
- Ver evidencia agregada de investigación para defender una decisión.

**Personas secundarias:**

- **Lead de sistema de diseño** — publica versiones de biblioteca, necesita saber quién usa una versión vieja.
- **Investigadora UX** — corre estudios con tareas múltiples, necesita temas recurrentes sin escuchar cada audio.
- **Ingeniero de frontend** — quiere tokens y estructura exportables, no capturas de pantalla.

## 4. Principios de producto

- **Un modelo, cero fricción** — Diseñar, probar y ver resultados son la misma pestaña y el mismo modelo de datos.
- **La IA propone, la persona decide** — Ninguna propuesta de IA se aplica sola.
- **Nada se pierde en el camino** — Historial con nombre desde el día uno.
- **Dueño claro, acceso explícito desde el primer commit** — El aislamiento de datos no se agrega después, es parte del modelo base.

## 5. Alcance funcional

Ocho módulos. Los tres primeros son el núcleo mínimo defendible.

### 01 · Núcleo — Sistema de diseño

Tokens semánticos editables en tiempo real. Componentes con estados propios (default, hover, pressed, disabled, focus), no solo una variante visual suelta.

- Tokens con modo claro/oscuro desde el mismo set
- Escala tipográfica con roles (display, cuerpo, etiqueta)
- Componentes con instancias que heredan del maestro
- Detección de sobrescrituras que rompen el sistema

### 02 · Núcleo — Prototipado multi-breakpoint

Pantallas conectadas por acciones, con breakpoint (móvil/tablet/escritorio) como propiedad de la pantalla, no un archivo aparte.

- Variantes de una pantalla por tamaño de dispositivo
- Chequeo automático de flujo antes de compartir
- Historial de versiones nombradas y restaurables
- Modo wireframe / alta fidelidad con el mismo dato

### 03 · Núcleo — Pruebas con usuarios

Un estudio encadena varias tareas sobre una copia congelada del proyecto, con enlace público sin fricción de cuenta.

- Consentimiento y grabación por separado, nunca implícita
- Mapa de calor de interacción por pantalla
- Resumen por IA que agrupa sesiones por tema, citando la sesión exacta
- Exportación completa de resultados

En la práctica: en vez de escuchar 15 audios de 4 minutos, Valentina recibe "6 de 15 personas dudaron en el campo de monto" con enlaces directos a esos momentos.

### 04 — Colaboración en vivo

Presencia y comentarios anclados a un componente, con menciones.

### 05 — Entrega a desarrollo

Modo de inspección con medidas exactas + export de tokens (Style Dictionary, CSS, JS) + componentes React/HTML de referencia.

### 06 — Copiloto de IA conversacional

Generación con memoria de la conversación + modo crítica (señala, no reemplaza).

### 07 — Gobernanza de biblioteca y roles

Publicación versionada de componentes + panel de adopción + roles owner/editor/viewer.

### 08 — Accesibilidad e importación

Contraste y foco verificados antes de publicar + importador de código + conexión a Figma vía API oficial.

## 6. Arquitectura y decisiones técnicas

- **Autenticación independiente de una sola plataforma** — email + código, y SSO (Google Workspace, Microsoft Entra) para equipos. No depender de un único proveedor externo fuera de nuestro control.
- **Un solo modelo de datos, versionado desde el día uno** — cada cambio nombrado es una fila en `project_versions`, no una sobrescritura silenciosa.
- **Guardado por operación, no por documento completo** — para que la colaboración en vivo sea posible sin reescribir todo después.
- **Almacenamiento en el borde, IA como servicio externo** — un cambio de modelo o precio de IA no obliga a migrar los datos del producto.

**Stack:** Frontend: React + lienzo con estado por operación · Datos: Postgres o D1 (edge) + almacenamiento de objetos · Auth: email/código + SSO por equipo · IA: proveedor intercambiable

## 7. Fuera de alcance (a propósito)

- Ilustración vectorial libre o edición de trazos.
- Plan enterprise multi-organización con facturación propia.
- Reclutamiento de participantes propio.
- Editor de video/animación entre pantallas.

## 8. Hoja de ruta

### MVP (0–3 meses)

| Tamaño | Entregable |
|---|---|
| L | Módulo 01 — Sistema de diseño con tokens y estados de componente |
| L | Módulo 02 — Prototipado con guardarraíl de flujo y un solo breakpoint |
| M | Historial con nombre desde el modelo base |
| S | Autenticación por email/código con roles básicos |

### V1 (3–6 meses)

| Tamaño | Entregable |
|---|---|
| L | Módulo 03 — Pruebas con usuarios con tareas múltiples y resumen por IA |
| M | Breakpoints de tablet y escritorio |
| M | Accesibilidad integrada al guardarraíl |
| M | Módulo 05 — Modo inspección y export de tokens |

### V2 (6–12 meses)

| Tamaño | Entregable |
|---|---|
| L | Módulo 04 — Colaboración en vivo |
| M | Módulo 06 — Copiloto conversacional y modo crítica |
| L | Módulo 07 — Biblioteca versionada |
| L | Módulo 08 — Importación desde Figma vía API oficial |

## 9. Métricas de éxito

| Métrica | Objetivo |
|---|---|
| Tiempo a evidencia | < 1 día, de proyecto nuevo a primera sesión de prueba |
| Adopción de biblioteca | ≥ 80% de bloques instanciados desde un componente publicado |
| Accesibilidad | 0 estudios publicados con errores críticos |
| Colaboración | ≥ 2 personas activas por proyecto en la misma semana |
| Tiempo de handoff | < 5 min de flujo aprobado a tokens/medidas exactas |
| Satisfacción de PDs | ≥ 4.5/5 en encuesta trimestral |

## 10. Riesgos y preguntas abiertas

- **Construir vs. adaptar** — un motor de colaboración en tiempo real y un lienzo de diseño son proyectos grandes por sí solos; evaluar librerías CRDT existentes antes de construir desde cero.
- **Alcance del MVP** — el riesgo más común es no soltar el núcleo (01+02+03) sin colaboración ni biblioteca versionada.
- **La API de Figma tiene límites de formato** — auto-layout complejo y componentes anidados no siempre se traducen limpio.
- **El resumen de research por IA puede alucinar patrones** — cada afirmación debe poder rastrearse a sesiones concretas.
- **¿Producto interno o SaaS externo?** — si el objetivo es vender a equipos externos, roles y biblioteca versionada deberían adelantarse al MVP.

## 11. Apéndice — modelo de datos de referencia

```ts
// modelo central
Block = {
  id, type, label, detail, target, variant, action,
  required, disabled, options, value,
  states: { default, hover, pressed, disabled, focus } // por componente de biblioteca
}

Screen = { id, name, breakpoint: 'mobile'|'tablet'|'desktop', variantOf?, blocks: Block[] }

Project = {
  id, name, brand, business, tokens, version,
  screens: Screen[], components: Block[]
}
```

```sql
-- tablas base, no agregadas después
projects(id, data, owner, updated)
project_versions(id, project_id, label, snapshot, created_by, created_at)
library_releases(id, library_id, version, snapshot, published_by, published_at)
memberships(id, subject_type, subject_id, user_id, role) -- role: owner | editor | viewer
studies(id, project_id, name, tasks[], snapshot, owner, created)
sessions(id, study_id, device, consent, audio, video, feedback, status)
events(id, session_id, screen, block, kind, x, y, elapsed)
```
