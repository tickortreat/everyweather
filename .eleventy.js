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
    const latestDate = DateTime.fromJSDate(new Date(all[0].data.observed)).toISODate();
    return all.filter(e => {
      return DateTime.fromJSDate(new Date(e.data.observed)).toISODate() === latestDate;
    });
  });

  // Entries grouped by month for the calendar
  eleventyConfig.addCollection("entriesByMonth", function(collectionApi) {
    const grouped = {};
    collectionApi.getFilteredByGlob("src/content/entries/*.md").forEach(entry => {
      const date = DateTime.fromJSDate(new Date(entry.data.observed));
      const key = date.toFormat("yyyy-LL");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    });
    return grouped;
  });

  // -----------------------------------------------------
  // Filters
  // -----------------------------------------------------

  // Format a date: "Monday, 18 May 2026"
  eleventyConfig.addFilter("longDate", function(dateValue) {
    if (!dateValue) return "";
    return DateTime.fromJSDate(new Date(dateValue)).toFormat("cccc, d LLLL yyyy");
  });

  // Format the weekday only
  eleventyConfig.addFilter("weekday", function(dateValue) {
    if (!dateValue) return "";
    return DateTime.fromJSDate(new Date(dateValue)).toFormat("cccc");
  });

  // Format "18 May 2026"
  eleventyConfig.addFilter("dayMonth", function(dateValue) {
    if (!dateValue) return "";
    return DateTime.fromJSDate(new Date(dateValue)).toFormat("d LLLL yyyy");
  });

  // Format "18 May"
  eleventyConfig.addFilter("dayMonthShort", function(dateValue) {
    if (!dateValue) return "";
    return DateTime.fromJSDate(new Date(dateValue)).toFormat("d LLL");
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
    if (!dateValue) return "";
    return DateTime.fromJSDate(new Date(dateValue)).toFormat("yyyy-LL-dd");
  });

  // "May 2026"
  eleventyConfig.addFilter("monthYear", function(dateValue) {
    if (!dateValue) return "";
    return DateTime.fromJSDate(new Date(dateValue)).toFormat("LLLL yyyy");
  });

  // Month-day key for companion lookup: "05-18"
  eleventyConfig.addFilter("monthDay", function(dateValue) {
    if (!dateValue) return "";
    return DateTime.fromJSDate(new Date(dateValue)).toFormat("LL-dd");
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
    const entryDays = new Set(entries.map(e => DateTime.fromJSDate(new Date(e.data.observed)).day));

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
