# Real-Time Calculation Implementation Test Plan

## Features Implemented

### 1. Debounced Calculation Hook (`/hooks/use-debounced-calculation.ts`)
- Provides a 500ms debounce delay by default
- Queues calculations for changed scenarios
- Tracks pending and calculating states
- Allows cancellation of pending calculations

### 2. Batch Calculation Support (`/hooks/use-calculate-fees-batch.ts`)
- Supports calculating multiple scenarios in parallel
- Handles individual errors without failing the entire batch
- Returns results with success/error status for each scenario

### 3. Enhanced Simulation Grid (`/components/simulation-grid.tsx`)
- **Visual Status Indicators:**
  - 🟡 Amber circle: Unsaved changes
  - 🔵 Blue spinner: Calculating
  - ✅ Green checkmark: Calculated successfully
  
- **Row Highlighting:**
  - Amber background: Rows with unsaved changes
  - Blue background: Rows currently being calculated
  
- **Real-Time Calculation:**
  - Automatically triggers calculation when:
    - Material profile is selected
    - Sourcing profile is selected
    - Sale price is entered
    - Pack size is changed
  - 500ms debounce prevents excessive API calls while typing
  
- **Status Legend:**
  - Shows legend explaining status indicators
  - Indicates when real-time calculation is enabled

### 4. Updated Simulation Studio Page
- Implements `handleCalculateSpecificScenarios` for individual row calculations
- Maintains scenario state for real-time updates
- Supports both individual and batch calculations
- Preserves "Calculate All" button for manual override

## How It Works

1. **User makes changes** to a scenario (price, material, sourcing profile)
2. **Grid marks row** with amber indicator and background
3. **Debounce timer starts** (500ms)
4. **After debounce**, calculation is triggered for changed scenarios
5. **During calculation**, row shows blue spinner and background
6. **After completion**, row shows green checkmark
7. **Errors** are handled gracefully without affecting other rows

## Benefits

- **Responsive UX**: Immediate visual feedback for user actions
- **Efficient**: Debouncing prevents excessive API calls
- **Clear Status**: Users always know the state of their data
- **Flexible**: Can disable real-time calculation if needed
- **Robust**: Individual row errors don't break the entire grid

## Testing Instructions

1. Add multiple scenarios to the grid
2. Change values and observe the status indicators
3. Note the 500ms delay before calculations start
4. Try changing multiple rows quickly - they'll batch together
5. Use "Calculate All" to recalculate everything at once