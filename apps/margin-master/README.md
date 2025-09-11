# MarginMaster

MarginMaster is a comprehensive Amazon FBA profit margin calculator that helps sellers optimize their product pricing and profitability across multiple European marketplaces.

## Features

### 🔍 Product Margin Calculator
- Real-time profit margin calculations
- Support for multiple Amazon marketplaces (UK, DE, FR, IT, ES, NL, SE, PL, BE, IE, TR)
- Accurate FBA fee calculations including:
  - Fulfillment fees (standard and low-price)
  - Storage fees (monthly and low inventory)
  - Referral fees by category
  - SIPP discount programs
  - Optional services (labeling, bubble wrap, etc.)

### 📊 Simulation Grid (New!)
- Create and compare multiple product scenarios side-by-side
- Visual grid layout for easy comparison
- Save and load simulation sets
- Real-time updates as you modify parameters
- Batch calculations for efficient processing

### 📈 Reference Data Libraries
- **Materials Library**: Manage material costs and properties
- **Sourcing Profiles**: Track supplier information and shipping costs
- **Amazon Fee Tables**: Browse all FBA fees by marketplace

### 💾 Data Management
- Import fee data from Excel files
- Built-in data validation and analysis tools
- Persistent storage with PostgreSQL

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/marginmaster.git
cd marginmaster
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your database credentials:
```
DATABASE_URL="postgresql://user:password@localhost:5432/marginmaster"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3007"
```

4. Set up the database:
```bash
npm run db:generate
npm run db:push
npm run db:setup
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3007](http://localhost:3007) to access the application.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:seed` - Import Amazon fee data from Excel
- `npm run db:reset` - Reset database
- `npm run db:setup` - Reset and seed database
- `npm run analyze:fees` - Analyze fee data integrity
- `npm run analyze:ie-fees` - Investigate Ireland fee anomalies

## Project Structure

```
marginmaster/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── calculator/        # Main calculator page
│   ├── simulation-studio/ # Simulation grid interface
│   ├── amazon-fees/       # Fee reference tables
│   ├── materials/         # Materials management
│   └── sourcing/          # Sourcing profiles
├── components/            # React components
├── lib/                   # Utilities and shared logic
├── prisma/                # Database schema and migrations
├── scripts/               # Data import and analysis scripts
└── public/                # Static assets
```

## Key Technologies

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: React Query
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Forms**: React Hook Form with Zod validation

## Known Issues

- Ireland (IE) marketplace shows an anomaly where 0-0.15kg standard parcels have a higher fee (€3.26) than 0.15-0.4kg (€1.87). This appears to be sourced from Amazon's official rate card.
- Some composite countries (e.g., "NL/BE/IE") may have inconsistent fee structures.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.