import React from 'react';
import type { RecordData } from '../../lib/records/logic';

interface PrintableRecordsProps {
  records: RecordData[];
  columns: string[];
  getRowClassName: (record: RecordData) => string;
  getRowColor: (woNumber: string) => string | undefined;
}

const PrintableRecords: React.FC<PrintableRecordsProps> = ({
  records,
  columns,
  getRowClassName,
  getRowColor,
}) => (
  <section className="print-area" aria-label="Printable work orders">
    <h1>Work Orders</h1>
    <table className="print-table">
      <thead>
        <tr>
          <th>#</th>
          {columns.map((column) => <th key={column}>{column}</th>)}
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => {
          const woNumber = String(record['WO Number'] || '').trim();
          const rowColor = getRowColor(woNumber);

          return (
            <tr key={record['WO Number'] || index} className={getRowClassName(record)}>
              <td>{index + 1}</td>
              {columns.map((column) => (
                <td key={column} style={rowColor ? { backgroundColor: rowColor, color: '#ffffff' } : undefined}>
                  {record[column] || '-'}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  </section>
);

export default PrintableRecords;
