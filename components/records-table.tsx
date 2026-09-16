import { IconTrash } from '@tabler/icons-react';
import React, { useEffect, useRef, useState } from 'react';

interface RecordsTableProps {
  records: Array<Record<string, string>>;
  columns?: string[];
  filterValues?: Record<string, string[]>;
  columnFilters?: Record<string, string[]>;
  onColumnFilterChange?: (column: string, value: string, multiSelect?: boolean) => void;
  onOpSave?: (woNumber: string, value: string) => void;
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
  onOpSave,
  onDeleteRow,
  onRowClick,
  getRowColor,
  savingOp,
  getRowClassName,
}) => {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [multiSelectColumn, setMultiSelectColumn] = useState<string | null>('Occupier');
  const [opDialog, setOpDialog] = useState<{ woNumber: string; value: string } | null>(null);
  const opDialogRef = useRef<HTMLDialogElement>(null);
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

  useEffect(() => {
    const dialog = opDialogRef.current;
    if (!dialog) return;

    if (opDialog && !dialog.open) {
      dialog.showModal();
    } else if (!opDialog && dialog.open) {
      dialog.close();
    }
  }, [opDialog]);

  const openOpDialog = (woNumber: string, value: string) => {
    setOpDialog({ woNumber, value });
  };

  const closeOpDialog = () => {
    setOpDialog(null);
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
                    record[column] ? (
                      <p
                        className="op-value"
                        role="button"
                        tabIndex={0}
                        title="Edit OP"
                        onClick={(event) => {
                          event.stopPropagation();
                          openOpDialog(String(record['WO Number'] || ''), String(record[column]));
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            openOpDialog(String(record['WO Number'] || ''), String(record[column]));
                          }
                        }}
                      >
                        {record[column]}
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="op-write-button"
                        aria-label={`Write OP for ${record['WO Number']}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openOpDialog(String(record['WO Number'] || ''), '');
                        }}
                      >
                        Write OP
                      </button>
                    )
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
      <dialog
        ref={opDialogRef}
        className="op-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeOpDialog();
        }}
      >
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            if (!opDialog) return;
            onOpSave?.(opDialog.woNumber, opDialog.value.trim());
            closeOpDialog();
          }}
        >
          <h2>{opDialog?.value ? 'Edit OP' : 'Write OP'}</h2>
          <label className="op-dialog-field">
            <span>OP</span>
            <input
              className="op-input"
              autoFocus
              value={opDialog?.value ?? ''}
              aria-label="OP"
              onChange={(event) => setOpDialog((current) => current ? { ...current, value: event.target.value } : current)}
            />
          </label>
          <div className="op-dialog-actions">
            <button type="button" className="op-cancel-button" onClick={closeOpDialog}>Cancel</button>
            <button type="submit" className="op-save-button" disabled={!opDialog || savingOp === opDialog.woNumber}>
              {savingOp === opDialog?.woNumber ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </dialog>
      {records.length === 0 && <p className="empty-state text-center">No work orders match these filters.</p>}
    </div>
  );
};

export default RecordsTable;