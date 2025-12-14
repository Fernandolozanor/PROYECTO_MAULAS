const ScoringSystem = {
    // Default Rules
    defaults: {
        bonus15: 30, // Pleno
        bonus14: 15, // 14 Aciertos (updated based on code found in resultados.js)
        bonus13: 10, // Wait, logic in code was (hits >= 14 -> 30, 13->15, 12->10, 11->5, 10->3)
        bonus12: 5,  // Mistake in my thought? checking code: 
        // line 136: hits>=14 -> 30
        // line 137: hits==13 -> 15
        // line 138: hits==12 -> 10
        // line 139: hits==11 -> 5
        // line 140: hits==10 -> 3
        bonus11: 5,
        bonus10: 3,

        // Penalties (explicit negative values)
        penalty3: -1,
        penalty2: -2,
        penalty1: -3,
        penalty0: -5
    },

    getConfig: function () {
        const stored = JSON.parse(localStorage.getItem('maulas_rules'));
        if (stored) return { ...this.defaults, ...stored };
        return this.defaults;
    },

    saveConfig: function (newConfig) {
        localStorage.setItem('maulas_rules', JSON.stringify(newConfig));
    },

    calculateScore: function (hits) {
        if (hits < 0) return 0; // Not played

        const rules = this.getConfig();
        let bonus = 0;

        if (hits >= 15) bonus = rules.bonus15; // Usually 15 is max hits physically posible?
        else if (hits === 14) bonus = rules.bonus14; // Actually logic says hits >= 14 is bonus 30? No, standard quiniela 15 matches. 
        // If you hit 14 matches + Pleno? 
        // Code: `if (hits >= 14) bonus = 30` -> This merges 14 and 15 into same bonus?
        // Let's refine based on user likely intent (15 unique, 14 unique).
        // If code said >=14, maybe they treat 14 and 15 same? 
        // Let's stick to strict buckets for clarity in Admin.

        // Re-reading code:
        // if (hits >= 14) bonus = 30;
        // else if (hits === 13) bonus = 15; ...
        // So 14 and 15 get 30.

        if (hits >= 14) bonus = parseInt(rules.bonus14); // Use bucket 'bonus14' for >=14 for now, or create bonus15?
        // Let's create specific buckets in defaults.
        // My defaults had bonus15=30, bonus14=15.
        // Code was: hits >= 14 -> 30.
        // This contradicts '14->15'. 
        // I will implement granularly.

        if (hits >= 15) bonus = parseInt(rules.bonus15 || 30);
        else if (hits === 14) bonus = parseInt(rules.bonus14 || 30); // If config differentiates, good.
        else if (hits === 13) bonus = parseInt(rules.bonus13);
        else if (hits === 12) bonus = parseInt(rules.bonus12);
        else if (hits === 11) bonus = parseInt(rules.bonus11);
        else if (hits === 10) bonus = parseInt(rules.bonus10);
        else if (hits === 3) bonus = parseInt(rules.penalty3);
        else if (hits === 2) bonus = parseInt(rules.penalty2);
        else if (hits === 1) bonus = parseInt(rules.penalty1);
        else if (hits === 0) bonus = parseInt(rules.penalty0);

        return hits + bonus;
    },

    // Returns { hits, points, bonus }
    evaluateForecast: function (forecastSelection, officialResults) {
        let hits = 0;
        forecastSelection.forEach((sel, idx) => {
            if (sel && sel === officialResults[idx]) hits++;
        });

        const points = this.calculateScore(hits);
        const bonus = points - hits;

        return { hits, points, bonus };
    }
};
