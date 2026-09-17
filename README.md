# CSV Records App

This is a full-stack Next.js application that displays active records from a CSV file on a web page.

## Project Structure

```
csv-records-app
├── app
│   ├── api
│   │   └── records
│   │       └── route.ts        # API route for fetching records
│   ├── page.tsx                # Main entry point of the application
│   ├── layout.tsx              # Layout component for the application
│   └── globals.css             # Global CSS styles
├── components
│   ├── records-table.tsx        # Interactive records table
│   └── records
│       └── printable-records.tsx # Print-only records table
├── lib
│   ├── pdf
│   │   └── export-records-pdf.ts # PDF export module
│   └── records
│       └── logic.ts             # Filtering, summaries, sorting, and date rules
├── types
│   └── record.ts                # TypeScript interface for record structure
├── package.json                 # npm configuration file
├── tsconfig.json               # TypeScript configuration file
├── next.config.ts              # Next.js configuration file
└── README.md                   # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd csv-records-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000` to view the application.

## Saving OP to Google Sheets

The CSV export URL is read-only. To enable the `Save` button in the `OP` column:

1. Deploy the `google-apps-script/Code.gs` file as a Google Apps Script Web App.
2. Set the deployment to execute as you and allow access to anyone who has the URL.
3. Create `.env.local` with the deployment URL:
   ```
   GOOGLE_SHEET_UPDATE_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
4. Restart the development server.

## Usage

The application fetches records from the `data/records.csv` file and displays them in a table format. You can modify the CSV file to update the records displayed on the web page.

## Contributing

Feel free to submit issues or pull requests for any improvements or bug fixes.