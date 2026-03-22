# Obsidian Plugin Quality Score (0–10) System

## Philosophy

Most scoring systems fail because they conflate **popularity** with **quality**. A plugin with 100k downloads and no updates in 2 years is popular but potentially abandoned. A plugin with 200 downloads, actively maintained, with zero open bugs is high quality but undiscovered.

This system separates these concerns into **5 independent dimensions**, each scored 0–2, summing to a maximum of **10**. A user can glance at the breakdown and understand *why* a plugin scores the way it does.

---

## The Five Dimensions

| Dimension | Weight | What It Captures |
|---|---|---|
| **Adoption** | 0–2 | Real-world usage and community endorsement |
| **Maintenance** | 0–2 | Is the developer actively caring for this plugin? |
| **Stability** | 0–2 | How bug-free and reliable is the plugin? |
| **Maturity** | 0–2 | Has the plugin proven itself over time with consistent evolution? |
| **Community Health** | 0–2 | How well does the developer engage with users and contributors? |

---

## Dimension 1: Adoption (0–2)

**Purpose:** Measure genuine real-world traction, not vanity metrics.

### Minimum Data Threshold

To prevent meaningless ratios at very low scale, several sub-scores in this dimension require minimum thresholds. Plugins with `totalDownloads < 50` receive a flat **Adoption Score of 0.5** (neutral) — there is simply insufficient data to measure adoption meaningfully. All sub-score formulas below assume this threshold has been met.

### Signals Used

**1a. Download Velocity (0–0.8)**

Raw total downloads are meaningless without age context. A plugin with 10k downloads in 2 months is more impressive than 10k over 4 years.

```
pluginAgeDays = max(now - createdAt, 1)
downloadsPerDay = totalDownloads / pluginAgeDays
```

Use a **log-scaled percentile** against all plugins in the ecosystem:

```
rawScore = percentileRank(downloadsPerDay, allPlugins)
```

| Percentile | Score |
|---|---|
| ≥ 90th | 0.8 |
| ≥ 70th | 0.6 |
| ≥ 50th | 0.4 |
| ≥ 30th | 0.2 |
| < 30th | 0.1 |

*Floor of 0.1: even a niche plugin that exists and has some downloads gets minimal credit.*

**1b. Star-to-Download Ratio (0–0.4)**

Stars represent *intentional endorsement*. A high star-to-download ratio means people who try it actively endorse it. This is a proxy for satisfaction.

```
starRatio = stargazers / totalDownloads
```

*Note: No `+1` denominator needed because the minimum data threshold (totalDownloads ≥ 50) guarantees a nonzero denominator.*

This ratio naturally varies by ecosystem scale, so use percentile ranking:

| Percentile | Score |
|---|---|
| ≥ 80th | 0.4 |
| ≥ 60th | 0.3 |
| ≥ 40th | 0.2 |
| ≥ 20th | 0.1 |
| < 20th | 0.0 |

**1c. Recent Download Trend (0–0.8)**

Is adoption growing or dying? Compare recent download velocity to historical, using a **spike-resistant** approach.

```
// Using downloadsPerRelease and PublishedDateOfEveryRelease
// Compute downloads/day for the most recent 3 releases vs the 3 before that

recentReleases = last 3 releases (by PublishedDateOfEveryRelease)
olderReleases = 3 releases before that

recentDownloadsPerDay = sum(recentReleases.downloads) / daySpan(recentReleases)
olderDownloadsPerDay = sum(olderReleases.downloads) / daySpan(olderReleases)

// If fewer than 6 releases exist, compare last half vs first half of releases
// If only 1 release exists, score 0.4 (neutral)
```

**Spike dampening:** To prevent viral spikes from distorting the baseline, cap `olderDownloadsPerDay` at `3× the plugin's lifetime average` before computing the trend ratio. This ensures a one-time spike doesn't set an impossibly high bar for subsequent periods.

```
lifetimeAvgDownloadsPerDay = totalDownloads / pluginAgeDays
olderDownloadsPerDay = min(olderDownloadsPerDay, lifetimeAvgDownloadsPerDay * 3)

trendRatio = recentDownloadsPerDay / (olderDownloadsPerDay + 0.1)
```

*Note: The `+0.1` (rather than `+1`) prevents division by zero without distorting plugins that have very low but nonzero daily downloads.*

