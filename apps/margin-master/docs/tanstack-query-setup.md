# TanStack Query Setup Guide

## Installation

TanStack Query is already installed in this project. If you need to install it in a new project:

```bash
npm install @tanstack/react-query
npm install @tanstack/react-query-devtools --save-dev
```

## Setup Overview

### 1. Providers Setup (Already Configured)

The TanStack Query providers are configured in `/app/providers.tsx`:
- QueryClient with default options (staleTime: 60s, refetchOnWindowFocus: false)
- QueryClientProvider wrapping the app
- ReactQueryDevtools for development

### 2. API Endpoints Created

The following API endpoints have been created for the Simulation Studio:

- `/api/materials` - Fetches all active MaterialProfile records
- `/api/sourcing-profiles` - Fetches all SourcingProfile records  
- `/api/metadata` - Fetches countries and programs data

### 3. Custom Hooks

Created reusable hooks in `/hooks/use-simulation-data.ts`:
- `useMaterials()` - Fetches material profiles
- `useSourcingProfiles()` - Fetches sourcing profiles
- `useMetadata()` - Fetches countries and programs

### 4. Simulation Studio Integration

The Simulation Studio page (`/app/simulation-studio/page.tsx`) now uses TanStack Query to:
- Fetch and display materials in the material dropdown
- Fetch and display sourcing profiles in the sourcing profile dropdown
- Fetch and display countries in the marketplace dropdown
- Show loading states while data is being fetched
- Handle errors gracefully with error messages
- Display data status summary showing counts of available data

## Usage

The data fetching is automatic when the page loads. The queries are configured with:
- 5-minute stale time for materials and sourcing profiles
- 10-minute stale time for metadata (countries/programs)
- Automatic error handling
- Loading states

## Next Steps

The simulation grid can now use this data infrastructure by:
1. Accessing the fetched data through the query results
2. Using the selected material and sourcing profile IDs
3. Implementing the simulation calculation logic
4. Displaying results in the grid format