# Asset Strategy — controlled rebuild, strategy-first architecture

## Product purpose
Decision-support for a commercial property asset manager. Establish an investment mandate and asset thesis, create credible competing whole-asset business plans, test their unit-level actions and cash flows, then explain the preferred plan and its risks to an investment committee. The tool must **not** select a strategy purely because it has the highest IRR or imply that a quantitative score is professional judgement.

## Canonical workflow
1. **Asset facts:** physical spaces and areas, tenancies and legal events, income, costs, capex history, evidence sources and dates. Facts are immutable from within a scenario; edits to facts flag every scenario for revalidation.
2. **Mandate and asset thesis:** fund style, objectives and priorities, return hurdle, income requirements, capital budget, liquidity/hold period, tolerance for vacancy, execution and covenant risk, constraints, exit thesis. Explicitly record *why the asset is held*, risks to that thesis and what success looks like.
3. **Create scenario:** name, objective, investment horizon and exit approach. Initially a contractual baseline; add alternatives by duplicating a whole scenario.
4. **Unit business plan:** for every physical unit, choose one or more timed actions and explain their purpose, expected occupier response, evidence, dependencies and execution probability. Unchanged units are explicitly marked hold. Each action must link to one or more mandate objectives and identify trade-offs.
5. **Commercial and valuation assumptions:** cash-flow events, ERV, rent-free, void, refurbishment, professional costs, recoverability, yield and evidence. Distinguish market changes from scenario-specific effects; yield judgement is manual and documented. No automatic yield hardening from WAULT.
6. **Appraise and challenge:** unit and asset cash flows; equity/unlevered returns; term-and-reversion exit; sensitivities and downside cases; risks and key assumptions; affordability and execution feasibility. Compare against contractual baseline and across scenarios.
7. **Recommendation:** best *commercially justified* plan, alternatives rejected and why, financial outcomes, mandate alignment, risk-adjusted considerations, key sensitivities, decisions required and implementation milestones. The system may rank NPV mechanically, but must not equate this with a final recommendation.

## Data contracts (version 2)
```js
{
 schemaVersion: 2,
 asset: { id, name, valuationDate, openingValue, units: [{id, name, area}], leases: [{id, unitId, tenant, passingRent, erv, commencement, expiry, breakDates, reviews}], operatingCosts, evidence: [] },
 mandate: { name, style, objectives: [{id, name, priority, successMeasure}], hurdle, holdMonths, capitalBudget, incomeFloor, riskTolerance, constraints: [], assetThesis, exitThesis },
 scenarios: [{
   id, name, objective, status, horizonMonths, exit: { method, disposalCosts, marketShift },
   unitPlans: { [unitId]: { intent, rationale, objectiveIds: [], actions: [{id, type, effectiveDate, parameters, evidenceIds: [], dependencies: [], executionRisk}], yieldAssumptions: { baseYield, amAdjustment, rationale, reviewed } } },
   sharedAssumptions: { marketRentGrowth, costInflation, finance },
   decision: { commercialCase, risks: [], alternatives: [], implementation: [], recommendationStatus }
 }],
 metadata: { sourceVersion, createdAt, updatedAt }
}
```
The contract is an architectural target, not a claim that the existing UI already implements it. A separate migration adapter will map legacy `tenancies`, `options`, `interventions`, `unitYields`, and `marketShifts` without silently losing unknown fields.

## Non-negotiable invariants
- Asset facts are shared and not overwritten by scenario edits.
- Duplicating a scenario deep-copies **all** assumptions and unit plans, generating distinct IDs; changing one never mutates another.
- Every unit is represented in every scenario, even when its plan is hold.
- Financial calculations are pure and repeatable; every output links to its inputs and assumptions.
- Unreviewed market judgements and missing evidence produce visible provisional status.
- Tenant breaks are risks unless expressly modelled as exercised; no assumption of certain exercise.
- Unit valuations sum to the whole-asset exit valuation before whole-asset sale costs.
- Baseline and alternatives use comparable opening value and valuation conventions; hold periods are disclosed where different.
- No automatic recommendation from NPV, IRR or a weighted score alone.
- No silent defaults for critical assumptions. Import/export round trips preserve scenario identities and actions.
- The app must work on iPad and Windows; local-only persistence and its limitations must be clear.

## Design of the new interface
Navigation: **Asset → Investment mandate → Scenarios → Compare → Investment committee**.
The **Scenarios** page has a left scenario list, a persistent scenario header, and a unit-by-unit plan with tabs for Actions, Assumptions, Cash flow, and Risks. A separate overview of the building's leases is under Asset, not another editable 'whole-asset strategy' selector. 'Create', 'Duplicate', 'Save', 'Archive' are scenario operations; 'Save case' remains an explicit whole-project operation. A clear unsaved-change indicator is required.

## Acceptance test
Using the seven-unit demo: set core-plus mandate and priorities; create contractual baseline; duplicate into income security and active letting; edit units and market assumptions independently; confirm contractual facts unchanged; reconcile every unit's receipts, costs and valuation; compare IRR, NPV, downside and mandate fit; produce a report explaining why the preferred option is appropriate **despite** any difference between modelled return and mandate constraints. Reopen a saved case and verify complete fidelity. Test with keyboard/mouse on Windows and touch on iPad.

## Build order
A. Freeze the current deployed application on main; work on `rebuild/strategy-first`.
B. Versioned model and migration adapter, with data-integrity tests.
C. Strategy-first scenario workspace and mandate definition.
D. Connect existing lease engine via an explicit adapter; independently reconcile worked examples and fix engine shortcomings.
E. Compare, sensitivities, decision gate and IC report.
F. Browser and touch acceptance tests; migrate and deploy only after sign-off.

## Existing engine review flags
The legacy engine is a useful starting point, not a certified valuation model. Review the difference between cash-flow lease events and contractual security, treatment of unexercised breaks, reviews and reletting, yield basis, terminal reversion, sale fees, capital expenditure, and scenario comparability. Explicitly distinguish model assumptions from market evidence.
