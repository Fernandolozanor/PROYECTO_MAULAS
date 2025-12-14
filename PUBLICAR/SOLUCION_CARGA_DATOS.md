# CÓMO ARREGLAR "DATOS A CERO"

El problema es técnico: Los datos se subieron con un formato antiguo que la nueva web no entiende ("predictions" vs "selection").
He corregido el script de carga. Al pulsar el botón rojo de nuevo, se sobrescribirán los datos malos con los buenos.

### Pasos
1. Haz **Commit** y **Push** en GitHub Desktop (asegúrate de que marcas todo).
2. Ve a la web -> Administración.
3. **PULSA DE NUEVO EL BOTÓN ROJO "RECARGAR DATOS FÁBRICA"**.
   - Esto es CRUCIAL. Necesitamos que borre la versión vieja y ponga la nueva.
4. Espera a que termine.
5. Ve a **Resultados**. Ahora sí deberían salir números y no ceros.

Nota: Si ves filas duplicadas o raro, es normal tras varios intentos. Lo ideal sería limpiar la base de datos, pero el botón "Recargar" debería corregir los IDs para que coincidan (Jornada 1 = ID 1).
