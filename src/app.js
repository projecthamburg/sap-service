import { content } from "./content.js";
import { icon, logo } from "./icons.js";
import { escapeHTML as esc, store } from "./utils.js";
import { Estimator } from "./estimator.js";
import { mountCareers } from "./careers.js";

const app = document.getElementById("app");
let language = /^#\/fr\//.test(location.hash)
  ? "fr"
  : /^#\/en\//.test(location.hash)
  ? "en"
  : store.get("language") || "en";
if (!["en", "fr"].includes(language)) language = "en";
let activePage = "";
let estimator;
let bookingObserver;
let bookingTimer;
const comparisonImages = {
  condo: "cleaning-comparison.png",
  fitness: "cleaning-fitness.png",
  restaurant: "cleaning-restaurant.png",
  healthcare: "cleaning-healthcare.png",
  office: "cleaning-office.png",
};
export const config = {
  apiUrl: "",
  bookingUrl: "https://schedule.projecthamburg.com/booking/sap-service-cleanup",
  turnstileSiteKey: "",
};
fetch("./site-config.json")
  .then((r) => (r.ok ? r.json() : {}))
  .then((value) => {
    // Public endpoints only. A compromised config cannot inject markup or javascript: URLs.
    if (
      typeof value.apiUrl === "string" &&
      /^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/.test(value.apiUrl)
    )
      config.apiUrl = value.apiUrl.replace(/\/$/, "");
    if (
      typeof value.bookingUrl === "string" &&
      value.bookingUrl.startsWith("https://schedule.projecthamburg.com/")
    )
      config.bookingUrl = value.bookingUrl;
    if (
      typeof value.turnstileSiteKey === "string" &&
      /^[a-zA-Z0-9_-]+$/.test(value.turnstileSiteKey)
    )
      config.turnstileSiteKey = value.turnstileSiteKey;
  })
  .catch(() => {});

