/**
 * Tooltip bodies for every metric tile.
 *
 * Each entry is an HTML string rendered via `dangerouslySetInnerHTML` inside
 * `MetricHelpTip`. Layout (block bullets, formula code-block) is owned by
 * `TooltipHtml` styling in `MetricHelpTip.tsx` so the whole thing renders the
 * same way no matter what Mantine's `Tooltip` does to a `label` ReactNode.
 *
 * Voice: §10 — short, direct, anti-grind, no behind-the-scenes plumbing.
 */
export const TILE_HELP = {
  commitMomentum: `
    <ul>
      <li>rolling score for your last year of commits</li>
      <li>recent days lift it more; older days still nudge it, just lighter</li>
      <li>not about lines changed or how busy you look to anyone else</li>
    </ul>
    <pre><code>CommitMomentum = Σ RecencyWeight (one term per commit in window)
if ageDays &gt; 365:   RecencyWeight = 0
else:   RecencyWeight = max(0.25, min(1, 1 − 0.75 * ageDays / 365))
ageDays = whole days from commit time to now</code></pre>
  `,

  streak: `
    <ul>
      <li>how many days in a row you actually coded</li>
      <li>weekends and time off can sit outside the count — your call in settings</li>
      <li>tweak the mode if your life doesn’t match the default</li>
    </ul>
    <pre><code>walk backward from today, one calendar day at a time
skip entirely: PTO + public holidays (never extend, never break)
strict: every other calendar day needs ≥1 commit or streak ends
skip-non-workdays + workdays-only: days off vanish from the walk; workdays need commits
longest = max run of streak-eligible days with ≥1 commit in the window</code></pre>
  `,

  weeklyCodingDays: `
    <ul>
      <li>this week: workdays you touched code, out of workdays that counted for you</li>
      <li>pto and holidays shrink the “expected” side on purpose</li>
      <li>the sparkline is the same idea, week by week</li>
    </ul>
    <pre><code>per calendar week, in your local timezone:
expectedDays = workdays in that week, not PTO, not public holiday
activeDays   = expectedDays where you had ≥1 commit
tile shows |activeDays| / |expectedDays|
sparkline = |activeDays| for each of the last 12 weeks</code></pre>
  `,

  consistencyMap: `
    <ul>
      <li>your last year as a grid of days</li>
      <li>deeper color = more commits that day; light = quiet</li>
      <li>pto and holidays read as their own color so rest shows up</li>
    </ul>
    <pre><code>commits_day = commits on that calendar day
cell shade scales with commits_day
same “what counts as a commit” as the rest of this dashboard</code></pre>
  `,

  wlbAudit: `
    <ul>
      <li>when you commit: late nights vs workdays vs the rest</li>
      <li>one weird week doesn’t get to rewrite your whole story</li>
      <li>footers say it plain — no lecture, no shame</li>
    </ul>
    <pre><code>LateNightRatio   = commits 22:00–05:59 / evaluableCommits
NonWorkdayRatio  = commits on your non-workdays / evaluableCommits
evaluableCommits = commits not on PTO or public holiday (for those ratios)
HourHistogram[h] = commits whose local hour is h
longestBreakDays = longest run of non-off-days in a row with zero commits</code></pre>
  `,

  techStack: `
    <ul>
      <li>what your repos lean toward lately, language-wise</li>
      <li>a vibe check, not a ranking</li>
      <li>moves when your work moves — that’s normal</li>
    </ul>
    <pre><code>for each language: bytes = Σ size reported on each repo
only repos with a push in the last 12 months
share = bytes_language / Σ all bytes
show top languages + one “Other” bucket for the long tail</code></pre>
  `,
} as const;

export type TileHelpKey = keyof typeof TILE_HELP;
