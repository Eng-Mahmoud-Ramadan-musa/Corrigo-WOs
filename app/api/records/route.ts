import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { google } from 'googleapis';

const DEFAULT_GOOGLE_SHEET_CSV_URL =
    'https://docs.google.com/spreadsheets/d/1r30VDn-Ofc4DxqXROBCV0_5exCRuHP3zYsWoPB2oZo8/export?format=csv&gid=0';
const GOOGLE_SHEET_CSV_URL =
    process.env.GOOGLE_SHEET_CSV_URL || DEFAULT_GOOGLE_SHEET_CSV_URL;
const GOOGLE_SHEET_UPDATE_URL = process.env.GOOGLE_SHEET_UPDATE_URL;
const GOOGLE_SHEET_ID =
    process.env.GOOGLE_SHEET_ID ||
    GOOGLE_SHEET_CSV_URL.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];

function normalizeHeader(value?: string) {
    return String(value ?? '').trim().toLowerCase();
}

function getGoogleSheetClient() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !privateKey || !GOOGLE_SHEET_ID) {
        return null;
    }

    const auth = new google.auth.JWT({
        email,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
}

function getGoogleSheetsConfigError() {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
        return 'GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured';
    }

    if (!process.env.GOOGLE_PRIVATE_KEY) {
        return 'GOOGLE_PRIVATE_KEY is not configured';
    }

    if (!GOOGLE_SHEET_ID) {
        return 'GOOGLE_SHEET_ID is not configured';
    }

    return null;
}

function columnToLetter(columnNumber: number) {
    let result = '';
    let current = columnNumber;

    while (current > 0) {
        const remainder = (current - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        current = Math.floor((current - 1) / 26);
    }

    return result;
}

function buildSelectedRecords(records: Record<string, string>[]) {
    const selectedColumns = [
        'WO Number',
        'Occupier',
        'Problem',
        'Category',
        'Created',
        'Last Message',
        'Complete by',
        'OP',
    ];

    return records.map((record) => {
        const completeBy = record['Complete by'];
        let remainingDays: number | null = null;

        if (completeBy?.trim()) {
            const parts = completeBy.trim().split('/');

            if (parts.length === 3) {
                const day = Number(parts[0]);
                const month = Number(parts[1]) - 1;
                const year = Number(parts[2]);
                const deadline = new Date(year, month, day);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                deadline.setHours(0, 0, 0, 0);
                const difference = deadline.getTime() - today.getTime();
                remainingDays = Math.ceil(difference / (1000 * 60 * 60 * 24));
            }
        }

        const selectedRecord: Record<string, string | number | null> = {};

        selectedColumns.forEach((column) => {
            selectedRecord[column] = record[column] ?? '';
        });

        selectedRecord['Deadline'] = remainingDays;
        return selectedRecord;
    });
}

async function readFromGoogleSheets() {
    const sheets = getGoogleSheetClient();
    if (!sheets || !GOOGLE_SHEET_ID) {
        return null;
    }

    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            fields: 'sheets(properties(title))',
        });

        const sheetName =
            spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${sheetName}!A:ZZ`,
        });

        const rows = response.data.values ?? [];
        if (rows.length < 3) {
            return [];
        }

        const headers = rows[2] ?? [];
        const dataRows = rows.slice(3);

        const records = dataRows.map((row) => {
            const record: Record<string, string> = {};
            headers.forEach((header, index) => {
                record[String(header ?? '').trim()] = String(row[index] ?? '');
            });
            return record;
        });

        return buildSelectedRecords(records);
    } catch {
        return null;
    }
}

async function updateOpInGoogleSheet(woNumber: string, op: string) {
    const configError = getGoogleSheetsConfigError();
    if (configError) {
        throw new Error(configError);
    }

    const sheets = getGoogleSheetClient();
    if (!sheets || !GOOGLE_SHEET_ID) {
        throw new Error('Google Sheets client could not be created');
    }

    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        fields: 'sheets(properties(title))',
    });

    const sheetName =
        spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sheetName}!A:ZZ`,
    });

    const rows = response.data.values ?? [];
    if (rows.length < 3) {
        throw new Error('The sheet is empty or the header row is missing.');
    }

    const headers = rows[2] ?? [];
    const woColumn = headers.findIndex(
        (header) => normalizeHeader(header) === 'wo number'
    );

    if (woColumn === -1) {
        throw new Error('WO Number column was not found');
    }

    let opColumn = headers.findIndex(
        (header) => normalizeHeader(header) === 'op'
    );

    if (opColumn === -1) {
        const updatedHeaders = [...headers, 'OP'];
        await sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${sheetName}!3:3`,
            valueInputOption: 'RAW',
            requestBody: {
                values: [updatedHeaders],
            },
        });
        opColumn = updatedHeaders.length - 1;
    }

    const targetRowIndex = rows.findIndex((row, index) => {
        if (index < 3) return false;
        return String(row[woColumn] ?? '').trim() === woNumber.trim();
    });

    if (targetRowIndex === -1) {
        throw new Error('Work order was not found');
    }

    const actualRowNumber = targetRowIndex + 1;
    const targetCell = `${columnToLetter(opColumn + 1)}${actualRowNumber}`;

    await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sheetName}!${targetCell}`,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[op]],
        },
    });

    return true;
}

