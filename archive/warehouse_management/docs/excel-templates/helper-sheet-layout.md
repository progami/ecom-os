# helper sheet - Visual Layout Guide

## Here's exactly how your helper sheet should look:

```
   A                    B              C      D              E         F            G
1  MONDAY DATES SECTION                      ACTIVE COMBINATIONS SECTION
2  Monday_Date          Week_Number          Warehouse      SKU       Batch_Lot    Combination_Count
3  1/6/2025            2                    [Formula pulls unique combinations]   =COUNTA(D3:D)
4  1/13/2025           3                    WH1            SKU001    BATCH001
5  1/20/2025           4                    WH1            SKU001    BATCH002
6  1/27/2025           5                    WH1            SKU002    BATCH001
7  2/3/2025            6                    WH2            SKU001    BATCH001
...continues to row 54                      ...etc

   I                              J
1  SUMMARY STATISTICS
2  
3  Total Mondays:               52
4  Total Combinations:          48
5  Total Storage Ledger Rows:   2,496
6
7  Expected Rows Breakdown:
8  Rows per Monday:             48
9  Rows per Warehouse:          832
```

## The Structure Explained:

**Row 1**: Section titles (just labels to organize the sheet)
**Row 2**: Column headers (actual headers for the data)
**Row 3+**: Data starts here

So:
- A1 = "MONDAY DATES SECTION" (just a title to label this section)
- A2 = "Monday_Date" (the actual column header)
- A3 = First data entry (the date formula)

Think of it like a report where:
- Row 1 has big section titles
- Row 2 has column headers
- Row 3 onwards has the actual data

This makes it easier to see what each section of the helper sheet is for!