import pandas as pd
from pathlib import Path

# Check the other P&L file
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
file_path = str(DATA_DIR / "TRADEMAN_ENTERPRISE_LTD_-_Profit_and_Loss (1).xlsx")
df = pd.read_excel(file_path, header=None)

# Print the first 15 rows to see the structure
print("=== Excel File: TRADEMAN_ENTERPRISE_LTD_-_Profit_and_Loss (1).xlsx ===")
for i, row in df.head(15).iterrows():
    print(f"Row {i}: {list(row.values)}")

# Also check all other Excel files for 2024 data
print("\n=== Checking all Excel files for 2024 year-end data ===")
import os
import glob

data_dir = str(DATA_DIR)
excel_files = glob.glob(os.path.join(data_dir, "*.xlsx"))

for file in excel_files:
    try:
        df_temp = pd.read_excel(file, header=None)
        file_name = os.path.basename(file)
        
        # Check first 10 rows for date info
        for i, row in df_temp.head(10).iterrows():
            row_str = str(row.values)
            if '2024' in row_str and ('Dec' in row_str or '31' in row_str or 'year' in row_str.lower()):
                print(f"\nFound 2024 year-end data in {file_name}:")
                print(f"Row {i}: {list(row.values)}")
                # Print a few more rows for context
                for j in range(max(0, i-2), min(len(df_temp), i+5)):
                    print(f"Row {j}: {list(df_temp.iloc[j].values)}")
                break
    except Exception as e:
        print(f"Error reading {file}: {e}")
