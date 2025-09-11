# HRMS Application - Exhaustive UI Elements Inventory

## Overview
This document provides a comprehensive inventory of all interactable UI elements in the HRMS application, organized by page and component.

## Navigation Component (HRMSNavigation.tsx)

### Mobile Menu Toggle
- **Element**: `<button>`
- **Class**: `lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 border border-slate-800`
- **Aria-label**: `Menu`
- **Action**: Toggles mobile menu visibility

### Navigation Links
- **Element**: `<Link>` (Next.js)
- **Routes**: 
  - `/hrms` (Dashboard)
  - `/hrms/employees` (Employees)
  - `/hrms/attendance` (Attendance)
  - `/hrms/freelancers` (Freelancers)
  - `/hrms/documents` (Documents)
  - `/hrms/resources` (Resources)
  - `/hrms/settings` (Settings)

### Mobile Overlay
- **Element**: `<div>`
- **Class**: `lg:hidden fixed inset-0 bg-black/50 z-30`
- **Action**: Closes mobile menu when clicked

## Dashboard Page

### Stats Cards
- **Total Employees Card**
  - Element: `<div>`
  - Class: `gradient-border hover-glow`
  - Visual hover effect only

- **Present Today Card**
  - Element: `<div>`
  - Class: `gradient-border hover-glow`
  - Visual hover effect only

- **On Leave Card**
  - Element: `<div>`
  - Class: `gradient-border hover-glow`
  - Visual hover effect only

- **New Hires Card**
  - Element: `<div>`
  - Class: `gradient-border hover-glow`
  - Visual hover effect only

### Metric Cards
- **Monthly Payroll Card**
- **Work Hours Card**
- **Leave Requests Card**
- All use hover-glow effect

## Employees Page

### Action Buttons
- **Add Employee Button**
  - Element: `<Link>`
  - Href: `/hrms/employees/add`
  - Class: `flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:opacity-90 transition-opacity`

- **Export Button**
  - Element: `<button>`
  - Class: `flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors`

### Search & Filter
- **Search Input**
  - Type: `text`
  - Placeholder: `Search employees by name, email, or ID...`
  - Class: `w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-purple-500 transition-colors`

- **Filters Toggle Button**
  - Element: `<button>`
  - Action: Shows/hides filter panel

### Employee Table Component

#### Table Rows
- **Hover Effect**: `hover:bg-slate-800/50 transition-colors`

#### Action Dropdown
- **Trigger Button**
  - Element: `<button>`
  - Aria-label: `More actions`
  - Class: `p-2 hover:bg-slate-700 rounded-lg transition-colors`

- **Dropdown Menu Items**
  1. View Details - `<Link href="/hrms/employees/${id}">`
  2. Edit - `<Link href="/hrms/employees/${id}/edit">`
  3. Send Email - `<a href="mailto:${email}">`
  4. Call - `<a href="tel:${phone}">`
  5. Delete - `<button>` with `text-red-400`

### Employee Filters Component

#### Filter Dropdowns
1. **Department Select**
   - Options: All Departments, Engineering, Marketing, Sales, HR, Finance

2. **Status Select**
   - Options: All Status, Active, On Leave, Terminated

3. **Employment Type Select**
   - Options: All Types, Full Time, Part Time, Contract, Intern

4. **Join Date Select**
   - Options: All Time, Last 30 Days, Last 3 Months, Last 6 Months, Last Year

## Add Employee Page

### Navigation
- **Back Button**
  - Element: `<Link href="/hrms/employees">`
  - Class: `p-2 hover:bg-slate-800 rounded-lg transition-colors`

### Form Fields

#### Personal Information
- First Name - `<input type="text" required>`
- Last Name - `<input type="text" required>`
- Email - `<input type="email" required>`
- Phone - `<input type="tel">`
- Date of Birth - `<input type="date">`
- Gender - `<select>` (Male, Female, Other, Prefer not to say)

#### Employment Information
- Employee ID - `<input type="text" required>`
- Department - `<select required>`
- Position - `<input type="text" required>`
- Employment Type - `<select required>`
- Join Date - `<input type="date" required>`
- Reports To - `<input type="text">`

#### Compensation
- Salary - `<input type="number">`
- Currency - `<select>` (USD, EUR, GBP, INR)

#### Address
- Street Address - `<input type="text">`
- City - `<input type="text">`
- State/Province - `<input type="text">`
- Postal Code - `<input type="text">`
- Country - `<input type="text">`

#### Emergency Contact
- Name - `<input type="text">`
- Relationship - `<input type="text">`
- Phone - `<input type="tel">`

### Form Actions
- **Cancel Button** - `<Link href="/hrms/employees">`
- **Save Button** - `<button type="submit">` with loading state

## Employee Detail Page

### Header Actions
- **Edit Employee Button**
  - Element: `<Link href="/hrms/employees/${id}/edit">`
  - Class: Gradient button styling

### Contact Information
- **Email Link** - `<a href="mailto:${email}">`
- **Phone Link** - `<a href="tel:${phone}">`

### Tab Navigation
- **Tab Buttons**: Overview, Attendance, Documents, Leaves, Payroll, Performance, Training, Activity
- Element: `<button>` for each tab
- Active tab highlighting

### Overview Tab - Quick Actions
1. Send Email - `<a href="mailto:">`
2. Call - `<a href="tel:">`
3. Schedule Meeting - `<button>`
4. Log Attendance - `<button>`
5. Request Leave - `<button>`

