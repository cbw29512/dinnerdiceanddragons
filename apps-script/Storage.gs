function dddNow_() {
  try {
    return new Date().toISOString();
  } catch (error) {
    console.error("[DDD] dddNow_ failed", error);
    throw error;
  }
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

function dddUpsert_(sheetName, keyField, keyValue, rowObject) {
  try {
    const headers = DDD_SCHEMA[sheetName];
    if (!headers) throw new Error(`Unknown schema: ${sheetName}`);
    const keyIndex = headers.indexOf(keyField);
    if (keyIndex < 0) throw new Error(`Unknown key ${keyField} for ${sheetName}`);

    const sheet = dddSheet_(sheetName);
    const values = sheet.getDataRange().getValues();
    let targetRow = -1;
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      if (String(values[rowIndex][keyIndex]) === String(keyValue)) {
        targetRow = rowIndex + 1;
        break;
      }
    }

    if (targetRow < 0) return dddAppend_(sheetName, rowObject);

    const existing = values[targetRow - 1];
    const normalized = { ...rowObject };
    const createdIndex = headers.indexOf("created_at");
    if (createdIndex >= 0 && existing[createdIndex]) normalized.created_at = existing[createdIndex];
    const row = headers.map((header, index) => normalized[header] ?? existing[index] ?? "");
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);
    return normalized;
  } catch (error) {
    console.error(`[DDD] Unable to upsert ${sheetName}`, error);
    throw error;
  }
}

function dddDeactivateBy_(sheetName, filters, updatedAt) {
  try {
    const headers = DDD_SCHEMA[sheetName];
    if (!headers) throw new Error(`Unknown schema: ${sheetName}`);
    const activeIndex = headers.indexOf("active");
    if (activeIndex < 0) throw new Error(`${sheetName} has no active field`);
    const updatedIndex = headers.indexOf("updated_at");
    const filterIndexes = Object.entries(filters || {}).map(([field, value]) => {
      const index = headers.indexOf(field);
      if (index < 0) throw new Error(`Unknown filter ${field} for ${sheetName}`);
      return { index, value };
    });

    const sheet = dddSheet_(sheetName);
    const values = sheet.getDataRange().getValues();
    let changed = 0;
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const matches = filterIndexes.every((filter) => String(values[rowIndex][filter.index]) === String(filter.value));
      if (!matches) continue;
      values[rowIndex][activeIndex] = false;
      if (updatedIndex >= 0) values[rowIndex][updatedIndex] = updatedAt || dddNow_();
      changed += 1;
    }
    if (changed > 0) sheet.getRange(1, 1, values.length, headers.length).setValues(values);
    return changed;
  } catch (error) {
    console.error(`[DDD] Unable to deactivate rows in ${sheetName}`, error);
    throw error;
  }
}