| Trend Ratio | Interpretation | Score |
|---|---|---|
| ≥ 2.0 | Strong growth | 0.8 |
| ≥ 1.3 | Growing | 0.6 |
| ≥ 0.8 | Stable | 0.4 |
| ≥ 0.4 | Declining | 0.2 |
| < 0.4 | Dying | 0.0 |

**Adoption Score = 1a + 1b + 1c** (max 2.0)

---

## Dimension 2: Maintenance (0–2)

**Purpose:** Is someone actively looking after this plugin?

### Feature-Complete Plugin Detection

Before scoring sub-dimensions, determine whether a plugin qualifies as **feature-complete**. A plugin is considered feature-complete if ALL of the following are true:

```
isFeatureComplete =
    commitCountInLast24months < 3
    AND openBugs == 0
    AND totalDownloads > 1000
    AND pluginAgeMonths ≥ 12
    AND totalReleases ≥ 3
```

*Rationale: The 5,000-download threshold from the original system excluded many legitimate niche plugins. The revised threshold of 1,000 downloads combined with ≥12 months of age and ≥3 releases provides evidence that the plugin has real users, has been iterated on, and has stabilized — not just been published and forgotten. Zero open bugs confirms users aren't experiencing problems that need fixing.*

If `isFeatureComplete` is true, the entire Maintenance dimension receives a **floor of 1.0** (out of 2.0). Individual sub-scores are still computed; if their sum exceeds 1.0, the actual sum is used. This prevents all three sub-dimensions from independently punishing a finished product.

### Signals Used

**2a. Recency of Last Meaningful Activity (0–0.7)**

Use the **most recent** of: `latestReleaseAt`, `lastCommitDate`.

```
daysSinceActivity = now - max(latestReleaseAt, lastCommitDate)
```

| Days Since Activity | Score |
|---|---|
| ≤ 30 | 0.7 |
| ≤ 90 | 0.55 |
| ≤ 180 | 0.4 |
| ≤ 365 | 0.2 |
| > 365 | 0.05 |

*Note: The `> 365` floor is 0.05 rather than 0.0 — combined with the feature-complete safeguard, this prevents a genuinely stable finished plugin from receiving an absolute zero.*

**2b. Commit Consistency (0–0.6)**

`commitCountInLast24months` tells us volume, but consistency matters more. Since we only have the count (not per-month breakdown), we use a **normalized rate** with protections against inflated counts.

```
effectiveMonths = min(24, pluginAgeMonths)
commitRate = commitCountInLast24months / max(effectiveMonths, 1)  // commits per month
```

**Bot/trivial commit dampening:** If `commitRate ≥ 15`, apply a soft cap. Extremely high commit rates are more likely to reflect automated commits (Dependabot, Renovate), formatting passes, or unsquashed trivial changes than meaningful development. Cap the effective rate:

```
if commitRate > 15:
    commitRate = 15 + log2(commitRate - 14)  // logarithmic scaling above 15
```

| Commits/Month (effective) | Score |
|---|---|
| ≥ 8 | 0.6 |
| ≥ 4 | 0.5 |
| ≥ 2 | 0.4 |
| ≥ 1 | 0.25 |
| ≥ 0.25 | 0.1 |
| 0 | 0.0 |

**2c. Release Cadence (0–0.7)**

Consistent releases signal active development. Compute the regularity of releases over the plugin's lifetime.

```
// Using PublishedDateOfEveryRelease (sorted ascending)
// Compute gaps between consecutive releases

gaps = []
for i in 1..len(releaseDates):
    gaps.append(releaseDates[i] - releaseDates[i-1])

if len(gaps) == 0:
    // Only one release ever
    daysSinceOnlyRelease = now - releaseDates[0]
    if daysSinceOnlyRelease ≤ 90: score = 0.3  // new plugin, benefit of doubt
    else: score = 0.0
else:
    // Filter out same-day releases (hotfixes) to prevent median distortion
    meaningfulGaps = [g for g in gaps if g >= 1]
    
    if len(meaningfulGaps) == 0:
        // All releases were same-day; treat as a single release session
        medianGapDays = daysSinceLastRelease  // fall back to time since last activity
    else:
        medianGapDays = median(meaningfulGaps)
    
    daysSinceLastRelease = now - latestReleaseAt
    cadenceRatio = daysSinceLastRelease / (medianGapDays + 1)
```

Score the median gap:

