import { IconTrash } from '@tabler/icons-react';
import React, { useState } from 'react';

interface RecordsTableProps {
  records: Array<Record<string, string>>;
  columns?: string[];
  filterValues?: Record<string, string[]>;
  columnFilters?: Record<string, string[]>;
  onColumnFilterChange?: (column: string, value: string, multiSelect?: boolean) => void;
  onOpChange?: (woNumber: string, value: string) => void;
  onOpSave?: (woNumber: string) => void;
  onDeleteRow?: (woNumber: string) => void;
  onRowClick?: (woNumber: string) => void;
  getRowColor?: (woNumber: string) => string | undefined;
  savingOp?: string | null;
  getRowClassName?: (record: Record<string, string>) => string;
}

const RecordsTable: React.FC<RecordsTableProps> = ({
  records,
  columns: providedColumns,
  filterValues = {},
  columnFilters = {},
  onColumnFilterChange,
  onOpChange,
  onOpSave,
  onDeleteRow,
  onRowClick,
  getRowColor,
  savingOp,
  getRowClassName,
}) => {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [multiSelectColumn, setMultiSelectColumn] = useState<string | null>('Occupier');
  const columns = providedColumns ?? (records.length > 0
    ? Object.keys(records[0]).filter((column) => column.trim() !== '')
    : []);

  const getColumnWidth = (column: string) => {
    const weights: Record<string, number> = {
      'WO Number': 1.4,
      Occupier: 2,
      Category: 1.2,
      Problem: 4.5,
      'Last Message': 1.2,
      OP: 2,
      Created: 1.1,
      Deadline: 0.9,
    };
    const totalWeight = columns.reduce((total, currentColumn) => total + (weights[currentColumn] ?? 1.2), 0);
    const columnWeight = weights[column] ?? 1.2;

    return `${(columnWeight / totalWeight) * 89}%`;
  };

  return (
    <div className="table-scroll">
      <table className="records-table" aria-label="Work Orders Table">
        <colgroup>
          <col className="row-number-column" style={{ width: '5%' }} />
          {columns.map((column) => <col key={column} style={{ width: getColumnWidth(column) }} />)}
          <col className="actions-column" style={{ width: '6%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="row-number-header">#</th>
            {columns.map((column) => (
              <th className="table-header-cell" key={column}>
                <span>{column}</span>
                <span className="column-filter-trigger">
                  <button
                    type="button"
                    className={`column-filter-button ${columnFilters[column] ? 'is-active' : ''}`}
                    aria-label={`Filter ${column}`}
                    aria-expanded={openFilter === column}
                    onClick={() => setOpenFilter(openFilter === column ? null : column)}
                  >
                    <span aria-hidden="true">&#x25BC;</span>
                  </button>
                  {openFilter === column && (
                    <div className="column-filter-menu">
                    {column === 'Occupier' && (
                      <button
                        type="button"
                        className={`column-filter-option ${multiSelectColumn === column ? 'is-selected' : ''}`}
                        aria-pressed={multiSelectColumn === column}
                        onClick={() => setMultiSelectColumn((current) => current === column ? null : column)}
                      >
                        {multiSelectColumn === column ? 'Multi-select: On' : 'Multi-select: Off'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="column-filter-option"
                      onClick={() => {
                        onColumnFilterChange?.(column, '');
                        setOpenFilter(null);
                      }}
                    >
                      All
                    </button>
                    {(filterValues[column] ?? []).map((value) => multiSelectColumn === column ? (
                      <label
                        className={`column-filter-option ${columnFilters[column]?.includes(value) ? 'is-selected' : ''}`}
                        key={value}
                      >
                        <input
                          type="checkbox"
                          checked={columnFilters[column]?.includes(value) ?? false}
                          onChange={() => onColumnFilterChange?.(column, value, true)}
                        />
                        {value}
                      </label>
                    ) : (
                      <button
                        type="button"
                        className={`column-filter-option ${columnFilters[column]?.includes(value) ? 'is-selected' : ''}`}
                        key={value}
                        aria-pressed={columnFilters[column]?.includes(value) ?? false}
                        onClick={() => {
                          onColumnFilterChange?.(column, value, false);
                          setOpenFilter(null);
                        }}
                      >
                        {value}
                      </button>
                    ))}
                    {column === 'Occupier' && (
                      <button type="button" className="column-filter-option" onClick={() => setOpenFilter(null)}>
                        Done
                      </button>
                    )}
                    </div>
                  )}
                </span>
              </th>
            ))}
            <th className="actions-header">Actions</th>
          </tr>
        </thead>
        <tbody className="">
          {records.map((record, index) => {
            const woNumber = String(record['WO Number'] || '').trim();
            const rowColor = getRowColor?.(woNumber);

            return (
            <tr
              key={woNumber || index}
              className={`${getRowClassName?.(record) || ''} h-auto ${onRowClick ? 'row-coloring-enabled' : ''}`}
              onClick={() => onRowClick?.(woNumber)}
            >
                <td className="row-number-cell" key={index} title={record[index]}>{index + 1}</td>
              {columns.map((column) => (
                <td className="record-cell" key={column} title={String(record[column] ?? '')} style={rowColor ? { backgroundColor: rowColor, color: '#ffffff' } : undefined}>
                  {column === 'OP' ? (
                    <div className="op-editor">
                      <input
                        className="op-input"
                        value={record[column] || ''}
                        aria-label={`OP for ${record['WO Number']}`}
                        onChange={(event) => onOpChange?.(String(record['WO Number'] || ''), event.target.value)}
                      />
                      <button
                        type="button"
                        className="op-save-button"
                        aria-label={savingOp === String(record['WO Number'] || '') ? 'Saving OP' : record[column] ? 'Update OP' : 'Save OP'}
                        title={savingOp === String(record['WO Number'] || '') ? 'Saving OP' : record[column] ? 'Update OP' : 'Save OP'}
                        disabled={savingOp === String(record['WO Number'] || '')}
                        onClick={() => onOpSave?.(String(record['WO Number'] || ''))}
                      >
                        <span aria-hidden="true">
                          {savingOp === String(record['WO Number'] || '') ? <>&#x23F3;</> : <>&#x1F4BE;</>}
                        </span>
                      </button>
                    </div>
                  ) : (record[column] || '-')}
                </td>
              ))}
              <td className="actions-cell" style={rowColor ? { backgroundColor: rowColor, color: '#ffffff' } : undefined}>
                <button
                  type="button"
                  className="delete-row-button"
                  aria-label={`Delete work order ${woNumber}`}
                  title={`Delete work order ${woNumber}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteRow?.(woNumber);
                  }}
                >
                  <IconTrash stroke={2} />
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {records.length === 0 && <p className="empty-state text-center">No work orders match these filters.</p>}
    </div>
  );
};

export default RecordsTable;