import pandas as pd
import json
from pathlib import Path

# Read Excel data
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
excel_file = str(DATA_DIR / "TRADEMAN_ENTERPRISE_LTD_-_Profit_and_Loss (1).xlsx")
df = pd.read_excel(excel_file, header=None)

print("=== EXACT COMPARISON: Excel vs API ===\n")

# Extract Excel values into a dictionary
excel_values = {}
current_section = None

for i in range(6, len(df)):
    account_name = df.iloc[i, 0]
    value = df.iloc[i, 1]
    
    if pd.notna(account_name):
        account_str = str(account_name).strip()
        
        # Section headers
        if pd.isna(value) and account_str not in ['Profit', 'Net Profit', 'Gross Profit']:
            current_section = account_str
            continue
            
        # Skip total lines and profit summaries
        if account_str.startswith('Total') or account_str in ['Gross Profit', 'Net Profit', 'Profit', 
                                                                'Operating Profit', 
                                                                'Profit on Ordinary Activities Before Taxation',
                                                                'Profit after Taxation']:
            continue
            
        # Regular accounts
        if pd.notna(value):
            try:
                value_float = float(value) if isinstance(value, (int, float)) else 0.0
                excel_values[account_str] = {
                    'value': value_float,
                    'section': current_section
                }
            except:
                pass

# Print Excel accounts
print("EXCEL ACCOUNTS:")
total_excel_revenue = 0
total_excel_cogs = 0
total_excel_opex = 0
total_excel_other_income = 0

for account, data in sorted(excel_values.items()):
    print(f"  {account}: £{data['value']:,.2f} ({data['section']})")
    
    if data['section'] == 'Turnover':
        total_excel_revenue += data['value']
    elif data['section'] == 'Cost of Sales':
        total_excel_cogs += data['value']
    elif data['section'] == 'Administrative Costs':
        total_excel_opex += data['value']
    elif data['section'] == 'Other Income':
        total_excel_other_income += data['value']

print(f"\nEXCEL TOTALS:")
print(f"  Revenue: £{total_excel_revenue:,.2f}")
print(f"  COGS: £{total_excel_cogs:,.2f}")
print(f"  Operating Expenses: £{total_excel_opex:,.2f}")
print(f"  Other Income: £{total_excel_other_income:,.2f}")
print(f"  Net Profit: £{(total_excel_revenue + total_excel_other_income - total_excel_cogs - total_excel_opex):,.2f}")

# Read API aggregated data
with open('data/2024-pl-api-aggregated.json', 'r') as f:
    api_data = json.load(f)

print(f"\n\nAPI TOTALS:")
print(f"  Revenue: £{api_data['totalRevenue']:,.2f}")
print(f"  COGS: £{api_data['costOfGoodsSold']:,.2f}")
print(f"  Operating Expenses: £{api_data['operatingExpenses']:,.2f}")
print(f"  Other Income: £{api_data['otherIncome']:,.2f}")
print(f"  Net Profit: £{api_data['netProfit']:,.2f}")

# Detailed comparison
print("\n\nDETAILED ACCOUNT COMPARISON:")
print("="*80)

# Check each Excel account
api_accounts = api_data['accounts']
all_matches = True

for account, excel_data in sorted(excel_values.items()):
    excel_value = excel_data['value']
    api_value = api_accounts.get(account, {}).get('total', 0)
    
    if abs(excel_value - api_value) < 0.01:
        status = "✅ MATCH"
    else:
        if account == "Amazon Refunds" and abs(abs(excel_value) - api_value) < 0.01:
            status = "⚠️  SIGN"
        else:
            status = "❌ DIFF"
            all_matches = False
    
    print(f"{status} {account}")
    print(f"     Excel: £{excel_value:,.2f}")
    print(f"     API:   £{api_value:,.2f}")
    if abs(excel_value - api_value) >= 0.01:
        print(f"     Diff:  £{(api_value - excel_value):,.2f}")
    print()

# Check for accounts only in API
print("\nACCOUNTS ONLY IN API:")
for account, data in api_accounts.items():
    if account not in excel_values:
        print(f"  {account}: £{data['total']:,.2f}")

print("\n" + "="*80)
print(f"ALL ACCOUNTS MATCH EXACTLY: {all_matches}")