| Median Gap (days) | Base Score |
|---|---|
| ≤ 30 | 0.7 |
| ≤ 60 | 0.55 |
| ≤ 120 | 0.4 |
| ≤ 240 | 0.25 |
| > 240 | 0.1 |

Apply overdue penalty:

```
if cadenceRatio > 3.0: baseScore *= 0.3   // way overdue
elif cadenceRatio > 2.0: baseScore *= 0.6  // somewhat overdue
elif cadenceRatio > 1.5: baseScore *= 0.8  // slightly overdue
// else: no penalty
```

**Maintenance Score = max(2a + 2b + 2c, featureCompleteFloor)** (max 2.0)

Where `featureCompleteFloor = 1.0` if `isFeatureComplete`, else `0.0`.

---

## Dimension 3: Stability (0–2)

**Purpose:** How reliable is the plugin? Are there many unresolved bugs?

### Minimum Data Threshold

Stability signals from issues are only meaningful if there's enough usage to generate reports. Plugins with `totalDownloads < 100` receive a flat **Stability Score of 1.0** (neutral) — absence of bug reports at this scale tells us nothing.

### Activity-Adjusted Confidence

For plugins that pass the download threshold, the **absence of bug reports** is only credible if the plugin has recent activity or recent issues. If a plugin shows no maintenance activity in over 12 months AND has fewer than 5 total issues ever, stability scores are capped at **1.2** (out of 2.0) — we lack confidence that the absence of reports reflects genuine stability rather than user abandonment.

```
daysSinceActivity = now - max(latestReleaseAt, lastCommitDate)
totalIssuesEver = openIssues_all + closedIssues_all

if daysSinceActivity > 365 AND totalIssuesEver < 5:
    stabilityConfidenceCap = 1.2
else:
    stabilityConfidenceCap = 2.0
```

### Signals Used

This dimension relies heavily on **issue label classification**. The input data says we can account for opening/closing reasons.

**Definitions:**

```
openBugs = openIssues where reason = "bug"
openFeatureRequests = openIssues where reason = "feature_request"
openOther = openIssues where reason = "other" (questions, docs, etc.)

closedFixed = closedIssues where reason ∈ {"completed", "fixed"}
closedWontfix = closedIssues where reason ∈ {"wont_fix", "not_planned"}
closedDuplicate = closedIssues where reason = "duplicate"
closedOther = closedIssues - closedFixed - closedWontfix - closedDuplicate

totalBugsEver = openBugs + closedIssues where original_label = "bug"
```

**3a. Bug Ratio (0–1.0)**

The core stability signal: what fraction of issues are unresolved bugs, normalized by scale?

```
totalIssues = openIssues_all + closedIssues_all
if totalIssues == 0:
    bugRatio = 0  // no issues at all = assume stable (subject to confidence cap)
else:
    bugRatio = openBugs / totalIssues
```

| Bug Ratio | Score |
|---|---|
| 0 (no open bugs) | 1.0 |
| ≤ 0.05 | 0.85 |
| ≤ 0.10 | 0.7 |
| ≤ 0.20 | 0.5 |
| ≤ 0.35 | 0.3 |
| ≤ 0.50 | 0.15 |
| > 0.50 | 0.0 |

**3b. Bug Resolution Effectiveness (0–0.6)**

Of all bugs ever filed, what fraction were actually resolved (not just closed as wontfix)?

```
totalBugsClosed = closedIssues where original_label = "bug"
bugsActuallyFixed = totalBugsClosed where close_reason ∈ {"completed", "fixed"}

if totalBugsEver == 0:
    fixRate = 1.0  // no bugs ever (subject to confidence cap)
else:
    fixRate = bugsActuallyFixed / totalBugsEver
```

| Fix Rate | Score |
|---|---|
| ≥ 0.90 | 0.6 |
| ≥ 0.75 | 0.45 |
| ≥ 0.60 | 0.3 |
| ≥ 0.40 | 0.15 |
| < 0.40 | 0.0 |

**3c. Bug Density (0–0.4)**

A stability proxy: how many open bugs per N users? Fewer bugs per user = more stable software.

```
bugsPer10kDownloads = (openBugs * 10000) / totalDownloads
```

*Note: No `+1` needed — the minimum data threshold guarantees `totalDownloads ≥ 100`.*

