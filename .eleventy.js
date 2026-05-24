const { DateTime } = require("luxon");

module.exports = function(eleventyConfig) {

  // Pass through static assets and admin
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });

  // Watch CSS for changes
  eleventyConfig.addWatchTarget("src/assets/css/");

  // -----------------------------------------------------
  // Collections
  // -----------------------------------------------------

  // All entries, reverse-chronological (newest first)
  eleventyConfig.addCollection("entries", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/content/entries/*.md")
      .sort((a, b) => {
        return new Date(b.data.observed).getTime() - new Date(a.data.observed).getTime();
      });
  });

  // Most recent entry (for the "today" slot on home)
  eleventyConfig.addCollection("latestEntry", function(collectionApi) {
    const all = collectionApi.getFilteredByGlob("src/content/entries/*.md")
      .sort((a, b) => new Date(b.data.observed).getTime() - new Date(a.data.observed).getTime());
    return all.slice(0, 1);
  });

  // All entries written on the same date as the latest entry — supports
  // displaying multiple scribes' observations from "today" on the home page.
  eleventyConfig.addCollection("entriesOnLatestDay", function(collectionApi) {
    const all = collectionApi.getFilteredByGlob("src/content/entries/*.md")
      .sort((a, b) => new Date(b.data.observed).getTime() - new Date(a.data.observed).getTime());
    if (!all.length) return [];
    const latestDate = DateTime.fromJSDate(all[0].data.observed, { zone: "utc" }).toISODate();
    return all.filter(e => {
      return DateTime.fromJSDate(e.data.observed, { zone: "utc" }).toISODate() === latestDate;
    });
  });

  // Entries grouped by month for the calendar
  eleventyConfig.addCollection("entriesByMonth", function(collectionApi) {
    const grouped = {};
    collectionApi.getFilteredByGlob("src/content/entries/*.md").forEach(entry => {
      const date = DateTime.fromJSDate(entry.data.observed, { zone: "utc" });
      const key = date.toFormat("yyyy-LL");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    });
    return grouped;
  });

  // -----------------------------------------------------
  // Date helper — handle both string dates ("2026-05-13") and JS Date
  // objects (Eleventy converts frontmatter dates to JS Date at UTC midnight).
  // We pin everything to UTC for display so dates don't shift across timezones.
  // -----------------------------------------------------

  function toDT(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === "string") {
      // ISO date string like "2026-05-13" — parse as UTC-anchored
      return DateTime.fromISO(dateValue, { zone: "utc" });
    }
    // JS Date object — interpret in UTC since Eleventy stores frontmatter
    // dates as UTC midnight
    return DateTime.fromJSDate(dateValue, { zone: "utc" });
  }

  // -----------------------------------------------------
  // Filters
  // -----------------------------------------------------

  // Format a date: "Monday, 18 May 2026"
  eleventyConfig.addFilter("longDate", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.toFormat("cccc, d LLLL yyyy") : "";
  });

  // Format the weekday only
  eleventyConfig.addFilter("weekday", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.toFormat("cccc") : "";
  });

  // Format "18 May 2026"
  eleventyConfig.addFilter("dayMonth", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.toFormat("d LLLL yyyy") : "";
  });

  // Format "18 May"
  eleventyConfig.addFilter("dayMonthShort", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.toFormat("d LLL") : "";
  });

  // Format time: "9:06 PM"
  eleventyConfig.addFilter("formatTime", function(timeValue) {
    if (!timeValue) return "";
    // Accept "21:06" or "9:06 PM" format
    if (/AM|PM/i.test(timeValue)) return timeValue;
    const [h, m] = timeValue.split(":");
    const dt = DateTime.fromObject({ hour: parseInt(h), minute: parseInt(m) });
    return dt.toFormat("h:mm a");
  });

  // ISO date for <time datetime="">
  eleventyConfig.addFilter("isoDate", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.toFormat("yyyy-LL-dd") : "";
  });

  // "May 2026"
  eleventyConfig.addFilter("monthYear", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.toFormat("LLLL yyyy") : "";
  });

  // Month-day key for companion lookup: "05-18"
  eleventyConfig.addFilter("monthDay", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.toFormat("LL-dd") : "";
  });

  // Year number (UTC)
  eleventyConfig.addFilter("year", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.year : null;
  });

  // Month number, 1-12 (UTC)
  eleventyConfig.addFilter("monthNum", function(dateValue) {
    const dt = toDT(dateValue);
    return dt ? dt.month : null;
  });

  // Truncate prose to a snippet
  eleventyConfig.addFilter("snippet", function(text, length = 100) {
    if (!text) return "";
    // Strip HTML and markdown
    const stripped = text.replace(/<[^>]*>/g, "").replace(/[#*_\[\]]/g, "").trim();
    if (stripped.length <= length) return stripped;
    return stripped.substring(0, length).trim() + "\u2026";
  });

  // Volume and issue number based on entry index
  eleventyConfig.addFilter("issueNumber", function(collection) {
    if (!collection) return 1;
    return collection.length;
  });

  // -----------------------------------------------------
  // Shortcodes
  // -----------------------------------------------------

  // Calendar for a given month, with entries marked
  eleventyConfig.addShortcode("calendar", function(year, month, entriesByMonth) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const entries = entriesByMonth[monthKey] || [];
    const entryDays = new Set(entries.map(e => DateTime.fromJSDate(e.data.observed, { zone: "utc" }).day));

    const firstDay = DateTime.fromObject({ year, month, day: 1 });
    const daysInMonth = firstDay.daysInMonth;
    const startDow = firstDay.weekday % 7; // Sunday = 0
    const today = DateTime.now();
    const todayDay = (today.year === year && today.month === month) ? today.day : null;

    let html = `<div class="calendar-grid">`;
    html += `<div class="dow">S</div><div class="dow">M</div><div class="dow">T</div><div class="dow">W</div><div class="dow">T</div><div class="dow">F</div><div class="dow">S</div>`;

    for (let i = 0; i < startDow; i++) {
      html += `<div class="day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = (d === todayDay);
      const isScribed = entryDays.has(d);
      const isPast = !isToday && (DateTime.fromObject({ year, month, day: d }) < today.startOf("day"));
      const isFuture = !isToday && !isPast;

      let classes = ["day"];
      if (isScribed) classes.push("scribed");
      if (isToday && isScribed) classes.push("today-marker");
      else if (isPast) classes.push("past");
      else if (isFuture) classes.push("future");

      html += `<div class="${classes.join(" ")}"><span class="day-num">${d}</span></div>`;
    }

    html += `</div>`;
    return html;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"]
  };
};
