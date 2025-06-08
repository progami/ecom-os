# storage ledger

## Purpose
Automatically generates weekly Monday stock-takes for all warehouse/SKU/batch combinations, calculating storage costs within monthly billing periods.

## Headers for Row 1 (Copy and paste this line into A1, it will split across columns):
```
SL_ID	Week_Ending_Date	Warehouse	SKU	Batch_Lot	Cartons_End_of_Monday	Storage_Pallets_Charged_Week	Applicable_Weekly_Storage_Rate	Calculated_Weekly_Storage_Cost	Billing_Period_Start	Billing_Period_End
```

## Setup Steps

### Step 1: Create Helper Sheet
Follow the 'helper sheet' artifact to set up all required helper data in one place.

### Step 2: Check Total Rows Needed
Look at cell J5 in your helper sheet - this shows total rows needed (typically ~2,500 for a full year with all combinations).

### Step 3: Add Formulas to Storage Ledger

Copy these formulas starting in row 2, then drag down for the number of rows shown in helper sheet J5:

### Column A - SL_ID (A2):
```
=IF(B2="","","SL-"&TEXT(B2,"YYYYMMDD")&"-"&C2&"-"&D2&IF(E2<>"","-"&E2,""))
```

### Column B - Week_Ending_Date (B2):
```
=IFERROR(INDEX('helper sheet'!$A$3:$A,ROUNDUP((ROW()-1)/COUNTA('helper sheet'!$Q$3:$Q),0)),"")
```

### Column C - Warehouse (C2):
```
=IF(B2="","",INDEX('helper sheet'!$Q$3:$Q,MOD(ROW()-2,COUNTA('helper sheet'!$Q$3:$Q))+1))
```

### Column D - SKU (D2):
```
=IF(B2="","",INDEX('helper sheet'!$R$3:$R,MOD(ROW()-2,COUNTA('helper sheet'!$Q$3:$Q))+1))
```

### Column E - Batch_Lot (E2):
```
=IF(B2="","",INDEX('helper sheet'!$S$3:$S,MOD(ROW()-2,COUNTA('helper sheet'!$Q$3:$Q))+1))
```

### Column F - Cartons_End_of_Monday (F2):
```
=IF(B2="","",SUMIFS('inventory ledger'!$H:$H,'inventory ledger'!$C:$C,C2,'inventory ledger'!$D:$D,D2,'inventory ledger'!$E:$E,E2,'inventory ledger'!$A:$A,"<="&B2+TIME(23,59,59))-SUMIFS('inventory ledger'!$I:$I,'inventory ledger'!$C:$C,C2,'inventory ledger'!$D:$D,D2,'inventory ledger'!$E:$E,E2,'inventory ledger'!$A:$A,"<="&B2+TIME(23,59,59)))
```

### Column G - Storage_Pallets_Charged_Week (G2):
```
=IF(F2<=0,0,IFERROR(ROUNDUP(F2/INDEX(FILTER('warehouse config'!$D:$D,('warehouse config'!$B:$B=C2)*('warehouse config'!$C:$C=D2)*('warehouse config'!$G:$G<=B2)*(('warehouse config'!$H:$H>=B2)+ISBLANK('warehouse config'!$H:$H))),1)),0))
```

### Column H - Applicable_Weekly_Storage_Rate (H2):
```
=IFERROR(INDEX(FILTER('cost master'!$E:$E,('cost master'!$B:$B=C2)*('cost master'!$D:$D="Storage cost per pallet / week")*('cost master'!$G:$G<=B2)*(('cost master'!$H:$H>=B2)+ISBLANK('cost master'!$H:$H))),1),0)
```

### Column I - Calculated_Weekly_Storage_Cost (I2):
```
=G2*H2
```

### Column J - Billing_Period_Start (J2):
```
=IF(DAY(B2)<=15,DATE(YEAR(B2),MONTH(B2)-1,16),DATE(YEAR(B2),MONTH(B2),16))
```

### Column K - Billing_Period_End (K2):
```
=IF(DAY(B2)<=15,DATE(YEAR(B2),MONTH(B2),15),DATE(YEAR(B2),MONTH(B2)+1,15))
```

## Step 4: Copy Formulas Down

1. Enter all formulas in row 2
2. Select cells A2:K2
3. Copy and paste (or drag) down for the number of rows indicated in helper sheet cell J5

## Alternative Approach: Filter After Setup

Since dynamically changing combinations per week is very complex in Google Sheets, the practical solution is:

1. **Set up all possible combinations** (as currently designed)
2. **The formulas already calculate correct inventory** - old batches will show 0 cartons after they run out
3. **Use filtering to show only relevant rows**:
   - Add filter to headers (Data > Create a filter)
   - Filter Column F (Cartons_End_of_Monday) to exclude 0 values
   - This automatically hides combinations that didn't exist each week

## Result:
- January weeks show Batches 5,6,7 (with inventory)
- March weeks show Batches 8,9 (Batches 5,6,7 automatically show 0 and are filtered out)
- Historical data preserved but hidden when not needed

This gives you the clean view you want without complex dynamic formulas.

## Monthly Process

The sheet automatically updates as you add inventory transactions. Each Monday's stock level is calculated based on all transactions up to that Monday 23:59:59.