| Bugs per 10k DL | Score |
|---|---|
| ≤ 1 | 0.4 |
| ≤ 3 | 0.3 |
| ≤ 7 | 0.2 |
| ≤ 15 | 0.1 |
| > 15 | 0.0 |

**Stability Score = min(3a + 3b + 3c, stabilityConfidenceCap)** (max 2.0)

---

## Dimension 4: Maturity (0–2)

**Purpose:** Has the plugin proven itself over time? Is it a battle-tested tool or an experiment?

### Signals Used

**4a. Age (0–0.5)**

Older plugins have had more time to prove themselves (or fail). This is a gentle bonus, not a dominant factor.

```
ageMonths = (now - createdAt) / 30
```

| Age (months) | Score |
|---|---|
| ≥ 36 | 0.5 |
| ≥ 24 | 0.4 |
| ≥ 12 | 0.3 |
| ≥ 6 | 0.2 |
| ≥ 3 | 0.1 |
| < 3 | 0.05 |

**4b. Release Count (0–0.5)**

More releases = more iteration = more mature. But diminishing returns.

```
releases = totalReleases
```

| Releases | Score |
|---|---|
| ≥ 20 | 0.5 |
| ≥ 12 | 0.4 |
| ≥ 6 | 0.3 |
| ≥ 3 | 0.2 |
| 1–2 | 0.1 |

**4c. Sustained Adoption (0–1.0)**

The most important maturity signal: has the plugin maintained downloads over its lifetime, or was it a flash in the pan?

Divide the plugin's life into **quarters by calendar time** (not by release boundaries). For each calendar quarter, sum the downloads of all releases whose publication date falls within that quarter. If no release falls within a quarter, attribute that quarter's downloads to the release that was current during that period (the most recent release before the quarter started).

```
// Divide [createdAt, now] into equal-length calendar quarters
calendarQuarters = divideLifetimeIntoQuarters(createdAt, now)

// For each quarter, estimate downloads:
// Sum downloads from releases published within the quarter.
// For quarters with no new release, the existing (current) release
// was still accumulating downloads — estimate by interpolation
// from the surrounding releases' downloadsPerRelease.

for each quarter Q:
    releasesInQ = releases where publishedDate ∈ Q.dateRange
    if len(releasesInQ) > 0:
        Q.downloads = sum(releasesInQ.downloads)
    else:
        // Attribute a proportional share of the "current" release's downloads
        currentRelease = most recent release published before Q.startDate
        Q.downloads = currentRelease.downloads * (Q.daySpan / currentRelease.totalDaysAsCurrent)

quarterRates = [Q.downloads / Q.daySpan for Q in calendarQuarters]

if len(calendarQuarters) < 2:
    sustainedScore = 0.5  // too new to judge, neutral
else:
    // Use median rate instead of peak to resist spike distortion
    medianRate = median(quarterRates)
    sustainedQuarters = count(q for q in quarterRates if q >= medianRate * 0.5)
    sustainedFraction = sustainedQuarters / len(calendarQuarters)
```

*Rationale for using median instead of peak: Using the peak quarter as the reference means any viral spike permanently sets an unreachable bar. The median rate represents the plugin's "normal" level of adoption, and checking how many quarters sustain at least half of that is a fair test of consistency.*

| Sustained Fraction | Score |
|---|---|
| ≥ 0.80 | 1.0 |
| ≥ 0.60 | 0.75 |
| ≥ 0.40 | 0.5 |
| ≥ 0.20 | 0.25 |
| < 0.20 | 0.1 |

**Maturity Score = 4a + 4b + 4c** (max 2.0)

---

## Dimension 5: Community Health (0–2)

**Purpose:** How well does the plugin developer interact with the community? Are contributions welcome? Are users heard?

### Signals Used

**5a. Issue Responsiveness (0–0.8)**

Using the optional timeframe data: how quickly are issues closed after being opened?

To prevent fast dismissals of easy issues from masking neglect of hard ones, use a **weighted approach** that accounts for issue type and outliers.

```
// Separate bug issues from non-bug issues
bugCloseTimeDays = [closedAt - createdAt for closedIssues where original_label = "bug"]
allCloseTimeDays = [closedAt - createdAt for all closedIssues]

// Use the 75th percentile instead of median to ensure slow-to-resolve
// complex issues influence the score, not just easy wins
if len(allCloseTimeDays) == 0:
    if openIssues_count == 0: score = 0.4  // no issues at all, neutral
    else: score = 0.1  // issues exist but none closed = bad sign
else:
    p75CloseTime = percentile(allCloseTimeDays, 75)
    
    // If bug-specific data exists and bugs take significantly longer,
    // blend in the bug resolution time
    if len(bugCloseTimeDays) >= 3:
        bugP75 = percentile(bugCloseTimeDays, 75)
        effectiveCloseTime = (p75CloseTime + bugP75) / 2
    else:
        effectiveCloseTime = p75CloseTime
```

