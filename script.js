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
// ---------- Citi Bike modal ----------
const openBtn = document.getElementById("citibike-open");
const modal = document.getElementById("citibike-modal");
const closeBtn = modal.querySelector(".modal-close");

if (openBtn && modal && closeBtn) {
  openBtn.onclick = () => modal.style.display = "block";
  closeBtn.onclick = () => modal.style.display = "none";
  window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };
}
// ---------- Hover Popover for project cards ----------
(() => {
  const pop = document.getElementById("projectPopover");
  if (!pop) return;

  let activeCard = null;
  let hideTimer = null;

  const OPEN_CLASS = "open";

  function setPopoverContentFromTemplate(templateId) {
    const tpl = document.getElementById(templateId);
    if (!tpl) return;
    pop.innerHTML = "";
    pop.appendChild(tpl.content.cloneNode(true));
  }

  function positionPopoverNearCard(card) {
    if (!card) return;

    // Temporarily show for measuring
    pop.style.visibility = "hidden";
    pop.classList.add(OPEN_CLASS);

    const cardRect = card.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();

    const gap = 14;

    // Prefer right side of card, fallback to left, then clamp
    let left = cardRect.right + gap;
    if (left + popRect.width > window.innerWidth - 12) {
      left = cardRect.left - gap - popRect.width;
    }
    left = Math.max(12, Math.min(left, window.innerWidth - popRect.width - 12));

    // Align top with card, but clamp to viewport
    let top = cardRect.top;
    top = Math.max(12, Math.min(top, window.innerHeight - popRect.height - 12));

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    pop.style.visibility = "visible";
  }

  function openPopover(card) {
    clearTimeout(hideTimer);
    activeCard = card;

    const templateId = card.getAttribute("data-popover-template");
    if (templateId) setPopoverContentFromTemplate(templateId);

    pop.setAttribute("aria-hidden", "false");
    pop.classList.add(OPEN_CLASS);
    positionPopoverNearCard(card);
  }

  function scheduleClosePopover() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      pop.classList.remove(OPEN_CLASS);
      pop.setAttribute("aria-hidden", "true");
      activeCard = null;
    }, 120);
  }

  // Attach hover behavior to any card with details
  const cards = document.querySelectorAll(".has-hover-details");
  cards.forEach((card) => {
    card.addEventListener("mouseenter", () => openPopover(card));
    card.addEventListener("mouseleave", scheduleClosePopover);

    // keyboard accessibility
    card.addEventListener("focusin", () => openPopover(card));
    card.addEventListener("focusout", scheduleClosePopover);
  });

  // Keep it open if user hovers the popover itself
  pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  pop.addEventListener("mouseleave", scheduleClosePopover);

  // Reposition on scroll/resize
  window.addEventListener("scroll", () => {
    if (pop.classList.contains(OPEN_CLASS) && activeCard) {
      positionPopoverNearCard(activeCard);
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (pop.classList.contains(OPEN_CLASS) && activeCard) {
      positionPopoverNearCard(activeCard);
    }
  });
})();
