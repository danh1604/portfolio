document.addEventListener('DOMContentLoaded', () => {
    const spreads = document.querySelectorAll('.spread');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageCounter = document.getElementById('pageCounter');
    
    let currentSpread = 0;
    const totalSpreads = spreads.length;
    let isAnimating = false;

    // Initialize
    updatePageCounter();
    updateNavButtons();

    // Previous button
    prevBtn.addEventListener('click', () => {
        if (currentSpread > 0 && !isAnimating) {
            goToSpread(currentSpread - 1);
        }
    });

    // Next button
    nextBtn.addEventListener('click', () => {
        if (currentSpread < totalSpreads - 1 && !isAnimating) {
            goToSpread(currentSpread + 1);
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (isAnimating) return;
        
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            if (currentSpread > 0) {
                goToSpread(currentSpread - 1);
            }
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
            if (currentSpread < totalSpreads - 1) {
                goToSpread(currentSpread + 1);
            }
        }
    });

    // Touch/Swipe support
    let touchStartX = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (isAnimating) return;
        
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > 60) {
            if (diff > 0 && currentSpread < totalSpreads - 1) {
                goToSpread(currentSpread + 1);
            } else if (diff < 0 && currentSpread > 0) {
                goToSpread(currentSpread - 1);
            }
        }
    }, { passive: true });

    function goToSpread(spreadIndex) {
        if (spreadIndex < 0 || spreadIndex >= totalSpreads || spreadIndex === currentSpread) return;
        
        isAnimating = true;
        const direction = spreadIndex > currentSpread ? 'forward' : 'backward';

        // Get current and next spread
        const currentEl = spreads[currentSpread];
        const nextEl = spreads[spreadIndex];

        // Animate current spread out
        currentEl.style.transition = 'transform 0.6s ease-in, opacity 0.4s ease';
        currentEl.style.transformOrigin = 'right center';
        
        if (direction === 'forward') {
            currentEl.style.transform = 'scale(0.95) rotateY(-5deg)';
        } else {
            currentEl.style.transform = 'scale(0.95) rotateY(5deg)';
        }
        currentEl.style.opacity = '0';

        // Prepare next spread
        nextEl.style.transition = 'none';
        nextEl.style.opacity = '0';
        if (direction === 'forward') {
            nextEl.style.transform = 'scale(0.95) rotateY(10deg)';
        } else {
            nextEl.style.transform = 'scale(0.95) rotateY(-10deg)';
        }

        setTimeout(() => {
            currentEl.classList.remove('active');
            currentEl.style.transform = '';
            currentEl.style.opacity = '';
            currentEl.style.transition = '';

            nextEl.style.transition = 'transform 0.6s ease-out, opacity 0.4s ease';
            nextEl.style.opacity = '1';
            nextEl.style.transform = 'rotateY(0deg) scale(1)';
        }, 300);

        setTimeout(() => {
            nextEl.classList.add('active');
            nextEl.style.transform = '';
            nextEl.style.opacity = '';
            nextEl.style.transition = '';
            
            currentSpread = spreadIndex;
            updatePageCounter();
            updateNavButtons();
            isAnimating = false;
        }, 900);
    }

    function updatePageCounter() {
        pageCounter.textContent = `${currentSpread + 1} / ${totalSpreads}`;
    }

    function updateNavButtons() {
        prevBtn.disabled = currentSpread === 0;
        nextBtn.disabled = currentSpread === totalSpreads - 1;
    }
});