
class PronosticoManager {
    constructor() {
        this.members = [];
        this.jornadas = [];
        this.pronosticos = [];

        this.currentMemberId = null;
        this.currentJornadaId = null;

        this.init();
    }

    async init() {
        if (window.DataService) await window.DataService.init();

        this.members = await window.DataService.getAll('members');
        this.jornadas = await window.DataService.getAll('jornadas');
        this.pronosticos = await window.DataService.getAll('pronosticos');

        this.cacheDOM();
        this.populateDropdowns();
        this.bindEvents();
    }

    cacheDOM() {
        this.selMember = document.getElementById('sel-member');
        this.selJornada = document.getElementById('sel-jornada');
        this.container = document.getElementById('forecast-container');
        this.statusMsg = document.getElementById('status-message');
        this.deadlineInfo = document.getElementById('deadline-info');
        this.btnSave = document.getElementById('btn-save');
    }

    bindEvents() {
        this.selMember.addEventListener('change', (e) => {
            this.currentMemberId = parseInt(e.target.value);
            this.loadForecast();
        });

        this.selJornada.addEventListener('change', (e) => {
            this.currentJornadaId = parseInt(e.target.value);
            this.loadForecast();
        });

        this.btnSave.addEventListener('click', () => this.saveForecast());
    }

    populateDropdowns() {
        this.members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.name} ${m.surname || ''}`;
            this.selMember.appendChild(opt);
        });

        const sortedJornadas = [...this.jornadas].sort((a, b) => a.number - b.number);
        const now = new Date();

        sortedJornadas.forEach(j => {
            if (!j.active) return;

            // Filter: Only show jornadas on Sunday
            const dateObj = this.parseDate(j.date);
            if (!dateObj) return;
            if (dateObj.getDay() !== 0) return; // 0 = Sunday

            // Locked check

            const closeDate = new Date(dateObj.getTime());
            closeDate.setDate(closeDate.getDate() + 2);
            closeDate.setHours(23, 59, 59);

            // Removed closeDate check to allow viewing past forecasts
            /* if (now > closeDate) return; */

            const opt = document.createElement('option');
            opt.value = j.id;
            opt.textContent = `Jornada ${j.number} - ${j.date}`;
            this.selJornada.appendChild(opt);
        });
    }

    loadForecast() {
        this.container.innerHTML = '';
        this.container.classList.add('hidden');
        this.btnSave.style.display = 'none';
        this.statusMsg.textContent = '';
        this.deadlineInfo.textContent = '';

        if (!this.currentMemberId || !this.currentJornadaId) return;

        const jornada = this.jornadas.find(j => j.id === this.currentJornadaId);
        if (!jornada) return;

        const deadline = this.calculateDeadline(jornada.date);
        const now = new Date();
        const isLate = now > deadline;

        const dateObj = this.parseDate(jornada.date);
        const closeDate = new Date(dateObj);
        closeDate.setDate(closeDate.getDate() + 2);
        const isLocked = now > closeDate;

        if (deadline) {
            const dStr = deadline.toLocaleDateString() + ' ' + deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.deadlineInfo.innerHTML = isLate ?
                `<span style="color:var(--danger)">Plazo expirado (${dStr})</span>` :
                `<span style="color:var(--primary-green)">Cierre: ${dStr}</span>`;
        }

        if (isLocked) {
            this.statusMsg.innerHTML = '<span class="badge-locked">🔒 JORNADA FINALIZADA - NO SE ADMITEN CAMBIOS</span>';
        } else if (isLate) {
            this.statusMsg.innerHTML = '<span class="badge-late">⚠️ FUERA DE PLAZO - SE MARCARÁ COMO RETRASADO</span>';
        }

        const existing = this.pronosticos.find(p => p.jId === this.currentJornadaId && p.mId === this.currentMemberId);
        const currentSelections = existing ? existing.selection : Array(15).fill(null);

        jornada.matches.forEach((match, idx) => {
            const displayIdx = idx === 14 ? 'P15' : idx + 1;
            const row = document.createElement('div');
            row.className = 'pronostico-row';

            let disabledStr = isLocked ? 'style="pointer-events:none; opacity:0.6;"' : '';

            // Pleno Restriction
            if (idx === 14) {
                const bigThree = ['Real Madrid', 'Atlético de Madrid', 'FC Barcelona'];
                const isBigMatch = bigThree.includes(match.home) && bigThree.includes(match.away);
                if (!isBigMatch) {
                    disabledStr = 'style="pointer-events:none; opacity:0.3; background:#eee;" title="Pleno deshabilitado"';
                }
            }

            const val = currentSelections[idx];
            const homeLogo = this.getTeamLogo(match.home);
            const awayLogo = this.getTeamLogo(match.away);

            row.innerHTML = `
                <div class="p-match-info">
                    <span style="font-weight:bold; color:var(--primary-green); width:30px;">${displayIdx}</span>
                    
