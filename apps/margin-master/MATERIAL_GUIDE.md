# Material Profile Guide

## Quick Start Examples

### 1. Corrugated Cardboard (Standard)
```
Name: Corrugated Cardboard - Single Wall
Country: China
Density: 0.20 g/cm³
Thickness Options: 1.5, 2, 3, 4 mm
Max Sheet: 300cm × 200cm
Cost Unit: Area (per m²)
Cost: $1.80 per m²
MOQ: 50 m²
Setup Cost: $100
Waste Factor: 15%
Rigid: No
Liner Required: No
```

### 2. Bubble Wrap
```
Name: Bubble Wrap - Large Bubbles
Country: US
Density: 0.035 g/cm³
Thickness Options: 3, 5, 10 mm
Max Sheet: 150cm × 100cm (rolls)
Cost Unit: Area (per m²)
Cost: $0.85 per m²
MOQ: 100 m²
Waste Factor: 5%
Rigid: No
Liner Required: No
```

### 3. Kraft Paper
```
Name: Kraft Paper - 80gsm Brown
Country: Canada
Density: 0.80 g/cm³
Thickness Options: 0.1, 0.15, 0.2 mm
Cost Unit: Weight (per kg)
Cost: $1.20 per kg
MOQ: 25 kg
Waste Factor: 8%
Rigid: No
Liner Required: No
```

### 4. Foam Sheets
```
Name: PE Foam - High Density
Country: Mexico
Density: 0.08 g/cm³
Thickness Options: 5, 10, 15, 20 mm
Max Sheet: 200cm × 100cm
Cost Unit: Volume (per m³)
Cost: $85 per m³
MOQ: 5 m³
Waste Factor: 20%
Rigid: No
Liner Required: No
```

### 5. Rigid Plastic Box
```
Name: PP Plastic Sheet - Clear
Country: US
Density: 0.90 g/cm³
Thickness Options: 0.5, 1, 2 mm
Max Sheet: 120cm × 80cm
Cost Unit: Area (per m²)
Cost: $4.50 per m²
MOQ: 20 m²
Setup Cost: $200
Waste Factor: 25%
Max Bend Radius: 5 cm
Rigid: Yes
Liner Required: No
```

## Field Explanations

### Basic Information
- **Name**: Descriptive name including type and specification
- **Country of Origin**: Where material is manufactured (affects tariffs)
- **Density**: Material weight per volume - critical for weight calculations

### Physical Properties
- **Thickness Options**: Available thicknesses from supplier (affects strength & weight)
- **Max Sheet Dimensions**: Largest available size (limits product dimensions)
- **Max Bend Radius**: For rigid materials - minimum radius for bending
- **Rigid**: Whether material can be easily folded
- **Requires Liner**: If inner protective layer is needed

### Cost & Constraints
- **Cost Unit Type**: How supplier charges (area/weight/volume/piece)
- **Cost per Unit**: Base price before waste/MOQ
- **Min Order Quantity (MOQ)**: Minimum purchase amount
- **Setup Cost**: One-time tooling/die costs
- **Waste Factor**: % lost in cutting (increases effective cost)

## Tips for Accurate Data

1. **Density Values**
   - Get from supplier data sheets
   - Or weigh a known volume sample
   - Critical for accurate weight calculations

2. **Waste Factor**
   - Simple rectangles: 5-10%
   - Complex cuts: 15-25%
   - Die-cut shapes: 20-30%

3. **Cost Units**
   - Sheet materials → Area (m²)
   - Rolls/bulk → Weight (kg)
   - Foam/fill → Volume (m³)
   - Pre-cut → Piece

4. **MOQ Impact**
   - Small orders may cost significantly more
   - Consider storage costs vs MOQ savings
   - Factor into pricing strategy

## Common Material Densities

| Material | Density (g/cm³) |
|----------|----------------|
| Corrugated Cardboard | 0.15 - 0.25 |
| Solid Cardboard | 0.60 - 0.90 |
| Kraft Paper | 0.70 - 0.80 |
| Bubble Wrap | 0.02 - 0.05 |
| PE Foam | 0.03 - 0.10 |
| PP/PE Plastic | 0.90 - 0.95 |
| PVC | 1.30 - 1.45 |
| Styrofoam | 0.01 - 0.03 |

## Impact on Calculations

1. **Weight Calculation**
   ```
   Packaging Weight = Surface Area × Thickness × Density
   Total Weight = Product Weight + Packaging Weight
   ```

2. **Cost with Waste**
   ```
   Effective Cost = Base Cost × (1 + Waste Factor)
   ```

3. **MOQ Adjustment**
   ```
   If Order < MOQ:
     Total Cost = MOQ Cost
   ```

4. **Size Tier Impact**
   - Heavier packaging → May push to higher FBA tier
   - Thicker material → Larger overall dimensions
   - Both affect FBA fees significantly