# helper sheet

## Purpose
Single sheet containing all helper data for automated storage ledger generation.

## Sheet Structure

### Section 1: Monday Dates (Columns A-B)
**A1**: `MONDAY DATES` (Section title)
**A2**: `Monday_Date` (Column header)
**A3**: `=DATE(2025,1,6)` (First Monday of 2025)
**A4**: `=A3+7` (drag down to A54 for 52 weeks)

**B2**: `Week_Number` (Column header)
**B3**: `=WEEKNUM(A3,2)` (drag down to B54)

### Section 2: Active Combinations (Columns D-F)
**D1**: `ACTIVE COMBINATIONS` (Section title)
**D2:F2**: Column headers (paste this line):
```
Warehouse	SKU	Batch_Lot
```

**D3**: Formula to pull all unique combinations from inventory:
```
=UNIQUE(FILTER('inventory ledger'!C2:E,LEN('inventory ledger'!C2:C)>0))
```

### Section 3: Summary Statistics (Columns H-I)
**H1**: `SUMMARY` (Section title)

**H3**: `Total Mondays:`
**I3**: `=COUNTA(A3:A54)`

**H4**: `Total Combinations:`
**I4**: `=COUNTA(D3:D)`

**H5**: `Total Storage Ledger Rows:`
**I5**: `=I3*I4`

## Storage Ledger Formulas

Reference this helper sheet in your storage ledger:

### Column B - Week_Ending_Date:
```
=IFERROR(INDEX('helper sheet'!$A$3:$A,ROUNDUP((ROW()-1)/COUNTA('helper sheet'!$D$3:$D),0)),"")
```

### Column C - Warehouse:
```
=IF(B2="","",INDEX('helper sheet'!$D$3:$D,MOD(ROW()-2,COUNTA('helper sheet'!$D$3:$D))+1))
```

### Column D - SKU:
```
=IF(B2="","",INDEX('helper sheet'!$E$3:$E,MOD(ROW()-2,COUNTA('helper sheet'!$D$3:$D))+1))
```

### Column E - Batch_Lot:
```
=IF(B2="","",INDEX('helper sheet'!$F$3:$F,MOD(ROW()-2,COUNTA('helper sheet'!$D$3:$D))+1))
```

## Key Points:
- Creates all combinations that have ever existed in inventory
- Old batches will show 0 cartons after they run out
- Filter storage ledger by Cartons > 0 to see only active inventory
- Typically creates ~2,500 rows (52 weeks × ~48 combinations)