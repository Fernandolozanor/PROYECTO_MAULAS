class DataService {
    constructor() {
        this.db = window.db;
        this.collections = {
            members: 'members',
            jornadas: 'jornadas',
            pronosticos: 'pronosticos',
            logs: 'logs',
            config: 'config',
            docs: 'documents'
        };
    }

    async init() {
        console.log("DataService: Checking connection...");
        try {
            await this.migrateIfNeeded();
            console.log("DataService: Ready.");
        } catch (e) {
            console.error("DataService Error:", e);
            alert("Error conectando con la base de datos.");
        }
    }

    // --- MIGRATION UTILS ---
    async migrateIfNeeded() {
        await this.migrateCollection('members', 'maulas_members');
        await this.migrateCollection('jornadas', 'maulas_jornadas');
        await this.migrateCollection('pronosticos', 'maulas_pronosticos');
        // Config usually has multiple keys, treat special or just 'scoring_config'
        // Logs
        await this.migrateCollection('logs', 'maulas_logs');
        await this.migrateCollection('docs', 'maulas_docs');
    }

    async migrateCollection(colName, localKey) {
        const snap = await this.db.collection(colName).limit(1).get();
        if (!snap.empty) return; // Already data

        const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (localData.length === 0) return;

        console.log(`Migrating ${colName} to cloud...`);
        const batch = this.db.batch();
        let count = 0;

        // Batches limit is 500
        for (const item of localData) {
            let docId = item.id ? String(item.id) : null;
            if (!docId) docId = this.db.collection(colName).doc().id;

            const ref = this.db.collection(colName).doc(docId);
            batch.set(ref, item);
            count++;
            if (count >= 490) break; // Simple safety mechanism for batch size
        }
        await batch.commit();
        console.log(`Migrated ${count} items to ${colName}.`);
    }

    // --- CRUD WRAPPERS ---

    // Generic Get All
    async getAll(collectionName) {
        const snap = await this.db.collection(collectionName).get();
        return snap.docs.map(doc => doc.data());
    }

    // Generic Add/Update (Upsert)
    async save(collectionName, item) {
        if (!item.id) item.id = Date.now();
        await this.db.collection(collectionName).doc(String(item.id)).set(item);
    }

    // Generic Delete
    async delete(collectionName, id) {
        await this.db.collection(collectionName).doc(String(id)).delete();
    }

    // Config Specific
    async getConfig() {
        // Scoring rules
        const doc = await this.db.collection('config').doc('scoring').get();
        if (doc.exists) return doc.data();
        return null;
    }

    async saveConfig(rules) {
        await this.db.collection('config').doc('scoring').set(rules);
    }

    // Auth Helpers
    async logAction(user, action) {
        const log = {
            id: Date.now(),
            user,
            action,
            date: new Date().toISOString()
        };
        await this.save(this.collections.logs, log);
    }
}

window.DataService = new DataService();