| Effective Close Time (days, p75) | Score |
|---|---|
| ≤ 7 | 0.8 |
| ≤ 14 | 0.65 |
| ≤ 30 | 0.5 |
| ≤ 60 | 0.35 |
| ≤ 120 | 0.2 |
| > 120 | 0.1 |

**Dismiss rate modifier:** If most closures are "wont_fix" / "not_planned", fast closure time is less impressive:

```
dismissRate = closedWontfix / max(closedIssues_count, 1)
if dismissRate > 0.5: score *= 0.6
elif dismissRate > 0.3: score *= 0.8
```

**Open issue neglect modifier:** Even if closed issues are resolved quickly, a large backlog of old open issues is a red flag:

```
oldOpenIssues = openIssues where (now - createdAt) > 90 days
if openIssues_count > 0:
    neglectRatio = oldOpenIssues / openIssues_count
    if neglectRatio > 0.7 AND oldOpenIssues >= 3: score *= 0.7
    elif neglectRatio > 0.5 AND oldOpenIssues >= 3: score *= 0.85
```

**5b. PR Engagement (0–0.7)**

How does the maintainer handle community contributions?

```
totalCommunityPRs = openPRs + closedPRs + mergedPRs  // (already filtered: no author/bot/collab)

if totalCommunityPRs == 0:
    prScore = 0.35  // neutral; many good plugins are solo projects
else:
    mergeRate = mergedPRs / totalCommunityPRs
    
    // Also consider PR staleness: how many open PRs are aging?
    stalePRs = openPRs where (now - openPR.createdAt) > 90 days
    staleRatio = stalePRs / max(openPRs, 1)
```

**Addressing the asymmetry between "no PRs" and "all PRs rejected":** A plugin with `mergedPRs = 0` and `closedPRs > 0` (all community PRs rejected) should not score worse than a plugin that never attracted PRs in the first place — *unless* the rejection rate is very high with significant volume. The rationale: reviewing and closing PRs (even with rejection) is still engagement; the low merge rate already reflects the outcome.

```
// If all PRs were rejected but the maintainer at least reviewed them:
if mergeRate == 0 AND totalCommunityPRs > 0:
    baseScore = max(0.2, baseScoreFromTable)  // floor at 0.2, not 0.1
    // Rationale: reviewing and closing is more engagement than no PRs at all
```

Base score from merge rate:

| Merge Rate | Base Score |
|---|---|
| ≥ 0.70 | 0.7 |
| ≥ 0.50 | 0.55 |
| ≥ 0.30 | 0.4 |
| ≥ 0.10 | 0.25 |
| < 0.10 | 0.2 |

Apply stale PR penalty:

```
if staleRatio > 0.5: baseScore *= 0.5
elif staleRatio > 0.3: baseScore *= 0.7
```

Also consider PR response time (time from creation to merge for merged PRs):

```
if mergedPRs > 0:
    medianPRMergeTime = median(mergedPR.mergedAt - mergedPR.createdAt)
    if medianPRMergeTime > 60: baseScore *= 0.85  // slight penalty for slow merges
```

**5c. Feature Request Engagement (0–0.5)**

A subtle signal: if users request features and the maintainer engages, that's healthy. If feature requests pile up unanswered, it's not.

The key distinction is between **engagement** (implementing or thoughtfully explaining why not) and **blanket dismissal**. Both result in closed issues, but they represent different quality of interaction.

