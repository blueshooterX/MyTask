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
        version: CONFIG.VERSION,
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
    let existingTask = null;

    if (task.id) {
        for (let i = 1; i < data.length; i++) {
            if (data[i][CONFIG.COLUMNS.ID] == task.id) {
                rowIndex = i + 1;
                existingTask = data[i];
                break;
            }
        }
    }

    if (rowIndex === -1) {
        // New
        const richTextValue = htmlToRichText(task.contentHtml, task.contentRaw || '');
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
        sheet.getRange(rowIndex, CONFIG.COLUMNS.CONTENT + 1).setRichTextValue(richTextValue);
    } else {
        // Update
        // Update
        const updatesLeft = {};
        const updatesRight = {};
        let contentChanged = false;

        // Check Left Block (Group, Title)
        if (existingTask[CONFIG.COLUMNS.GROUP] !== task.group) updatesLeft[CONFIG.COLUMNS.GROUP] = task.group;
        if (existingTask[CONFIG.COLUMNS.TITLE] !== task.title) updatesLeft[CONFIG.COLUMNS.TITLE] = task.title;

        // Check Content
        if (task._contentModified || existingTask[CONFIG.COLUMNS.CONTENT] !== task.contentRaw) {
            contentChanged = true;
        }

        // Check Right Block (Due Date, Priority, Status, Label)
        const existingDueDate = existingTask[CONFIG.COLUMNS.DUE_DATE] instanceof Date ? existingTask[CONFIG.COLUMNS.DUE_DATE].toISOString().split('T')[0] : '';
        const newDueDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';

        // Note: For right block, if ANY changed, we write ALL in the block to simple batching
        // Or we check individually? Batching requires writing the whole range or constructing a range.
        // Simplest batch: If any in Group/Title changed, write Group/Title.
        // If any in Due/Pri/Stat/Label changed, write that block.

        let writeLeft = false;
        if (Object.keys(updatesLeft).length > 0) writeLeft = true;

        let writeRight = false;
        if (existingDueDate !== newDueDate ||
            existingTask[CONFIG.COLUMNS.PRIORITY] !== task.priority ||
            existingTask[CONFIG.COLUMNS.STATUS] !== task.status ||
            existingTask[CONFIG.COLUMNS.LABEL] !== task.label) {
            writeRight = true;
        }

        // Apply Updates
        if (writeLeft) {
            // Group(2), Title(3)
            sheet.getRange(rowIndex, CONFIG.COLUMNS.GROUP + 1, 1, 2)
                .setValues([[task.group, task.title]]);
        }

        if (contentChanged) {
            // Content(4)
            // Write raw first (optional if setting rich text immediately, but good for consistency)
            sheet.getRange(rowIndex, CONFIG.COLUMNS.CONTENT + 1).setValue(task.contentRaw);
            const richTextValue = htmlToRichText(task.contentHtml, task.contentRaw || '');
            sheet.getRange(rowIndex, CONFIG.COLUMNS.CONTENT + 1).setRichTextValue(richTextValue);
        }

        if (writeRight) {
            // Due(5), Priority(6), Status(7), Label(8)
            const dateVal = task.dueDate ? new Date(task.dueDate) : '';
            sheet.getRange(rowIndex, CONFIG.COLUMNS.DUE_DATE + 1, 1, 4)
                .setValues([[dateVal, task.priority, task.status, task.label]]);
        }
    }

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
