document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
    const scroller = document.getElementById('scroller');
    const slides = Array.from(scroller.querySelectorAll('.spread'));
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const dotsBox = document.getElementById('dots');
    const progress = document.getElementById('scrollProgress');
    const total = slides.length;

    const mqMobile = window.matchMedia('(max-width: 900px)');
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isBook = () => !mqMobile.matches;   // desktop = chế độ sách lật trang

    const FLIP_MS = 950;       // thời gian 1 lần lật trang
    const PERSPECTIVE = 3200;  // càng nhỏ thì trang càng "vểnh" 3D

    let index = 0;       // spread đang mở
    let flip = null;     // lần lật đang diễn ra
    let pending = null;  // trang cần tới tiếp theo (khi bấm liên tục)
    let rafId = null;
    let drag = null;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
    const pagesOf = s => ({ L: s.querySelector('.left-page'), R: s.querySelector('.right-page') });

    /* ============ Dots ============ */
    slides.forEach((slide, i) => {
        const dot = document.createElement('button');
        dot.className = 'dot';
        dot.type = 'button';
        dot.setAttribute('aria-label', (slide.dataset.title || 'Trang') + ' (' + (i + 1) + '/' + total + ')');
        dot.addEventListener('click', () => goTo(i));
        dotsBox.appendChild(dot);
    });
    const dots = Array.from(dotsBox.children);

    /* ============ Góc trang để kéo / bấm lật ============ */
    slides.forEach((s, i) => {
        const { L, R } = pagesOf(s);
        if (i < total - 1) R.appendChild(makeGrip('grip-next', 'Lật sang trang sau'));
        if (i > 0) L.appendChild(makeGrip('grip-prev', 'Lật về trang trước'));
    });

    function makeGrip(cls, title) {
        const g = document.createElement('div');
        g.className = 'page-grip ' + cls;
        g.title = title;
        g.setAttribute('aria-hidden', 'true');
        return g;
    }

    /* ============ Trạng thái / giao diện ============ */
    function syncUI(i) {
        prevBtn.disabled = i <= 0;
        nextBtn.disabled = i >= total - 1;
        dots.forEach((d, n) => {
            d.classList.toggle('active', n === i);
            if (n === i) d.setAttribute('aria-current', 'true');
            else d.removeAttribute('aria-current');
        });
    }

    function setHash(i) {
        if (slides[i].id && history.replaceState) history.replaceState(null, '', '#' + slides[i].id);
    }

    function setProgress(pos) {
        if (!isBook()) return;
        progress.style.width = (total > 1 ? (pos / (total - 1)) * 100 : 0) + '%';
    }

    // Mép giấy hai bên dày dần theo số tờ đã lật / còn lại
    function stackShadow(n, dir) {
        const parts = [];
        for (let k = 1; k <= n; k++) {
            parts.push(`${dir * k * 2}px ${k}px 0 ${k % 2 ? '#dcdcdf' : '#fafafa'}`);
        }
        return parts.length ? parts.join(', ') : '0 0 #0000';
    }

    function updateStack(i) {
        const { L, R } = pagesOf(slides[i]);
        L.style.setProperty('--stack', stackShadow(Math.min(i, 5), -1));
        R.style.setProperty('--stack', stackShadow(Math.min(total - 1 - i, 5), 1));
    }

    function markActive(i) {
        slides.forEach((s, n) => s.classList.toggle('is-active', n === i));
        slides[i].classList.add('visible');
        updateStack(i);
    }

    function settle(i, updateHash = true) {
        index = i;
        markActive(i);
        syncUI(i);
        setProgress(i);
        if (updateHash) setHash(i);
    }

    // Trang "đích" hiện tại (tính cả lần lật đang chạy và lệnh đang chờ)
    const current = () => (pending !== null ? pending : flip ? flip.to : index);

    /* ============ Bộ máy lật trang ============ */
    function beginFlip(to) {
        const from = index;
        const dir = to > from ? 1 : -1;
        const A = slides[from];
        const B = slides[to];
        const a = pagesOf(A);
        const b = pagesOf(B);

        // Lật tới: trang phải của A xoay quanh gáy sang trái, trang trái của B hạ xuống
        // Lật lui: trang trái của A xoay quanh gáy sang phải, trang phải của B hạ xuống
        const moving = dir > 0 ? a.R : a.L;
        const incoming = dir > 0 ? b.L : b.R;

        updateStack(to);
        B.classList.add('visible');
        A.classList.add('flip-top');
        B.classList.add('flip-under');
        moving.classList.add('is-turning');
        incoming.classList.add('is-turning');
        moving.style.transformOrigin = dir > 0 ? 'left center' : 'right center';
        incoming.style.transformOrigin = dir > 0 ? 'right center' : 'left center';

        flip = { from, to, dir, A, B, moving, incoming, p: 0 };
        renderFlip(0);
        syncUI(to);
    }

    function renderFlip(p) {
        const f = flip;
        if (!f) return;
        f.p = p;
        const s = f.dir;
        const firstHalf = p < 0.5;

        const mAngle = firstHalf ? -s * 180 * p : -s * 90;
        const iAngle = firstHalf ? s * 90 : s * 180 * (1 - p);

        f.moving.style.transform = `perspective(${PERSPECTIVE}px) rotateY(${mAngle}deg)`;
        f.incoming.style.transform = `perspective(${PERSPECTIVE}px) rotateY(${iAngle}deg)`;

        // Trang càng dựng đứng càng tối, giống ánh sáng thật
        f.moving.style.filter = `brightness(${1 - 0.45 * Math.min(1, p * 2)})`;
        f.incoming.style.filter = `brightness(${1 - 0.45 * Math.min(1, (1 - p) * 2)})`;

        f.moving.style.visibility = firstHalf ? '' : 'hidden';
        f.incoming.style.visibility = firstHalf ? 'hidden' : '';
        f.B.classList.toggle('flip-raised', !firstHalf);

        setProgress(f.from + (f.to - f.from) * p);
    }

    function finishFlip(committed) {
        const f = flip;
        if (!f) return;
        [f.moving, f.incoming].forEach(el => {
            el.style.transform = '';
            el.style.filter = '';
            el.style.visibility = '';
            el.style.transformOrigin = '';
            el.classList.remove('is-turning');
        });
        f.A.classList.remove('flip-top', 'flip-raised');
        f.B.classList.remove('flip-under', 'flip-raised');
        flip = null;

        settle(committed ? f.to : f.from);

        if (pending !== null) {
            const t = pending;
            pending = null;
            if (t !== index) requestAnimationFrame(() => goTo(t));
        }
    }

    function animateFlip(fromP, toP, ms, done) {
        cancelAnimationFrame(rafId);
        const t0 = performance.now();
        const step = now => {
            const k = Math.min(1, (now - t0) / ms);
            renderFlip(fromP + (toP - fromP) * easeInOutSine(k));
            if (k < 1) rafId = requestAnimationFrame(step);
            else done();
        };
        rafId = requestAnimationFrame(step);
    }

    function goTo(t, instant = false, updateHash = true) {
        t = clamp(t, 0, total - 1);

        // Mobile: cuộn dọc bình thường
        if (!isBook()) {
            slides[t].scrollIntoView({ behavior: instant || mqReduce.matches ? 'auto' : 'smooth', block: 'start' });
            index = t;
            syncUI(t);
            if (updateHash) setHash(t);
            return;
        }

        if (flip) {            // đang lật dở thì xếp hàng chờ
            pending = t;
            return;
        }
        if (t === index) return;

        if (instant || mqReduce.matches) {
            settle(t, updateHash);
            return;
        }

        beginFlip(t);
        animateFlip(0, 1, FLIP_MS, () => finishFlip(true));
    }

    prevBtn.addEventListener('click', () => goTo(current() - 1));
    nextBtn.addEventListener('click', () => goTo(current() + 1));

    document.querySelectorAll('[data-goto]').forEach(btn => {
        btn.addEventListener('click', () => goTo(parseInt(btn.dataset.goto, 10)));
    });

    /* ============ Chuột / trackpad: mỗi cú cuộn = lật 1 trang ============ */
    let wheelAcc = 0;
    let lastWheelTime = 0;
    let lastWheelMag = 0;
    let wheelArmed = true;

    function canScrollInside(el, deltaY) {
        const box = el && el.closest ? el.closest('.page-content') : null;
        if (!box || box.scrollHeight <= box.clientHeight + 1) return false;
        if (deltaY < 0) return box.scrollTop > 0;
        return box.scrollTop + box.clientHeight < box.scrollHeight - 1;
    }

    scroller.addEventListener('wheel', e => {
        if (!isBook() || e.ctrlKey) return; // ctrl + wheel = zoom

        const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
        const dx = e.deltaX * scale;
        const dy = e.deltaY * scale;
        const vertical = Math.abs(dy) >= Math.abs(dx);

        // Trang có nội dung dài: cuộn bên trong trước, hết rồi mới lật
        if (vertical && canScrollInside(e.target, dy)) return;

        e.preventDefault();

        const d = vertical ? dy : dx;
        const mag = Math.abs(d);
        const now = performance.now();

        // Cú cuộn mới = nghỉ > 180ms, hoặc lực tăng vọt (vuốt mới khi trackpad còn quán tính)
        const newGesture = now - lastWheelTime > 180 || (mag > lastWheelMag * 1.8 && mag > 8);
        lastWheelTime = now;
        lastWheelMag = mag;

        if (newGesture) {
            wheelArmed = true;
            wheelAcc = 0;
        }
        if (flip || drag || !wheelArmed) return;

        wheelAcc += d;
        if (Math.abs(wheelAcc) >= 35) {
            wheelArmed = false;
            const dir = wheelAcc > 0 ? 1 : -1;
            wheelAcc = 0;
            goTo(index + dir);
        }
    }, { passive: false });

    /* ============ Kéo góc trang (chuột) / vuốt (cảm ứng): trang lật theo tay ============ */
    scroller.addEventListener('pointerdown', e => {
        if (!isBook() || flip || e.button > 0) return;
        const grip = e.target.closest('.page-grip');
        if (e.pointerType === 'mouse' && !grip) return; // chuột: chỉ kéo từ góc trang
        if (grip) e.preventDefault(); // tránh bôi đen chữ

        drag = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            prevX: e.clientX,
            prevT: performance.now(),
            v: 0,
            started: false,
            forced: grip ? (grip.classList.contains('grip-next') ? 1 : -1) : 0,
            pageW: pagesOf(slides[index]).R.offsetWidth || 400
        };
    });

    scroller.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;

        if (!drag.started) {
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
            const dir = dx < 0 ? 1 : -1;               // kéo sang trái = lật tới
            if (drag.forced && dir !== drag.forced) { drag = null; return; }
            const to = index + dir;
            if (to < 0 || to >= total) { drag = null; return; }

            drag.started = true;
            drag.dir = dir;
            drag.x = e.clientX;
            try { scroller.setPointerCapture(e.pointerId); } catch (_) {}
            scroller.classList.add('is-dragging');
            beginFlip(to);
        }

        const now = performance.now();
        drag.v = ((e.clientX - drag.prevX) / Math.max(1, now - drag.prevT)) * -drag.dir;
        drag.prevX = e.clientX;
        drag.prevT = now;

        const moved = (e.clientX - drag.x) * -drag.dir;
        renderFlip(clamp(moved / (drag.pageW * 1.6), 0, 1));
    });

    function releaseDrag(e, cancelled) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        const d = drag;
        drag = null;
        scroller.classList.remove('is-dragging');

        if (!d.started) {
            // Bấm (không kéo) vào góc trang = lật luôn
            if (!cancelled && d.forced) goTo(index + d.forced);
            return;
        }

        const p = flip ? flip.p : 0;
        const commit = !cancelled && (p > 0.35 || d.v > 0.5);
        const target = commit ? 1 : 0;
        const ms = Math.max(220, FLIP_MS * Math.abs(target - p));
        animateFlip(p, target, ms, () => finishFlip(commit));
    }

    scroller.addEventListener('pointerup', e => releaseDrag(e, false));
    scroller.addEventListener('pointercancel', e => releaseDrag(e, true));

    /* ============ Bàn phím ============ */
    document.addEventListener('keydown', e => {
        if (!isBook() || e.altKey || e.ctrlKey || e.metaKey) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;

        let target = null;
        if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) target = current() + 1;
        else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) target = current() - 1;
        else if (e.key === ' ') {
            if (tag === 'button' || tag === 'a') return;
            target = e.shiftKey ? current() - 1 : current() + 1;
        }
        else if (e.key === 'Home') target = 0;
        else if (e.key === 'End') target = total - 1;
        if (target === null) return;

        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
            canScrollInside(document.activeElement, e.key === 'ArrowDown' ? 1 : -1)) return;

        e.preventDefault();
        if (e.repeat && flip) return;
        goTo(target);
    });

    /* ============ Mobile: dot + thanh tiến trình theo vị trí cuộn ============ */
    window.addEventListener('scroll', () => {
        if (isBook()) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    }, { passive: true });

    const mobileObserver = new IntersectionObserver(entries => {
        if (isBook()) return;
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            index = slides.indexOf(entry.target);
            syncUI(index);
        });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    slides.forEach(s => mobileObserver.observe(s));

    const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    slides.forEach(s => revealObserver.observe(s));

    /* ============ Đổi giữa desktop <-> mobile ============ */
    mqMobile.addEventListener('change', () => {
        cancelAnimationFrame(rafId);
        if (flip) finishFlip(true);
        drag = null;
        pending = null;
        scroller.classList.remove('is-dragging');

        if (isBook()) {
            slides.forEach(s => s.classList.add('visible'));
            window.scrollTo(0, 0);
            settle(index, false);
        } else {
            slides[index].scrollIntoView({ block: 'start' });
        }
    });

    /* ============ Khởi tạo: mở đúng trang theo #hash (vd: index.html#contact) ============ */
    const fromHash = slides.findIndex(s => s.id && '#' + s.id === location.hash);
    const startIndex = fromHash > -1 ? fromHash : 0;

    if (isBook()) {
        slides.forEach(s => s.classList.add('visible'));
        settle(startIndex, fromHash > -1);
    } else {
        syncUI(startIndex);
        if (fromHash > -1) requestAnimationFrame(() => goTo(startIndex, true, false));
    }
});