const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const animeRoots = [...document.querySelectorAll(".js-anime")];
const parallaxRoots = [...document.querySelectorAll(".js-parallax")];
const shineItems = [...document.querySelectorAll(".js-shine")];

let viewportHeight = window.innerHeight;
let scrollBottom = window.scrollY + viewportHeight;
let resizeTicking = false;

function updateWindowValues() {
  viewportHeight = window.innerHeight;
  scrollBottom = window.scrollY + viewportHeight;
}

function prepareShineText() {
  shineItems.forEach((item) => {
    const text = item.textContent || "";

    if (!text.trim()) {
      return;
    }

    item.textContent = "";

    [...text].forEach((letter, index) => {
      const span = document.createElement("span");
      span.textContent = letter === " " ? "\u00a0" : letter;

      if (index % 3 !== 1) {
        span.style.animationDelay = `${(index % 8) * 35}ms`;
      }

      item.appendChild(span);
    });
  });
}

function observeAnime() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-anime");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -20% 0px",
    },
  );

  animeRoots.forEach((root) => observer.observe(root));
}

function updateParallaxRoot(root) {
  const item = root.querySelector(".js-parallax-item");

  if (!item) {
    return;
  }

  const rootHeight = root.offsetHeight;
  const rootTop = root.getBoundingClientRect().top + window.scrollY;
  const movable = item.offsetHeight - rootHeight;
  const ratio = movable / (viewportHeight + rootHeight);
  const position = Math.round((scrollBottom - rootTop) * ratio);

  root.style.setProperty("--position", position.toString());
}

function updateParallax() {
  updateWindowValues();
  parallaxRoots.forEach(updateParallaxRoot);
}

function initParallax() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-active", entry.isIntersecting);
      });
    },
    {
      root: null,
      rootMargin: "50% 0px",
    },
  );

  parallaxRoots.forEach((root, index) => {
    window.setTimeout(() => {
      updateParallaxRoot(root);
      root.classList.add("is-init");
      observer.observe(root);
    }, 20 * index);
  });

  window.addEventListener("scroll", () => {
    window.requestAnimationFrame(updateParallax);
  }, { passive: true });
}

function handleResize() {
  if (resizeTicking) {
    return;
  }

  resizeTicking = true;
  window.requestAnimationFrame(() => {
    resizeTicking = false;
    updateParallax();
  });
}

if (reduceMotion.matches) {
  animeRoots.forEach((root) => root.classList.add("is-anime"));
  parallaxRoots.forEach((root) => root.classList.add("is-init"));
} else {
  prepareShineText();
  observeAnime();
  initParallax();
  updateParallax();
  window.addEventListener("resize", handleResize);
}
