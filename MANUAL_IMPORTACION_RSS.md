# Importación de Resultados desde RSS

## Descripción

El sistema de importación de resultados RSS permite importar automáticamente los resultados oficiales de las quinielas desde el feed RSS de Loterías y Apuestas del Estado.

## Ubicación del Feed RSS

URL oficial: `https://www.loteriasyapuestas.es/es/la-quiniela/resultados/.formatoRSS`

## Cómo Funciona

### 1. Acceso al Botón

En la página de **Jornadas**, encontrarás un botón verde con el texto:
```
📥 Importar Resultados RSS
```

### 2. Proceso de Importación

Al hacer clic en el botón, el sistema:

1. **Descarga el feed RSS** automáticamente usando proxies CORS
2. **Parsea el XML** para extraer los resultados de las últimas jornadas
3. **Compara con la base de datos** para identificar jornadas sin resultados
4. **Muestra una ventana de confirmación** con:
   - Lista de jornadas a importar
   - Número de jornada y fecha
   - Indicador de confianza (si los equipos coinciden)
   - Detalles de los partidos y resultados

### 3. Confirmación

La ventana de confirmación muestra:

- **Jornadas a importar**: Número total de jornadas que recibirán resultados
- **Detalles por jornada**:
  - Número de jornada y fecha
  - Badge de confianza:
    - ✓ **Equipos coinciden** (verde): Los equipos del RSS coinciden con los de la BD
    - ⚠ **Verificar equipos** (amarillo): Los equipos no coinciden completamente
  - Número de partidos a importar
  - Detalles expandibles con todos los resultados

### 4. Importación

Al confirmar:
- Se actualizan las jornadas en la base de datos
- Se muestra un resumen de las jornadas importadas
- La página se recarga automáticamente para mostrar los nuevos resultados

## Manejo de Errores

### Problema de CORS

Si los proxies CORS fallan, el sistema mostrará una ventana alternativa que permite:

1. Abrir el feed RSS en una nueva pestaña
2. Copiar todo el contenido XML (Ctrl+A, Ctrl+C)
3. Pegarlo en un área de texto
4. Continuar con la importación

### Jornadas No Encontradas

Si una jornada del RSS no tiene una jornada correspondiente en la base de datos (por fecha), simplemente se omite.

### Jornadas con Resultados Existentes

Las jornadas que ya tienen resultados NO se sobrescriben. Solo se importan resultados para jornadas que estén vacías.

## Formato de Resultados

Los resultados se importan en el formato estándar de quiniela:
- `1` = Victoria local
- `X` = Empate
- `2` = Victoria visitante
- `1-2`, `0-0`, etc. = Resultado exacto (para el pleno al 15)
- `M-0`, `M-2`, etc. = Resultado con "M" (partido suspendido o no jugado)

## Frecuencia de Uso

Se recomienda usar esta función:
- **Cada semana** después de que se jueguen las jornadas
- **Los lunes** cuando los resultados oficiales ya están publicados
- **Antes de calcular puntuaciones** para asegurar que todos los resultados están actualizados

## Notas Técnicas

### Proxies CORS Utilizados

1. `https://api.allorigins.win/raw?url=`
2. `https://corsproxy.io/?`

Si ambos fallan, se ofrece la opción manual.

### Coincidencia de Equipos

El sistema normaliza los nombres de equipos para la comparación:
- Convierte a minúsculas
- Elimina acentos
- Normaliza espacios

Se considera una coincidencia válida si al menos el **70%** de los equipos coinciden entre el RSS y la base de datos.

### Coincidencia de Fechas

Las jornadas se emparejan por fecha exacta (día, mes, año). El sistema soporta ambos formatos:
- `21 diciembre 2025` (formato del RSS)
- `21/12/2025` (formato de la BD)

## Solución de Problemas

### "No hay nada que importar"

Esto significa que todas las jornadas ya tienen resultados. Es normal si ya has importado los resultados previamente.

### "Error al cargar los resultados del RSS"

Posibles causas:
- Problemas de conexión a Internet
- El feed RSS está temporalmente no disponible
- Problemas con los proxies CORS

**Solución**: Usa la opción manual de pegar el XML.

### "Error al parsear el XML"

El XML pegado manualmente no es válido. Asegúrate de copiar TODO el contenido del feed RSS, desde `<rss>` hasta `</rss>`.

## Ejemplo de Uso

1. Vas a **Jornadas**
2. Haces clic en **📥 Importar Resultados RSS**
3. El sistema muestra: "Se importarán resultados para 2 jornadas"
4. Ves los detalles:
   - Jornada 26 - 7 diciembre 2025 ✓ Equipos coinciden
   - Jornada 27 - 14 diciembre 2025 ✓ Equipos coinciden
5. Haces clic en **✓ Confirmar Importación**
6. Ves el mensaje: "✅ Importación completada con éxito! Se importaron resultados para 2 jornadas"
7. La página se recarga mostrando los resultados actualizados

## Futuras Mejoras

En versiones futuras se podría:
- Importar también la información de premios y acertantes
- Programar importaciones automáticas semanales
- Enviar notificaciones cuando haya nuevos resultados disponibles
