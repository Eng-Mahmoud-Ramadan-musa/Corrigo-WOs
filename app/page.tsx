"use client";
import React, { useEffect, useRef, useState } from 'react';
import RecordsTable from '../components/records-table';
import { IconPencilOff, IconPencilCheck, IconDeviceFloppy, IconFileTypePdf, IconFilterCancel } from '@tabler/icons-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const Page = () => {
  const [records, setRecords] = useState<Array<Record<string, string>>>([]);
  const [opMatrix, setOpMatrix] = useState<Record<string, string>>({});
  const opMatrixRef = useRef<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [messageFilter, setMessageFilter] = useState('all');
  const [deadlineSort, setDeadlineSort] = useState('ascending');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [savingOp, setSavingOp] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isRefreshingRecords, setIsRefreshingRecords] = useState(false);
  const [coloringEnabled, setColoringEnabled] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#2563eb');
  const [rowColors, setRowColors] = useState<Record<string, string>>({});

  const rowColorOptions = [
    { name: 'Blue 600', value: '#2563eb' },
    { name: 'Red 600', value: '#dc2626' },
    { name: 'Green 600', value: '#16a34a' },
    { name: 'Amber 600', value: '#d97706' },
    { name: 'Orange 600', value: '#ea580c' },
    { name: 'Purple 600', value: '#9333ea' },
    { name: 'Pink 600', value: '#db2777' },
    { name: 'Teal 600', value: '#0d9488' },
  ];

  const excludedOccupier = /smart village|maadi cornishe/i;
  const isVisibleRecord = (record: Record<string, string>) => !excludedOccupier.test(record['Occupier'] || '');

  useEffect(() => {
    try {
      const storedColors = window.localStorage.getItem('work-order-row-colors');
      if (storedColors) setRowColors(JSON.parse(storedColors) as Record<string, string>);
    } catch {
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('work-order-row-colors', JSON.stringify(rowColors));
  }, [rowColors]);

  useEffect(() => {
    let cancelled = false;
    let isFetching = false;
    let controller: AbortController | null = null;

    const fetchRecords = async () => {
      if (cancelled || isFetching) return;

      isFetching = true;
      controller?.abort();
      controller = new AbortController();
      setIsRefreshingRecords(true);

      try {
        const response = await fetch('/api/records', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unable to refresh records');

        const data = await response.json() as Array<Record<string, string>>;
        if (!Array.isArray(data)) throw new Error('Invalid records response');
        if (cancelled) return;

        setRecords((currentRecords) => {
          const currentByWo = new Map(currentRecords.map((record) => [
            String(record['WO Number'] || '').trim(),
            record,
          ]));

          return data.map((record) => {
            const woNumber = String(record['WO Number'] || '').trim();
            const localRecord = currentByWo.get(woNumber);
            const localOp = opMatrixRef.current[woNumber];
            const op = localOp ?? record.OP ?? localRecord?.OP ?? '';
            return { ...record, OP: op };
          });
        });
        setOpMatrix((currentMatrix) => {
          const nextMatrix = { ...currentMatrix };
          data.forEach((record) => {
            const woNumber = String(record['WO Number'] || '').trim();
            const op = String(record.OP || '').trim();
            if (woNumber && op && nextMatrix[woNumber] === undefined) {
              nextMatrix[woNumber] = record.OP;
            }
          });
          opMatrixRef.current = nextMatrix;
          return nextMatrix;
        });
        await Promise.all(data.map(async (record) => {
          const woNumber = String(record['WO Number'] || '').trim();
          const localOp = opMatrixRef.current[woNumber];
          if (!woNumber || localOp === undefined || localOp === record.OP) return;

          await fetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ woNumber, op: localOp }),
          });
        }));
        setLastUpdated(new Date());
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          setSaveMessage('Unable to refresh records');
        }
      } finally {
        isFetching = false;
        if (!cancelled) {
          setIsLoadingRecords(false);
          setIsRefreshingRecords(false);
        }
      }
    };

    fetchRecords();
    const refreshTimer = window.setInterval(fetchRecords, 30_000);
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') fetchRecords();
    };
    document.addEventListener('visibilitychange', refreshOnVisibility);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, []);

  const getLastMessage = (record: Record<string, string>) =>
    (record['Last Message'] || '').trim().toLowerCase();

  const visibleRecords = records.filter(isVisibleRecord);

  const groupedSummaryCards = [
    {
      key: 'offer-shared',
      label: 'Offer Shared',
      matches: (message: string) => message.includes('offer shared'),
    },
    {
      key: 'approved',
      label: 'Approved',
      matches: (message: string) => message.includes('approved'),
    },
  ];

  const otherSummaryCards = Array.from(new Set(
    visibleRecords
      .map((record) => String(record['Last Message'] || '').trim())
      .filter(Boolean)
  )).filter((message) => {
    const normalizedMessage = message.toLowerCase();
    return !groupedSummaryCards.some((card) => card.matches(normalizedMessage));
  }).map((message) => ({
    key: message.toLowerCase(),
    label: `${message.split(/\s+/).slice(0, 3).join(' ')}${message.split(/\s+/).length > 3 ? '...' : ''}`,
    matches: (currentMessage: string) => currentMessage === message.toLowerCase(),
  }));

  const summaryCards = [...groupedSummaryCards, ...otherSummaryCards];

  const matchesMessageFilter = (record: Record<string, string>, filter: string) => {
    if (filter === 'all') return true;

    const summaryCard = summaryCards.find((card) => card.key === filter);
    return summaryCard?.matches(getLastMessage(record)) ?? false;
  };

  const uniqueValues = (column: string) => Array.from(new Set(
    visibleRecords.map((record) => record[column]).filter(Boolean)
  )).sort();

  const columns = records.length > 0
    ? Object.keys(records[0]).filter((column) => column.trim() !== '')
    : [];
  const filterValues = Object.fromEntries(columns.map((column) => [column, uniqueValues(column)]));

  const filteredRecords = visibleRecords.filter((record) => {
    const searchableText = Object.values(record).join(' ').toLowerCase();
    const matchesSearch = searchableText.includes(search.toLowerCase());
    const matchesState = stateFilter === 'all' || record['Occupier'] === stateFilter;
    const matchesCategory = categoryFilter === 'all' || record.Category === categoryFilter;
    const matchesMessage = matchesMessageFilter(record, messageFilter);
    const matchesColumnFilters = Object.entries(columnFilters).every(
      ([column, value]) => !value || record[column] === value
    );

    return matchesSearch && matchesState && matchesCategory && matchesMessage && matchesColumnFilters;
  });

  const sortedRecords = deadlineSort === 'none'
    ? filteredRecords
    : [...filteredRecords].sort((firstRecord, secondRecord) => {
      const firstDeadline = Number(firstRecord['Deadline']);
      const secondDeadline = Number(secondRecord['Deadline']);
      const firstIsMissing = !Number.isFinite(firstDeadline);
      const secondIsMissing = !Number.isFinite(secondDeadline);

      if (firstIsMissing || secondIsMissing) {
        if (firstIsMissing && secondIsMissing) return 0;
        return firstIsMissing ? 1 : -1;
      }

      return deadlineSort === 'ascending'
        ? firstDeadline - secondDeadline
        : secondDeadline - firstDeadline;
    });

  const hasFilters = search || stateFilter !== 'all' || categoryFilter !== 'all' || messageFilter !== 'all' || Object.values(columnFilters).some(Boolean);

  const resetFilters = () => {
    setSearch('');
    setStateFilter('all');
    setCategoryFilter('all');
    setMessageFilter('all');
    setColumnFilters({});
  };

  const updateColumnFilter = (column: string, value: string) => {
    setColumnFilters((currentFilters) => {
      const nextFilters = { ...currentFilters };

      if (value) {
        nextFilters[column] = value;
      } else {
        delete nextFilters[column];
      }

      return nextFilters;
    });
  };

  const saveOp = async (woNumber: string, value: string) => {
    const record = records.find((item) => String(item['WO Number'] || '') === woNumber);
    if (!record) return;

    setSavingOp(woNumber);
    setSaveMessage('');
    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ woNumber, op: value }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Unable to save OP to Google Sheets');
      }
      opMatrixRef.current = { ...opMatrixRef.current, [woNumber]: value };
      setOpMatrix(opMatrixRef.current);
      setRecords((currentRecords) => currentRecords.map((currentRecord) => (
        String(currentRecord['WO Number'] || '') === woNumber ? { ...currentRecord, OP: value } : currentRecord
      )));
      setSaveMessage('OP saved successfully');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to save OP to Google Sheets');
    } finally {
      setSavingOp(null);
    }
  };

  const deleteRow = async (woNumber: string) => {
    if (!woNumber || !window.confirm(`Delete work order ${woNumber}?`)) return;

    try {
      const response = await fetch('/api/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ woNumber }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Unable to delete work order');
      }

      setRecords((currentRecords) => currentRecords.filter(
        (record) => String(record['WO Number'] || '').trim() !== woNumber
      ));
      setSaveMessage('Work order deleted successfully');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to delete work order');
    }
  };

  const colorRow = (woNumber: string) => {
    if (!woNumber) return;
    setRowColors((currentColors) => {
      const nextColors = { ...currentColors };

      if (coloringEnabled) {
        nextColors[woNumber] = selectedColor;
      } else {
        delete nextColors[woNumber];
      }

      return nextColors;
    });
  };

  const getCreatedAgeClass = (record: Record<string, string>) => {
    if (record.Category?.trim().toLowerCase() !== 'request') return '';
    if (!(record['Last Message'] || '').toLowerCase().includes('please check out')) return '';

    const created = String(record.Created || '');
    const parts = created.trim().split(/[\/\-]/).map(Number);
    let createdDate: Date;

    if (parts.length === 3 && parts.every(Number.isFinite)) {
      const [first, second, third] = parts;
      createdDate = first > 31
        ? new Date(first, second - 1, third)
        : new Date(third, second - 1, first);
    } else {
      createdDate = new Date(created);
    }

    if (Number.isNaN(createdDate.getTime())) return '';
    createdDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ageInDays = Math.floor((today.getTime() - createdDate.getTime()) / 86_400_000);

    if (ageInDays > 4) return 'record-over-four-days';
    if (ageInDays > 3) return 'record-over-three-days';
    return '';
  };

  const savePdf = async () => {
    const sourceTable = document.querySelector('.records-table') as HTMLElement | null;
    if (!sourceTable) return;

    const table = sourceTable.cloneNode(true) as HTMLElement;
    const headerCells = table.querySelectorAll('thead th');
    const bodyRows = table.querySelectorAll('tbody tr');
    const columnDefinitions = table.querySelectorAll('colgroup col');
    const maxColumnIndex = 5;

    columnDefinitions.forEach((column, index) => {
      if (index > maxColumnIndex) column.remove();
    });
    headerCells.forEach((cell, index) => {
      if (index > maxColumnIndex) cell.remove();
    });
    bodyRows.forEach((row) => {
      row.querySelectorAll('td').forEach((cell, index) => {
        if (index > maxColumnIndex) cell.remove();
      });
    });

    table.style.position = 'absolute';
    table.style.left = '-10000px';
    table.style.top = '0';
    table.style.width = '1400px';
    document.body.appendChild(table);

    try {
      const canvas = await html2canvas(table, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 6;
      const pageWidth = 297 - margin * 2;
      const pageHeight = 210 - margin * 2;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let remainingHeight = imageHeight;
      let position = margin;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, pageWidth, imageHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position = margin - (imageHeight - remainingHeight);
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, pageWidth, imageHeight);
        remainingHeight -= pageHeight;
      }

      pdf.save('work-orders.pdf');
    } catch {
      setSaveMessage('Unable to export PDF');
    } finally {
      table.remove();
    }
  };

  const printableColumns = columns.slice(0, 5);

  return (
    <main id="top">
      <h1>Work Orders</h1>
      <div className="row-color-toolbar">
        <button
          type="button"
          className="row-color-toggle"
          onClick={() => setColoringEnabled((enabled) => !enabled)}
          aria-pressed={coloringEnabled}
        >
          {coloringEnabled ? <IconPencilCheck className ='bg-green-500 text-white rounded-lg w-10 h-8' stroke={2} /> : <IconPencilOff className='bg-red-500 text-white rounded-lg w-10 h-8' stroke={2} />}
        </button>
        <div className="color-options" aria-label="Choose row color">
          {rowColorOptions.map((color) => (
            <button
              key={color.value}
              type="button"
              className={`color-option${selectedColor === color.value ? ' selected' : ''}`}
              style={{ backgroundColor: color.value }}
              aria-label={color.name}
              aria-pressed={selectedColor === color.value}
              title={color.name}
              onClick={() => setSelectedColor(color.value)}
            />
          ))}
        </div>
      </div>
      <section className="summary-cards">
        {summaryCards.map((card) => {
          const count = visibleRecords.filter((record) => card.matches(getLastMessage(record))).length;
          const isActive = messageFilter === card.key;

          return (
            <button
              key={card.key}
              type="button"
              className={`summary-card summary-card-button${isActive ? ' active' : ''}`}
              aria-pressed={isActive}
              onClick={() => setMessageFilter(isActive ? 'all' : card.key)}
            >
              <span>{card.label}:</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </section>
      <section className="orders-section">
        <div className="orders-header">
            <label className="flex items-center gap-2">
            <span>Search</span>
            <input
              className="search-input"
              type="search"
              placeholder="Search work orders..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="summary-card ">
            <h2>All work orders</h2>
            <p>{isLoadingRecords ? 'Loading records...' : `${filteredRecords.length} records`}</p>
            {lastUpdated && !isLoadingRecords && (
              <small className="refresh-message">
                {isRefreshingRecords ? 'Refreshing...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
              </small>
            )}
          </div>
          <div>
            <label className="deadline-sort-control">
              <span>Sort by Deadline</span>
              <select
                value={deadlineSort}
                onChange={(event) => setDeadlineSort(event.target.value)}
              >
                <option value="ascending">Ascendin ⇩</option>
                <option value="descending">Descending ⇧</option>
                <option value="none">Original order</option>
              </select>
            </label>
            <div className='flex items-center gap-2 justify-end'>
            {hasFilters && (
              <button type="button" className="bg-gray-300 p-2 rounded-lg text-white" onClick={resetFilters}>
                <IconFilterCancel className='bg-red-500 me-1' stroke={2} />
              </button>
            )}
            <button type="button" className="bg-gray-300 p-2 rounded-lg text-white" onClick={savePdf} title="Export PDF">
              <IconFileTypePdf className='bg-red-500' stroke={2} />
            </button>
            <button type="button" className="bg-blue-300 p-2 rounded-lg text-white" onClick={() => window.print()}>
              <IconDeviceFloppy stroke={2} />
            </button>
            </div>
            </div>
          </div>
        <RecordsTable
          records={sortedRecords}
          columns={columns}
          filterValues={filterValues}
          columnFilters={columnFilters as unknown as Record<string, string[]>}
          onColumnFilterChange={updateColumnFilter}
          onOpSave={saveOp}
          onDeleteRow={deleteRow}
          onRowClick={colorRow}
          getRowColor={(woNumber) => rowColors[woNumber]}
          savingOp={savingOp}
          getRowClassName={getCreatedAgeClass}
        />
      </section>
      <section className="print-area" aria-label="Printable work orders">
        <h1>Work Orders</h1>
        <table className="print-table">
          <thead>
            <tr>
              <th>#</th>
              {printableColumns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record, index) => {
              const woNumber = String(record['WO Number'] || '').trim();
              const rowColor = rowColors[woNumber];

              return (
              <tr key={record['WO Number'] || index} className={getCreatedAgeClass(record)}>
                <td>{index + 1}</td>
                {printableColumns.map((column) => (
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
    </main>
  );
};

export default Page;