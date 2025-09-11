---
description: "Comprehensively verify ALL hyperlinks in e2.html including TOC and cross-references"
allowed-tools: all
---
Any temporary files created during analysis should be placed in appropriate folders or deleted afterwards.
ULTRATHINK deeply about all hyperlink structures in e2.html - not just the table of contents, but EVERY internal link throughout the document.

Use TodoWrite to create a comprehensive verification plan, then deploy multiple Task agents to:

**Phase 1: Extract & Analyze ALL Hyperlinks**
Deploy Task agents to:
1. Extract complete TOC structure with all links
2. Find ALL internal links throughout the document (href="#...")
3. Map all element IDs (id="...") that can be link targets
4. Identify cross-references between sections (e.g., "see Section 3.2")
5. Extract links in tables, figures, and inline text
6. Build complete link dependency graph

**Phase 2: Comprehensive Link Validation** 
Launch parallel Task agents to verify:

*Table of Contents Links:*
1. Every TOC link points to an existing section ID
2. All major sections appear in the TOC
3. Section numbering sequence is correct
4. Heading text in TOC matches actual section headings
5. Sub-section hierarchy and indentation are proper

*All Other Internal Links:*
1. Every href="#xxx" link has a corresponding id="xxx"
2. Cross-references to tables/figures are valid
3. "See Section X.X" references point to real sections
4. Footnote/endnote links work bidirectionally
5. Navigation links (if any) function correctly
6. No broken fragment identifiers exist

**Phase 3: Cross-Reference Analysis**
1. Ensure Tables and Figures referenced in TOC exist
2. Verify appendices and supplementary sections
3. Check that TOC depth matches document structure
4. Validate internal cross-references between sections

**Phase 4: Present Findings & Get Approval**
PRESENT comprehensive report to user with:
- All broken links found (with line numbers)
- Proposed fixes for each issue
- Impact analysis of changes
- Risk assessment

**CRITICAL: STOP and WAIT for user approval before proceeding to Phase 5**

State clearly: "I've identified [X] issues. Would you like me to proceed with the fixes?"

**Phase 5: Fix All Issues (ONLY AFTER USER APPROVAL)**
If user approves, use MultiEdit to batch fix:

*TOC Fixes:*
1. Update broken TOC links to correct section IDs
2. Add missing sections to TOC
3. Fix section title mismatches
4. Correct numbering sequences
5. Adjust hierarchy and indentation

*Document-Wide Link Fixes:*
1. Fix all broken internal links throughout document
2. Update cross-references to match actual section numbers
3. Correct table/figure reference links
4. Add missing IDs for orphaned links
5. Ensure bidirectional links work (e.g., footnotes)
6. Standardize link formatting and conventions

**Phase 6: Final Verification (After Fixes)**
Run comprehensive test to ensure:
- All links are clickable and lead to correct sections
- Document navigation flows logically
- No broken references remain
- TOC provides complete document overview

Use ultrathinking to understand the document's logical flow and ensure the TOC serves as an effective navigation tool for readers, especially for E-2 visa officers reviewing the business plan.

Generate comprehensive report with:
- Complete link audit results (TOC + all internal links)
- Count of broken links found and fixed by type
- Cross-reference validation summary
- Link coverage map showing document connectivity
- Navigation flow assessment
- Specific fixes applied with before/after examples
- Recommendations for improving document structure and navigation