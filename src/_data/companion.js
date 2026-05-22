/**
 * Historical companion corpus.
 *
 * Each key is "MM-DD". Each value is an array of historical journal
 * entries known to be from that calendar date. The companion layer
 * picks one to display alongside each scribed entry on the same date.
 *
 * IMPORTANT: Only include verified entries with citations to primary
 * sources. The companion is the project's claim that we are continuous
 * with older records of attention — falsifying that claim by inventing
 * quotes would corrupt the archive's integrity.
 *
 * Verified sources used so far:
 *   - The Walden Woods Project's Thoreau Log (walden.org/thoreaus-log)
 *   - The 1906 Torrey/Allen edition of Thoreau's Journal (public domain)
 *
 * Pending future verification: Gilbert White, Susan Fenimore Cooper,
 * John Burroughs, the Old Farmer's Almanac historical archive.
 */

module.exports = {
  "05-13": [
    {
      text: "Surveying Damon's Acton lot \u2026 Apple in bloom.",
      author: "Henry David Thoreau",
      source: "Journal, Volume 12, p. 187",
      year: 1859,
      location: "Concord, Massachusetts",
      citation_url: "https://www.walden.org/log-entry/13-may-1859-concord-mass/"
    }
  ]

  // Future entries will be added here as they are verified.
  // Template for each entry:
  //
  // "MM-DD": [
  //   {
  //     text: "...",
  //     author: "...",
  //     source: "...",
  //     year: ...,
  //     location: "...",
  //     citation_url: "..."
  //   }
  // ]
};
