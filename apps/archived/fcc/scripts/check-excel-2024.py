import pandas as pd
import json
from pathlib import Path

# Read the Excel file
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
file_path = str(DATA_DIR / "TRADEMAN_ENTERPRISE_LTD_-_Profit_and_Loss.xlsx")
df = pd.read_excel(file_path, header=None)

# Print the first 15 rows to see the structure
print("=== Excel File Header ===")
for i, row in df.head(15).iterrows():
    print(f"Row {i}: {list(row.values)}")

# Look for date/period information
print("\n=== Looking for date information ===")
for i, row in df.iterrows():
    row_str = str(row.values)
    if '2024' in row_str or 'Dec' in row_str or 'December' in row_str or '31' in row_str:
        print(f"Row {i}: {list(row.values)}")
        if i > 20:  # Stop after finding a few matches
            break

# Check if this is a year-end report
print("\n=== Checking column headers for dates ===")
if len(df.columns) > 1:
    # Try to find the header row (usually has account names in first column)
    for i in range(min(10, len(df))):
        if pd.notna(df.iloc[i, 0]) and isinstance(df.iloc[i, 0], str):
            if any(keyword in str(df.iloc[i, 0]).lower() for keyword in ['income', 'revenue', 'sales', 'expense']):
                # This might be our data start row, check the row before for headers
                if i > 0:
                    header_row = df.iloc[i-1]
                    print(f"Potential header row {i-1}: {list(header_row.values)}")
                break
