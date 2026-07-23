const tiles = [...document.querySelectorAll("[data-gallery-tile]")];
const replayButton = document.querySelector("[data-replay]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let observer;

function revealWithoutMotion() {
  tiles.forEach((tile) => tile.classList.add("is-revealed"));
}

function observeTiles() {
  observer?.disconnect();

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealWithoutMotion();
    return;
  }

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0 });

  tiles.forEach((tile) => observer.observe(tile));
}

function replayGallery() {
  observer?.disconnect();
  document.documentElement.classList.add("is-resetting");
  tiles.forEach((tile) => tile.classList.remove("is-revealed"));
  window.scrollTo({ top: 0, behavior: "auto" });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("is-resetting");
      observeTiles();
    });
  });
}

replayButton?.addEventListener("click", replayGallery);
reducedMotion.addEventListener?.("change", replayGallery);

observeTiles();
