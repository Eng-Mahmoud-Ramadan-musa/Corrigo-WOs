import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportRecordsPdf(sourceTable: HTMLElement) {
  const table = sourceTable.cloneNode(true) as HTMLElement;
  const headerCells = table.querySelectorAll('thead th');
  const bodyRows = table.querySelectorAll('tbody tr');
  const columnDefinitions = table.querySelectorAll('colgroup col');
  const keepIndexes = new Set<number>([0, 1, 2, 3, 4, 5]);
  const headers = Array.from(headerCells);
  const opIndex = headers.findIndex((cell) => {
    const headerLabel = cell.querySelector('.table-header-cell > span')?.textContent?.trim()
      || cell.textContent?.trim().replace(/[\u25BC\u25BE]/g, '').trim();
    return headerLabel === 'OP';
  });
  if (opIndex >= 0) keepIndexes.add(opIndex);

  columnDefinitions.forEach((column, index) => {
    if (index > 0 && !keepIndexes.has(index)) column.remove();
  });
  headerCells.forEach((cell, index) => {
    if (index > 0 && !keepIndexes.has(index)) cell.remove();
  });
  bodyRows.forEach((row) => {
    row.querySelectorAll('td').forEach((cell, index) => {
      if (index > 0 && !keepIndexes.has(index)) cell.remove();
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
    const image = canvas.toDataURL('image/png');

    pdf.addImage(image, 'PNG', margin, position, pageWidth, imageHeight);
    remainingHeight -= pageHeight;

    while (remainingHeight > 0) {
      position = margin - (imageHeight - remainingHeight);
      pdf.addPage();
      pdf.addImage(image, 'PNG', margin, position, pageWidth, imageHeight);
      remainingHeight -= pageHeight;
    }

    pdf.save('work-orders.pdf');
  } finally {
    table.remove();
  }
}
