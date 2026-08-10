function dddNow_() {
  return new Date().toISOString();
}

function dddId_(prefix) {
  try {
    return `${prefix}_${Utilities.getUuid().replaceAll("-", "")}`;
  } catch (error) {
    console.error("[DDD] dddId_ failed", error);
    throw error;
  }
}

function dddSheet_(name) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet) throw new Error(`Missing sheet: ${name}`);
    return sheet;
  } catch (error) {
    console.error(`[DDD] Unable to load sheet ${name}`, error);
    throw error;
  }
}

function dddAppend_(sheetName, rowObject) {
  try {
    const headers = DDD_SCHEMA[sheetName];
    if (!headers) throw new Error(`Unknown schema: ${sheetName}`);
    const sheet = dddSheet_(sheetName);
    const row = headers.map((header) => rowObject[header] ?? "");
    sheet.appendRow(row);
    return rowObject;
  } catch (error) {
    console.error(`[DDD] Unable to append ${sheetName}`, error);
    throw error;
  }
}

function dddRows_(sheetName) {
  try {
    const sheet = dddSheet_(sheetName);
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];
    const headers = values[0];
    return values.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
  } catch (error) {
    console.error(`[DDD] Unable to read ${sheetName}`, error);
    throw error;
  }
}

function dddFindBy_(sheetName, field, value) {
  try {
    return dddRows_(sheetName).filter((row) => String(row[field]) === String(value));
  } catch (error) {
    console.error(`[DDD] Unable to filter ${sheetName}`, error);
    throw error;
  }
}
