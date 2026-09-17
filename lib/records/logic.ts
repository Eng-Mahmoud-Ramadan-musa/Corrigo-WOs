export type RecordData = Record<string, string>;

export type SummaryCard = {
  key: string;
  label: string;
  matches: (message: string) => boolean;
};

export const EXCLUDED_OCCUPIER = /smart village|maadi cornishe/i;

export function getLastMessage(record: RecordData) {
  return (record['Last Message'] || '').trim().toLowerCase();
}

export function normalizeFilterValue(column: string, value: string) {
  if (column === 'Last Message' && value.toLowerCase().includes('inspection done')) {
    return 'Inspection Done';
  }

  return value;
}

export function isVisibleRecord(record: RecordData) {
  return !EXCLUDED_OCCUPIER.test(record.Occupier || '');
}

export function createSummaryCards(records: RecordData[]) {
  const groupedCards: SummaryCard[] = [
    {
      key: 'offer-shared',
      label: 'Offer Shared',
      matches: (message) => message.includes('offer shared'),
    },
    {
      key: 'approved',
      label: 'Approved',
      matches: (message) => message.includes('approved'),
    },
    {
      key: 'inspection-done',
      label: 'Inspection Done',
      matches: (message) => message.includes('inspection done'),
    },
  ];

  const otherCards = Array.from(new Set(
    records
      .map((record) => String(record['Last Message'] || '').trim())
      .filter(Boolean),
  )).filter((message) => {
    const normalizedMessage = message.toLowerCase();
    return !groupedCards.some((card) => card.matches(normalizedMessage));
  }).map((message): SummaryCard => ({
    key: message.toLowerCase(),
    label: `${message.split(/\s+/).slice(0, 3).join(' ')}${message.split(/\s+/).length > 3 ? '...' : ''}`,
    matches: (currentMessage) => currentMessage === message.toLowerCase(),
  }));

  return [...groupedCards, ...otherCards];
}

export function getInspectionRowColor(record: RecordData) {
  if (!getLastMessage(record).includes('inspection done')) return undefined;

  const op = String(record.OP || '').trim().toLowerCase();
  if (!op) return undefined;
  if (op === 'offer shared') return '#16a34a';
  if (op === 'done') return '#2563eb';
  return '#facc15';
}

export function getCreatedAgeClass(record: RecordData) {
  if (record.Category?.trim().toLowerCase() !== 'request') return '';
  if (!(record['Last Message'] || '').toLowerCase().includes('please check out')) return '';

  const parts = String(record.Created || '').trim().split(/[\/\-]/).map(Number);
  let createdDate: Date;

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [first, second, third] = parts;
    createdDate = first > 31
      ? new Date(first, second - 1, third)
      : new Date(third, second - 1, first);
  } else {
    createdDate = new Date(String(record.Created || ''));
  }

  if (Number.isNaN(createdDate.getTime())) return '';
  createdDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ageInDays = Math.floor((today.getTime() - createdDate.getTime()) / 86_400_000);

  if (ageInDays > 4) return 'record-over-four-days';
  if (ageInDays > 3) return 'record-over-three-days';
  return '';
}

export function sortByDeadline(records: RecordData[], direction: string) {
  if (direction === 'none') return records;

  return [...records].sort((firstRecord, secondRecord) => {
    const firstDeadline = Number(firstRecord.Deadline);
    const secondDeadline = Number(secondRecord.Deadline);
    const firstIsMissing = !Number.isFinite(firstDeadline);
    const secondIsMissing = !Number.isFinite(secondDeadline);

    if (firstIsMissing || secondIsMissing) {
      if (firstIsMissing && secondIsMissing) return 0;
      return firstIsMissing ? 1 : -1;
    }

    return direction === 'ascending'
      ? firstDeadline - secondDeadline
      : secondDeadline - firstDeadline;
  });
}
