import pandas as pd
import json

# Read the Excel file
df = pd.read_excel('data/cash summary.xlsx', sheet_name=0, header=None)

# Extract the structure
print('=== CASH SUMMARY STRUCTURE ===')
print()

# Header info
print('Header:')
print(f'Title: {df.iloc[0, 0]}')
print(f'Company: {df.iloc[1, 0]}')
print(f'Period: {df.iloc[2, 0]}')
print()

# Month columns
print('Month columns:')
months = [str(df.iloc[4, i]) for i in range(1, 11, 2) if pd.notna(df.iloc[4, i])]
print(months)
print()

# Find section boundaries
sections = []
current_section = None
for idx, row in df.iterrows():
    cell_value = str(row[0]) if pd.notna(row[0]) else ''
    
    # Skip empty or nan values
    if not cell_value or cell_value == 'nan':
        continue
    
    # Identify main sections
    if cell_value == 'Income':
        current_section = 'Income'
        sections.append({'name': 'Income', 'start': idx, 'items': []})
    elif cell_value == 'Less Expenses':
        current_section = 'Expenses'
        sections.append({'name': 'Expenses', 'start': idx, 'items': []})
    elif cell_value == 'Plus Other Cash Movements':
        current_section = 'Other Cash Movements'
        sections.append({'name': 'Other Cash Movements', 'start': idx, 'items': []})
    elif cell_value == 'Plus VAT Movements':
        current_section = 'VAT Movements'
        sections.append({'name': 'VAT Movements', 'start': idx, 'items': []})
    elif cell_value == 'Plus Foreign Currency Gains and Losses':
        current_section = 'Foreign Currency'
        sections.append({'name': 'Foreign Currency', 'start': idx, 'items': []})
    elif cell_value == 'Summary':
        current_section = 'Summary'
        sections.append({'name': 'Summary', 'start': idx, 'items': []})
    elif current_section:
        # Skip totals and subtotals
        skip_words = ['Total', 'Net', 'Plus', 'Surplus', 'Deficit', '[FX]']
        if not any(word in cell_value for word in skip_words):
            # Add line items to current section
            for section in sections:
                if section['name'] == current_section:
                    # Don't add exchange rate lines
                    if not any(curr in cell_value for curr in ['EUR', 'USD', 'PKR', 'SEK']) and not any(date in cell_value for date in ['31', '30', '28']):
                        section['items'].append(cell_value)

# Print structure
for section in sections:
    print(f'\n=== {section["name"]} ===')
    for item in section['items']:
        print(f'  - {item}')

# Extract sample values for May 2025
print('\n\n=== SAMPLE VALUES (May 2025) ===')
for idx, row in df.iterrows():
    account = str(row[0]) if pd.notna(row[0]) else ''
    value = row[1] if pd.notna(row[1]) else None
    
    if account and account != 'nan' and value is not None and isinstance(value, (int, float)):
        print(f'{account}: {value}')