async function deleteRecordFromGoogleSheet(woNumber: string) {
    const configError = getGoogleSheetsConfigError();
    if (configError) throw new Error(configError);

    const sheets = getGoogleSheetClient();
    if (!sheets || !GOOGLE_SHEET_ID) throw new Error('Google Sheets client could not be created');

    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        fields: 'sheets(properties(sheetId,title))',
    });
    const sheet = spreadsheet.data.sheets?.[0]?.properties;
    if (!sheet?.title || sheet.sheetId === undefined) throw new Error('Google Sheet was not found');

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${sheet.title}!A:ZZ`,
    });
    const rows = response.data.values ?? [];
    const headers = rows[2] ?? [];
    const woColumn = headers.findIndex((header) => normalizeHeader(header) === 'wo number');
    const targetRowIndex = rows.findIndex((row, index) => index >= 3 && String(row[woColumn] ?? '').trim() === woNumber.trim());

    if (woColumn === -1 || targetRowIndex === -1) throw new Error('Work order was not found');

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEET_ID,
        requestBody: {
            requests: [{
                deleteDimension: {
                    range: { sheetId: sheet.sheetId, dimension: 'ROWS', startIndex: targetRowIndex, endIndex: targetRowIndex + 1 },
                },
            }],
        },
    });
}

export async function GET() {
    try {
        const directRecords = await readFromGoogleSheets();
        if (directRecords) {
            return NextResponse.json(directRecords);
        }

        const response = await fetch(GOOGLE_SHEET_CSV_URL, {
            cache: 'no-store',
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Unable to fetch records from Google Sheets' },
                { status: response.status }
            );
        }

        const csv = await response.text();
        const records = parse(csv, {
            columns: true,
            from_line: 3,
            relax_column_count: true,
            skip_empty_lines: true,
        }) as Record<string, string>[];

        return NextResponse.json(buildSelectedRecords(records));
    } catch {
        return NextResponse.json(
            { error: 'Unable to process records' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const woNumber = String(body.woNumber ?? '').trim();
        const op = String(body.op ?? '');

        if (!woNumber) {
            return NextResponse.json(
                { error: 'woNumber is required' },
                { status: 400 }
            );
        }

        try {
            await updateOpInGoogleSheet(woNumber, op);
            return NextResponse.json({ saved: true });
        } catch (error) {
            if (!GOOGLE_SHEET_UPDATE_URL) {
                return NextResponse.json(
                    { error: error instanceof Error ? error.message : 'Unable to save OP to Google Sheets' },
                    { status: 400 }
                );
            }
        }

        if (!GOOGLE_SHEET_UPDATE_URL) {
            return NextResponse.json(
                { error: 'GOOGLE_SHEET_UPDATE_URL is not configured' },
                { status: 503 }
            );
        }

        const response = await fetch(GOOGLE_SHEET_UPDATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                woNumber,
                op,
            }),
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Unable to save OP to Google Sheets' },
                { status: response.status }
            );
        }

        return NextResponse.json({ saved: true });
    } catch {
        return NextResponse.json(
            { error: 'Unable to save OP to Google Sheets' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const woNumber = String(body.woNumber ?? '').trim();

        if (!woNumber) return NextResponse.json({ error: 'woNumber is required' }, { status: 400 });

        await deleteRecordFromGoogleSheet(woNumber);
        return NextResponse.json({ deleted: true });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unable to delete work order' },
            { status: 400 }
        );
    }
}