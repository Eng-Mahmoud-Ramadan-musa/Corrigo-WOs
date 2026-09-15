function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    var woNumber = String(payload.woNumber || '').trim();
    var op = String(payload.op || '');

    if (!woNumber) {
      return jsonResponse({ error: 'woNumber is required' }, 400);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var headerRow = 3;
    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
    var woColumn = headers.indexOf('WO Number') + 1;
    var opColumn = headers.indexOf('OP') + 1;

    if (!woColumn) {
      return jsonResponse({ error: 'WO Number column was not found' }, 400);
    }

    if (!opColumn) {
      opColumn = lastColumn + 1;
      sheet.getRange(headerRow, opColumn).setValue('OP');
    }

    var firstDataRow = headerRow + 1;
    var rowCount = Math.max(sheet.getLastRow() - headerRow, 0);
    var workOrderValues = rowCount
      ? sheet.getRange(firstDataRow, woColumn, rowCount, 1).getValues()
      : [];
    var row = workOrderValues.findIndex(function (value) {
      return String(value[0]).trim() === woNumber;
    });

    if (row === -1) {
      return jsonResponse({ error: 'Work order was not found' }, 404);
    }

    sheet.getRange(firstDataRow + row, opColumn).setValue(op);
    return jsonResponse({ saved: true });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
