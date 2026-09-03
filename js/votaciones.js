class VotingSystem {
    constructor() {
        this.votaciones = [];
        this.members = [];
        this.currentUser = JSON.parse(sessionStorage.getItem('maulas_user'));

        // Telegram WebApp Integration
        this.tg = window.Telegram ? window.Telegram.WebApp : null;
        if (this.tg) {
            this.tg.ready();
            this.tg.expand();
        }

        this.init();
    }

    async tryAutoLogin(tgUsername) {
        if (!tgUsername) {
            console.warn("VotingSystem: No Telegram username provided for auto-login.");
            return;
        }

        console.log("VotingSystem: Attempting auto-login for:", tgUsername);

        // Normalize TG username for comparison
        const cleanTg = tgUsername.toLowerCase().replace('@', '').trim();

        // Match by new tgNick field or phone
        const member = this.members.find(m =>
            (m.tgNick && m.tgNick.toLowerCase().trim() === cleanTg) ||
            (m.phone && m.phone.toLowerCase().replace('@', '').trim() === cleanTg)
        );

        if (member) {
            console.log("VotingSystem: Auto-login SUCCESS for", member.name);
            const userData = {
                id: member.id,
                name: member.name,
                phone: member.phone,
                tgNick: member.tgNick,
                email: member.email,
                loginTime: new Date().toISOString()
            };
            sessionStorage.setItem('maulas_user', JSON.stringify(userData));
            this.currentUser = userData;
            this.render();
        } else {
            console.warn("VotingSystem: No matching member found for TG Nick:", cleanTg);
        }
    }

    async init() {
        console.log("VotingSystem: Initializing...");
        if (!window.DataService) {
            console.error("DataService not found");
            return;
        }
        await window.DataService.init();

        this.cacheDOM();
        this.bindEvents();
        await this.loadData();

        // After loading members, try auto-login if TG detected
        if (this.tg && !this.currentUser) {
            this.attemptTgAuth();
            setTimeout(() => this.attemptTgAuth(), 500);
            setTimeout(() => this.attemptTgAuth(), 2500);
        }

        this.render();

        // Update countdowns every second
        setInterval(() => this.updateCountdowns(), 1000);

        // Auto-check for newly finished votations
        setInterval(() => this.checkAutoNotifications(), 10000);
    }

    attemptTgAuth() {
        if (this.currentUser || !this.tg) return;
        const tgData = this.tg.initDataUnsafe;
        const tgUser = tgData ? tgData.user : null;

        if (tgUser) {
            if (tgUser.username) {
                this.tryAutoLogin(tgUser.username);
            } else if (tgUser.first_name) {
                console.log("VotingSystem: No username, using first_name as fallback...");
                this.tryAutoLogin(tgUser.first_name);
            }
        }
    }

    getCurrentUser() {
        if (!this.currentUser) {
            try {
                this.currentUser = JSON.parse(sessionStorage.getItem('maulas_user'));
            } catch (e) { }
        }
        return this.currentUser;
    }

    canManageVote(v) {
        const user = this.getCurrentUser();
        if (!user) return false;
        const isCreator = v.creatorId !== undefined && v.creatorId !== null && String(user.id) === String(v.creatorId);
        const isEmilio = (user.email && String(user.email).toLowerCase() === 'emilio@maulas.com') ||
            (user.name && String(user.name).toLowerCase().includes('emilio')) ||
            (user.phone && String(user.phone).includes('667634629'));
        const isAdmin = (window.AuthService && typeof window.AuthService.isAdmin === 'function' ? window.AuthService.isAdmin() : false) ||
            sessionStorage.getItem('maulas_admin') === 'true';
        return isCreator || isEmilio || isAdmin;
    }

    cacheDOM() {
        this.listContainer = document.getElementById('votaciones-list');
        this.btnPropose = document.getElementById('btn-propose');
        this.modal = document.getElementById('vote-modal');
        this.form = document.getElementById('vote-form');
        this.btnCancel = document.getElementById('btn-cancel-vote');

        this.inpTitle = document.getElementById('inp-vote-title');
        this.inpDesc = document.getElementById('inp-vote-desc');
        this.inpOptions = document.getElementById('inp-vote-options');
        this.inpDate = document.getElementById('inp-vote-date');
        this.inpTime = document.getElementById('inp-vote-time');
        this.inpThreshold = document.getElementById('inp-vote-threshold');
        this.inpMultiple = document.getElementById('inp-vote-multiple');

        // Edit Deadline Modal Elements
        this.editModal = document.getElementById('edit-deadline-modal');
        this.editForm = document.getElementById('edit-deadline-form');
        this.btnCancelEdit = document.getElementById('btn-cancel-edit-deadline');
        this.inpEditVoteId = document.getElementById('inp-edit-vote-id');
        this.editVoteTitle = document.getElementById('edit-deadline-vote-title');
        this.inpEditDate = document.getElementById('inp-edit-date');
        this.inpEditTime = document.getElementById('inp-edit-time');
    }

    bindEvents() {
        if (this.btnPropose) this.btnPropose.addEventListener('click', () => this.openModal());
        if (this.btnCancel) this.btnCancel.addEventListener('click', () => this.closeModal());
        if (this.form) this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        if (this.btnCancelEdit) this.btnCancelEdit.addEventListener('click', () => this.closeEditDeadlineModal());
        if (this.editForm) this.editForm.addEventListener('submit', (e) => this.handleEditDeadlineSubmit(e));
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
            if (e.target === this.editModal) this.closeEditDeadlineModal();
        });
    }

    async loadData() {
        try {
            this.votaciones = await window.DataService.getAll('votaciones');
            this.members = await window.DataService.getAll('members');
            this.votaciones.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (e) {
            console.error("Error loading voting data:", e);
        }
    }

    async checkAutoNotifications() {
        const now = new Date();
        let changed = false;

        for (const v of this.votaciones) {
            const deadline = new Date(v.deadline);
            if (now > deadline && !v.tgNotified) {
                if (window.TelegramService) {
                    await window.TelegramService.sendVoteResultReport(v, this.members);
                    v.tgNotified = true;
                    await window.DataService.save('votaciones', v);
                    changed = true;
                }
            }
        }

        if (changed) {
            await this.loadData();
            this.render();
        }
    }

    render() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';

        if (this.votaciones.length === 0) {
            this.listContainer.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color: var(--text-muted); padding: 2rem;">No hay votaciones activas ni pasadas.</p>`;
            return;
        }

        const now = new Date();

        this.votaciones.forEach(v => {
            const deadline = new Date(v.deadline);
            const isFinished = now > deadline;
            const options = v.options || ["Sí", "No"];
            const canManage = this.canManageVote(v);
            const canEditDeadline = canManage && !isFinished;

            const user = this.getCurrentUser();
            const getMyVotes = () => {
                if (!user || !v.votes) return [];
                const val = v.votes[user.id];
                if (val === undefined || val === null) return [];
                return Array.isArray(val) ? val : [val];
            };
            const myVotes = getMyVotes();
            const totalVoters = Object.keys(v.votes || {}).length;

            const card = document.createElement('div');
            card.className = `vote-card ${isFinished ? 'finished' : 'active'}`;
            card.innerHTML = `
                <div class="vote-header">
                    <h3 class="vote-title">${v.title}</h3>
                    <div style="display:flex; gap: 0.5rem; align-items:center;">
                        <span class="vote-badge ${isFinished ? 'badge-finished' : 'badge-active'}">${isFinished ? 'Finalizada' : 'Activa'}</span>
                        ${canEditDeadline ? `
                            <button class="delete-btn" onclick="votingSystem.openEditDeadlineModal('${v.id}')" title="Cambiar fecha de finalización">✏️</button>
                        ` : ''}
                        ${canManage ? `
                            <button class="delete-btn" onclick="votingSystem.deleteVote('${v.id}')" title="Borrar Votación">🗑️</button>
                        ` : ''}
                    </div>
                </div>
                ${v.description ? `<p class="vote-desc">${v.description}</p>` : ''}
                
                <div class="vote-meta">
                    <span>Propuesta por: <b>${v.creatorName}</b></span>
                    <span style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        Límite: <b>${new Date(v.deadline).toLocaleString()}</b>
                        ${canEditDeadline ? `<button class="btn-change-date" onclick="votingSystem.openEditDeadlineModal('${v.id}')" style="padding: 2px 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer; border-radius: 4px; border: 1px solid var(--primary-blue); background: rgba(21, 101, 192, 0.1); color: var(--primary-blue);">✏️ Cambiar Fecha</button>` : ''}
                    </span>
                    <span>Para ganar: <b>${v.threshold}%</b> de los votos</span>
                    ${v.allowMultiple ? `<span style="color:var(--primary-blue); font-weight:bold;">✅ Elección Múltiple Permitida</span>` : ''}
                </div>

                ${!isFinished ? `
                    <div class="vote-timer" id="timer-${v.id}">Calculando tiempo...</div>
                ` : ''}

                <div class="vote-options">
                    ${options.map((opt, idx) => {
                    let count = 0;
                    Object.values(v.votes || {}).forEach(voteVal => {
                        if (Array.isArray(voteVal)) {
                            if (voteVal.includes(idx)) count++;
                        } else {
                            if (voteVal === idx) count++;
                        }
                    });

                    const pct = totalVoters > 0 ? (count / totalVoters * 100).toFixed(0) : 0;
                    const isSelected = myVotes.includes(idx);

                    return `
                            <div class="option-wrapper">
                                <button class="option-btn ${isSelected ? 'selected' : ''}" 
                                        onclick="votingSystem.castVote('${v.id}', ${idx})"
                                        ${isFinished ? 'disabled' : ''}>
                                    <span>${opt}</span>
                                    <span>${count} (${pct}%)</span>
                                </button>
                                <div class="option-progress">
                                    <div class="progress-bar" style="width: ${pct}%"></div>
                                </div>
                            </div>
                        `;
                }).join('')}
                </div>

                <div class="vote-results">
                    <div class="voters-list">
                        <b>Socios que han votado (${totalVoters}):</b> ${this.formatVoters(v)}
                    </div>
                </div>

                ${isFinished ? this.renderWinnerInfo(v, totalVoters, options) : ''}
            `;
            this.listContainer.appendChild(card);
        });

        this.updateCountdowns();
    }

    formatVoters(v) {
        if (!v.votes || Object.keys(v.votes).length === 0) return 'Nadie ha votado aún';
        return Object.keys(v.votes).map(uid => {
            const member = this.members.find(m => String(m.id) === String(uid));
            return member ? (member.phone || member.name) : 'Socio ' + uid;
        }).join(', ');
    }

    renderWinnerInfo(v, totalVoters, options) {
        if (totalVoters === 0) return `<div class="winning-info" style="background:#eee; color:#666; border-color:#ccc;">Empate / Sin votos</div>`;

        const counts = options.map((_, idx) => {
            let c = 0;
            Object.values(v.votes || {}).forEach(voteVal => {
                if (Array.isArray(voteVal)) {
                    if (voteVal.includes(idx)) c++;
                } else {
                    if (voteVal === idx) c++;
                }
            });
            return c;
        });

        const maxVal = Math.max(...counts);
        const winnerIndices = counts.reduce((acc, c, i) => (c === maxVal ? [...acc, i] : acc), []);
        const winnerPct = (maxVal / totalVoters * 100);

        if (winnerIndices.length > 1) {
            return `<div class="winning-info" style="background:#fce4ec; color:#c2185b; border-color:#f8bbd0;">EMPATE ENTRE: ${winnerIndices.map(i => options[i].toUpperCase()).join(', ')}</div>`;
        }

        if (winnerPct >= v.threshold) {
            return `<div class="winning-info">GANADOR: ${options[winnerIndices[0]].toUpperCase()} (${winnerPct.toFixed(1)}%)</div>`;
        } else {
            return `<div class="winning-info" style="background:#eee; color:#666; border-color:#ccc;">NO ALCANZA MAYORÍA (${winnerPct.toFixed(1)}% < ${v.threshold}%)</div>`;
        }
    }

    updateCountdowns() {
        const now = new Date();
        this.votaciones.forEach(v => {
            const el = document.getElementById(`timer-${v.id}`);
            if (!el) return;

            const deadline = new Date(v.deadline);
            const diff = deadline - now;

            if (diff <= 0) {
                el.innerHTML = "¡TIEMPO AGOTADO!";
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            el.innerHTML = `Quedan: ${days > 0 ? days + 'd ' : ''}${hours}h ${mins}m ${secs}s`;
        });
    }

    async castVote(voteId, optionIdx) {
        if (!this.currentUser) return alert("Debes iniciar sesión para votar.");

        const v = this.votaciones.find(x => x.id === voteId);
        if (!v) return;

        const now = new Date();
        if (now > new Date(v.deadline)) return alert("La votación ya ha finalizado.");

        if (!v.votes) v.votes = {};

        const currentVoteVal = v.votes[this.currentUser.id];
        let newVoteVal;

        if (v.allowMultiple) {
            let currentArray = Array.isArray(currentVoteVal) ? currentVoteVal : (currentVoteVal !== undefined && currentVoteVal !== null ? [currentVoteVal] : []);
            if (currentArray.includes(optionIdx)) {
                newVoteVal = currentArray.filter(i => i !== optionIdx);
            } else {
                newVoteVal = [...currentArray, optionIdx];
            }
        } else {
            newVoteVal = (currentVoteVal === optionIdx) ? null : optionIdx;
        }

        v.votes[this.currentUser.id] = newVoteVal;

        try {
            await window.DataService.save('votaciones', v);
            await this.loadData();
            this.render();
        } catch (e) {
            alert("Error al guardar el voto.");
        }
    }

    async deleteVote(voteId) {
        if (!confirm("¿Seguro que quieres BORRAR esta votación?")) return;
        try {
            await window.DataService.delete('votaciones', voteId);
            await this.loadData();
            this.render();
        } catch (e) {
            alert("Error al borrar.");
        }
    }

    async cancelVote(voteId) {
        if (!confirm("¿Deseas CANCELAR esta votación?")) return;
        const v = this.votaciones.find(x => x.id === voteId);
        if (!v) return;

        v.deadline = new Date().toISOString();
        v.tgNotified = false;
        try {
            await window.DataService.save('votaciones', v);
            await this.loadData();
            this.render();
        } catch (e) {
            alert("Error al cancelar.");
        }
    }

    openModal() {
        if (!this.currentUser) return alert("Inicia sesión primero.");
        this.modal.classList.add('active');
        const d = new Date();
        d.setDate(d.getDate() + 3);
        this.inpDate.value = d.toISOString().split('T')[0];
    }

    closeModal() {
        this.modal.classList.remove('active');
        this.form.reset();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const title = this.inpTitle.value.trim();
        const desc = this.inpDesc.value.trim();
        const optsRaw = this.inpOptions.value.trim();
        const deadlineDate = this.inpDate.value;
        const deadlineTime = this.inpTime.value;
        const threshold = parseInt(this.inpThreshold.value) || 51;
        const allowMultiple = this.inpMultiple.checked;

        const options = optsRaw ? optsRaw.split(',').map(o => o.trim()) : ["Sí", "No"];
        const deadline = new Date(`${deadlineDate}T${deadlineTime}`).toISOString();

        const newVote = {
            id: 'VOTE-' + Date.now(),
            title,
            description: desc,
            options,
            deadline,
            threshold,
            allowMultiple,
            creatorId: this.currentUser.id,
            creatorName: this.currentUser.phone || this.currentUser.name,
            createdAt: new Date().toISOString(),
            votes: {},
            tgNotified: false
        };

        try {
            await window.DataService.save('votaciones', newVote);
            if (window.TelegramService) {
                await window.TelegramService.sendVoteNotification(newVote);
            }
            await this.loadData();
            this.render();
            this.closeModal();
            alert("Votación creada con éxito.");
        } catch (e) {
            alert("Error al crear.");
        }
    }

    openEditDeadlineModal(voteId) {
        const user = this.getCurrentUser();
        if (!user) return alert("Inicia sesión primero.");
        const v = this.votaciones.find(x => x.id === voteId);
        if (!v) return;

        if (new Date() > new Date(v.deadline)) {
            return alert("La votación ya ha finalizado y no se puede modificar su fecha.");
        }

        if (!this.canManageVote(v)) {
            return alert("Solo el creador o un administrador puede modificar esta fecha.");
        }

        if (this.inpEditVoteId) this.inpEditVoteId.value = v.id;
        if (this.editVoteTitle) this.editVoteTitle.textContent = v.title;

        const d = new Date(v.deadline);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            if (this.inpEditDate) this.inpEditDate.value = `${year}-${month}-${day}`;

            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            if (this.inpEditTime) this.inpEditTime.value = `${hours}:${minutes}`;
        } else {
            const now = new Date();
            if (this.inpEditDate) this.inpEditDate.value = now.toISOString().split('T')[0];
            if (this.inpEditTime) this.inpEditTime.value = "20:00";
        }

        if (this.editModal) this.editModal.classList.add('active');
    }

    closeEditDeadlineModal() {
        if (this.editModal) this.editModal.classList.remove('active');
        if (this.editForm) this.editForm.reset();
    }

    async handleEditDeadlineSubmit(e) {
        e.preventDefault();
        const voteId = this.inpEditVoteId ? this.inpEditVoteId.value : null;
        const v = this.votaciones.find(x => x.id === voteId);
        if (!v) return alert("No se encuentra la votación.");

        if (!this.canManageVote(v)) {
            return alert("No tienes permisos para modificar esta votación.");
        }

        const dateVal = this.inpEditDate ? this.inpEditDate.value : '';
        const timeVal = (this.inpEditTime && this.inpEditTime.value) ? this.inpEditTime.value : '20:00';

        if (!dateVal) return alert("Debes seleccionar una fecha válida.");

        const newDeadlineDate = new Date(`${dateVal}T${timeVal}`);
        if (isNaN(newDeadlineDate.getTime())) {
            return alert("Fecha u hora introducida no válida.");
        }

        const newDeadlineISO = newDeadlineDate.toISOString();
        v.deadline = newDeadlineISO;

        // Reset tgNotified if the new deadline is in the future
        if (newDeadlineDate > new Date()) {
            v.tgNotified = false;
        }

        try {
            await window.DataService.save('votaciones', v);
            await this.loadData();
            this.render();
            this.closeEditDeadlineModal();
            alert("¡Fecha de finalización modificada con éxito!");
        } catch (err) {
            console.error("Error al actualizar fecha de votación:", err);
            alert("Error al actualizar la fecha: " + err.message);
        }
    }
}

window.votingSystem = new VotingSystem();
