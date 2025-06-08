# calculated costs ledger

## Purpose
Calculates the expected cost for every individual billable activity, including both inventory transactions and weekly storage charges, mapped to monthly billing periods.

## Headers for Row 1 (Copy and paste this line into A1, it will split across columns):
```
Calculated_Cost_ID	Transaction_type	Transaction_ID	Cost_Rate_ID	Cost_Type	Transaction_Date	Billing_Week_Ending	Billing_Period_Start	Billing_Period_End	Warehouse	SKU	Batch_Lot	Reference_ID_Source	Quantity_Charged	Applicable_Rate	Calculated_Cost	Cost_Adjustment_Value	Final_Expected_Cost	Cost_Name_From_Master
```

## Manual Input Columns
- **A**: Calculated_Cost_ID (Manual: "CCL-1", "CCL-2", etc.)
- **B**: Transaction_type ("inventory" or "storage")
- **C**: Transaction_ID (Reference to 'inventory ledger'!B:B or 'storage ledger'!A:A)
- **D**: Cost_Rate_ID (Reference to 'cost master'!A:A)
- **N**: Quantity_Charged (Manual for inventory; formula fills for storage)
- **Q**: Cost_Adjustment_Value (Optional - for manual overrides)

## Formulas

### Cell A2 - Calculated_Cost_ID (if you want auto-numbering):
```
="CCL-"&ROW()-1
```

### Cell E2 - Cost_Type (drag down):
```
=IF(D2="","",VLOOKUP(D2,'cost master'!A:C,3,FALSE))
```

### Cell F2 - Transaction_Date (drag down):
```
=IF(B2="storage",VLOOKUP(C2,'storage ledger'!A:B,2,FALSE),IF(B2="inventory",VLOOKUP(C2,'inventory ledger'!B:A,2,TRUE),""))
```

### Cell G2 - Billing_Week_Ending (drag down):
```
=IF(B2="storage",F2,IF(F2="","",F2-WEEKDAY(F2,3)+7))
```

### Cell H2 - Billing_Period_Start (drag down):
```
=IF(B2="storage",VLOOKUP(C2,'storage ledger'!A:J,10,FALSE),IF(B2="inventory",IF(DAY(F2)<=15,DATE(YEAR(F2),MONTH(F2)-1,16),DATE(YEAR(F2),MONTH(F2),16)),""))
```

### Cell I2 - Billing_Period_End (drag down):
```
=IF(B2="storage",VLOOKUP(C2,'storage ledger'!A:K,11,FALSE),IF(B2="inventory",IF(DAY(F2)<=15,DATE(YEAR(F2),MONTH(F2),15),DATE(YEAR(F2),MONTH(F2)+1,15)),""))
```

### Cell J2 - Warehouse (drag down):
```
=IF(B2="storage",VLOOKUP(C2,'storage ledger'!A:C,3,FALSE),IF(B2="inventory",VLOOKUP(C2,'inventory ledger'!B:C,2,FALSE),""))
```

### Cell K2 - SKU (drag down):
```
=IF(B2="storage",VLOOKUP(C2,'storage ledger'!A:D,4,FALSE),IF(B2="inventory",VLOOKUP(C2,'inventory ledger'!B:D,3,FALSE),""))
```

### Cell L2 - Batch_Lot (drag down):
```
=IF(B2="storage",VLOOKUP(C2,'storage ledger'!A:E,5,FALSE),IF(B2="inventory",VLOOKUP(C2,'inventory ledger'!B:E,4,FALSE),""))
```

### Cell M2 - Reference_ID_Source (drag down):
```
=IF(B2="storage","Storage Calc: "&C2,IF(B2="inventory",VLOOKUP(C2,'inventory ledger'!B:G,6,FALSE),""))
```

### Cell N2 - Quantity_Charged (drag down):
```
=IF(B2="storage",VLOOKUP(C2,'storage ledger'!A:G,7,FALSE),"")
```
*Note: Leave blank for inventory transactions - enter manually*

### Cell O2 - Applicable_Rate (drag down):
```
=IF(D2="",0,INDEX(FILTER('cost master'!E:E,('cost master'!A:A=D2)*('cost master'!G:G<=F2)*(('cost master'!H:H>=F2)+ISBLANK('cost master'!H:H))),1))
```

### Cell P2 - Calculated_Cost (drag down):
```
=IF(OR(N2="",O2=""),0,N2*O2)
```

### Cell R2 - Final_Expected_Cost (drag down):
```
=P2+IF(Q2="",0,Q2)
```

### Cell S2 - Cost_Name_From_Master (drag down):
```
=IF(D2="","",VLOOKUP(D2,'cost master'!A:D,4,FALSE))
```

## Usage Instructions:

### For Storage Costs:
1. After creating your storage ledger entries for the month
2. Add rows here with:
   - Transaction_type = "storage"
   - Transaction_ID = SL_ID from storage ledger
   - Cost_Rate_ID = the ID for "Storage cost per pallet / week" from cost master
3. Formulas will auto-populate everything else

### For Inventory Costs:
1. For each inventory transaction that has a cost:
   - Transaction_type = "inventory"
   - Transaction_ID = Transaction_ID from inventory ledger
   - Cost_Rate_ID = appropriate cost from cost master
   - Manually enter Quantity_Charged based on the activity

### Example Entries:
- Storage: `CCL-1 | storage | SL-20250505-WH1-SKU123 | COST-001 | ... (formulas fill rest)`
- Inventory: `CCL-2 | inventory | TXN-001 | COST-002 | ... (formulas fill) ... | 3 | ... (formulas calculate cost)`