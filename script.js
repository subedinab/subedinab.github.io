// 🔨🤖🔧 tiny enhancements; no frameworks

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.getElementById('site-nav');

navToggle?.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

// Smooth-scroll + close mobile menu on nav click
document.querySelectorAll('#site-nav a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    siteNav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

// Scrollspy (active link highlighting)
const sections = Array.from(document.querySelectorAll('main section[id]'));
const navLinks = Array.from(document.querySelectorAll('#site-nav a[href^="#"]'));
const byId = id => navLinks.find(a => a.getAttribute('href') === `#${id}`);

const spy = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const link = byId(entry.target.id);
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      link?.classList.add('active');
    }
  });
}, { threshold: 0.6 });

sections.forEach(sec => spy.observe(sec));

// Reveal-on-scroll
const rev = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      rev.unobserve(e.target);
    }
  });
}, { threshold: .2 });

document.querySelectorAll('.section, .card, .hero-photo').forEach(el => {
  el.classList.add('reveal');
  rev.observe(el);
});

// Color mode toggle (persists)
const modeBtn = document.getElementById('colorModeBtn');
const setTheme = theme => {
  document.documentElement.dataset.theme = theme;
  modeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('color-mode', theme);
};
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const saved = localStorage.getItem('color-mode');
setTheme(saved || (prefersDark ? 'dark' : 'light'));
modeBtn?.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();
