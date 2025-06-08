# storage ledger - Simple Automated Setup

## Step 1: Create Helper Sheets

### Sheet: "monday_dates"
In A1: `Monday_Date`
In A2: `=DATE(2025,1,6)` (or your first Monday)
In A3: `=A2+7` (drag down for ~20-30 rows for 5-6 months)

### Sheet: "active_combinations" 
In A1: 
```
={"Warehouse","SKU","Batch_Lot";UNIQUE(FILTER('inventory ledger'!C2:E,LEN('inventory ledger'!C2:C)>0))}
```

## Step 2: Calculate How Many Rows You'll Need

In any empty cell on storage ledger sheet:
```
="Total rows needed: "&COUNTA('monday_dates'!A2:A)*COUNTA('active_combinations'!A2:A)
```

This tells you exactly how many rows to create formulas for.

## Step 3: Fill Storage Ledger Columns

### Column B - Week_Ending_Date (starting in B2):
```
=IFERROR(INDEX('monday_dates'!$A$2:$A,ROUNDUP((ROW()-1)/COUNTA('active_combinations'!$A$2:$A),0)),"")
```

### Column C - Warehouse (starting in C2):
```
=IF(B2="","",INDEX('active_combinations'!$A$2:$A,MOD(ROW()-2,COUNTA('active_combinations'!$A$2:$A))+1))
```

### Column D - SKU (starting in D2):
```
=IF(B2="","",INDEX('active_combinations'!$B$2:$B,MOD(ROW()-2,COUNTA('active_combinations'!$A$2:$A))+1))
```

### Column E - Batch_Lot (starting in E2):
```
=IF(B2="","",INDEX('active_combinations'!$C$2:$C,MOD(ROW()-2,COUNTA('active_combinations'!$A$2:$A))+1))
```

### Column A - SL_ID (starting in A2):
```
=IF(B2="","","SL-"&TEXT(B2,"YYYYMMDD")&"-"&C2&"-"&D2&IF(E2<>"","-"&E2,""))
```

### Column F - Cartons_End_of_Monday (starting in F2):
```
=IF(B2="","",SUMIFS('inventory ledger'!$H:$H,'inventory ledger'!$C:$C,C2,'inventory ledger'!$D:$D,D2,'inventory ledger'!$E:$E,E2,'inventory ledger'!$A:$A,"<="&B2+TIME(23,59,59))-SUMIFS('inventory ledger'!$I:$I,'inventory ledger'!$C:$C,C2,'inventory ledger'!$D:$D,D2,'inventory ledger'!$E:$E,E2,'inventory ledger'!$A:$A,"<="&B2+TIME(23,59,59)))
```

## Step 4: Copy Formulas Down

Drag all formulas down for the number of rows calculated in Step 2.

## Example Calculation:
- 20 Mondays (5 months of Mondays)
- 25 unique Warehouse/SKU/Batch combinations
- Total rows = 20 × 25 = 500 rows

## The Pattern Created:
```
Row 2: Monday 1, Combination 1
Row 3: Monday 1, Combination 2
Row 4: Monday 1, Combination 3
...
Row 26: Monday 1, Combination 25
Row 27: Monday 2, Combination 1
Row 28: Monday 2, Combination 2
...and so on
```

## Tips:
1. The formulas use MOD to cycle through combinations
2. ROUNDUP distributes Mondays across all combinations
3. After setup, you can filter to hide rows where F (cartons) = 0
4. These formulas are simple enough for Google Sheets to handle even with 1000+ rows