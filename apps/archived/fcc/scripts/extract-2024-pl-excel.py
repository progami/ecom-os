import pandas as pd
import json

# Read the 2024 year-end P&L file
file_path = "/Users/jarraramjad/Documents/ecom_os/FCC/data/TRADEMAN_ENTERPRISE_LTD_-_Profit_and_Loss (1).xlsx"
df = pd.read_excel(file_path, header=None)

print("=== TRADEMAN ENTERPRISE LTD - Profit and Loss ===")
print("=== For the year ended 31 December 2024 ===\n")

# Extract all the data starting from row 6
accounts = {}
current_section = None
line_items = []

for i in range(6, len(df)):
    account_name = df.iloc[i, 0]
    value = df.iloc[i, 1]
    
    # Skip empty rows
    if pd.isna(account_name) and pd.isna(value):
        continue
    
    # Check if it's a section header (no value)
    if pd.notna(account_name) and pd.isna(value):
        current_section = str(account_name).strip()
        if current_section not in ['Profit', 'Net Profit', 'Gross Profit']:
            print(f"\n{current_section}:")
    # Check if it's a total line
    elif pd.notna(account_name) and pd.notna(value):
        account_str = str(account_name).strip()
        
        # Convert value to float if it's not already
        try:
            if isinstance(value, (int, float)):
                value_float = float(value)
            else:
                value_float = 0.0
        except:
            value_float = 0.0
            
        if account_str.startswith('Total'):
            print(f"  {account_str}: £{value_float:,.2f}")
        elif account_str in ['Gross Profit', 'Net Profit', 'Profit']:
            print(f"\n{account_str}: £{value_float:,.2f}")
        else:
            # Regular account line
            print(f"  {account_str}: £{value_float:,.2f}")
            line_items.append({
                'section': current_section,
                'account': account_str,
                'amount': value_float
            })

# Summary of line items
print(f"\n=== Summary ===")
print(f"Total line items: {len(line_items)}")

# Group by section
from collections import defaultdict
by_section = defaultdict(list)
for item in line_items:
    by_section[item['section']].append(item)

print("\nLine items by section:")
for section, items in by_section.items():
    print(f"  {section}: {len(items)} items")

# Save to JSON for comparison
with open('data/2024-pl-excel-data.json', 'w') as f:
    json.dump({
        'period': 'Year ended 31 December 2024',
        'line_items': line_items,
        'by_section': dict(by_section)
    }, f, indent=2)

print("\nData saved to data/2024-pl-excel-data.json")