function header(t) {
  return `<a class="skip-link" href="#main">${t.skip}</a>
    <div class="utility-bar"><div class="container"><span>${
      t.top
    }</span><a href="tel:+15142943063">514 294 3063 ${icon(
    "diagonal"
  )}</a><span class="utility-region">${t.territory}</span></div></div>
    <header class="site-header"><div class="container nav-inner">
      <a href="#" class="brand" aria-label="SAP Service Inc. · ${
        language === "fr" ? "Accueil" : "Home"
      }">${logo()}<span>SERVICE INC.<small>${
    language === "fr" ? "NETTOYAGE DE CHANTIER" : "CONSTRUCTION CLEANING"
  }</small></span></a>
      <nav id="main-nav" class="main-nav" aria-label="${
        language === "fr" ? "Navigation principale" : "Main navigation"
      }">${t.nav
    .map((label, i) => `<a href="${t.navLinks[i]}">${label}</a>`)
    .join("")}</nav>
      <div class="nav-actions"><button class="language-toggle" data-action="language" aria-label="${
        t.otherLabel
      }">${
    t.other
  }</button><span class="nav-divider"></span><button class="icon-button theme-toggle" data-action="theme" aria-label="${
    t.theme
  }">${icon(
    document.documentElement.dataset.theme === "dark" ? "sun" : "moon"
  )}</button><a class="button primary nav-estimate" href="#estimate">${
    t.getEstimate
  }${icon(
    "diagonal"
  )}</a><button class="icon-button menu-toggle" data-action="menu" aria-expanded="false" aria-controls="main-nav" aria-label="${
    t.menu
  }">${icon("menu")}</button></div>
    </div></header>`;
}
function footer(t) {
  return `<footer class="site-footer"><div class="container"><div class="footer-upper"><div class="footer-brand"><a href="#" class="brand" aria-label="SAP Service Inc.">${logo()}<span>SERVICE INC.</span></a><h2>${
    t.footer.line
  }</h2><p>${
    t.footer.copy
  }</p></div><div class="footer-links"><p class="eyebrow">${
    t.footer.explore
  }</p>${t.nav
    .map((label, i) => `<a href="${t.navLinks[i]}">${label}</a>`)
    .join("")}<a href="#estimate">${t.getEstimate}</a><a href="#consultation">${
    t.book
  }</a></div><div class="footer-contact"><p class="eyebrow">${
    t.footer.contact
  }</p><a class="footer-phone" href="tel:+15142943063">514 294 3063${icon(
    "diagonal"
  )}</a><a href="mailto:servicesapinc@gmail.com">servicesapinc@gmail.com</a><p>Frank Sungwa<br>Montréal, Québec</p><a href="#/${language}/careers" class="footer-careers">${
    t.footer.careers
  }${icon(
    "arrow"
  )}</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${
    t.footer.rights
  }</span><div><a href="#/${language}/privacy">${
    t.footer.privacy
  }</a><a href="#/${language}/terms">${t.footer.terms}</a><a href="#">${
    t.footer.top
  }${icon("diagonal")}</a></div></div></div></footer>`;
}
function stageDetails(t, i) {
  const stage = t.services.stages[i];
  return `<div class="stage-copy"><span class="eyebrow">${
    stage.tag
  }</span><h3>${stage.name}</h3><p>${
    stage.description
  }</p><span class="micro-label">${
    t.services.included
  }</span><ul class="check-list">${stage.items
    .map((x) => `<li>${icon("check")}<span>${x}</span></li>`)
    .join("")}</ul><a class="text-link" href="#estimate" data-stage="${
    stage.key
  }">${t.services.more}${icon(
    "diagonal"
  )}</a></div><figure class="stage-photo"><img src="./images/${
    stage.image
  }" alt="${esc(stage.name)} · ${
    t.comparison.reference
  }" loading="lazy" width="900" height="650"><figcaption><span>${stage.num} / ${
    stage.tag
  }</span><span>SAP SERVICE INC.</span></figcaption></figure>`;
}
function home(t) {
  return `<main id="main" tabindex="-1">
    <section class="hero" id="top"><div class="hero-copy"><p class="eyebrow"><span class="accent-line"></span>${
      t.hero.eyebrow
    }</p><h1>${t.hero.title}</h1><p class="hero-description">${
    t.hero.copy
  }</p><div class="hero-buttons"><a class="button primary" href="#estimate">${
    t.getEstimate
  }${icon("diagonal")}</a><a class="hero-secondary" href="#consultation">${
    t.book
  }${icon(
    "arrow"
  )}</a></div><div class="hero-foot"><span class="status-dot"></span>${
    t.hero.note
  }</div></div><figure class="hero-photo"><img src="./images/lobby.jpg" alt="${
    language === "fr"
      ? "Hall contemporain avec vitrage pleine hauteur et finitions de bois"
      : "Contemporary building lobby with full-height glazing and warm wood finishes"
  }" fetchpriority="high" width="1536" height="1024"><div class="hero-photo-shade"></div><span class="photo-corner">SAP / ${
    t.territory
  }</span><figcaption><span>${t.hero.photo}<small>${
    t.hero.photoNote
  }</small></span><a href="#services" aria-label="${t.hero.scroll}">${icon(
    "arrow"
  )}</a></figcaption><div class="hero-photo-index">01<span>/</span>03</div></figure><a class="hero-scroll" href="#services">${
    t.hero.scroll
  }<span>↓</span></a></section>
    <section class="trust-strip container" aria-label="SAP Service Inc.">${t.trust
      .map(
        ([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`
      )
      .join("")}</section>
    <section class="section services-section" id="services"><div class="container"><div class="section-heading"><div><p class="eyebrow">${
      t.services.eyebrow
    }</p><h2>${t.services.title}</h2></div><p class="section-intro">${
    t.services.copy
  }</p></div><div class="stage-tabs" role="tablist" aria-label="${
    t.nav[0]
  }">${t.services.stages
    .map(
      (s, i) =>
        `<button type="button" id="phase-tab-${i}" role="tab" aria-selected="${
          i === 0
        }" aria-controls="stage-panel" tabindex="${
          i === 0 ? "0" : "-1"
        }" data-phase="${i}"><span>${s.num}</span><div>${s.name}<small>${
          s.fr
        }</small></div>${icon("diagonal")}</button>`
    )
    .join(
      ""
    )}</div><div class="stage-panel" id="stage-panel" role="tabpanel" aria-labelledby="phase-tab-0" tabindex="0">${stageDetails(
    t,
    0
  )}</div></div></section>
    <section class="section projects-section" id="projects"><div class="container"><div class="section-heading"><div><p class="eyebrow">${
      t.projects.eyebrow
    }</p><h2>${t.projects.title}</h2></div><p class="section-intro">${
    t.projects.copy
  }</p></div><div class="project-filters" role="group" aria-label="${
    t.nav[1]
  }">${["all", "public", "residential", "commercial"]
    .map(
      (filter, i) =>
        `<button class="filter-button" data-filter="${filter}" aria-pressed="${
          i === 0
        }">${t.projects[filter]}</button>`
    )
    .join("")}</div><div class="project-grid">${t.projects.cards
    .map(
      (card, i) =>
        `<article class="project-card" data-sector="${
          card.filter
        }"><a href="#estimate" data-category="${card.key}" aria-label="${esc(
          card.name
        )} — ${
          t.projects.explore
        }"><div class="project-photo"><img src="./images/${
          card.image
        }" alt="${esc(card.name)} · ${
          t.comparison.reference
        }" loading="lazy" width="800" height="560"><span class="project-tag">${
          card.tag
        }</span><span class="project-arrow">${icon(
          "diagonal"
        )}</span></div><div class="project-caption"><span class="project-index">0${
          i + 1
        }</span><div><h3>${card.name}</h3><p>${
          card.scope
        }</p></div></div></a></article>`
    )
    .join("")}</div><p class="image-disclosure">${icon("info")}${
    t.projects.reference
  }</p></div></section>
    <section class="section approach-section" id="approach"><div class="container approach-grid"><div class="approach-visual"><img src="./images/construction.jpg" alt="${
      language === "fr"
        ? "Intérieur commercial durant les travaux de finition"
        : "Commercial interior during the finishing trades"
    }" width="900" height="1100" loading="lazy"><div class="approach-stamp">${logo()}<span>${
    t.approach.imageNote
  }</span></div><div class="approach-badge">${
    language === "fr" ? "DEPUIS" : "SINCE"
  }<br><strong>2020</strong><span>MONTRÉAL, QC</span></div></div><div class="approach-copy"><p class="eyebrow">${
    t.approach.eyebrow
  }</p><h2>${t.approach.title}</h2><p class="section-intro">${
    t.approach.copy
  }</p><div class="approach-list">${t.approach.items
    .map(
      ([title, copy], i) =>
        `<div><span>0${
          i + 1
        }</span><div><h3>${title}</h3><p>${copy}</p></div></div>`
    )
    .join(
      ""
    )}</div><a class="person-contact" href="mailto:servicesapinc@gmail.com"><span class="avatar">FS</span><div><strong>${
    t.approach.signature
  }</strong><small>${t.approach.role}</small></div>${icon(
    "diagonal"
  )}</a></div></div></section>
    <section class="section estimator-section" id="estimate"><div class="container"><div class="section-heading"><div><p class="eyebrow">${
      t.estimator.eyebrow
    }</p><h2>${t.estimator.title}</h2></div><div><p class="section-intro">${
    t.estimator.copy
  }</p><span class="anonymous-note">${icon("shield")}${
    t.estimator.anonymous
  }</span></div></div><div id="estimator"></div></div></section>
    <section class="section comparison-section"><div class="container comparison-grid"><div><p class="eyebrow">${
      t.comparison.eyebrow
    }</p><h2>${t.comparison.title}</h2><p class="section-intro">${
    t.comparison.copy
  }</p><span class="comparison-detail">${icon("sparkle")}${
    t.services.stages[1].name
  }</span><p class="fine-print">${
    t.comparison.note
  }</p></div><div><div class="comparison-choices" role="group" aria-label="${
    t.nav[1]
  }">${t.comparison.spaces
    .map(
      ([key, label], index) =>
        `<button type="button" data-comparison="${key}" aria-pressed="${
          index === 0
        }">${label}</button>`
    )
    .join(
      ""
    )}</div><div class="comparison-view" style="--position:50%"><div class="comparison-image comparison-after"></div><div class="comparison-image comparison-before"></div><span class="comparison-label before">${
    t.comparison.before
  }</span><span class="comparison-label after">${
    t.comparison.after
  }</span><div class="comparison-line"><span>‹ ›</span></div><input type="range" min="0" max="100" value="50" aria-label="${
    t.comparison.label
  }" class="comparison-slider"></div><div class="comparison-foot"><span>${
    t.comparison.before
  }</span><span>← ${
    language === "fr" ? "GLISSEZ POUR COMPARER" : "DRAG TO COMPARE"
  } →</span><span>${t.comparison.after}</span></div></div></div></section>
    <section class="section booking-section" id="consultation"><div class="container"><div class="section-heading"><div><p class="eyebrow">${
      t.booking.eyebrow
    }</p><h2>${t.booking.title}</h2></div><p class="section-intro">${
    t.booking.copy
  }</p></div><div class="booking-layout"><aside class="booking-info"><div class="booking-icon">${icon(
    "calendar"
  )}</div><h3>${t.booking.meeting}</h3><p>${
    t.booking.meetingCopy
  }</p><div class="booking-facts"><span>${icon("users")}${
    t.booking.with
  }</span><span>${icon("pin")}${t.booking.location}</span><span>${icon(
    "layers"
  )}${t.trust[1][1]}</span></div><hr><p class="micro-label">${
    t.booking.contact
  }</p><a class="booking-phone" href="tel:+15142943063">514 294 3063${icon(
    "diagonal"
  )}</a><a class="booking-email" href="mailto:servicesapinc@gmail.com">servicesapinc@gmail.com</a></aside><div class="booking-calendar"><div class="calendar-top"><span class="status-dot"></span>${
    t.booking.meeting
  }<span>SAP SERVICE INC.</span></div><div class="calendar-frame"><div class="calendar-loading" role="status"><div class="loading-ring"></div><p>${
    t.booking.loading
  }</p></div><iframe id="booking-frame" title="${
    t.booking.meeting
  }" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="payment" data-src="${esc(
    config.bookingUrl
  )}"></iframe></div><div class="calendar-fallback"><span>${
    t.booking.fallback
  }</span><a href="${esc(
    config.bookingUrl
  )}" target="_blank" rel="noopener noreferrer">${t.booking.external}${icon(
    "diagonal"
  )}</a></div></div></div><p class="booking-privacy">${icon("shield")}${
    t.booking.privacy
  }</p></div></section>
    <section class="section faq-section"><div class="container faq-grid"><div><p class="eyebrow">${
      t.faq.eyebrow
    }</p><h2>${
    t.faq.title
  }</h2><a class="text-link" href="mailto:servicesapinc@gmail.com">${
    t.footer.contact
  }${icon("diagonal")}</a></div><div class="faq-list">${t.faq.items
    .map(
      ([q, a], i) =>
        `<details><summary><span class="faq-index">0${
          i + 1
        }</span><span>${q}</span>${icon("plus")}</summary><p>${a}</p></details>`
    )
    .join("")}</div></div></section>
    <section class="careers-strip"><div class="container"><div><p class="eyebrow">${
      t.footer.work
    }</p><h2>${
    t.footer.careersCopy
  }</h2></div><a href="#/${language}/careers" class="button light">${
    t.footer.careers
  }${icon("diagonal")}</a></div></section>
  </main>`;
}
function legal(t, page) {
  const title = page === "privacy" ? t.legal.privacyTitle : t.legal.termsTitle;
  return `<main class="legal-page container" id="main" tabindex="-1"><a href="#" class="text-link">← ${
    t.careers.back
  }</a><p class="eyebrow">SAP SERVICE INC.</p><h1>${title}</h1><p class="legal-date">${
    language === "fr"
      ? "Mise à jour : 30 octobre 2026"
      : "Updated: October 30, 2026"
  }</p>${t.legal[page]
    .map(([h, p]) => `<section><h2>${h}</h2><p>${p}</p></section>`)
    .join("")}</main>`;
}
function currentPage() {
  return (
    location.hash.match(/^#\/(?:en|fr)\/(careers|privacy|terms)/)?.[1] || "home"
  );
}
function render(force = false) {
  const hashLang = location.hash.match(/^#\/(en|fr)\//)?.[1];
  if (hashLang && hashLang !== language) {
    language = hashLang;
    force = true;
  }
  const page = currentPage();
  if (!force && page === activePage) {
    scrollToAnchor();
    return;
  }
  const careerForm =
    page === "careers" && activePage === "careers"
      ? document.getElementById("career-form")
      : null;
  const careerDraft = careerForm ? new FormData(careerForm) : null;
  activePage = page;
  store.set("language", language);
  const t = content[language];
  document.documentElement.lang = t.lang;
  document.title = `SAP Service Inc. — ${
    page === "careers"
      ? t.footer.careers
      : page === "privacy"
      ? t.legal.privacyTitle
      : page === "terms"
      ? t.legal.termsTitle
      : language === "fr"
      ? "Nettoyage de chantier · Montréal"
      : "Construction Cleaning · Montréal"
  }`;
  document.querySelector('meta[name="description"]').content =
    language === "fr"
      ? "Nettoyage de chantier, de finition et avant livraison. SAP Service Inc., Montréal, au service de projets au Québec et en Ontario."
      : "Specialized construction cleaning from rough clean to final handover. SAP Service Inc., Montréal, serving Québec and Ontario.";
  document.querySelector('meta[property="og:locale"]').content =
    language === "fr" ? "fr_CA" : "en_CA";
  bookingObserver?.disconnect();
  clearTimeout(bookingTimer);
  app.innerHTML =
    header(t) +
    (page === "home"
      ? home(t)
      : page === "careers"
      ? '<main id="main" tabindex="-1"></main>'
      : legal(t, page)) +
    footer(t);
  if (page === "home") {
    if (!estimator) estimator = new Estimator(config);
    estimator.mount(document.getElementById("estimator"), language);
    mountBooking(t);
  } else if (page === "careers") {
    mountCareers(document.getElementById("main"), t, language, config);
    if (careerDraft) {
      for (const field of document.querySelectorAll("#career-form [name]")) {
        const values = careerDraft.getAll(field.name);
        if (field.type === "checkbox")
          field.checked = values.includes(field.value);
        else if (field.type === "file") {
          const transfer = new DataTransfer();
          for (const value of values)
            if (value instanceof File && value.size) transfer.items.add(value);
          field.files = transfer.files;
          field.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (values.length) field.value = String(values[0]);
      }
    }
  }
  if (page !== "home") window.scrollTo(0, 0);
  else requestAnimationFrame(scrollToAnchor);
}
function scrollToAnchor() {
  if (/^#[a-z-]+$/.test(location.hash))
    document
      .getElementById(location.hash.slice(1))
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  else if (!location.hash || location.hash === "#") window.scrollTo(0, 0);
}
function mountBooking(t) {
  const iframe = document.getElementById("booking-frame");
  const mount = () => {
    iframe.src = iframe.dataset.src;
    iframe.addEventListener(
      "load",
      () => {
        document.querySelector(".calendar-loading")?.classList.add("loaded");
        clearTimeout(bookingTimer);
      },
      { once: true }
    );
    bookingTimer = setTimeout(() => {
      const loader = document.querySelector(".calendar-loading");
      if (loader && !loader.classList.contains("loaded")) {
        loader.innerHTML = `${icon("calendar")}<p>${
          t.booking.blocked
        }</p><a class="button primary" target="_blank" rel="noopener noreferrer" href="${esc(
          config.bookingUrl
        )}">${t.booking.external}${icon("diagonal")}</a>`;
      }
    }, 18000);
  };
  if ("IntersectionObserver" in window) {
    bookingObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          mount();
          bookingObserver.disconnect();
        }
      },
      { rootMargin: "600px" }
    );
    bookingObserver.observe(iframe);
  } else mount();
}
app.addEventListener("click", (event) => {
  const target = event.target.closest("button,a");
  if (!target) return;
  if (target.dataset.action === "language") {
    language = language === "en" ? "fr" : "en";
    store.set("language", language);
    if (activePage !== "home" || /^#\/(?:en|fr)\//.test(location.hash))
      location.hash = `#/${language}/${
        activePage === "home" ? "" : activePage
      }`;
    render(true);
  }
  if (target.dataset.action === "theme") {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("theme", next);
    target.innerHTML = icon(next === "dark" ? "sun" : "moon");
    document.querySelector('meta[name="theme-color"]').content =
      next === "dark" ? "#111b30" : "#1E2D53";
  }
  if (target.dataset.action === "menu") {
    const open = target.getAttribute("aria-expanded") !== "true";
    target.setAttribute("aria-expanded", String(open));
    document.getElementById("main-nav").classList.toggle("is-open", open);
    target.innerHTML = icon(open ? "close" : "menu");
  }
  if (target.dataset.phase !== undefined)
    selectStage(Number(target.dataset.phase));
  if (target.dataset.filter) {
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === target)));
    document
      .querySelectorAll("[data-sector]")
      .forEach(
        (c) =>
          (c.hidden =
            target.dataset.filter !== "all" &&
            c.dataset.sector !== target.dataset.filter)
      );
  }
  if (
    target.dataset.comparison &&
    Object.hasOwn(comparisonImages, target.dataset.comparison)
  ) {
    document
      .querySelectorAll("[data-comparison]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button === target))
      );
    document
      .querySelector(".comparison-view")
      .style.setProperty(
        "--comparison-image",
        `url("./images/${comparisonImages[target.dataset.comparison]}")`
      );
  }
  if (target.dataset.category) {
    estimator.state.category = target.dataset.category;
    estimator.state.step = 0;
    estimator.update();
  }
  if (target.dataset.stage) {
    estimator.state.phases = [target.dataset.stage];
    estimator.state.step = 1;
    estimator.update();
  }
  if (target.tagName === "A") {
    document.getElementById("main-nav")?.classList.remove("is-open");
    const menu = document.querySelector(".menu-toggle");
    menu?.setAttribute("aria-expanded", "false");
    if (menu) menu.innerHTML = icon("menu");
  }
});
function selectStage(i, focus = false) {
  document.querySelectorAll("[data-phase]").forEach((b, n) => {
    b.setAttribute("aria-selected", String(n === i));
    b.tabIndex = n === i ? 0 : -1;
    if (focus && n === i) b.focus();
  });
  const panel = document.getElementById("stage-panel");
  panel.innerHTML = stageDetails(content[language], i);
  panel.setAttribute("aria-labelledby", `phase-tab-${i}`);
}
app.addEventListener("keydown", (event) => {
  if (
    event.target.matches("[data-phase]") &&
    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
  ) {
    event.preventDefault();
    let i = Number(event.target.dataset.phase);
    i =
      event.key === "Home"
        ? 0
        : event.key === "End"
        ? 2
        : (i + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    selectStage(i, true);
  }
  if (event.key === "Escape") {
    document.getElementById("main-nav")?.classList.remove("is-open");
    document
      .querySelector(".menu-toggle")
      ?.setAttribute("aria-expanded", "false");
  }
});
app.addEventListener("input", (event) => {
  if (event.target.matches(".comparison-slider"))
    event.target
      .closest(".comparison-view")
      .style.setProperty("--position", `${event.target.value}%`);
});
window.addEventListener("hashchange", () => render());
render();