```
totalFeatureRequests = openFeatureRequests + closedIssues where original_label = "feature_request"

if totalFeatureRequests == 0:
    balanceScore = 0.25  // neutral
elif totalFeatureRequests < 3:
    balanceScore = 0.25  // insufficient data, neutral
else:
    closedFeatures = closedIssues where original_label = "feature_request"
    implementedFeatures = closedFeatures where close_reason ∈ {"completed", "fixed"}
    dismissedFeatures = closedFeatures where close_reason ∈ {"wont_fix", "not_planned"}
    
    addressRate = closedFeatures / totalFeatureRequests
    
    // Of addressed features, what fraction were actually implemented vs dismissed?
    if closedFeatures > 0:
        implementRate = implementedFeatures / closedFeatures
    else:
        implementRate = 0
    
    // Score based on address rate, then adjust by implementation quality
    // A maintainer who engages with all requests gets base credit;
    // the mix of implemented vs explained determines the final score
    
    engagementScore = addressRate  // 0 to 1
    
    // Weight: 60% for engaging at all, 40% for actually implementing
    qualityAdjustedRate = (engagementScore * 0.6) + (implementRate * 0.4)
```

| Quality-Adjusted Rate | Score |
|---|---|
| ≥ 0.80 | 0.5 |
| ≥ 0.60 | 0.4 |
| ≥ 0.40 | 0.25 |
| ≥ 0.20 | 0.1 |
| < 0.20 | 0.0 |

*Rationale: A maintainer who closes 100% of feature requests as "wont_fix" gets `engagementScore = 1.0` and `implementRate = 0.0`, yielding `qualityAdjustedRate = 0.6` → score of 0.4. This is good (they engaged) but not perfect (they never implemented anything). A maintainer who implements 80% and explains away 20% gets `qualityAdjustedRate = 0.92` → score of 0.5. This correctly differentiates engagement-only from engagement-plus-implementation.*

**Community Health Score = 5a + 5b + 5c** (max 2.0)

---

## Final Score Computation

```
finalScore = Adoption + Maintenance + Stability + Maturity + CommunityHealth
// Range: 0.0 – 10.0
```

### Score Interpretation

| Score | Label | Meaning |
|---|---|---|
| 9.0–10.0 | **Exceptional** | Best-in-class. Actively maintained, stable, widely adopted, community-engaged. |
| 7.5–8.9 | **Excellent** | High quality across most dimensions. Trustworthy for daily use. |
| 6.0–7.4 | **Good** | Solid plugin. May have minor weaknesses in one area. |
| 4.5–5.9 | **Fair** | Functional but has notable gaps (e.g., declining maintenance, some bugs). |
| 3.0–4.4 | **Concerning** | Significant issues in multiple dimensions. Use with caution. |
| 1.5–2.9 | **Poor** | Major problems. Likely abandoned, buggy, or both. |
| 0.0–1.4 | **Critical** | Effectively dead or broken. Avoid. |

---

## Edge Cases & Safeguards

### New Plugin Grace Period
Plugins less than **90 days old** get special treatment:
- Maturity 4c (sustained adoption): automatic 0.5 (neutral, not penalized)
- Maintenance 2c (release cadence): if only 1 release and < 90 days old, score 0.3 instead of 0
- Community Health 5a: if < 5 total issues, score 0.4 (insufficient data)
- Adoption: if totalDownloads < 50, entire dimension scores 0.5 (neutral)
- Stability: if totalDownloads < 100, entire dimension scores 1.0 (neutral)
- The *absence* of data should never be punished for new plugins; it should score neutral

### Minimum Data Thresholds
Several formulas are meaningless at very low scale. The system enforces minimum thresholds rather than relying on `+1` denominators:
- **Adoption dimension:** Requires `totalDownloads ≥ 50`; below this, flat score of 0.5
- **Stability dimension:** Requires `totalDownloads ≥ 100`; below this, flat score of 1.0
- **Community Health 5c:** Requires `totalFeatureRequests ≥ 3`; below this, neutral 0.25
- All ratio formulas operate on guaranteed-nonzero denominators after thresholds are applied

### Solo Developer Plugins
Many excellent Obsidian plugins are one-person projects with zero community PRs:
- Community Health 5b: 0 community PRs = 0.35 (neutral), never 0
- A plugin that receives and reviews PRs but rejects all of them scores 0.2 (floor), which is lower than 0.35 but acknowledges engagement occurred

### Feature-Complete Plugins
Some plugins are feature-complete and intentionally not updated. These should not be punished for low commit rates IF they remain stable:
- If `commitCountInLast24months < 3` AND `openBugs == 0` AND `totalDownloads > 1000` AND `pluginAgeMonths ≥ 12` AND `totalReleases ≥ 3`:
  - Entire Maintenance dimension has a **floor of 1.0** (instead of just 2b having a floor of 0.25)
  - This protects against all three sub-dimensions (2a, 2b, 2c) independently penalizing finished software
  - The 1,000-download threshold (down from 5,000) ensures niche but legitimate plugins qualify

