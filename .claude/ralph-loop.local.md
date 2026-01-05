---
active: true
iteration: 26
max_iterations: 0
completion_promise: null
started_at: "2026-01-05T01:47:50Z"
---

redesign the entire HRMS

  2. remove custom CSS / buttons and custom code which is prone to bugs

  3. migrate everything to shadcn/ui and following the stack

  LayerChoiceUI Componentsshadcn/uiTablesTanStack TableChartsshadcn/ui charts (Recharts)FormsReact Hook Form + ZodThemingCSS variables in globals.css

  4. use brand colors from other apps (xplan)

  5. ultrathink

  6. test each feature in chrome hrms app (logged in) https://ecomos.targonglobal.com/hrms

  7. find any business logic inconsistencies compared to SOTA HRMS apps - things which are not needed and still exist

  8. keep things lean unless the feature is absolutely needed since its used by a team of 15-20 people
  9. do actualy revampe and verify with chrome, dont just fonts and colors
