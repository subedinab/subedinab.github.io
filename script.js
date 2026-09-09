// Mobile menu toggle + copyright year. No frameworks, no dependencies.

const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.getElementById('site-nav');

navToggle?.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