### Attendance Tab
- **Month Navigation**
  - Previous Month - `<button>`
  - Next Month - `<button>`
- **Edit Buttons** - For each attendance record

### Documents Tab
- **Upload Document Button**
- **Document Actions Dropdown** - View, Download, Delete

### Leaves Tab
- **Request Leave Button**
- **View Buttons** - For each leave record

## Freelancers Page

### Actions
- **Add Freelancer Button** - `<Link href="/hrms/freelancers/add">`
- **Search Input** - Placeholder: `Search freelancers by name, email, or skills...`
- **Filters Button**
- **Export Button**

### Freelancer Table
- **Action Dropdown** with same pattern as Employee table

### Freelancer Filters
1. **Category Select** - Full Stack, Frontend, Mobile, Graphics, UI/UX, Content, Marketing, Video
2. **Availability Select** - Available, Busy, Unavailable
3. **Rate Range Select** - $0-50/hr, $50-100/hr, $100-150/hr, $150+/hr
4. **Active Projects Select** - No active projects, 1-2, 3-5, 5+ projects

## Freelancer Detail Page

### Primary Actions
- **Message Button** - `<button>`
- **Hire Now Button** - `<button>` with gradient styling

### Links
- **Portfolio Link** - `<a href="${portfolio}" target="_blank">`
- **Email Link** - `<a href="mailto:">`
- **Phone Link** - `<a href="tel:">`

### Quick Actions
- Schedule Interview - `<button>`
- View Projects - `<button>`
- Send Contract - `<button>`

## Documents Page

### Header Actions
- **Upload Document Button** - Gradient styling
- **Search Input** - Placeholder: `Search documents by name or description...`

### View Mode Toggle
- **Grid View Button** - With FolderOpen icon
- **List View Button** - With FileText icon

### Document Grid Component

#### Grid View Actions
- **More Button** - Opens dropdown
- **Dropdown Items**: View, Download, Delete

#### List View Actions
- **View Button** - Eye icon
- **Download Button** - Download icon
- **Delete Button** - Trash icon with `text-red-400`

### Document Filters
1. **Category Select** - Contracts, Identification, Certifications, Policies, Reports, Other
2. **Owner Type Select** - Employee Documents, Company Documents, Public Documents
3. **Upload Date Select** - Today, This Week, This Month, This Quarter, This Year
4. **File Size Select** - < 1 MB, 1-10 MB, 10-50 MB, > 50 MB

## Resources Page

### Actions
- **Add Resource Button** - Gradient styling
- **Search Input** - Placeholder: `Search resources by title or description...`

### Resource Categories
- **Category Buttons**: All Resources, Handbooks, Policies, Guidelines, Templates, Training, Benefits, Other
- Active category highlighting

### Resources Grid
- **Resource Card Actions**
  - View Button - `<button>`
  - Download Button - `<button>` (hidden for LINK type)

## Attendance Page

### Header Actions
- **Export Report Button** - With Download icon
- **Mark Attendance Button** - Gradient styling

### Filters & Controls
- **Search Input** - Placeholder: `Search by name or employee ID...`
- **Date Picker** - `<input type="date">`
- **View Mode Toggle** - Daily/Monthly buttons
- **Filter Button** - With Filter icon

### Table Actions
- **Edit Button** - `text-purple-400 hover:text-purple-300`

## Settings Page

### Company Settings
- **Company Name Input** - `<input type="text">`
- **Industry Select** - Technology, Healthcare, Finance, Education, Retail, Other
- **Employee ID Prefix Input** - `<input type="text">`

### Department Management
- **Edit Buttons** - For each department
- **Add Department Button** - Dashed border style

### Security Settings (Toggle Switches)
- Two-Factor Authentication - `<input type="checkbox">`
- Password Policy - `<input type="checkbox">`

### Notification Settings (Toggle Switches)
- Email Notifications - `<input type="checkbox">`
- Leave Requests - `<input type="checkbox">`

### Form Actions
- **Save Changes Button** - Gradient styling

## Common UI Patterns

### Button Styles
1. **Primary Actions**: `bg-gradient-to-r from-purple-500 to-pink-500`
2. **Secondary Actions**: `bg-slate-800 border border-slate-700`
3. **Danger Actions**: `text-red-400`

### Input Styles
- Base: `bg-slate-800 border border-slate-700 rounded-lg`
- Focus: `focus:outline-none focus:border-purple-500`

### Interactive Effects
- **Hover States**: Most elements use `hover:` classes
- **Transitions**: `transition-colors`, `transition-opacity`
- **Gradient Borders**: `gradient-border` class
- **Glow Effects**: `hover-glow` class

### Link Types
1. **Internal Navigation**: Next.js `<Link>` component
2. **Email Links**: `mailto:` protocol
3. **Phone Links**: `tel:` protocol
4. **External Links**: `target="_blank"` for portfolio links

### Dropdown Patterns
- Trigger button with icon
- State management for visibility
- Positioned absolutely with z-index
- Click outside to close functionality

### Table Patterns
- Row hover effects
- Action buttons in last column
- Responsive design considerations

## Accessibility Features
- Aria-labels on icon-only buttons
- Required field indicators
- Focus states on all interactive elements
- Semantic HTML elements

## State Management Indicators
- Loading states on buttons
- Active/inactive toggle states
- Selected tab highlighting
- Filter active indicators