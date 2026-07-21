# Code Review Before AI Changes

## Objetivo

Definir cuándo y cómo revisar código real antes de pedir cambios a Cursor, Codex u otros agentes.

## Regla principal

Antes de generar instrucciones de implementación, ChatGPT debe revisar el código real actualizado siempre que:

- el cambio afecte a implementación
- el código esté disponible en GitHub
- el cambio pueda romper comportamiento existente
- el cambio afecte a arquitectura, seguridad, datos o flujos principales

No se deben generar instrucciones amplias basadas solo en memoria si el código real puede revisarse.

## Fuente de verdad

La fuente de verdad será, por este orden:

1. Código más reciente commiteado y pusheado en GitHub.
2. Estado local proporcionado por el usuario:
   - `git status`
   - `git diff`
   - archivos concretos
   - resumen de Cursor/Codex aceptado como contexto provisional
3. Memoria del hilo actual, solo para cambios recientes que se están trabajando en ese momento.

ChatGPT debe distinguir entre:

- código revisado en GitHub
- código local reportado por el usuario
- memoria conversacional provisional

## Cuándo es obligatorio revisar código

Revisar código antes de instrucciones que afecten a:

- backend
- API
- base de datos
- SQL
- autenticación
- autorización
- seguridad
- protección de datos
- servicios frontend
- AuthProvider o contextos React
- componentes con lógica de estado
- mapeos de datos
- migraciones desde Supabase
- operaciones create/update/delete
- arquitectura
- flujos funcionales completos

## Cuándo puede omitirse

Puede omitirse para:

- mensajes de commit
- changelog/release con datos proporcionados
- documentación pura
- correcciones de texto
- explicación conceptual sin cambios de código

## Procedimiento

Para cambios no triviales:

1. Confirmar si el estado está commiteado y pusheado.
2. Revisar archivos reales implicados.
3. Identificar funciones, componentes, rutas, servicios, imports y dependencias afectadas.
4. Definir alcance exacto.
5. Redactar instrucción concreta para Cursor/Codex.
6. Indicar qué debe modificarse.
7. Indicar qué no debe modificarse.
8. Indicar validación esperada.
9. Esperar validación antes de proponer commit.

## Memoria provisional

Si estamos trabajando en una tarea activa y el usuario acaba de mostrar o validar cambios locales, ChatGPT puede tenerlos en cuenta.

Pero no debe tratarlos como código revisado en GitHub.

Para cambios amplios, sensibles o estructurales, pedir `git status`, `git diff` o archivos relevantes si no están pusheados.