### Abandoned Plugin Detection
Low maintenance combined with low issue activity does not automatically mean "stable":
- Stability dimension applies a **confidence cap of 1.2** when `daysSinceActivity > 365` AND `totalIssuesEver < 5`
- This prevents the system from presenting abandoned plugins as highly stable based solely on the absence of reports

### Viral Spike Protection
A one-time viral spike should not permanently penalize a plugin's trend score:
- Adoption 1c caps the historical baseline at `3× lifetime average downloads/day` before computing trend ratios
- Maturity 4c uses **median quarter rate** (not peak) as the reference for sustained adoption
- Both mechanisms ensure that a plugin returning to healthy-but-not-viral growth after a spike is scored as "stable" (0.4) rather than "dying" (0.0)

### Same-Day Release Handling
Hotfix releases on the same day as a main release should not distort cadence calculations:
- Maintenance 2c filters out gaps of less than 1 day before computing median gap
- If all gaps are same-day, the system falls back to `daysSinceLastRelease` as the cadence reference

### Popularity Bias Protection
The system deliberately avoids making raw download count or star count dominant:
- Downloads only appear in Adoption (max 2/10) and as a denominator in Stability 3c
- Stars only appear as a ratio in Adoption 1b (max 0.4/10)
- A plugin with 500 downloads and perfect scores in Maintenance, Stability, Maturity, and Community Health can still score 8+

---

## Data Requirements Summary

| Data Point | Used In | Required? |
|---|---|---|
| `totalDownloads` | Adoption 1a, 1b; Stability 3c; thresholds | Yes |
| `stargazers` | Adoption 1b | Yes |
| `createdAt` | Adoption 1a; Maturity 4a; thresholds | Yes |
| `latestReleaseAt` | Maintenance 2a, 2c | Yes |
| `lastCommitDate` | Maintenance 2a | Yes |
| `commitCountInLast24months` | Maintenance 2b | Yes |
| `totalReleases` | Maturity 4b; feature-complete check | Yes |
| `PublishedDateOfEveryRelease` | Maintenance 2c; Maturity 4c; Adoption 1c | Yes |
| `downloadsPerRelease` | Adoption 1c; Maturity 4c | Yes |
| `openIssues` (with labels + creation dates) | Stability 3a, 3b, 3c; Community 5a, 5c | Yes |
| `closedIssues` (with labels + close reason + timestamps) | Stability 3a, 3b; Community 5a, 5c | Yes |
| `openPRs` (with creation date) | Community 5b | Yes |
| `closedPRs` | Community 5b | Yes |
| `mergedPRs` (with merge timestamps) | Community 5b | Yes |
| `forks` | *Not used* | No |

### Why Forks Are Excluded
Forks are a noisy signal. People fork repos for many reasons (exploring code, intending to contribute, creating derivatives) and the count doesn't reliably indicate quality, popularity, or health. Every meaningful signal that forks might provide is already captured better by other metrics (PRs for contribution health, stars for endorsement, downloads for usage).

---

## Why This System Works

1. **No single dimension dominates.** A viral but abandoned plugin can't score above 6. A tiny but perfectly maintained plugin can score 8+.

2. **It rewards consistency over spikes.** Download trends use spike-dampened baselines, sustained adoption uses median-based references, and release cadence filters out same-day hotfixes. Plugins that show up reliably over time are rewarded.

3. **It distinguishes "popular" from "good."** Stability and Community Health have nothing to do with download counts.

4. **It handles edge cases honestly.** New plugins get neutral scores (not zeros) for things that simply haven't had time to develop. Solo projects aren't penalized for having no community PRs. Finished software receives a maintenance floor. Abandoned plugins can't fake stability through silence.

5. **It resists gaming.** Commit count inflation hits a log cap. Fast dismissal of easy issues is caught by the p75 metric and open-issue neglect modifier. Closing feature requests as "wont_fix" scores lower than implementing them. The system rewards genuine quality, not metric optimization.

6. **The breakdown is transparent.** Users can see *exactly* why a plugin scored 7.3: maybe it's 1.8 Adoption, 1.9 Maintenance, 1.6 Stability, 0.8 Maturity, 1.2 Community Health. That tells a story no single number can.
