/* ==========================================================================
   SERVICIO TÉCNICO ELECTROLUX · CDMX Y EDOMEX · app.js
   Sin dependencias. Sin listeners de scroll: el movimiento ligado al scroll usa
   IntersectionObserver y CSS scroll-driven animations (ver styles.css).
   ========================================================================== */
(() => {
    'use strict';

    /* ─────────────── CONFIGURACIÓN (editar aquí) ───────────────
       Cambia sólo `phone` (10 dígitos, sin +52) y todo el sitio se actualiza:
       enlaces tel:, enlaces de WhatsApp, números visibles y datos estructurados. */
    const CONFIG = {
        phone: '5500000000',      // TODO: número real del cliente
        countryCode: '52',
        phoneDisplay: '',         // opcional, ej. '55 1234 5678'. Vacío = formato automático
        waDefaultText: 'Hola, necesito servicio técnico para mi equipo Electrolux.'
    };

    /* ─────────────── UTILIDADES ─────────────── */
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const html = document.documentElement;
    const body = document.body;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const safe = (name, fn) => { try { fn(); } catch (err) { console.error('[app.js] ' + name, err); } };
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    // app.js arrancó: se cancela el failsafe del <head>
    clearTimeout(window.__fs);

    /* ─────────────── CONTACTO: teléfono y WhatsApp ─────────────── */
    const digits = CONFIG.phone.replace(/\D/g, '');
    // Espacios no separables: el número nunca se parte en dos líneas
    const NBSP = '\u00a0';
    const display = (CONFIG.phoneDisplay ||
        (digits.length === 10 ? `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}` : digits)).replace(/ /g, NBSP);
    const telHref = `tel:+${CONFIG.countryCode}${digits}`;
    const waUrl = (text) => `https://wa.me/${CONFIG.countryCode}${digits}?text=${encodeURIComponent(text)}`;

    function wireContacts() {
        $$('[data-call]').forEach((a) => {
            a.setAttribute('href', telHref);
            if (a.hasAttribute('aria-label')) a.setAttribute('aria-label', `Llamar al ${display}`);
        });
        $$('[data-wa]').forEach((a) => a.setAttribute('href', waUrl(a.dataset.waText || CONFIG.waDefaultText)));
        $$('[data-phone-text]').forEach((el) => { el.textContent = display; });

        const ld = $('#ld-business');
        if (ld) {
            const data = JSON.parse(ld.textContent);
            data.telephone = `+${CONFIG.countryCode}${digits}`;
            ld.textContent = JSON.stringify(data, null, 2);
        }
        const year = $('#year');
        if (year) year.textContent = new Date().getFullYear();
    }

    /* ─────────────── REVELADO AL ENTRAR EN PANTALLA ─────────────── */
    function initReveal() {
        const targets = $$('.reveal, .step');
        if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                // También se marcan los que quedaron por encima del viewport (recarga a mitad de página)
                if (e.isIntersecting || e.boundingClientRect.top < 0) {
                    e.target.classList.add('is-in');
                    io.unobserve(e.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
        targets.forEach((el) => io.observe(el));
    }

    /* ─────────────── CABECERA: estado "stuck" y enlace activo ─────────────── */
    function initHeader() {
        const header = $('#site-header');
        const sentinel = $('#top-sentinel');
        if (header && sentinel && 'IntersectionObserver' in window) {
            new IntersectionObserver(([e]) => header.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
        }
        const links = $$('.nav-links a');
        const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
        if (!byId.size || !('IntersectionObserver' in window)) return;
        // Se observan todas las secciones: en las que no tienen enlace propio (p. ej. Garantía) se apaga el resaltado
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                const current = byId.get(e.target.id);
                links.forEach((l) => l.classList.toggle('is-current', l === current));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        $$('main section[id]').forEach((s) => spy.observe(s));
    }

    /* ─────────────── MENÚ MÓVIL ─────────────── */
    function initMenu() {
        const burger = $('#burger');
        const menu = $('#mobile-menu');
        if (!burger || !menu) return;
        let opener = null;
        // Con el menú abierto, el resto de la página deja de ser navegable con teclado y lector de pantalla
        const behind = $$('main, footer, .call-float, .wa-float');
        const set = (open) => {
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            menu.classList.toggle('is-open', open);
            menu.inert = !open;
            behind.forEach((el) => { el.inert = open; });
            html.classList.toggle('is-locked', open);
            if (open) { opener = document.activeElement; const first = $('a', menu); if (first) first.focus({ preventScroll: true }); }
            else if (opener) { opener.focus({ preventScroll: true }); opener = null; }
        };
        burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
        menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
        addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) set(false); });
        matchMedia('(min-width: 1100px)').addEventListener('change', (m) => { if (m.matches && menu.classList.contains('is-open')) set(false); });
    }

    /* ─────────────── FAQ (acordeón, una abierta a la vez) ─────────────── */
    function initFAQ() {
        const items = $$('.faq-item');
        items.forEach((item) => {
            const btn = $('.faq-q', item);
            btn.addEventListener('click', () => {
                const willOpen = !item.classList.contains('is-open');
                items.forEach((i) => { i.classList.remove('is-open'); $('.faq-q', i).setAttribute('aria-expanded', 'false'); });
                if (willOpen) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
            });
        });
    }

    /* ─────────────── ASISTENTE DE DIAGNÓSTICO ───────────────
       Orientación general por equipo y síntoma. `w` = aviso de seguridad opcional. */
    const GAS_WARN = 'Si hueles gas, cierra la llave de paso, ventila el lugar, no uses flamas ni interruptores y llama a tu proveedor de gas o al 911.';
    const DIAG = {
        refrigerador: { label: 'refrigerador', issues: [
            { k: 'No enfría o enfría poco', t: 'Refrigerador que no enfría', c: 'Lo más común es un ventilador del evaporador o del condensador detenido, un sensor de temperatura defectuoso o la tarjeta de control. En equipos no-frost también influye el hielo acumulado sobre el evaporador.', w: 'Mantén la puerta cerrada para conservar el frío. Si pasan varias horas, traslada los alimentos delicados a una hielera.' },
            { k: 'Gotea o hay agua en el piso', t: 'Fuga de agua en el refrigerador', c: 'Suele ser el drenaje de descongelación tapado o congelado, una charola de evaporación desbordada o la manguera de la fábrica de hielo o del dispensador.', w: 'Seca el piso para evitar resbalones y mantén cables y contactos lejos del agua.' },
            { k: 'Hace ruido', t: 'Ruido en el refrigerador', c: 'Un zumbido o chasquido constante apunta al ventilador del evaporador con hielo o desgaste. Un golpeteo metálico puede venir del compresor o de piezas flojas.' },
            { k: 'Exceso de hielo o escarcha', t: 'Escarcha o hielo excesivo', c: 'Normalmente falla el sistema de descongelación (resistencia, termostato de deshielo o tarjeta). Un sello de puerta dañado también deja entrar humedad.' },
            { k: 'Se apaga o no enciende', t: 'Refrigerador que no enciende', c: 'Puede ser la tarjeta de control, el relevador de arranque del compresor o un problema en la alimentación eléctrica.', w: 'Evita usar extensiones y verifica que el contacto tenga corriente antes de llamar.' }
        ] },
        lavadora: { label: 'lavadora', issues: [
            { k: 'No desagua', t: 'Lavadora que no desagua', c: 'Casi siempre es la bomba de drenaje obstruida o averiada, el filtro tapado o la manguera de desagüe doblada.', w: 'Desconecta la lavadora antes de revisar el filtro y ten una toalla a la mano: puede salir agua.' },
            { k: 'No centrifuga', t: 'Lavadora que no centrifuga', c: 'Un desbalance de carga, amortiguadores o soportes desgastados, el sensor de la tapa o puerta, o el motor y la tarjeta pueden ser la causa.' },
            { k: 'Fuga de agua', t: 'Fuga en la lavadora', c: 'Suele venir del sello o empaque de la puerta, de mangueras de entrada flojas, de la bomba o de un exceso de detergente.' },
            { k: 'Hace ruido o vibra mucho', t: 'Ruido o vibración en la lavadora', c: 'Rodamientos del tambor, amortiguadores vencidos u objetos atrapados entre el tambor y la tina son las causas más frecuentes.' },
            { k: 'Código de error o no enciende', t: 'Código de error en la lavadora', c: 'Puede tratarse de la tarjeta electrónica, el sensor de puerta o la alimentación. Anota el código que muestra el panel, ayuda mucho al técnico.' }
        ] },
        secadora: { label: 'secadora', issues: [
            { k: 'No calienta', t: 'Secadora que no calienta', c: 'Resistencia (eléctrica) o quemador y válvula (gas) dañados, termostato o fusible térmico abierto, o un ducto de salida obstruido.' },
            { k: 'No gira', t: 'Secadora que no gira', c: 'Lo más común es la banda de transmisión rota, la polea tensora o el motor. También conviene revisar el sensor de puerta.' },
            { k: 'Tarda mucho en secar', t: 'Secadora que tarda en secar', c: 'Filtro de pelusa o ducto de salida obstruidos, sensor de humedad sucio o calentamiento débil.', w: 'Limpia el filtro de pelusa después de cada uso: los ductos obstruidos elevan el riesgo de sobrecalentamiento.' },
            { k: 'Hace ruido', t: 'Ruido en la secadora', c: 'Rodillos de soporte, polea tensora o rodamientos desgastados suelen generar chirridos o golpeteo.' }
        ] },
        estufa: { label: 'estufa o parrilla', issues: [
            { k: 'El quemador no enciende', t: 'Quemador que no enciende', c: 'Orificios del quemador obstruidos, electrodo o módulo de ignición con falla, o una válvula de gas sucia.', w: GAS_WARN },
            { k: 'Hace chispa pero no prende', t: 'Ignición sin flama', c: 'Suele ser suciedad en el quemador o la boquilla, humedad en el electrodo o baja presión de gas.', w: GAS_WARN },
            { k: 'Flama amarilla o débil', t: 'Flama irregular', c: 'Una mezcla de aire y gas desajustada o quemadores con residuos producen flama amarilla o débil.', w: GAS_WARN },
            { k: 'La perilla está dura', t: 'Perilla de estufa atorada', c: 'La válvula de gas puede estar desgastada o con grasa endurecida. No fuerces la perilla.' }
        ] },
        horno: { label: 'horno', issues: [
            { k: 'No calienta', t: 'Horno que no calienta', c: 'En hornos eléctricos suele fallar la resistencia, el termostato o la tarjeta. En hornos de gas, el ignitor o la válvula.', w: GAS_WARN },
            { k: 'Temperatura incorrecta', t: 'Horno con temperatura errónea', c: 'Un sensor de temperatura descalibrado o un termostato defectuoso hacen que el horno se pase o se quede corto.' },
            { k: 'El ventilador no funciona', t: 'Ventilador de convección', c: 'El motor del ventilador, sus aspas o el conector pueden estar dañados. A veces hay ruido antes de que falle.' },
            { k: 'La puerta no cierra bien', t: 'Puerta de horno', c: 'Bisagras o empaque desgastados dejan escapar calor y afectan la cocción.' }
        ] },
        lavavajillas: { label: 'lavavajillas', issues: [
            { k: 'No drena', t: 'Lavavajillas que no drena', c: 'Filtro o bomba de drenaje obstruidos y mangueras dobladas son las causas más comunes.' },
            { k: 'No lava bien', t: 'Lavado deficiente', c: 'Brazos aspersores tapados, filtro sucio, bomba de circulación débil o agua sin la temperatura adecuada.' },
            { k: 'Fuga de agua', t: 'Fuga en el lavavajillas', c: 'Suele ser el sello de la puerta, una manguera o la bomba.' },
            { k: 'No inicia el ciclo', t: 'Lavavajillas que no arranca', c: 'El seguro o interruptor de puerta y la tarjeta de control son los primeros componentes a revisar.' }
        ] },
        otro: { label: 'equipo', issues: [
            { k: 'No enfría o no congela', t: 'Equipo que no enfría o no congela', c: 'En congeladores y cavas de vino suelen fallar el ventilador, el sensor de temperatura o la tarjeta de control.' },
            { k: 'Fuga de agua', t: 'Fuga de agua', c: 'Conviene revisar mangueras y drenajes. En fábricas de hielo es frecuente una línea de agua floja o una válvula con falla.' },
            { k: 'No produce hielo', t: 'Fábrica de hielo sin producción', c: 'La válvula de entrada de agua, un filtro tapado o el sensor de temperatura pueden impedir la producción.' },
            { k: 'Hace ruido', t: 'Ruido en el equipo', c: 'Ventiladores o compresor con desgaste son las causas más frecuentes. Un técnico lo confirma con una revisión.' },
            { k: 'Otra falla', t: 'Otra falla', c: 'Cuéntanos qué ocurre y de qué equipo se trata. Un técnico te orienta y agenda la visita.' }
        ] }
    };

    function initDiag() {
        const root = $('#diag');
        if (!root) return;
        const panes = $$('.diag-pane', root);
        const steps = $$('.diag-steps li', root);
        const nameEl = $('#diag-equip-name');
        const issuesEl = $('#diag-issues');
        const resTitle = $('#diag-res-title');
        const resCause = $('#diag-res-cause');
        const resWarn = $('#diag-res-warn');
        const waBtn = $('#diag-wa');
        const zone = $('#diag-zone');
        const state = { equip: null, issue: null };
        let scanTimer = 0;

        const paneOf = (n) => panes.find((p) => Number(p.dataset.pane) === n);

        function go(n) {
            panes.forEach((p) => {
                const on = Number(p.dataset.pane) === n;
                p.classList.toggle('is-active', on);
                if (!on) p.classList.remove('is-scanning');
            });
            steps.forEach((s) => {
                const k = Number(s.dataset.s);
                s.classList.toggle('is-active', k === n);
                s.classList.toggle('is-done', k < n);
            });
            // Accesibilidad: el foco pasa al título del panel activo
            const h = $('h3', paneOf(n));
            if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
        }

        function selectEquip(key) {
            const data = DIAG[key];
            if (!data) return;
            state.equip = key;
            nameEl.textContent = data.label;
            issuesEl.textContent = '';
            data.issues.forEach((it, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'diag-issue';
                b.dataset.i = i;
                const label = document.createElement('span');
                label.textContent = it.k;
                b.appendChild(label);
                b.insertAdjacentHTML('beforeend', '<svg class="ic" width="18" height="18" aria-hidden="true"><use href="#i-arrow"/></svg>');
                issuesEl.appendChild(b);
            });
            go(2);
        }

        function updateWa() {
            const data = DIAG[state.equip];
            const it = state.issue;
            if (!data || !it) return;
            const z = zone.value.trim();
            const text = ['Hola, necesito servicio técnico Electrolux.', `Equipo: ${cap(data.label)}`, `Falla: ${it.k}`]
                .concat(z ? [`Zona: ${z}`] : [], ['¿Me pueden ayudar a agendar una visita?']).join('\n');
            waBtn.href = waUrl(text);
        }

        function selectIssue(i) {
            const it = DIAG[state.equip].issues[i];
            if (!it) return;
            state.issue = it;
            resTitle.textContent = it.t;
            resCause.textContent = it.c;
            resWarn.hidden = !it.w;
            resWarn.textContent = it.w || '';
            updateWa();
            go(3);
            const pane = paneOf(3);
            if (reduce) return;
            // Breve búsqueda visual antes de mostrar el resultado
            pane.classList.add('is-scanning');
            clearTimeout(scanTimer);
            scanTimer = setTimeout(() => { pane.classList.remove('is-scanning'); resTitle.focus({ preventScroll: true }); }, 700);
        }

        function reset() {
            clearTimeout(scanTimer);
            state.equip = state.issue = null;
            zone.value = '';
            go(1);
        }

        root.addEventListener('click', (e) => {
            const opt = e.target.closest('.diag-opt');
            if (opt) return selectEquip(opt.dataset.equip);
            const issue = e.target.closest('.diag-issue');
            if (issue) return selectIssue(Number(issue.dataset.i));
            if (e.target.closest('.diag-back')) reset();
        });
        zone.addEventListener('input', updateWa);
    }

    /* ─────────────── FORMULARIO → WHATSAPP ─────────────── */
    function initForm() {
        const form = $('#wa-form');
        if (!form) return;
        const status = $('#form-status');
        const f = { name: $('#f-name'), phone: $('#f-phone'), equip: $('#f-equip'), zone: $('#f-zone'), msg: $('#f-msg') };
        const normPhone = (v) => {
            let d = v.replace(/\D/g, '');
            if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
            if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
            return d;
        };
        const setErr = (key, msg) => {
            const el = form.querySelector(`[data-err="${key}"]`);
            if (el) el.textContent = msg || '';
            f[key].closest('.f-group').classList.toggle('is-invalid', Boolean(msg));
            f[key].setAttribute('aria-invalid', msg ? 'true' : 'false');
        };
        function validate() {
            let ok = true;
            if (f.name.value.trim().length < 2) { setErr('name', 'Escribe tu nombre completo.'); ok = false; } else setErr('name', '');
            if (normPhone(f.phone.value).length !== 10) { setErr('phone', 'Ingresa un teléfono de 10 dígitos.'); ok = false; } else setErr('phone', '');
            if (!f.equip.value) { setErr('equip', 'Selecciona el equipo que necesita servicio.'); ok = false; } else setErr('equip', '');
            return ok;
        }
        ['name', 'phone', 'equip'].forEach((k) => {
            f[k].addEventListener('input', () => { if (f[k].closest('.f-group').classList.contains('is-invalid')) validate(); });
            f[k].addEventListener('change', () => { if (f[k].closest('.f-group').classList.contains('is-invalid')) validate(); });
        });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validate()) {
                const bad = $('.is-invalid input, .is-invalid select', form);
                if (bad) bad.focus();
                status.textContent = 'Revisa los campos marcados.';
                status.classList.remove('is-ok');
                return;
            }
            const lines = ['Hola, necesito servicio técnico Electrolux.', `Nombre: ${f.name.value.trim()}`,
                `Teléfono: ${normPhone(f.phone.value)}`, `Equipo: ${f.equip.value}`];
            if (f.zone.value.trim()) lines.push(`Zona: ${f.zone.value.trim()}`);
            if (f.msg.value.trim()) lines.push(`Falla: ${f.msg.value.trim()}`);
            const url = waUrl(lines.join('\n'));
            status.textContent = 'Abriendo WhatsApp con tu solicitud.';
            status.classList.add('is-ok');
            const win = window.open(url, '_blank');
            if (win) { try { win.opener = null; } catch (err) { /* ignorar */ } } else { location.href = url; }
        });
    }

    /* ─────────────── CONTADORES ─────────────── */
    function initCounters() {
        const els = $$('.counter');
        if (!els.length) return;
        const run = (el) => {
            const target = Number(el.dataset.target);
            const t0 = performance.now();
            const step = (now) => {
                const p = clamp((now - t0) / 1500, 0, 1);
                el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };
        if (reduce || !('IntersectionObserver' in window)) return;   // se conserva el valor final del HTML
        els.forEach((el) => { el.textContent = '0'; });
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
        }, { threshold: .6 });
        els.forEach((el) => io.observe(el));
    }

    /* ─────────────── "LLAMAR" FLOTANTE: sólo cuando el botón del hero ya no se ve ─────────────── */
    function initCallFloat() {
        const float = $('.call-float');
        const anchor = $('.hero-actions');
        if (!float || !anchor || !('IntersectionObserver' in window)) { if (float) float.classList.add('is-on'); return; }
        new IntersectionObserver(([e]) => {
            float.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0);
        }).observe(anchor);
    }

    /* ─────────────── GLOBO DEL BOTÓN DE WHATSAPP ─────────────── */
    function initWaTip() {
        const wa = $('.wa-float');
        if (!wa) return;
        let shown = false;
        try { shown = sessionStorage.getItem('ste-tip') === '1'; } catch (err) { /* ignorar */ }
        if (shown) return;
        setTimeout(() => {
            wa.classList.add('is-tip');
            try { sessionStorage.setItem('ste-tip', '1'); } catch (err) { /* ignorar */ }
            setTimeout(() => wa.classList.remove('is-tip'), 6500);
        }, 4000);
    }

    /* ─────────────── LOADER: spinner con progreso ─────────────── */
    function onReady() {
        safe('counters', initCounters);
        safe('waTip', initWaTip);
    }

    function runLoader() {
        const loader = $('#loader');
        if (!loader) { body.classList.remove('is-loading'); body.classList.add('is-ready'); html.classList.remove('is-locked'); onReady(); return; }
        const num = $('#ld-num');
        const fill = $('#ld-fill');
        const status = $('#ld-status');
        let seen = false;
        try { seen = sessionStorage.getItem('ste-seen') === '1'; } catch (err) { /* ignorar */ }

        const MIN = reduce ? 250 : (seen ? 500 : 1500);   // en visitas repetidas de la sesión el loader es breve
        const MAX = 6000;                                  // tope duro si algo tarda en cargar
        let loaded = document.readyState === 'complete';
        let fontsOk = false;
        if (!loaded) addEventListener('load', () => { loaded = true; }, { once: true });
        const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.race([fonts, new Promise((r) => setTimeout(r, 2200))]).then(() => { fontsOk = true; });

        const t0 = performance.now();
        let finished = false;

        function finish() {
            if (finished) return;
            finished = true;
            num.textContent = '100';
            fill.style.transform = 'scaleX(1)';
            status.textContent = 'Sitio listo';
            try { sessionStorage.setItem('ste-seen', '1'); } catch (err) { /* ignorar */ }
            setTimeout(() => {
                loader.classList.add('is-done');
                html.classList.remove('is-locked');
                body.classList.remove('is-loading');
                body.classList.add('is-ready');
                onReady();
                setTimeout(() => loader.remove(), reduce ? 50 : 700);
            }, reduce ? 0 : 200);
        }

        function frame(now) {
            const el = now - t0;
            const p = 1 - Math.pow(1 - clamp(el / MIN, 0, 1), 3);   // easeOutCubic
            let pct = p * 100;
            if (!(loaded && fontsOk) && el < MAX) pct = Math.min(pct, 92);
            num.textContent = Math.floor(pct);
            fill.style.transform = `scaleX(${(pct / 100).toFixed(4)})`;
            if (pct >= 100 || el >= MAX) finish(); else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    /* ─────────────── ARRANQUE ─────────────── */
    safe('contacts', wireContacts);
    safe('reveal', initReveal);
    safe('header', initHeader);
    safe('menu', initMenu);
    safe('faq', initFAQ);
    safe('diag', initDiag);
    safe('form', initForm);
    safe('callFloat', initCallFloat);
    safe('loader', runLoader);
})();
