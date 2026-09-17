"use client";
import React, { useEffect, useRef, useState } from 'react';
import RecordsTable from '../components/records-table';
import PrintableRecords from '../components/records/printable-records';
import { IconPencilOff, IconPencilCheck, IconDeviceFloppy, IconFileTypePdf, IconFilterCancel, IconBookmark, IconTrash } from '@tabler/icons-react';
import { exportRecordsPdf } from '../lib/pdf/export-records-pdf';
import {
  createSummaryCards,
  getCreatedAgeClass,
  getLastMessage,
  getInspectionRowColor,
  isVisibleRecord,
  normalizeFilterValue,
  sortByDeadline,
} from '../lib/records/logic';

const Page = () => {
  type SavedFilter = { id: string; name: string; filters: Record<string, string[]> };
  const [records, setRecords] = useState<Array<Record<string, string>>>([]);
  const [opMatrix, setOpMatrix] = useState<Record<string, string>>({});
  const opMatrixRef = useRef<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [messageFilter, setMessageFilter] = useState('all');
  const [deadlineSort, setDeadlineSort] = useState('ascending');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [savedFilterName, setSavedFilterName] = useState('');
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
    try {
      const storedFilters = window.localStorage.getItem('work-order-saved-filters');
      if (storedFilters) setSavedFilters(JSON.parse(storedFilters) as SavedFilter[]);
    } catch {
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('work-order-saved-filters', JSON.stringify(savedFilters));
  }, [savedFilters]);

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

  const visibleRecords = records.filter(isVisibleRecord);
  const summaryCards = createSummaryCards(visibleRecords);

  const matchesMessageFilter = (record: Record<string, string>, filter: string) => {
    if (filter === 'all') return true;

    const summaryCard = summaryCards.find((card) => card.key === filter);
    return summaryCard?.matches(getLastMessage(record)) ?? false;
  };

  const uniqueValues = (column: string) => Array.from(new Set(
    visibleRecords.map((record) => normalizeFilterValue(column, record[column] || '')).filter(Boolean)
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
      ([column, values]) => values.length === 0 || values.includes(normalizeFilterValue(column, record[column] || ''))
    );

    return matchesSearch && matchesState && matchesCategory && matchesMessage && matchesColumnFilters;
  });

  const sortedRecords = sortByDeadline(filteredRecords, deadlineSort);

  const hasFilters = search || stateFilter !== 'all' || categoryFilter !== 'all' || messageFilter !== 'all' || Object.values(columnFilters).some(Boolean);

  const resetFilters = () => {
    setSearch('');
    setStateFilter('all');
    setCategoryFilter('all');
    setMessageFilter('all');
    setColumnFilters({});
  };

  const updateColumnFilter = (column: string, value: string, multiSelect = true) => {
    setColumnFilters((currentFilters) => {
      const nextFilters = { ...currentFilters };

      if (!value) {
        delete nextFilters[column];
      } else if (!multiSelect) {
        nextFilters[column] = [value];
      } else {
        const currentValues = nextFilters[column] || [];
        const nextValues = currentValues.includes(value)
          ? currentValues.filter((currentValue) => currentValue !== value)
          : [...currentValues, value];
        if (nextValues.length) nextFilters[column] = nextValues;
        else delete nextFilters[column];
      }

      return nextFilters;
    });
  };

  const saveCurrentFilter = () => {
    const name = savedFilterName.trim();
    if (!name || !Object.keys(columnFilters).length) return;
    setSavedFilters((currentFilters) => [
      ...currentFilters.filter((filter) => filter.name !== name),
      { id: `${Date.now()}`, name, filters: columnFilters },
    ]);
    setSavedFilterName('');
  };

  const applySavedFilter = (filter: SavedFilter) => {
    setColumnFilters(filter.filters);
  };

  const matchesSavedFilter = (record: Record<string, string>, filter: SavedFilter) =>
    Object.entries(filter.filters).every(
      ([column, values]) => values.length === 0 || values.includes(normalizeFilterValue(column, record[column] || ''))
    );

  const isSavedFilterActive = (filter: SavedFilter) =>
    JSON.stringify(columnFilters) === JSON.stringify(filter.filters);

  const deleteSavedFilter = (id: string) => {
    setSavedFilters((currentFilters) => currentFilters.filter((filter) => filter.id !== id));
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

  const savePdf = async () => {
    const sourceTable = document.querySelector('.records-table') as HTMLElement | null;
    if (!sourceTable) return;

    try {
      await exportRecordsPdf(sourceTable);
    } catch {
      setSaveMessage('Unable to export PDF');
    }
  };

  const printableColumns = [...columns.slice(0, 5), ...(columns.includes('OP') && !columns.slice(0, 5).includes('OP') ? ['OP'] : [])];

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
        {savedFilters.map((filter) => {
          const isActive = isSavedFilterActive(filter);
          const count = visibleRecords.filter((record) => matchesSavedFilter(record, filter)).length;

          return (
            <button
              key={`saved-${filter.id}`}
              type="button"
              className={`summary-card summary-card-button saved-filter-summary-card${isActive ? ' active' : ''}`}
              aria-pressed={isActive}
              onClick={() => setColumnFilters(isActive ? {} : filter.filters)}
              title="Apply saved filter"
            >
              <span>{filter.name}:</span>
              <strong>{count}</strong>
            </button>
          );
        })}
        <div className="saved-filters" aria-label="Saved filters">
          <input
            type="text"
            value={savedFilterName}
            placeholder="Filter name"
            onChange={(event) => setSavedFilterName(event.target.value)}
          />
          <button type="button" onClick={saveCurrentFilter} title="Save current filters" aria-label="Save current filters">
            <IconBookmark stroke={2} />
          </button>
          {savedFilters.map((filter) => (
            <span className="saved-filter" key={filter.id}>
              <button type="button" onClick={() => applySavedFilter(filter)}>{filter.name}</button>
              <button type="button" onClick={() => deleteSavedFilter(filter.id)} title={`Delete ${filter.name}`} aria-label={`Delete ${filter.name}`}>
                <IconTrash stroke={2} />
              </button>
            </span>
          ))}
        </div>
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
          columnFilters={columnFilters}
          onColumnFilterChange={updateColumnFilter}
          onOpSave={saveOp}
          onDeleteRow={deleteRow}
          onRowClick={colorRow}
          getRowColor={(woNumber) => {
            const record = records.find((item) => String(item['WO Number'] || '').trim() === woNumber) || {};
            return getInspectionRowColor(record) || rowColors[woNumber];
          }}
          savingOp={savingOp}
          getRowClassName={getCreatedAgeClass}
        />
      </section>
      <PrintableRecords
        records={sortedRecords}
        columns={printableColumns}
        getRowClassName={getCreatedAgeClass}
        getRowColor={(woNumber) => {
          const record = records.find((item) => String(item['WO Number'] || '').trim() === woNumber) || {};
          return getInspectionRowColor(record) || rowColors[woNumber];
        }}
      />
    </main>
  );
};

export default Page;