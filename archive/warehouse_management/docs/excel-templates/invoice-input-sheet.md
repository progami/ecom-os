# invoice input

## Purpose
Record actual invoice line items received from 3PL partners for comparison against expected costs.

## Headers for Row 1 (Copy and paste this line into A1, it will split across columns):
```
Invoice_Received_Date	Invoice_Number	Warehouse	Billing_Period_Start	Billing_Period_End	Cost_Category	Cost_Name	Invoiced_Quantity	Invoiced_Amount	Notes
```

## All Columns are Manual Input:
- **A**: Invoice_Received_Date (date you received the invoice)
- **B**: Invoice_Number (from the 3PL invoice)
- **C**: Warehouse (must match warehouse names used throughout system)
- **D**: Billing_Period_Start (should be 16th of previous month)
- **E**: Billing_Period_End (should be 15th of current month)
- **F**: Cost_Category (must match categories in cost master, e.g., "Inbound", "Storage", "Outbound")
- **G**: Cost_Name (must match exact cost names in cost master, e.g., "Storage cost per pallet / week", "Container unload", "Pallet shipment")
- **H**: Invoiced_Quantity (quantity from invoice line item)
- **I**: Invoiced_Amount (dollar amount from invoice line item)
- **J**: Notes (optional - any notes about this line item)

## Important Guidelines:

### Data Entry Tips:
1. **One line per invoice line item** - don't combine or summarize
2. **Match naming exactly** - Cost_Category and Cost_Name must match cost master exactly
3. **Consistent date format** - Always use 16th to 15th for billing periods
4. **Include all charges** - Even unexpected ones (you'll investigate in reconciliation)

### Common Invoice Line Items:
- **Storage**: Usually one line per warehouse for total weekly storage charges
- **Inbound**: Container unloads, pallet receiving, etc.
- **Outbound**: Shipments by size (pallet, case, unit)
- **Accessorial**: Special handling, labeling, photos, etc.

### Example Entries:
```
5/31/2025	INV-2025-05-ABC	ABC_Warehouse	4/16/2025	5/15/2025	Storage	Storage cost per pallet / week	485	970	
5/31/2025	INV-2025-05-ABC	ABC_Warehouse	4/16/2025	5/15/2025	Inbound	Container unload	3	450	
5/31/2025	INV-2025-05-ABC	ABC_Warehouse	4/16/2025	5/15/2025	Outbound	Pallet shipment	12	360	
```

## Monthly Process:
1. When invoice arrives (around 15th-20th of month for previous period)
2. Enter each line item from the invoice
3. Ensure billing period matches invoice (16th to 15th)
4. Proceed to invoice reconciliation sheet to compare against expected costs