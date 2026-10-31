# Calculator review pack for Frank

The calculator is a reproducible planning model, not SAP-approved commercial pricing. Its single rate source is `src/pricing.js` (`PRICING`, version `demo-2026.10`). English/French, the PDF and the private API use this same engine; the API recomputes the result rather than trusting a browser-supplied price. No AI model sets prices. The visitor's budget, referral and discovery notes do not alter the formula.

## What Frank should supply

Complete `docs/frank-rate-review.csv`, and return representative completed-job examples: scope, actual net area, phases and visits, crew/headcount, productive hours, travel, equipment/disposal costs, billed amount before tax, difficult conditions and overruns. Five to ten varied jobs are more useful for calibration than one average price per square foot. Identify who approves rates, their effective date, minimum charge and uncertainty range. No credentials or client personal information belong in the worksheet.

Decide whether the public estimator should remain illustrative, show an SAP-approved indicative range, or require a site review for particular sectors. Confirm the actual loading of the hourly rate and the intended profit method: the current 15% is a **markup on direct cost plus overhead**, not a 15% gross margin.

## Exact calculation

All internal areas are square feet. `1 m² = 10.7639104167 sq ft`; lengths in metres convert to feet before multiplication. Room mode sums each room's dimensions or entered area once. Project mode uses the entered total cleanable area once. Gross area and common area are checks/context; common areas are already included in that total. Floors and unit count are descriptive, not multipliers. Repeated units must already be included in the entered total. Multiple phases cause their own cleaning labour calculation; increasing visits adds mobilization and travel, not an automatic repeat of every phase.

For each selected phase:

```
base phase hours = sum over applicable areas:
  area / production[phase][category]
  × ceiling factor × fixture-density factor × floor factor

final-phase additions = washrooms × 1.5 h
                      + kitchens × 2.5 h
                      + interior glazing area / 120 sq ft per h

site factor = product of selected dust, debris, residue, access,
              sensitivity, urgency, working-hours and loading factors,
              plus no-elevator, no-water, no-power and occupied factors

phase hours = (base phase hours + final-phase additions, if final) × site factor
visits = max(number of phases, ceil(requested visits))
labour hours = sum(phase hours) + visits × 3 mobilization hours
crew days = labour hours / (4 people × 8 hours)
```

Current cost components:

```
labour = labour hours × CAD 46
 equipment = ceil(crew days) × CAD 85
 disposal = ceil(crew days) × CAD 140
 consumables = area × CAD 0.03 × number of phases
 travel = visits × CAD 120
 options = sum(selected flat amounts or total area × option rate)
 direct = labour + equipment + disposal + consumables + travel + options
 overhead = direct × 12%
 markup = (direct + overhead) × 15%
 midpoint = max(CAD 650, direct + overhead + markup)
 low = max(CAD 650, midpoint × 88%)
 high = midpoint × 112%
```

No sales tax is added. The range is therefore not symmetric when the lower end hits the minimum. Equipment/disposal use rounded-up crew days; labour keeps its unrounded hours. Phase dollar amounts allocate the **complete midpoint** in proportion to phase cleaning hours; they are not labour-only invoices. The brochure displays a cent-rounding adjustment when individually rounded cost lines differ by a cent from the rounded midpoint. Exact unrounded results and inputs are attached inside each PDF as `estimate-data.json`.

Interior glazing adds labour by its measured area in the final phase. Visible optional services include tracks, millwork, floor scrubbing, carpet, adhesive removal, accessible high dusting, stairs, elevators, parking and deficiency visits. Review whether whole-area option allowances are appropriate: they are simplified planning assumptions, not measured quantities for each surface. Specialist options and unavailable services trigger assessment flags, not a promise that the work is safe or included commercially.

## Measurement and plan safeguards

Hard errors reject missing/invalid areas, cleanable area larger than gross area, common area larger than the included total, and inconsistent dates. Unusual sizes require correction or explicit confirmation; editing relevant measurements invalidates that confirmation. Review thresholds are in `src/measurement-checks.js`: residential projects 200–8,000 sq ft per entered unit; other projects 100–250,000; residential rooms 20–1,500; other rooms 15–25,000. Additional checks cover cleanable area below 8% of gross and implausible fixture density. These thresholds are prompts for review, not proof that a number is wrong; a plausible 1,000 entered as 10,000 cannot always be detected from one number.

Optional plan review reads printed information from one chosen page. Non-overlapping ownership cores plus padded overlapping tiles preserve coverage and context. Printed text, units, normalized readings, approximate locations, room links, entered values and human decisions remain separate. Outer footprint dimensions do not establish net cleanable area. Unknown units, ambiguous associations, conflicting overlap readings and missing room matches require review. A page is compared with a whole project only when the visitor says it represents that whole project. Measurements are never silently replaced by AI output. A flagged exception remains visible for consultation.

## Worked reference cases

The synthetic base journeys produced the following before-tax results with their recorded conditions/options; these are regression examples, not SAP prices. The complete inputs are retained privately in the audit evidence, and each brochure contains its own inputs.

| Case | Cleanable area | Midpoint CAD | Range CAD |
|---|---:|---:|---:|
| Montréal ten-room condo; final; tracks | 1,500 sq ft | 1,609.38 | 1,416.25–1,802.50 |
| Laval commercial; three phases; heavy conditions | 8,000 sq ft | 11,696.38 | 10,292.81–13,099.94 |
| Ottawa fitness; final/touch-up; delicate finishes | 240 m² | 3,033.99 | 2,669.91–3,398.06 |
| Toronto office; rough/final; urgent/off-hours; no water | 25,000 sq ft | 26,346.08 | 23,184.55–29,507.61 |
| Gatineau renovation; final; light dust | 1,000 sq ft | 1,193.98 | 1,050.70–1,337.25 |

Any later corrected scope gets a new result and document ID. Keep the earlier result in the audit trail rather than rewriting it as though the original input had been different. After Frank returns the worksheet, change rates centrally, increment their version, rerun the numerical/PDF/browser checks and confirm the public wording before publishing approved commercial assumptions.
