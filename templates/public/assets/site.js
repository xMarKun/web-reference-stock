const searchInput = document.querySelector("[data-search]");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const cards = [...document.querySelectorAll("[data-card]")];
const empty = document.querySelector("[data-empty]");

let activeTag = "all";

function normalize(value) {
  return value.toLowerCase().trim();
}

function applyFilters() {
  const query = normalize(searchInput?.value || "");
  let visibleCount = 0;

  cards.forEach((card) => {
    const tags = (card.dataset.tags || "").split(" ");
    const haystack = normalize(card.textContent || "");
    const matchesTag = activeTag === "all" || tags.includes(activeTag);
    const matchesQuery = !query || haystack.includes(query);
    const isVisible = matchesTag && matchesQuery;

    card.classList.toggle("is-hidden", !isVisible);
    if (isVisible) visibleCount += 1;
  });

  if (empty) {
    empty.classList.toggle("is-hidden", visibleCount !== 0 || cards.length === 0);
  }
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTag = button.dataset.filter || "all";
    filterButtons.forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    applyFilters();
  });
});

searchInput?.addEventListener("input", applyFilters);
applyFilters();
