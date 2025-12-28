// SOLUCIÓN TEMPORAL PARA MODO CORRECCIÓN
// Añadir este código al final de js/pronosticos.js o ejecutarlo en consola

// Sobrescribir el método openAuditModal
PronosticoManager.prototype.openAuditModal = function (isLateCurrent) {
    console.log("🟡 openAuditModal llamado (VERSIÓN CON PROMPTS)");

    // Usar prompts nativos del navegador
    const reason = prompt(
        "📝 AUDITORÍA DE CORRECCIÓN\n\n" +
        "Estás modificando una jornada CERRADA.\n" +
        "Es obligatorio documentar este cambio.\n\n" +
        "Motivo del cambio:"
    );

    if (!reason || reason.trim() === '') {
        alert("❌ Corrección cancelada: Debes indicar un motivo.");
        this.pendingSaveData = null;
        return;
    }

    const applyLatePenalty = confirm(
        "⚠️ ¿Aplicar/Mantener penalización por retraso?\n\n" +
        "• Haz clic en 'Aceptar' si el cambio se debe a una recepción tardía del pronóstico.\n" +
        "• Haz clic en 'Cancelar' si fue un error administrativo (sin penalización)."
    );

    // Ejecutar guardado directamente
    this.executeAuditSaveWithPrompts(reason.trim(), applyLatePenalty);
};

// Nuevo método para ejecutar el guardado con los datos de los prompts
PronosticoManager.prototype.executeAuditSaveWithPrompts = async function (reason, isForceLate) {
    if (!this.pendingSaveData) return;

    console.log("💾 Guardando corrección...", { reason, isForceLate });

    // 1. Prepare Log Entry
    const existing = this.pronosticos.find(p => p.id === this.pendingSaveData.id);
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'CORRECTION',
        memberId: this.currentMemberId,
        jornadaId: this.currentJornadaId,
        oldSelection: existing ? existing.selection : null,
        newSelection: this.pendingSaveData.selection,
        reason: reason,
        forcedLate: isForceLate
    };

    // 2. Save Log
    if (window.DataService) {
        await window.DataService.save('modification_logs', logEntry);
        console.log("✅ Log guardado");
    }

    // 3. Update Record with Forced Late Status
    this.pendingSaveData.late = isForceLate;

    // 4. Save Record
    await this.performFinalSave(this.pendingSaveData, isForceLate, true);

    this.pendingSaveData = null;
};

console.log("✅ Solución temporal de Modo Corrección cargada. Usa prompts nativos.");
