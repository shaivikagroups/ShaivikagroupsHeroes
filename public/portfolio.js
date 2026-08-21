/* ============================================================
   Shaivika Portfolio Engine V5 — portfolio.js
   Interaction layer ONLY. SEO is fully server-rendered.
   ============================================================ */

(function () {
    'use strict';

    // ── Hamburger Menu ───────────────────────────────────────
    const hamburger = document.getElementById('pg-hamburger');
    const mobileMenu = document.getElementById('pg-mobile-menu');

    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', function () {
            const isOpen = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', String(!isOpen));
            mobileMenu.classList.toggle('pg-open', !isOpen);
            mobileMenu.setAttribute('aria-hidden', String(isOpen));
            document.body.style.overflow = isOpen ? '' : 'hidden';
        });

        // Close on mobile link click
        mobileMenu.querySelectorAll('.pg-mobile-link').forEach(function (link) {
            link.addEventListener('click', function () {
                hamburger.setAttribute('aria-expanded', 'false');
                mobileMenu.classList.remove('pg-open');
                mobileMenu.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            });
        });

        // Close on outside click
        document.addEventListener('click', function (e) {
            if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
                hamburger.setAttribute('aria-expanded', 'false');
                mobileMenu.classList.remove('pg-open');
                mobileMenu.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        });

        // Close on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileMenu.classList.contains('pg-open')) {
                hamburger.setAttribute('aria-expanded', 'false');
                mobileMenu.classList.remove('pg-open');
                mobileMenu.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
                hamburger.focus();
            }
        });
    }

    // ── Scroll: Nav shadow + Active Link ────────────────────
    var nav = document.getElementById('pg-nav');
    var navLinks = document.querySelectorAll('.pg-nav-link[data-target]');
    var sections = [];

    navLinks.forEach(function (link) {
        var targetId = link.getAttribute('data-target');
        var section = targetId ? document.querySelector(targetId) : null;
        if (section) sections.push({ link: link, section: section });
    });

    function onScroll() {
        var scrollY = window.scrollY;
        if (nav) nav.classList.toggle('pg-scrolled', scrollY > 8);

        // Scroll spy
        var currentSection = null;
        sections.forEach(function (item) {
            if (item.section.getBoundingClientRect().top <= 100) {
                currentSection = item;
            }
        });
        navLinks.forEach(function (l) { l.classList.remove('pg-active'); });
        if (currentSection) currentSection.link.classList.add('pg-active');
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ── Reveal on Scroll (IntersectionObserver) ──────────────
    if ('IntersectionObserver' in window) {
        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('pg-visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.pg-reveal').forEach(function (el) {
            revealObserver.observe(el);
        });
    } else {
        // Fallback: show all immediately for old browsers
        document.querySelectorAll('.pg-reveal').forEach(function (el) {
            el.classList.add('pg-visible');
        });
    }

    // ── 3D Tilt (Desktop only, pointer device) ───────────────
    var profileCard = document.getElementById('profile-card');
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isTouch = window.matchMedia('(hover: none)').matches;

    if (profileCard && !prefersReduced && !isTouch) {
        var wrap = profileCard.closest('.pg-profile-wrap');
        if (wrap) {
            wrap.addEventListener('mousemove', function (e) {
                var rect = wrap.getBoundingClientRect();
                var x = (e.clientX - rect.left) / rect.width  - 0.5;
                var y = (e.clientY - rect.top)  / rect.height - 0.5;
                profileCard.style.transform =
                    'perspective(700px) rotateY(' + (x * 12) + 'deg) rotateX(' + (-y * 12) + 'deg) scale(1.02)';
            });
            wrap.addEventListener('mouseleave', function () {
                profileCard.style.transform = '';
            });
        }
    }

    // ── Smooth scroll for anchor links ───────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            var top = target.getBoundingClientRect().top + window.scrollY - 72;
            window.scrollTo({ top: top, behavior: 'smooth' });
        });
    });

})();
