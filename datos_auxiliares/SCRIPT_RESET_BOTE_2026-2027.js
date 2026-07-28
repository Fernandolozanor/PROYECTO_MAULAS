/**
 * SCRIPT DE RESET COMPLETO DEL BOTE - TEMPORADA 2026-2027
 * =========================================================
 * BORRA todas las colecciones financieras del bote y deja todo a 0
 * para empezar la temporada 2026-2027 desde cero.
 *
 * COLECCIONES QUE SE BORRAN:
 *   - bote           → movimientos automáticos de gastos/premios por jornada
 *   - ingresos       → ingresos manuales / bizum de socios
 *   - repartos       → repartos de ganancias aprobados
 *   - cierres_vuelta → penalizaciones de clasificación (1ª vuelta / fin de temporada)
 *   - reembolsos_efectivo → pagos en efectivo de sellado
 *
 * COLECCIONES QUE NO SE TOCAN:
 *   - members        → socios
 *   - jornadas       → jornadas (ya filtradas por temporada 2026-2027)
 *   - pronosticos    → pronósticos
 *   - config         → configuración (solo se actualiza boteInicial a 0)
 *
 * Instrucciones:
 *   1. Abrir admin.html en el navegador (con sesión iniciada)
 *   2. Abrir la consola del desarrollador (F12 → Console)
 *   3. Pegar y ejecutar este script
 *
 * ⚠️ ADVERTENCIA: Esta operación es IRREVERSIBLE para los datos de la temporada actual.
 *    Los datos históricos de 2025-2026 se conservan en Firestore pero ya no se
 *    muestran en la web (la app filtra por temporada activa).
 */

(async function resetBote() {
    console.log('🚀 Iniciando RESET COMPLETO del Bote para temporada 2026-2027...');
    console.log('');

    /**
     * Borra todos los documentos de una colección de Firestore.
     * Lo hace en lotes de 100 para no saturar la cuota.
     */
    async function borrarColeccion(colName) {
        let total = 0;
        let snap = await db.collection(colName).limit(100).get();
        while (!snap.empty) {
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            total += snap.docs.length;
            console.log(`   → Eliminados ${total} documentos de '${colName}'...`);
            snap = await db.collection(colName).limit(100).get();
        }
        return total;
    }

    try {
        const colecciones = [
            'bote',
            'ingresos',
            'repartos',
            'cierres_vuelta',
            'reembolsos_efectivo'
        ];

        for (const col of colecciones) {
            const n = await borrarColeccion(col);
            if (n === 0) {
                console.log(`   ℹ️  '${col}' ya estaba vacía.`);
            } else {
                console.log(`   ✅ '${col}' borrada (${n} documentos eliminados).`);
            }
        }

        // Actualizar bote_config: boteInicial = 0
        const boteConfigRef = db.collection('config').doc('bote_config');
        const boteConfigSnap = await boteConfigRef.get();

        if (boteConfigSnap.exists) {
            await boteConfigRef.update({
                temporadaActual: '2026-2027',
                boteInicial: 0
            });
        } else {
            await boteConfigRef.set({
                id: 'bote_config',
                temporadaActual: '2026-2027',
                boteInicial: 0,
                costeColumna: 0.75,
                costeDobles: 12.00,
                aportacionSemanal: 1.50
            });
        }
        console.log('   ✅ config/bote_config → boteInicial: 0, temporadaActual: 2026-2027');

        // Verificar estado final
        console.log('');
        console.log('📋 Verificación final:');
        for (const col of colecciones) {
            const snap = await db.collection(col).limit(1).get();
            console.log(`   ${col}: ${snap.empty ? '✅ Vacía' : '⚠️  Aún tiene documentos'}`);
        }
        const cfg = await db.collection('config').doc('bote_config').get();
        console.log('   bote_config:', cfg.data());

        console.log('');
        console.log('🎉 RESET completado. El bote está a 0 para la temporada 2026-2027.');
        console.log('   → Recarga la página para que surta efecto.');

    } catch (e) {
        console.error('❌ Error durante el reset:', e);
        console.error('   Asegúrate de ejecutar este script desde admin.html con sesión iniciada.');
    }
})();
