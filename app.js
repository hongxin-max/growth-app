/* ========== DATA STORE ========== */
const Store = {
    _k(k) { return 'gt_' + k; },
    get(k) { try { return JSON.parse(localStorage.getItem(this._k(k))) || []; } catch { return []; } },
    save(k, arr) { localStorage.setItem(this._k(k), JSON.stringify(arr)); },
    add(k, entry) {
        const arr = this.get(k);
        entry.id = Date.now();
        entry.time = new Date().toISOString();
        arr.unshift(entry);
        this.save(k, arr);
    },
    del(k, id) { this.save(k, this.get(k).filter(e => e.id !== id)); },
    count(k) { return this.get(k).length; },
    ALL_KEYS: ['problems', 'outputs', 'reflects', 'encourages', 'criticizes', 'monthlyPos', 'monthlyNeg', 'victories']
};

/* ========== MODAL ========== */
const Modal = {
    _mask: null, _inner: null, _closeable: true,
    init() {
        this._mask = document.getElementById('modal-mask');
        this._inner = document.getElementById('modal-inner');
    },
    show(html, closeable) {
        this._inner.innerHTML = html;
        this._closeable = closeable !== false;
        this._mask.classList.add('show');
    },
    hide() { this._mask.classList.remove('show'); },
    onMaskClick(e) { if (e.target === this._mask && this._closeable) this.hide(); },

    alert(icon, title, text, btnText, btnClass, afterCode) {
        const onclick = afterCode ? 'Modal.hide();' + afterCode : 'Modal.hide()';
        this.show(`
            <div class="modal-icon">${icon}</div>
            <div class="modal-title">${title}</div>
            <div class="modal-text">${text}</div>
            <button class="modal-btn ${btnClass || 'primary'}" onclick="${onclick}">${btnText || '我知道了'}</button>
        `, false);
    },

    select(title, options, fnName) {
        const opts = options.map(o => `
            <button class="modal-option" onclick="Modal.hide();${fnName}('${o.value}')">
                <span class="mo-icon">${o.icon}</span><span class="mo-text">${o.text}</span>
            </button>`).join('');
        this.show(`
            <div class="modal-title">${title}</div>
            <div class="modal-options">${opts}</div>
            <button class="modal-btn ghost" onclick="Modal.hide()">取消</button>
        `, true);
    }
};

