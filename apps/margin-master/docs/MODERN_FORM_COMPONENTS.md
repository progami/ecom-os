# Modern Form Components

This document describes the enhanced form components created for MarginMaster, providing improved UX with floating labels, searchable selects, and consistent form field wrappers.

## Components Overview

### 1. FloatingInput

An enhanced input component with animated floating labels that move up when the field is focused or has a value.

**Features:**
- Animated floating labels
- Support for icons (left side)
- Currency formatting
- Error states with messages
- Helper text support
- Full accessibility support

**Usage:**
```tsx
import { FloatingInput } from '@/components/ui/floating-input'

<FloatingInput
  label="Product Name"
  icon={Package}
  value={value}
  onChange={(e) => setValue(e.target.value)}
  error="Product name is required"
  helperText="Enter a descriptive name"
  required
/>

// Currency input
<FloatingInput
  label="Sale Price"
  type="number"
  currency
  step="0.01"
  value={price}
  onChange={(e) => setPrice(e.target.value)}
/>
```

### 2. SearchableSelect

A combobox component with search functionality, perfect for large option lists.

**Features:**
- Type-to-search functionality
- Option grouping
- Multiple selection support
- Async data loading
- Clear button
- Custom option rendering
- Keyboard navigation
- Mobile-friendly

**Usage:**
```tsx
import { SearchableSelect, type Option } from '@/components/ui/searchable-select'

const options: Option[] = [
  { value: 'electronics', label: 'Electronics', group: 'Physical Products' },
  { value: 'software', label: 'Software', group: 'Digital Products' },
]

<SearchableSelect
  label="Product Category"
  options={options}
  value={category}
  onChange={(value) => setCategory(value)}
  placeholder="Select a category"
  searchPlaceholder="Search categories..."
  multiple={false}
  required
/>

// Multiple selection
<SearchableSelect
  label="Countries"
  options={countries}
  value={selectedCountries}
  onChange={(values) => setSelectedCountries(values)}
  multiple
  maxSelectedItems={3}
/>

// Async loading
<SearchableSelect
  label="Search Suppliers"
  options={asyncSuppliers}
  loading={isLoading}
  loadingText="Searching..."
  onSearch={handleSearch}
/>
```

### 3. FormField

Wrapper components for consistent form field layouts with labels, tooltips, and error handling.

**Components:**
- `FormField` - Standard vertical layout
- `InlineFormField` - Horizontal layout with fixed label width
- `FormSection` - Group related fields with title and description

**Usage:**
```tsx
import { FormField, InlineFormField, FormSection } from '@/components/ui/form-field'

// Standard form field
<FormField
  label="Email Address"
  required
  error={errors.email}
  tooltip="We'll never share your email"
>
  <FloatingInput
    type="email"
    icon={Mail}
    {...register('email')}
  />
</FormField>

// Inline form field
<InlineFormField
  label="Price"
  labelWidth="100px"
  required
>
  <FloatingInput
    type="number"
    currency
    {...register('price')}
  />
</InlineFormField>

// Form section
<FormSection
  title="Product Information"
  description="Basic details about your product"
>
  <FormField label="Name" required>
    <FloatingInput {...register('name')} />
  </FormField>
  <FormField label="Category" required>
    <SearchableSelect options={categories} />
  </FormField>
</FormSection>
```

## Integration with Simulation Studio

The simulation studio has been updated to use these modern components:

1. **Enhanced Grid Component** (`simulation-grid-enhanced.tsx`):
   - Uses `FloatingInput` for numeric and text cells
   - Uses `SearchableSelect` for material and sourcing profile selection
   - Improved visual feedback and animations

2. **Form Dialogs**:
   - Save simulation dialog uses `FloatingInput` for name entry
   - Consistent styling and validation

## Design Principles

1. **Progressive Enhancement**: Components work without JavaScript but provide enhanced experience when enabled
2. **Accessibility First**: Full keyboard navigation, ARIA labels, and screen reader support
3. **Mobile Responsive**: Touch-friendly targets, appropriate input types
4. **Consistent Styling**: Uses design system tokens for colors, spacing, and animations
5. **Error Handling**: Clear error messages with visual indicators

## Animation Details

- **Floating Labels**: 200ms ease-in-out transition
- **Focus States**: Ring animation with primary color
- **Error States**: Red border and text color with fade-in animation
- **Select Dropdown**: Slide and fade animations

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 14+)
- Mobile browsers: Optimized for touch

## Best Practices

1. Always provide labels for accessibility
2. Use appropriate input types (email, tel, number, etc.)
3. Provide clear error messages
4. Use helper text for complex fields
5. Group related fields with FormSection
6. Consider mobile users - use appropriate input modes

## Demo

View the live demo at `/demo/modern-forms` to see all components in action with various configurations and use cases.