                    <div style="flex:1; display:flex; justify-content:flex-end; align-items:center; gap:8px;">
                        <span>${match.home}</span>
                        <img src="${homeLogo}" class="team-logo" style="width:25px; height:25px; object-fit:contain;" onerror="this.style.display='none'">
                    </div>

                    <span style="margin:0 10px; color:#aaa;">-</span>

                    <div style="flex:1; display:flex; justify-content:flex-start; align-items:center; gap:8px;">
                        <img src="${awayLogo}" class="team-logo" style="width:25px; height:25px; object-fit:contain;" onerror="this.style.display='none'">
                        <span>${match.away}</span>
                    </div>
                </div>
                <div class="p-options" ${disabledStr} data-idx="${idx}">
                    <div class="chk-option ${val === '1' ? 'selected' : ''}" onclick="app.selectOption(this, '1')">1</div>
                    <div class="chk-option ${val === 'X' ? 'selected' : ''}" onclick="app.selectOption(this, 'X')">X</div>
                    <div class="chk-option ${val === '2' ? 'selected' : ''}" onclick="app.selectOption(this, '2')">2</div>
                </div>
            `;
            this.container.appendChild(row);
        });

        this.container.classList.remove('hidden');
        if (!isLocked) {
            this.btnSave.style.display = 'block';
        }
    }

    getTeamLogo(teamName) {
        if (!teamName) return '';

        // Normalize name for mapping
        const t = teamName.toLowerCase().trim();

        const map = {
            'alavés': 'escudos/primera/Escudo-Deportivo-Alavés-S.A.D..jpg',
            'alaves': 'escudos/primera/Escudo-Deportivo-Alavés-S.A.D..jpg',
            'almeria': 'escudos/segunda/ALMERIA.jpg',
            'almería': 'escudos/segunda/ALMERIA.jpg',
            'athletic club': 'escudos/primera/ATHLETIC_BILBAO-150x150.jpg',
            'athletic': 'escudos/primera/ATHLETIC_BILBAO-150x150.jpg',
            'at. madrid': 'escudos/primera/ATLÉTICO_MADRID-150x150.jpg',
            'atlético de madrid': 'escudos/primera/ATLÉTICO_MADRID-150x150.jpg',
            'atlético': 'escudos/primera/ATLÉTICO_MADRID-150x150.jpg',
            'barcelona': 'escudos/primera/BARCELONA-150x150.jpg',
            'betis': 'escudos/primera/REAL-BETIS-150x150.jpg',
            'real betis': 'escudos/primera/REAL-BETIS-150x150.jpg',
            'celta': 'escudos/primera/CELTA-150x150.jpg',
            'celta de vigo': 'escudos/primera/CELTA-150x150.jpg',
            'elche': 'escudos/primera/ELCHE-150x150.jpg',
            'espanyol': 'escudos/primera/ESPANYOL-150x150.jpg',
            'getafe': 'escudos/primera/GETAFE-150x150.jpg',
            'girona': 'escudos/primera/Escudo-Girona-FC-2022.jpg',
            'las palmas': 'escudos/segunda/LAS-PALMAS-150x150.jpg',
            'levante': 'escudos/primera/LEVANTE-150x150.jpg',
            'mallorca': 'escudos/primera/MALLORCA-150x150.jpg',
            'osasuna': 'escudos/primera/OSASUNA-150x150.jpg',
            'rayo vallecano': 'escudos/primera/RAYO-VALLECANO-150x150.jpg',
            'rayo': 'escudos/primera/RAYO-VALLECANO-150x150.jpg',
            'real madrid': 'escudos/primera/REAL-MADRID-150x150.jpg',
            'real sociedad': 'escudos/primera/REAL-SOCIEDAD-150x150.jpg',
            'sevilla': 'escudos/primera/SEVILLA-150x150.jpg',
            'valencia': 'escudos/primera/VALENCIA-150x150.jpg',
            'valladolid': 'escudos/segunda/Escudo-Real-Valladolid-CF.jpg',
            'real valladolid': 'escudos/segunda/Escudo-Real-Valladolid-CF.jpg',
            'villarreal': 'escudos/primera/VILLARREAL-150x150.jpg',

            // Segunda
            'albacete': 'escudos/segunda/ALBACETE-150x150.jpg',
            'andorra': 'escudos/segunda/ANDORRA-150x150.jpg',
            'burgos': 'escudos/segunda/BURGOS-150x150.jpg',
            'cádiz': 'escudos/segunda/CADIZ-150x150.jpg',
            'cadiz': 'escudos/segunda/CADIZ-150x150.jpg',
            'castellón': 'escudos/segunda/CASTELLON-150x150.jpg',
            'castellon': 'escudos/segunda/CASTELLON-150x150.jpg',
            'ceuta': 'escudos/segunda/Escudo-AgD-Ceuta-FC-150x150.jpg',
            'córdoba': 'escudos/segunda/CORDOBA-150x150.jpg',
            'cordoba': 'escudos/segunda/CORDOBA-150x150.jpg',
            'cultural leonesa': 'escudos/segunda/CULTURAL-150x150.jpg',
            'cultural': 'escudos/segunda/CULTURAL-150x150.jpg',
            'deportivo': 'escudos/segunda/DEPORTIVO-150x150.jpg',
            'depor': 'escudos/segunda/DEPORTIVO-150x150.jpg',
            'eibar': 'escudos/segunda/EIBAR-150x150.jpg',
            'granada': 'escudos/segunda/GRANADA-150x150.jpg',
            'huesca': 'escudos/segunda/HUESCA-150x150.jpg',
            'leganés': 'escudos/segunda/LEGANES-150x150.jpg',
            'leganes': 'escudos/segunda/LEGANES-150x150.jpg',
            'málaga': 'escudos/segunda/MALAGA-150x150.jpg',
            'malaga': 'escudos/segunda/MALAGA-150x150.jpg',
            'mirandés': 'escudos/segunda/MIRANDES-150x150.jpg',
            'mirandes': 'escudos/segunda/MIRANDES-150x150.jpg',
            'racing santander': 'escudos/segunda/REAL-RACING-150x150.jpg',
            'racing de santander': 'escudos/segunda/REAL-RACING-150x150.jpg',
            'racing': 'escudos/segunda/REAL-RACING-150x150.jpg',
            'r. oviedo': 'escudos/primera/REAL-OVIEDO-150x150.jpg',
            'real oviedo': 'escudos/primera/REAL-OVIEDO-150x150.jpg',
            'oviedo': 'escudos/primera/REAL-OVIEDO-150x150.jpg',
            'sporting': 'escudos/segunda/REAL-SPORTING-150x150.jpg',
            'real sporting': 'escudos/segunda/REAL-SPORTING-150x150.jpg',
            'r. zaragoza': 'escudos/segunda/REAL-ZARAGOZA-150x150.jpg',
            'real zaragoza': 'escudos/segunda/REAL-ZARAGOZA-150x150.jpg',
            'zaragoza': 'escudos/segunda/REAL-ZARAGOZA-150x150.jpg'
        };

        return map[t] || '';
    }

    selectOption(el, val) {
        const parent = el.parentElement;
        parent.querySelectorAll('.chk-option').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    }

    async saveForecast() {
        if (!this.currentMemberId || !this.currentJornadaId) return;

        const rows = this.container.querySelectorAll('.p-options');
        const selection = [];
        let missing = false;

        rows.forEach((r, i) => {
            // Skip Pleno check if disabled naturally? No, strict check on selection.
            // If Pleno is disabled (opacity 0.3), we accept null.
            const isPlenoDisabled = (i === 14 && r.style.opacity === '0.3');

            const sel = r.querySelector('.selected');
            if (sel) selection.push(sel.textContent);
            else {
                selection.push(null);
                if (!isPlenoDisabled) missing = true;
            }
        });

        if (missing) {
            alert('Debes rellenar todos los resultados disponibles.');
            return;
        }

        const jornada = this.jornadas.find(j => j.id === this.currentJornadaId);
        const deadline = this.calculateDeadline(jornada.date);
        const isLate = new Date() > deadline;

        const id = `${this.currentJornadaId}_${this.currentMemberId}`;
        const record = {
            id: id,
            jId: this.currentJornadaId,
            mId: this.currentMemberId,
            selection: selection,
            timestamp: new Date().toISOString(),
            late: isLate
        };

        const idx = this.pronosticos.findIndex(p => p.id === id);
        if (idx > -1) {
            this.pronosticos[idx] = { ...this.pronosticos[idx], ...record };
        } else {
            this.pronosticos.push(record);
        }

        await window.DataService.save('pronosticos', record);

        // Show random Maula phrase
        if (typeof FRASES_MAULA !== 'undefined' && FRASES_MAULA.length > 0) {
            const randomPhrase = FRASES_MAULA[Math.floor(Math.random() * FRASES_MAULA.length)];
            alert('PRONÓSTICO GUARDADO CORRECTAMENTE\n\n' + randomPhrase);
        } else {
            alert('Pronóstico guardado correctamente' + (isLate ? ' (CON RETRASO)' : '') + '.');
        }
    }

    calculateDeadline(dateStr) {
        const d = this.parseDate(dateStr);
        if (!d) return null;

        const deadline = new Date(d.getTime());
        deadline.setDate(d.getDate() - 3);  // 3 días antes (jueves si la jornada es domingo)
        deadline.setHours(17, 0, 0, 0);
        return deadline;
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        // Eliminar " de " para manejar formato "14 de diciembre de 2025"
        const clean = dateStr.replace(/\(.*\)/, '').replace(/ de /g, ' ').trim();
        const parts = clean.split(' ');

        if (parts.length < 3) return new Date();

        const day = parseInt(parts[0]);
        const year = parseInt(parts[parts.length - 1]);
        const monthStr = parts[1].toLowerCase();

        const months = {
            'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
            'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
        };

        return new Date(year, months[monthStr] || 0, day);
    }
}

const app = new PronosticoManager();
window.app = app;