/* ========== APP ========== */
const App = {
    stack: [],

    init() {
        Modal.init();
        this._applyTheme(localStorage.getItem('gt_theme') || 'light');
        this._checkLock();
    },

    _checkLock() {
        const hash = localStorage.getItem('gt_lock_hash');
        if (!hash) {
            document.getElementById('lock-hint').textContent = '首次使用，请设置一个访问密码（设置后每次打开都需要输入）';
            document.getElementById('lock-pwd').placeholder = '设置密码';
        }
        document.getElementById('lock-pwd').focus();
    },

    async _hashPwd(pwd) {
        const data = new TextEncoder().encode(pwd + '_growth_salt_2026');
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async unlock() {
        const pwd = document.getElementById('lock-pwd').value;
        if (!pwd) { document.getElementById('lock-error').textContent = '请输入密码'; return; }

        const storedHash = localStorage.getItem('gt_lock_hash');
        const inputHash = await this._hashPwd(pwd);

        if (!storedHash) {
            localStorage.setItem('gt_lock_hash', inputHash);
            this._enterApp();
        } else if (inputHash === storedHash) {
            this._enterApp();
        } else {
            document.getElementById('lock-error').textContent = '密码不正确';
            document.getElementById('lock-pwd').value = '';
            document.getElementById('lock-pwd').focus();
        }
    },

    _enterApp() {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        this.navigate('home');
        window.addEventListener('popstate', () => {
            if (this.stack.length > 1) { this.stack.pop(); this.render(); }
        });
    },

    toggleTheme() {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        this._applyTheme(next);
        localStorage.setItem('gt_theme', next);
    },

    _applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        const icon = document.getElementById('icon-theme');
        if (icon) {
            icon.innerHTML = t === 'dark'
                ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
                : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
        }
    },

    get current() { return this.stack[this.stack.length - 1]; },

    navigate(page, params) {
        this.stack.push({ page, params: params || {} });
        if (this.stack.length > 1) history.pushState(null, '', '');
        this.render();
        if (page === 'problem') this._problemWarning();
    },

    goBack() {
        if (this.stack.length > 1) { this.stack.pop(); this.render(); }
        if (this._pendingCelebrate) {
            this._pendingCelebrate = false;
            setTimeout(() => this._celebrate(), 300);
        }
    },

    render() {
        const { page, params } = this.current;
        const fn = this.pages[page];
        if (fn) {
            document.getElementById('main').innerHTML = '<div class="page-enter">' + fn.call(this, params) + '</div>';
            document.getElementById('main').scrollTop = 0;
        }
        this._header();
    },

    _header() {
        const { page } = this.current;
        const titles = {
            home: '成长轨迹', problem: '问题分析', daily: '每日产出 & 反思',
            outputForm: '记录产出', reflectForm: '记录反思',
            mood: '鼓励 & 批判', encourageForm: '表扬自己', criticizeForm: '审视自己',
            monthly: '月积累', monthlyPositive: '本月正反馈', monthlyNegative: '本月负反馈',
            victories: '每日小胜利', weeklyReport: '本周报告', history: '历史记录'
        };
        document.getElementById('page-title').textContent = titles[page] || '成长轨迹';
        document.getElementById('btn-back').classList.toggle('hidden', page === 'home');
        const hist = ['problem','outputForm','reflectForm','encourageForm','criticizeForm','monthlyPositive','monthlyNegative','victories'];
        document.getElementById('btn-hist').classList.toggle('hidden', !hist.includes(page));
    },

    /* --- Modals --- */
    _problemWarning() {
        Modal.alert('🚫', '停！先想一想',
            '不可以说「搞不懂这个业务」、「不会这个方向」！<br><br>你到底有没有<b>仔细分析</b>过这个问题？<br>分析之后再来吧！',
            '我分析过了', 'primary');
    },

    showOutputTypeSelect() {
        Modal.select('今天的收获是什么类型？', [
            { icon: '💬', text: '想说的话', value: 'words' },
            { icon: '📊', text: '想做的表', value: 'table' },
            { icon: '🎨', text: '想画的图', value: 'drawing' },
            { icon: '💡', text: '想积累的经验', value: 'experience' }
        ], 'App._onOutputType');
    },
    _onOutputType(v) {
        const m = { words: '想说的话', table: '想做的表', drawing: '想画的图', experience: '想积累的经验' };
        App.navigate('outputForm', { type: v, label: m[v] });
    },

    showReflectTypeSelect() {
        Modal.select('今天的反思是什么类型？', [
            { icon: '❌', text: '做错的事', value: 'wrongAction' },
            { icon: '🗣️', text: '说错的话', value: 'wrongWords' },
            { icon: '🧭', text: '想错的方向', value: 'wrongDirection' }
        ], 'App._onReflectType');
    },
    _onReflectType(v) {
        const m = { wrongAction: '做错的事', wrongWords: '说错的话', wrongDirection: '想错的方向' };
        App.navigate('reflectForm', { type: v, label: m[v] });
    },

    showCurrentHistory() {
        const map = {
            problem: 'problems', outputForm: 'outputs', reflectForm: 'reflects',
            encourageForm: 'encourages', criticizeForm: 'criticizes',
            monthlyPositive: 'monthlyPos', monthlyNegative: 'monthlyNeg',
            victories: 'victories'
        };
        const k = map[this.current.page];
        if (k) this.navigate('history', { key: k });
    },

    /* --- Submissions --- */
    submitProblem() {
        const q1 = document.getElementById('f-problem').value.trim();
        const q2 = document.getElementById('f-judgment').value.trim();
        const q3 = document.getElementById('f-tried').value.trim();
        if (!q1 || !q2 || !q3) {
            Modal.alert('✏️', '还没写完', '三个问题都要填，这是在训练你的分析肌肉！');
            return;
        }
        Store.add('problems', { problem: q1, judgment: q2, tried: q3 });
        if ((q1 + q2 + q3).length >= 10) this._pendingCelebrate = true;
        Modal.alert('🌟', '很不错！', '你的大脑已经在重新构建，别急！<br>我们慢慢来就好。', '继续加油', 'success', 'App.goBack()');
    },

    submitOutput() {
        const c = document.getElementById('f-content').value.trim();
        if (!c) { Modal.alert('✏️', '写点什么吧', '哪怕只有一句话，也是今天的收获。'); return; }
        const { type, label } = this.current.params;
        Store.add('outputs', { type, label, content: c });
        if (c.length >= 10) this._pendingCelebrate = true;
        Modal.alert('✨', '已记录！', '每一次记录都是成长的印记。', '好的', 'success', 'App.goBack()');
    },

    submitReflect() {
        const c = document.getElementById('f-content').value.trim();
        if (!c) { Modal.alert('✏️', '写点什么吧', '反思不需要长篇大论，一句话也好。'); return; }
        const { type, label } = this.current.params;
        Store.add('reflects', { type, label, content: c });
        if (c.length >= 10) this._pendingCelebrate = true;
        Modal.alert('🪞', '已记录', '看见问题本身就是进步。', '好的', 'primary', 'App.goBack()');
    },

    submitEncourage() {
        const c = document.getElementById('f-content').value.trim();
        if (!c) { Modal.alert('✏️', '想想看', '今天一定有值得表扬自己的地方！'); return; }
        Store.add('encourages', { content: c });
        if (c.length >= 10) this._pendingCelebrate = true;
        Modal.alert('🎉', '你值得被肯定！', '记住这个感觉，你比自己以为的更好。', '谢谢自己', 'success', 'App.goBack()');
    },

    submitCriticize() {
        const c = document.getElementById('f-content').value.trim();
        if (!c) { Modal.alert('✏️', '诚实面对', '写下来不是为了自我惩罚，是为了不再重复。'); return; }
        Store.add('criticizes', { content: c });
        if (c.length >= 10) this._pendingCelebrate = true;
        Modal.alert('💪', '已记录', '能直面不足的人，才有资格变强。', '我会改进', 'primary', 'App.goBack()');
    },

    submitMonthlyPos() {
        const c = document.getElementById('f-content').value.trim();
        const m = document.getElementById('f-month').value;
        if (!c) { Modal.alert('✏️', '想想看', '这个月一定有进步的地方！'); return; }
        Store.add('monthlyPos', { month: m, content: c });
        if (c.length >= 10) this._pendingCelebrate = true;
        Modal.alert('📈', '正反馈已记录', '每一点进步都值得被铭记。', '好的', 'success', 'App.goBack()');
    },

    submitMonthlyNeg() {
        const c = document.getElementById('f-content').value.trim();
        const m = document.getElementById('f-month').value;
        if (!c) { Modal.alert('✏️', '诚实面对', '记录遗憾不是为了自责，是为了下个月更好。'); return; }
        Store.add('monthlyNeg', { month: m, content: c });
        if (c.length >= 10) this._pendingCelebrate = true;
        Modal.alert('📝', '负反馈已记录', '看见问题就是解决问题的开始。', '下个月会更好', 'primary', 'App.goBack()');
    },

    submitVictories() {
        const w1 = document.getElementById('f-win1').value.trim();
        const w2 = document.getElementById('f-win2').value.trim();
        const w3 = document.getElementById('f-win3').value.trim();
        const wins = [w1, w2, w3].filter(w => w);
        if (!wins.length) { Modal.alert('✏️', '想想看', '今天一定有值得记录的小胜利！<br>搞明白了一个变量名？问问题前自己先想了？都算！'); return; }
        Store.add('victories', { wins });
        if (wins.join('').length >= 10) this._pendingCelebrate = true;
        const msgs = [
            '每一个小胜利都在修复你的自信心！',
            '看到了吗？你今天做到了这些！',
            '积少成多，这就是成长的样子！',
        ];
        Modal.alert('🏆', `记录了 ${wins.length} 个小胜利！`, msgs[Math.floor(Math.random() * msgs.length)], '继续加油', 'success', 'App.goBack()');
    },

    deleteEntry(key, id) {
        Modal.show(`
            <div class="modal-icon">⚠️</div>
            <div class="modal-title">确认删除</div>
            <div class="modal-text">删除后无法恢复，确定要删除吗？</div>
            <button class="modal-btn danger" onclick="Store.del('${key}',${id});Modal.hide();App.render()">确认删除</button>
            <button class="modal-btn ghost" onclick="Modal.hide()">取消</button>
        `, true);
    },

    /* --- Data management (with optional AES-GCM encryption) --- */
    exportData() {
        Modal.show(`
            <div class="modal-icon">📤</div>
            <div class="modal-title">导出数据</div>
            <div class="modal-text">选择导出格式</div>
            <button class="modal-btn primary" onclick="Modal.hide();App._doExport(true)">🔒 加密 JSON（可导入）</button>
            <button class="modal-btn success" onclick="Modal.hide();App._doExport(false)">📄 普通 JSON（可导入）</button>
            <button class="modal-btn" style="background:linear-gradient(135deg,#9f7aea,#805ad5);color:#fff" onclick="Modal.hide();App._exportTxt()">📝 TXT 文本（可阅读）</button>
            <button class="modal-btn ghost" onclick="Modal.hide()">取消</button>
        `, true);
    },

    _exportTxt() {
        const lines = [];
        const sep = '═'.repeat(50);
        const thin = '─'.repeat(50);
        lines.push(sep);
        lines.push('  成长轨迹 · 数据导出');
        lines.push('  导出时间：' + new Date().toLocaleString('zh-CN'));
        lines.push(sep, '');

        const keyNames = {
            problems: '问题分析', outputs: '每日产出', reflects: '每日反思',
            victories: '每日小胜利', encourages: '鼓励记录', criticizes: '批判记录',
            monthlyPos: '月正反馈', monthlyNeg: '月负反馈'
        };

        Store.ALL_KEYS.forEach(k => {
            const entries = Store.get(k);
            if (!entries.length) return;
            lines.push(`【${keyNames[k] || k}】共 ${entries.length} 条`, thin);

            entries.forEach((e, i) => {
                const time = e.time ? App._fmtDate(e.time) : '未知时间';
                lines.push(`  #${i + 1}  ${time}`);

                if (k === 'problems') {
                    lines.push(`  问题：${e.problem}`, `  判断：${e.judgment}`, `  尝试：${e.tried}`);
                } else if (k === 'victories') {
                    (e.wins || []).forEach((w, j) => lines.push(`  胜利${j+1}：${w}`));
                } else if (k === 'monthlyPos' || k === 'monthlyNeg') {
                    if (e.month) lines.push(`  月份：${e.month}`);
                    lines.push(`  内容：${e.content}`);
                } else {
                    if (e.label) lines.push(`  类型：${e.label}`);
                    lines.push(`  内容：${e.content}`);
                }
                lines.push('');
            });
            lines.push('');
        });

        lines.push(sep, '  总计 ' + App._totalCount() + ' 条记录', sep);

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '成长轨迹_' + new Date().toISOString().slice(0, 10) + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        Modal.alert('✅', '导出成功', 'TXT 文件已下载，可以直接用记事本或手机打开阅读。', '好的', 'success');
    },

    _doExport(encrypt) {
        if (!encrypt) {
            this._downloadJson(this._gatherData(), false);
            return;
        }
        Modal.show(`
            <div class="modal-icon">🔐</div>
            <div class="modal-title">设置加密密码</div>
            <div class="modal-text">请输入一个你能记住的密码，导入时需要用同一个密码解密。</div>
            <input class="modal-input" id="exp-pwd" type="password" placeholder="输入密码" autocomplete="off">
            <button class="modal-btn primary" onclick="App._encryptAndExport()">确认导出</button>
            <button class="modal-btn ghost" onclick="Modal.hide()">取消</button>
        `, false);
        setTimeout(() => { const el = document.getElementById('exp-pwd'); if (el) el.focus(); }, 300);
    },

    _gatherData() {
        const data = {};
        Store.ALL_KEYS.forEach(k => { data[k] = Store.get(k); });
        return data;
    },

    async _encryptAndExport() {
        const pwd = document.getElementById('exp-pwd').value;
        if (!pwd) { Modal.alert('⚠️', '请输入密码', '密码不能为空。'); return; }
        try {
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveKey']);
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const key = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
                keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
            );
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const plaintext = enc.encode(JSON.stringify(this._gatherData()));
            const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
            const payload = {
                encrypted: true,
                salt: Array.from(salt),
                iv: Array.from(iv),
                data: Array.from(new Uint8Array(ciphertext))
            };
            this._downloadJson(payload, true);
        } catch { Modal.alert('❌', '加密失败', '你的浏览器可能不支持 Web Crypto API。'); }
    },

    _downloadJson(obj, isEncrypted) {
        const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '成长轨迹_' + new Date().toISOString().slice(0, 10) + (isEncrypted ? '_encrypted' : '') + '.json';
        a.click();
        URL.revokeObjectURL(url);
        Modal.alert('✅', '导出成功', isEncrypted ? '加密备份已下载，请牢记密码。' : '备份文件已下载。', '好的', 'success');
    },

    importData() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const raw = JSON.parse(ev.target.result);
                    if (raw.encrypted) {
                        this._showDecryptModal(raw);
                    } else {
                        this._mergeData(raw);
                    }
                } catch { Modal.alert('❌', '导入失败', '文件格式不正确。'); }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    _showDecryptModal(raw) {
        Modal.show(`
            <div class="modal-icon">🔐</div>
            <div class="modal-title">文件已加密</div>
            <div class="modal-text">请输入导出时设置的密码来解密。</div>
            <input class="modal-input" id="imp-pwd" type="password" placeholder="输入密码" autocomplete="off">
            <button class="modal-btn primary" onclick="App._decryptAndImport()">解密导入</button>
            <button class="modal-btn ghost" onclick="Modal.hide()">取消</button>
        `, false);
        App._pendingEncrypted = raw;
        setTimeout(() => { const el = document.getElementById('imp-pwd'); if (el) el.focus(); }, 300);
    },

    async _decryptAndImport() {
        const pwd = document.getElementById('imp-pwd').value;
        const raw = App._pendingEncrypted;
        if (!pwd) { Modal.alert('⚠️', '请输入密码', '密码不能为空。'); return; }
        try {
            const enc = new TextEncoder();
            const dec = new TextDecoder();
            const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveKey']);
            const key = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt: new Uint8Array(raw.salt), iterations: 100000, hash: 'SHA-256' },
                keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
            );
            const plaintext = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(raw.iv) },
                key, new Uint8Array(raw.data)
            );
            const data = JSON.parse(dec.decode(plaintext));
            this._mergeData(data);
        } catch {
            Modal.alert('❌', '解密失败', '密码不正确或文件已损坏。');
        }
    },

    changePwd() {
        Modal.show(`
            <div class="modal-icon">🔑</div>
            <div class="modal-title">修改访问密码</div>
            <div class="modal-text">请先输入当前密码，再设置新密码。</div>
            <input class="modal-input" id="chg-old" type="password" placeholder="当前密码" autocomplete="off">
            <input class="modal-input" id="chg-new" type="password" placeholder="新密码" autocomplete="off">
            <button class="modal-btn primary" onclick="App._doChangePwd()">确认修改</button>
            <button class="modal-btn ghost" onclick="Modal.hide()">取消</button>
        `, false);
        setTimeout(() => { const el = document.getElementById('chg-old'); if (el) el.focus(); }, 300);
    },

    async _doChangePwd() {
        const old = document.getElementById('chg-old').value;
        const nw = document.getElementById('chg-new').value;
        if (!old || !nw) { Modal.alert('⚠️', '请填写完整', '当前密码和新密码都不能为空。'); return; }
        const oldHash = await this._hashPwd(old);
        if (oldHash !== localStorage.getItem('gt_lock_hash')) {
            Modal.alert('❌', '当前密码不正确', '请重新输入。');
            return;
        }
        const newHash = await this._hashPwd(nw);
        localStorage.setItem('gt_lock_hash', newHash);
        Modal.alert('✅', '密码已修改', '下次打开时将使用新密码。', '好的', 'success');
    },

    _celebrate() {
        const overlay = document.createElement('div');
        overlay.id = 'celebrate-overlay';
        document.body.appendChild(overlay);

        const canvas = document.createElement('canvas');
        overlay.appendChild(canvas);
        const textEl = document.createElement('div');
        textEl.className = 'celebrate-text';
        overlay.appendChild(textEl);

        const ctx = canvas.getContext('2d');
        let W = canvas.width = window.innerWidth;
        let H = canvas.height = window.innerHeight;

        const particles = [];
        const rockets = [];
        const palette = [
            '#ff6b6b','#feca57','#48dbfb','#ff9ff3','#54a0ff',
            '#5f27cd','#01a3a4','#f368e0','#ff9f43','#00d2d3',
            '#6c5ce7','#fd79a8','#e17055','#00cec9','#fdcb6e'
        ];

        function launchRocket() {
            rockets.push({
                x: W * (0.15 + Math.random() * 0.7),
                y: H,
                targetY: H * (0.08 + Math.random() * 0.32),
                speed: 4 + Math.random() * 4,
                color: palette[Math.floor(Math.random() * palette.length)]
            });
        }

        function explode(x, y, color) {
            const count = 60 + Math.floor(Math.random() * 50);
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.5 + Math.random() * 5.5;
                particles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1,
                    decay: 0.008 + Math.random() * 0.014,
                    color: Math.random() < 0.3 ? palette[Math.floor(Math.random() * palette.length)] : color,
                    size: 1.5 + Math.random() * 2.5
                });
            }
        }

        [0, 200, 500, 850, 1200, 1600, 2000].forEach(t => setTimeout(launchRocket, t));

        let running = true;
        function animate() {
            if (!running) return;
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(0, 0, W, H);

            for (let i = rockets.length - 1; i >= 0; i--) {
                const r = rockets[i];
                r.y -= r.speed;
                ctx.globalAlpha = 1;
                ctx.fillStyle = r.color;
                ctx.beginPath();
                ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(r.x + (Math.random() - 0.5) * 2, r.y + 10, 1.5, 0, Math.PI * 2);
                ctx.fill();
                if (r.y <= r.targetY) {
                    explode(r.x, r.y, r.color);
                    rockets.splice(i, 1);
                }
            }

            ctx.globalAlpha = 1;
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.035;
                p.vx *= 0.99;
                p.life -= p.decay;
                if (p.life <= 0) { particles.splice(i, 1); continue; }
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            requestAnimationFrame(animate);
        }
        animate();

        const msgs = ['今天的你很棒！','认真记录的你很棒！','静下心问题就解决了！','你要名副其实！'];
        setTimeout(() => {
            textEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
            textEl.classList.add('show');
        }, 2200);

        setTimeout(() => {
            running = false;
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 600);
        }, 5200);
    },

    _mergeData(data) {
        Store.ALL_KEYS.forEach(k => {
            if (data[k] && Array.isArray(data[k])) {
                const existing = Store.get(k);
                const ids = new Set(existing.map(x => x.id));
                const merged = [...existing];
                data[k].forEach(x => { if (!ids.has(x.id)) merged.push(x); });
                merged.sort((a, b) => b.id - a.id);
                Store.save(k, merged);
            }
        });
        Modal.alert('✅', '导入成功', '数据已合并到本地记录中。', '好的', 'success');
        App.render();
    },

    /* --- Stats helpers --- */
    _calcStreak() {
        const allDates = new Set();
        Store.ALL_KEYS.forEach(k => {
            Store.get(k).forEach(e => {
                if (e.time) allDates.add(e.time.slice(0, 10));
            });
        });
        if (!allDates.size) return 0;

        const toDateStr = d => d.toISOString().slice(0, 10);
        const prevDay = s => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - 1); return toDateStr(d); };

        const today = toDateStr(new Date());
        let streak = 0, check = today;

        if (allDates.has(check)) {
            streak = 1;
            check = prevDay(check);
            while (allDates.has(check)) { streak++; check = prevDay(check); }
        } else {
            check = prevDay(today);
            if (allDates.has(check)) {
                streak = 1;
                check = prevDay(check);
                while (allDates.has(check)) { streak++; check = prevDay(check); }
            }
        }
        return streak;
    },

    _weeklyCount() {
        const now = Date.now();
        const week = 7 * 24 * 60 * 60 * 1000;
        let c = 0;
        Store.ALL_KEYS.forEach(k => {
            Store.get(k).forEach(e => { if (e.time && now - new Date(e.time).getTime() < week) c++; });
        });
        return c;
    },

    _totalCount() {
        let c = 0;
        Store.ALL_KEYS.forEach(k => { c += Store.count(k); });
        return c;
    },

    _month() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    },

    _pad: n => String(n).padStart(2, '0'),

    _fmtDate(iso) {
        const d = new Date(iso);
        return `${d.getFullYear()}/${App._pad(d.getMonth()+1)}/${App._pad(d.getDate())} ${App._pad(d.getHours())}:${App._pad(d.getMinutes())}`;
    },

    _fmtDay(iso) {
        const d = new Date(iso);
        const days = ['周日','周一','周二','周三','周四','周五','周六'];
        const today = new Date().toISOString().slice(0,10);
        const yesterday = (() => { const y = new Date(); y.setDate(y.getDate()-1); return y.toISOString().slice(0,10); })();
        const ds = iso.slice(0, 10);
        if (ds === today) return '今天';
        if (ds === yesterday) return '昨天';
        return `${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}`;
    },

    _fmtTime(iso) {
        const d = new Date(iso);
        return `${App._pad(d.getHours())}:${App._pad(d.getMinutes())}`;
    },

    _greeting() {
        const h = new Date().getHours();
        if (h < 6)  return '夜深了，注意休息';
        if (h < 9)  return '早上好';
        if (h < 12) return '上午好';
        if (h < 14) return '中午好';
        if (h < 18) return '下午好';
        if (h < 22) return '晚上好';
        return '夜深了，注意休息';
    },

    _dateStr() {
        const d = new Date();
        const days = ['日','一','二','三','四','五','六'];
        return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 星期${days[d.getDay()]}`;
    },

    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    _weekRange() {
        const now = new Date();
        const day = now.getDay() || 7;
        const mon = new Date(now); mon.setDate(now.getDate() - day + 1); mon.setHours(0,0,0,0);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
        return { start: mon, end: sun };
    },

    _countInRange(start, end) {
        const counts = {};
        const s = start.getTime(), e = end.getTime();
        Store.ALL_KEYS.forEach(k => {
            counts[k] = 0;
            Store.get(k).forEach(x => {
                if (x.time) { const t = new Date(x.time).getTime(); if (t >= s && t <= e) counts[k]++; }
            });
        });
        counts._total = Object.values(counts).reduce((a, b) => a + b, 0);
        return counts;
    },

    _weekLabel(d) {
        return `${d.getMonth()+1}/${d.getDate()}`;
    },

    _groupByDate(entries) {
        const groups = {};
        entries.forEach(e => {
            const d = e.time ? e.time.slice(0, 10) : 'unknown';
            if (!groups[d]) groups[d] = [];
            groups[d].push(e);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    },

    /* ========== PAGE RENDERERS ========== */
    pages: {
        home() {
            const streak = App._calcStreak();
            const total = App._totalCount();
            const weekly = App._weeklyCount();

            const warm = [
                '每一次记录，都是对自己的一次负责',
                '主体性，从写下第一个判断开始',
                '你不是不行，你只是还在路上',
                '今天比昨天强一点点就够了',
                '能看见问题的人，离解决问题最近',
                '一天搞透一个函数，一个月就是三十个',
                '小胜利积累起来，就是大自信',
                '你已经比五个月前的自己强太多了',
                '敢写下自己的判断，本身就是勇气',
                '慢一点没关系，方向对就行',
                '每一步弯路都在教你认路',
                '你的努力不会白费，只是还在扎根',
                '今天的笨拙，是明天熟练的学费',
                '能坚持记录的人，不会差到哪里去',
                '你已经在做很多人不敢做的事了',
                '种子在土里的时候，谁也看不见它在生长',
                '你问的每一个问题，都在缩短你和答案的距离',
                '光是没有放弃这件事，就已经很了不起了',
                '允许自己慢，但不允许自己停',
                '五年后的你会感谢今天没有放弃的自己',
            ];
            const cold = [
                '受苦方式不对，再累也没有产出',
                '别再说「我没基础」了，这句话正在变成你的保护伞',
                '你不是不会，你是不敢自己做决定',
                '问别人之前你自己想了多久？三秒还是三十分钟？',
                '「看了很多」和「学会了」之间隔着一个输出',
                '不要泡在水里等学会游泳，一个动作一个动作练',
                '你以为的努力，可能只是在重复低效的焦虑',
                '如果今天和昨天做的事一模一样，你凭什么比昨天更强？',
                '舒适区里没有成长，只有自我感动',
                '很累不等于有效努力，别拿疲惫当成就感',
                '你花在纠结上的时间，够搞懂三个函数了',
                '你总说没时间，但你有时间焦虑',
                '把「搞不懂」换成「我卡在哪里」，思路就出来了',
                '五个月了，你给自己找了多少次借口？',
                '别人一晚上搞定的事你做不出来，不是因为笨，是因为你没有逼自己一把',
                '如果你不改变学习方式，再给你五个月结果也一样',
                '说一百遍「我要努力」不如做一件具体的事',
                '你在等什么？等一个完美的起点？它不存在',
                '判断权长期外包，你的主体性会越来越虚',
                '你不缺反思，缺的是反思之后的行动',
            ];
            const isWarm = Math.random() < 0.3;
            const pool = isWarm ? warm : cold;
            const q = pool[Math.floor(Math.random() * pool.length)];
            const qStyle = isWarm ? '' : 'border-left:3px solid #e53e3e;background:rgba(229,62,62,.06)';

            const cn = {
                p: Store.count('problems'),
                d: Store.count('outputs') + Store.count('reflects'),
                v: Store.count('victories'),
                m: Store.count('encourages') + Store.count('criticizes'),
                mo: Store.count('monthlyPos') + Store.count('monthlyNeg')
            };

            return `
                <div class="home-greeting">
                    <div class="hi">${App._greeting()}</div>
                    <div class="date">${App._dateStr()}</div>
                    <div class="streak-badge ${streak === 0 ? 'zero' : ''}">
                        ${streak > 0 ? '🔥' : '⏳'} ${streak > 0 ? '连续 ' + streak + ' 天' : '今天还没记录'}
                    </div>
                    <div class="home-quote" style="${qStyle}">${isWarm ? '🌱' : '🔪'} "${q}"</div>
                </div>

                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-value">${total}</div>
                        <div class="stat-label">总记录</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${streak}</div>
                        <div class="stat-label">连续天数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${weekly}</div>
                        <div class="stat-label">本周记录</div>
                    </div>
                </div>

                <div class="weekly-banner" onclick="App.navigate('weeklyReport')">
                    <div class="wb-icon">📊</div>
                    <div class="wb-body">
                        <h3>本周报告</h3>
                        <p>查看本周成长统计与分类分析</p>
                    </div>
                    <div class="wb-arrow">›</div>
                </div>

                <div class="home-cards">
                    <div class="home-card c1 card-stagger" onclick="App.navigate('problem')">
                        <div class="card-icon">🔍</div>
                        <div class="card-body"><h3>问题分析</h3><p>先分析，再求助</p></div>
                        ${cn.p ? '<span class="card-badge">'+cn.p+'</span>' : ''}
                    </div>
                    <div class="home-card c2 card-stagger" onclick="App.navigate('daily')">
                        <div class="card-icon">📝</div>
                        <div class="card-body"><h3>每日产出 & 反思</h3><p>记录收获，反思不足</p></div>
                        ${cn.d ? '<span class="card-badge">'+cn.d+'</span>' : ''}
                    </div>
                    <div class="home-card c3 card-stagger" onclick="App.navigate('victories')">
                        <div class="card-icon">🏆</div>
                        <div class="card-body"><h3>每日小胜利</h3><p>三个小赢，修复自信</p></div>
                        ${cn.v ? '<span class="card-badge">'+cn.v+'</span>' : ''}
                    </div>
                    <div class="home-card c4 card-stagger" onclick="App.navigate('mood')">
                        <div class="card-icon">💪</div>
                        <div class="card-body"><h3>鼓励 & 批判</h3><p>表扬自己，也审视自己</p></div>
                        ${cn.m ? '<span class="card-badge">'+cn.m+'</span>' : ''}
                    </div>
                    <div class="home-card c5 card-stagger" onclick="App.navigate('monthly')">
                        <div class="card-icon">📅</div>
                        <div class="card-body"><h3>月积累</h3><p>以月为单位的成长记录</p></div>
                        ${cn.mo ? '<span class="card-badge">'+cn.mo+'</span>' : ''}
                    </div>
                </div>

                <div class="data-actions">
                    <button onclick="App.exportData()">📤 导出备份</button>
                    <span class="dot">·</span>
                    <button onclick="App.importData()">📥 导入数据</button>
                    <span class="dot">·</span>
                    <button onclick="App.changePwd()">🔑 修改密码</button>
                </div>`;
        },

        problem() {
            return `
                <div class="form-section">
                    <div class="form-intro">
                        <p>💡 这不是一个普通的笔记框，这是<b>主体性训练</b>。</p>
                        <p>在你问任何人之前，先在这里写下你自己的判断。哪怕是错的，也要先写。</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">我现在遇到的具体问题是什么 <span class="req">*</span></label>
                        <div class="form-hint">越具体越好。不要写"搞不懂"，要写清楚卡在哪一步、哪一行、哪个概念。</div>
                        <textarea class="form-textarea" id="f-problem" placeholder="例：移植焦点仲裁功能时，AudioFocusManager 的 requestFocus 方法中第三个参数 streamType，我不确定在新平台上应该传什么值..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">我自己的初步判断是什么 <span class="req">*</span></label>
                        <div class="form-hint">先自己判断，再求证。哪怕是猜的也写下来——这就是主体性。</div>
                        <textarea class="form-textarea" id="f-judgment" placeholder="例：我判断可能是新旧平台的音频流类型枚举不一样，需要做映射。依据是我在旧代码里看到 STREAM_MUSIC=3，但新平台的定义好像不同..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">我已经尝试了什么 <span class="req">*</span></label>
                        <div class="form-hint">列出你做过的所有尝试，包括失败的。失败的尝试也是有效信息。</div>
                        <textarea class="form-textarea" id="f-tried" placeholder="例：1. 查看了旧平台的枚举定义文件 2. 在新平台代码库搜索了 STREAM_ 关键字 3. 尝试直接传旧值但编译报错 4. 查了官方文档但没找到迁移说明..."></textarea>
                    </div>
                    <button class="btn btn-primary" onclick="App.submitProblem()">提交分析</button>
                </div>`;
        },

        daily() {
            return `
                <div class="sub-menu">
                    <div class="sub-card green card-stagger" onclick="App.showOutputTypeSelect()">
                        <div class="sc-icon">📤</div>
                        <div class="sc-body"><h3>每日产出</h3><p>记录今天的收获和学到的东西</p></div>
                    </div>
                    <div class="sub-card orange card-stagger" onclick="App.showReflectTypeSelect()">
                        <div class="sc-icon">🪞</div>
                        <div class="sc-body"><h3>每日反思</h3><p>回顾今天做得不够好的地方</p></div>
                    </div>
                </div>
                <div class="section-divider">历史记录</div>
                <div class="sub-menu">
                    <div class="sub-card muted card-stagger" onclick="App.navigate('history',{key:'outputs',title:'产出记录'})">
                        <div class="sc-icon">📂</div>
                        <div class="sc-body"><h3>产出记录</h3><p>共 ${Store.count('outputs')} 条</p></div>
                    </div>
                    <div class="sub-card muted card-stagger" onclick="App.navigate('history',{key:'reflects',title:'反思记录'})">
                        <div class="sc-icon">📂</div>
                        <div class="sc-body"><h3>反思记录</h3><p>共 ${Store.count('reflects')} 条</p></div>
                    </div>
                </div>`;
        },

        outputForm(p) {
            const cm = { words: 'blue', table: 'green', drawing: 'orange', experience: 'purple' };
            const ph = {
                words: '把你想说的写下来，不需要很长，真实就好...',
                table: '描述你想做的表格内容：问题拆解表、知识对比表、函数参数对照表...',
                drawing: '描述你画的逻辑图内容，或者记录图中的关键信息和调用关系...',
                experience: '今天积累到的经验，哪怕只有一句话也好。比如"原来 git rebase 和 merge 的区别是..."'
            };
            return `
                <div class="form-section">
                    <span class="type-badge ${cm[p.type] || 'blue'}">${App._esc(p.label)}</span>
                    <div class="form-group">
                        <label class="form-label">记录你的产出 <span class="req">*</span></label>
                        <textarea class="form-textarea large" id="f-content" placeholder="${ph[p.type] || ''}"></textarea>
                    </div>
                    <button class="btn btn-success" onclick="App.submitOutput()">保存记录</button>
                </div>`;
        },

        reflectForm(p) {
            const cm = { wrongAction: 'red', wrongWords: 'orange', wrongDirection: 'purple' };
            const ph = {
                wrongAction: '今天做错了什么事？具体错在哪里？下次怎么避免？\n\n比如：今天拿到任务后没有先自己分析，直接就去问同事了...',
                wrongWords: '今天说错了什么话？当时应该怎么说？\n\n比如：开会的时候说了"我搞不懂这个"，应该说"我目前卡在XX环节，我的判断是..."',
                wrongDirection: '今天在什么事情上想偏了？正确的思路是什么？\n\n比如：我一直在试图理解整个模块，其实应该先专注搞懂一个函数...'
            };
            return `
                <div class="form-section">
                    <span class="type-badge ${cm[p.type] || 'red'}">${App._esc(p.label)}</span>
                    <div class="form-group">
                        <label class="form-label">写下你的反思 <span class="req">*</span></label>
                        <textarea class="form-textarea large" id="f-content" placeholder="${ph[p.type] || ''}"></textarea>
                    </div>
                    <button class="btn btn-warm" onclick="App.submitReflect()">保存反思</button>
                </div>`;
        },

        victories() {
            return `
                <div class="form-section">
                    <div class="form-intro">
                        <p>🏆 每天记录三个小胜利，系统性地修复你的自信心。</p>
                        <p>哪怕再小的事也算：搞明白了一个变量名、git 操作没出错、今天自己先想了再问别人、看懂了一段 log...</p>
                    </div>
                    <div class="victory-group">
                        <div class="victory-num">1</div>
                        <textarea class="form-textarea" id="f-win1" placeholder="今天的第一个小胜利..."></textarea>
                    </div>
                    <div class="victory-group">
                        <div class="victory-num">2</div>
                        <textarea class="form-textarea" id="f-win2" placeholder="第二个...（选填）"></textarea>
                    </div>
                    <div class="victory-group">
                        <div class="victory-num">3</div>
                        <textarea class="form-textarea" id="f-win3" placeholder="第三个...（选填）"></textarea>
                    </div>
                    <button class="btn btn-success" onclick="App.submitVictories()">记录今日小胜利 🏆</button>
                </div>`;
        },

        mood() {
            return `
                <div class="sub-menu">
                    <div class="sub-card green card-stagger" onclick="App.navigate('encourageForm')">
                        <div class="sc-icon">🌟</div>
                        <div class="sc-body"><h3>鼓励自己</h3><p>今天最该表扬自己的一个点</p></div>
                    </div>
                    <div class="sub-card red card-stagger" onclick="App.navigate('criticizeForm')">
                        <div class="sc-icon">⚡</div>
                        <div class="sc-body"><h3>批判自己</h3><p>今天最该批评自己的一个点</p></div>
                    </div>
                </div>
                <div class="section-divider">历史记录</div>
                <div class="sub-menu">
                    <div class="sub-card muted card-stagger" onclick="App.navigate('history',{key:'encourages',title:'鼓励记录'})">
                        <div class="sc-icon">📂</div>
                        <div class="sc-body"><h3>鼓励记录</h3><p>共 ${Store.count('encourages')} 条</p></div>
                    </div>
                    <div class="sub-card muted card-stagger" onclick="App.navigate('history',{key:'criticizes',title:'批判记录'})">
                        <div class="sc-icon">📂</div>
                        <div class="sc-body"><h3>批判记录</h3><p>共 ${Store.count('criticizes')} 条</p></div>
                    </div>
                </div>`;
        },

        encourageForm() {
            return `
                <div class="form-section">
                    <div class="form-group">
                        <label class="form-label">🌟 今天最该表扬自己的一个点 / 一件事 <span class="req">*</span></label>
                        <div class="form-hint">搞明白了一个函数？没有第一时间就问别人？自己先写了判断再提问？都算！</div>
                        <textarea class="form-textarea large" id="f-content" placeholder="今天我做得好的地方是..."></textarea>
                    </div>
                    <button class="btn btn-success" onclick="App.submitEncourage()">记录表扬 🌟</button>
                </div>`;
        },

        criticizeForm() {
            return `
                <div class="form-section">
                    <div class="form-group">
                        <label class="form-label">⚡ 今天最该批评自己的一个点 / 一件事 <span class="req">*</span></label>
                        <div class="form-hint">写具体。不要写"今天没努力"，要写"今天遇到XX问题直接问了别人，没有先自己分析"。</div>
                        <textarea class="form-textarea large" id="f-content" placeholder="今天我做得不好的地方是..."></textarea>
                    </div>
                    <button class="btn btn-warm" onclick="App.submitCriticize()">记录批评 ⚡</button>
                </div>`;
        },

        monthly() {
            return `
                <div class="sub-menu">
                    <div class="sub-card green card-stagger" onclick="App.navigate('monthlyPositive')">
                        <div class="sc-icon">📈</div>
                        <div class="sc-body"><h3>本月正反馈</h3><p>记录这个月的进步和收获</p></div>
                    </div>
                    <div class="sub-card red card-stagger" onclick="App.navigate('monthlyNegative')">
                        <div class="sc-icon">📉</div>
                        <div class="sc-body"><h3>本月负反馈</h3><p>记录这个月的遗憾和错误</p></div>
                    </div>
                </div>
                <div class="section-divider">历史记录</div>
                <div class="sub-menu">
                    <div class="sub-card muted card-stagger" onclick="App.navigate('history',{key:'monthlyPos',title:'正反馈记录'})">
                        <div class="sc-icon">📂</div>
                        <div class="sc-body"><h3>正反馈记录</h3><p>共 ${Store.count('monthlyPos')} 条</p></div>
                    </div>
                    <div class="sub-card muted card-stagger" onclick="App.navigate('history',{key:'monthlyNeg',title:'负反馈记录'})">
                        <div class="sc-icon">📂</div>
                        <div class="sc-body"><h3>负反馈记录</h3><p>共 ${Store.count('monthlyNeg')} 条</p></div>
                    </div>
                </div>`;
        },

        monthlyPositive() {
            return `
                <div class="form-section">
                    <div class="form-group">
                        <label class="form-label">月份</label>
                        <input type="month" id="f-month" class="form-textarea compact" value="${App._month()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">本月的进步和收获 <span class="req">*</span></label>
                        <div class="form-hint">比上个月强在哪里？学到了什么新东西？有什么事情做得比以前好？</div>
                        <textarea class="form-textarea large" id="f-content" placeholder="这个月我进步了...，收获了..."></textarea>
                    </div>
                    <button class="btn btn-success" onclick="App.submitMonthlyPos()">保存正反馈</button>
                </div>`;
        },

        monthlyNegative() {
            return `
                <div class="form-section">
                    <div class="form-group">
                        <label class="form-label">月份</label>
                        <input type="month" id="f-month" class="form-textarea compact" value="${App._month()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">本月的遗憾和错误 <span class="req">*</span></label>
                        <div class="form-hint">这个月有什么遗憾？犯了什么重复的错误？下个月怎么避免？</div>
                        <textarea class="form-textarea large" id="f-content" placeholder="这个月我遗憾的是...，重复犯了...的错误"></textarea>
                    </div>
                    <button class="btn btn-warm" onclick="App.submitMonthlyNeg()">保存负反馈</button>
                </div>`;
        },

        weeklyReport() {
            const wr = App._weekRange();
            const cur = App._countInRange(wr.start, wr.end);
            const prevStart = new Date(wr.start); prevStart.setDate(prevStart.getDate() - 7);
            const prevEnd = new Date(wr.end); prevEnd.setDate(prevEnd.getDate() - 7);
            const prev = App._countInRange(prevStart, prevEnd);

            const diff = cur._total - prev._total;
            const diffCls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
            const diffTxt = diff > 0 ? '↑ ' + diff : diff < 0 ? '↓ ' + Math.abs(diff) : '— 持平';

            const cats = [
                { key: 'problems', label: '问题分析', cls: '' },
                { key: 'outputs', label: '产出', cls: 'green' },
                { key: 'reflects', label: '反思', cls: 'orange' },
                { key: 'victories', label: '小胜利', cls: 'gold' },
                { key: 'encourages', label: '鼓励', cls: 'green' },
                { key: 'criticizes', label: '批判', cls: 'pink' },
                { key: 'monthlyPos', label: '月正反馈', cls: 'blue' },
                { key: 'monthlyNeg', label: '月负反馈', cls: 'orange' },
            ];
            const maxCount = Math.max(1, ...cats.map(c => cur[c.key]));

            let barsHtml = '';
            cats.forEach(c => {
                if (cur[c.key] > 0 || prev[c.key] > 0) {
                    const pct = Math.round((cur[c.key] / maxCount) * 100);
                    barsHtml += `<div class="wr-bar-row">
                        <div class="wr-bar-label">${c.label}</div>
                        <div class="wr-bar-track"><div class="wr-bar-fill ${c.cls}" style="width:${pct}%"></div></div>
                        <div class="wr-bar-count">${cur[c.key]}</div>
                    </div>`;
                }
            });
            if (!barsHtml) barsHtml = '<div style="text-align:center;color:var(--text-light);padding:20px">本周还没有记录</div>';

            const activeDays = new Set();
            Store.ALL_KEYS.forEach(k => {
                Store.get(k).forEach(e => {
                    if (e.time) {
                        const t = new Date(e.time).getTime();
                        if (t >= wr.start.getTime() && t <= wr.end.getTime()) activeDays.add(e.time.slice(0, 10));
                    }
                });
            });

            return `
                <div class="page-enter">
                    <div class="form-intro" style="text-align:center;margin-bottom:16px">
                        <p style="font-weight:700;font-size:16px">${App._weekLabel(wr.start)} — ${App._weekLabel(wr.end)}</p>
                    </div>
                    <div class="wr-summary">
                        <div class="wr-stat">
                            <div class="wr-stat-value">${cur._total}</div>
                            <div class="wr-stat-label">本周记录</div>
                            <div class="wr-stat-diff ${diffCls}">${diffTxt}</div>
                        </div>
                        <div class="wr-stat">
                            <div class="wr-stat-value">${activeDays.size}</div>
                            <div class="wr-stat-label">活跃天数</div>
                            <div class="wr-stat-diff ${activeDays.size >= 5 ? 'up' : activeDays.size >= 3 ? 'same' : 'down'}">
                                ${activeDays.size >= 5 ? '优秀' : activeDays.size >= 3 ? '还行' : '加油'}
                            </div>
                        </div>
                    </div>
                    <div class="section-divider">分类统计</div>
                    <div class="wr-bars">${barsHtml}</div>
                    ${cur._total > 0 ? `<div class="form-intro" style="text-align:center">
                        <p>${cur._total > prev._total ? '比上周多了 ' + (cur._total - prev._total) + ' 条记录，继续保持！' :
                            cur._total === prev._total ? '和上周持平，试试看能不能多记一点？' :
                            '比上周少了 ' + (prev._total - cur._total) + ' 条，这周再努力一点！'}</p>
                    </div>` : ''}
                </div>`;
        },

        history(p) {
            const entries = Store.get(p.key);
            if (!entries.length) {
                return `<div class="history-empty"><div class="he-icon">📭</div><p>还没有记录<br>开始你的第一条吧</p></div>`;
            }

            const hlMap = {
                problems: 'hl-blue', outputs: 'hl-green', reflects: 'hl-orange',
                encourages: 'hl-green', criticizes: 'hl-red',
                monthlyPos: 'hl-green', monthlyNeg: 'hl-red',
                victories: 'hl-gold'
            };
            const hl = hlMap[p.key] || '';
            const groups = App._groupByDate(entries);

            let html = '<div class="history-list">';

            groups.forEach(([dateStr, items]) => {
                html += `<div class="date-group-header"><span class="dgh-dot"></span>${App._fmtDay(dateStr + 'T12:00:00')}</div>`;

                items.forEach(e => {
                    html += `<div class="history-card ${hl}">`;
                    html += `<div class="hc-time">${App._fmtTime(e.time)}</div>`;
                    html += `<button class="hc-del" onclick="App.deleteEntry('${p.key}',${e.id})">×</button>`;

                    if (p.key === 'problems') {
                        html += `<div class="hc-fields">
                            <div class="hc-field"><div class="hc-field-label">遇到的问题</div><div class="hc-field-value">${App._esc(e.problem)}</div></div>
                            <div class="hc-field"><div class="hc-field-label">我的判断</div><div class="hc-field-value">${App._esc(e.judgment)}</div></div>
                            <div class="hc-field"><div class="hc-field-label">已尝试的</div><div class="hc-field-value">${App._esc(e.tried)}</div></div>
                        </div>`;
                    } else if (p.key === 'victories') {
                        html += `<div class="victory-list">`;
                        (e.wins || []).forEach((w, i) => {
                            html += `<div class="victory-item"><span class="vi-num">${i+1}</span><span class="vi-text">${App._esc(w)}</span></div>`;
                        });
                        html += '</div>';
                    } else if (p.key === 'monthlyPos' || p.key === 'monthlyNeg') {
                        if (e.month) html += `<span class="hc-type">${App._esc(e.month)}</span>`;
                        html += `<div class="hc-content">${App._esc(e.content)}</div>`;
                    } else {
                        if (e.label) html += `<span class="hc-type">${App._esc(e.label)}</span>`;
                        html += `<div class="hc-content">${App._esc(e.content)}</div>`;
                    }

                    html += '</div>';
                });
            });

            html += '</div>';
            return html;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
