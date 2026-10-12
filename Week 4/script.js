/* Small interactions shared across the three pages. */
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("songSearch");
  const moodFilter = document.getElementById("moodFilter");
  const regionFilter = document.getElementById("regionFilter");
  const clearButton = document.getElementById("clearFilters");
  const songItems = Array.from(document.querySelectorAll(".song-item"));
  const resultCount = document.getElementById("resultCount");
  const noResults = document.getElementById("noResults");

  // Search/filter controls only exist on songs.html.
  if (!searchInput || !moodFilter || !regionFilter || !resultCount) return;

  function updateSongs() {
    const query = searchInput.value.trim().toLocaleLowerCase("th");
    const selectedMood = moodFilter.value;
    const selectedRegion = regionFilter.value;
    let visibleCount = 0;

    songItems.forEach((item) => {
      const searchableText = [
        item.dataset.title || "",
        item.dataset.search || "",
        item.textContent || ""
      ].join(" ").toLocaleLowerCase("th");
      const moods = (item.dataset.mood || "").split(/\s+/);
      const region = item.dataset.region || "other";

      const matchesSearch = query === "" || searchableText.includes(query);
      const matchesMood = selectedMood === "all" || moods.includes(selectedMood);
      const matchesRegion = selectedRegion === "all" || region === selectedRegion;
      const visible = matchesSearch && matchesMood && matchesRegion;

      item.classList.toggle("d-none", !visible);
      if (visible) visibleCount += 1;
    });

    resultCount.textContent = `แสดง ${visibleCount} จาก ${songItems.length} รายการ`;
    if (noResults) noResults.classList.toggle("d-none", visibleCount !== 0);
  }

  searchInput.addEventListener("input", updateSongs);
  moodFilter.addEventListener("change", updateSongs);
  regionFilter.addEventListener("change", updateSongs);

  clearButton?.addEventListener("click", () => {
    searchInput.value = "";
    moodFilter.value = "all";
    regionFilter.value = "all";
    updateSongs();
    searchInput.focus();
  });

  updateSongs();
});
