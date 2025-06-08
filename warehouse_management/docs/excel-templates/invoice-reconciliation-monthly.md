# invoice reconciliation

## Purpose
Compares expected costs (from calculated costs ledger) against invoiced amounts (from invoice input) to identify billing discrepancies.

## Headers for Row 1 (Copy and paste this line into A1, it will split across columns):
```
Invoice_Number	Warehouse	Billing_Period_Start	Billing_Period_End	Cost_Category	Cost_Name	Expected_Amount	Invoiced_Amount	Difference	Status	Notes
```

## Manual Input Columns
- **A**: Invoice_Number (should match invoice input)
- **B**: Warehouse 
- **C**: Billing_Period_Start (e.g., 4/16/2025)
- **D**: Billing_Period_End (e.g., 5/15/2025)
- **E**: Cost_Category (should match cost master categories)
- **F**: Cost_Name (should match cost master cost names exactly)
- **K**: Notes (optional - for your comments)

## Formulas

### Cell G2 - Expected_Amount (drag down):
```
=SUMIFS('calculated costs ledger'!R:R,'calculated costs ledger'!J:J,B2,'calculated costs ledger'!E:E,E2,'calculated costs ledger'!S:S,F2,'calculated costs ledger'!H:H,C2,'calculated costs ledger'!I:I,D2)
```

### Cell H2 - Invoiced_Amount (drag down):
```
=SUMIFS('invoice input'!I:I,'invoice input'!B:B,A2,'invoice input'!C:C,B2,'invoice input'!F:F,E2,'invoice input'!G:G,F2,'invoice input'!D:D,C2,'invoice input'!E:E,D2)
```

### Cell I2 - Difference (drag down):
```
=G2-H2
```

### Cell J2 - Status (drag down):
```
=IF(ABS(I2)<0.01,"Match",IF(I2<0,"Overbilled by 3PL","Underbilled by 3PL"))
```

## How to Set Up for Each Invoice:

1. **When you receive an invoice** (around 15th-20th of month):
   - Enter all line items into 'invoice input' sheet
   - Note the billing period (should be 16th of previous month to 15th of current month)

2. **Create reconciliation rows**:
   - One row for each unique combination on the invoice:
     - Warehouse
     - Cost Category
     - Cost Name
   - Use the same billing period dates for all rows from the same invoice

3. **Example setup for a typical invoice**:
   ```
   INV-2025-05-ABC | WH1 | 4/16/2025 | 5/15/2025 | Storage | Storage cost per pallet / week
   INV-2025-05-ABC | WH1 | 4/16/2025 | 5/15/2025 | Inbound | Container unload
   INV-2025-05-ABC | WH1 | 4/16/2025 | 5/15/2025 | Outbound | Pallet shipment
   ```

## Common Issues and Solutions:

### Expected Amount is 0:
- Check that storage ledger has entries for all Mondays in the billing period
- Verify calculated costs ledger has corresponding entries
- Ensure billing period dates match exactly (format matters!)
- Confirm Cost_Name matches exactly between sheets

### Difference shows but amounts look correct:
- Cost names must match EXACTLY (watch for extra spaces)
- Date formats must be consistent
- Check if there are multiple cost rates for the same activity

### To investigate discrepancies:
1. Filter 'calculated costs ledger' by:
   - Warehouse (column J) = your warehouse
   - Billing_Period_Start (column H) = your period start
   - Cost_Name_From_Master (column S) = your cost name
2. This shows all expected costs that should sum to Expected_Amount
3. Compare individual line items with invoice details