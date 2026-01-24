/**
 * Task Service
 * Handles data operations for Tasks.
 */

function getSS() {
    if (CONFIG.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
        return SpreadsheetApp.getActiveSpreadsheet();
    }
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Access Control
 */
function checkAccess() {
    try {
        const userEmail = Session.getActiveUser().getEmail();
        if (!userEmail) return false;

        const ss = getSS();
        const masterSheet = ss.getSheetByName(CONFIG.MASTER_SHEET_NAME);
        if (!masterSheet) return true; // No restriction if master sheet missing

        const data = masterSheet.getDataRange().getValues();
        return data.some(row => row[0] === userEmail);
    } catch (e) {
        return false;
    }
}

/**
 * Get Settings
 */
function getSettings() {
    return {
        mapping: CONFIG.MAPPING,
        userEmail: Session.getActiveUser().getEmail()
    };
}

/**
 * Get Data
 */
function getData() {
    const ss = getSS();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);

    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['ID', '表示順', 'タスクグループ', 'タスクタイトル', 'タスク内容', 'タスク期限', 'タスク優先度', 'ステータス']);
    }

    const data = sheet.getDataRange().getValues();
    const richTexts = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getRichTextValues();
    const rows = data.slice(1);
    const rowsRichText = richTexts.slice(1);

    return rows.map((row, i) => {
        const taskContentRichText = rowsRichText[i][CONFIG.COLUMNS.CONTENT];
        return {
            id: row[CONFIG.COLUMNS.ID],
            no: row[CONFIG.COLUMNS.DISPLAY_NO],
            group: row[CONFIG.COLUMNS.GROUP],
            title: row[CONFIG.COLUMNS.TITLE],
            contentHtml: richTextToHtml(taskContentRichText),
            contentRaw: row[CONFIG.COLUMNS.CONTENT],
            dueDate: row[CONFIG.COLUMNS.DUE_DATE] instanceof Date ? row[CONFIG.COLUMNS.DUE_DATE].toISOString() : row[CONFIG.COLUMNS.DUE_DATE],
            priority: row[CONFIG.COLUMNS.PRIORITY],
            status: row[CONFIG.COLUMNS.STATUS],
            label: row[CONFIG.COLUMNS.LABEL] || ''
        };
    });
}

/**
 * Save Task
 */
function saveTask(task) {
    const ss = getSS();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    let rowIndex = -1;
    if (task.id) {
        for (let i = 1; i < data.length; i++) {
            if (data[i][CONFIG.COLUMNS.ID] == task.id) {
                rowIndex = i + 1;
                break;
            }
        }
    }

    const richTextValue = htmlToRichText(task.contentHtml, task.contentRaw || '');

    if (rowIndex === -1) {
        // New
        const nextId = getNextId(data);
        const nextNo = getNextNo(data, task.status);
        const newRow = [];
        newRow[CONFIG.COLUMNS.ID] = nextId;
        newRow[CONFIG.COLUMNS.DISPLAY_NO] = nextNo;
        newRow[CONFIG.COLUMNS.GROUP] = task.group;
        newRow[CONFIG.COLUMNS.TITLE] = task.title;
        newRow[CONFIG.COLUMNS.CONTENT] = task.contentRaw;
        newRow[CONFIG.COLUMNS.DUE_DATE] = task.dueDate ? new Date(task.dueDate) : '';
        newRow[CONFIG.COLUMNS.PRIORITY] = task.priority;
        newRow[CONFIG.COLUMNS.STATUS] = task.status;
        newRow[CONFIG.COLUMNS.LABEL] = task.label;

        sheet.appendRow(newRow);
        rowIndex = sheet.getLastRow();
    } else {
        // Update
        // Ensure we cover up to the LABEL column
        const outputCols = Math.max(sheet.getLastColumn(), CONFIG.COLUMNS.LABEL + 1);
        const range = sheet.getRange(rowIndex, 1, 1, outputCols);
        const vals = range.getValues()[0];

        vals[CONFIG.COLUMNS.GROUP] = task.group;
        vals[CONFIG.COLUMNS.TITLE] = task.title;
        vals[CONFIG.COLUMNS.CONTENT] = task.contentRaw;
        vals[CONFIG.COLUMNS.DUE_DATE] = task.dueDate ? new Date(task.dueDate) : '';
        vals[CONFIG.COLUMNS.PRIORITY] = task.priority;
        vals[CONFIG.COLUMNS.STATUS] = task.status;
        vals[CONFIG.COLUMNS.LABEL] = task.label;
        range.setValues([vals]);
    }

    sheet.getRange(rowIndex, CONFIG.COLUMNS.CONTENT + 1).setRichTextValue(richTextValue);

    return { success: true, id: task.id || data.length };
}

/**
 * Delete Task
 */
function deleteTask(id) {
    const ss = getSS();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        if (data[i][CONFIG.COLUMNS.ID] == id) {
            sheet.deleteRow(i + 1);
            return { success: true };
        }
    }
    return { success: false };
}

/**
 * Update Order and Status
 */
function updateOrderAndStatus(updates) {
    const ss = getSS();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    const idToRow = {};
    for (let i = 1; i < data.length; i++) {
        idToRow[data[i][CONFIG.COLUMNS.ID]] = i + 1;
    }

    updates.forEach(update => {
        const rowIndex = idToRow[update.id];
        if (rowIndex) {
            sheet.getRange(rowIndex, CONFIG.COLUMNS.DISPLAY_NO + 1).setValue(update.no);
            sheet.getRange(rowIndex, CONFIG.COLUMNS.STATUS + 1).setValue(update.status);
        }
    });

    return { success: true };
}

/**
 * Import from Google Tasks
 */
function importFromGoogleTasks() {
    const taskLists = Tasks.Tasklists.list().items;
    if (!taskLists || taskLists.length === 0) return { count: 0 };

    const existingData = getData();
    const existingTitles = new Set(existingData.map(t => t.title));
    let importCount = 0;

    taskLists.forEach(list => {
        const tasks = Tasks.Tasks.list(list.id).items;
        if (!tasks) return;

        tasks.forEach(gtask => {
            if (gtask.status === 'completed') return; // Skip completed
            if (existingTitles.has(gtask.title)) return; // Skip duplicates

            const newTask = {
                title: gtask.title,
                group: list.title || 'GoogleTasks',
                contentRaw: gtask.notes || '',
                contentHtml: (gtask.notes || '').replace(/\n/g, '<br>'),
                dueDate: gtask.due ? new Date(gtask.due).toISOString() : '',
                priority: '中',
                status: '未着手',
                label: ''
            };

            saveTask(newTask);
            importCount++;
        });
    });

    return { count: importCount };
}

function getNextId(data) {
    if (data.length <= 1) return 1;
    const ids = data.slice(1).map(r => Number(r[CONFIG.COLUMNS.ID]) || 0);
    return Math.max(...ids) + 1;
}

function getNextNo(data, status) {
    const sameStatusRows = data.slice(1).filter(r => r[CONFIG.COLUMNS.STATUS] === status);
    if (sameStatusRows.length === 0) return 1;
    const nos = sameStatusRows.map(r => Number(r[CONFIG.COLUMNS.DISPLAY_NO]) || 0);
    return Math.max(...nos) + 1;
}
