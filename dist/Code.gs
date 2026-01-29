// Combined Google Apps Script Logic


/* --- START AppConfig.js.sample --- */
/**
 * App Configuration
 * This is a sample configuration file.
 * Please copy this file to 'AppConfig.js' and set your own values.
 */
const CONFIG = {
    SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE', // TODO: Replace with your actual Spreadsheet ID
    SHEET_NAME: 'TaskData',
    MASTER_SHEET_NAME: 'MasterData',
    COLUMNS: {
        ID: 0,
        DISPLAY_NO: 1,
        GROUP: 2,
        TITLE: 3,
        CONTENT: 4,
        DUE_DATE: 5,
        PRIORITY: 6,
        STATUS: 7,
        LABEL: 8
    },
    MAPPING: {
        STATUS: {
            '未着手': 'backlog',
            '実施中': 'wip',
            '保留': 'pending',
            '完了': 'done'
        },
        PRIORITY: {
            '高': 'high',
            '中': 'middle',
            '低': 'low'
        }
    },
    VERSION: 'v1.1.0'
};

/* --- END AppConfig.js.sample --- */

/* --- START RichTextLib.js --- */
/**
 * RichText Conversion Library
 * 
 * Provides utility functions to convert between Google Sheets RichTextValue
 * and HTML string. This library is independent of specific application logic.
 */

/**
 * RichTextValue -> HTML (for reading)
 * @param {GoogleAppsScript.Spreadsheet.RichTextValue} richTextValue 
 * @return {string} HTML string
 */
function richTextToHtml(rtv) {
    if (!rtv) return "";
    if (typeof rtv === 'string') return rtv.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n|\r|\n/g, "<br>");

    const text = rtv.getText();
    const runs = rtv.getRuns();

    if (!runs || runs.length === 0) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n|\r|\n/g, "<br>");
    }

    let html = "";
    runs.forEach(run => {
        let runText = run.getText();
        if (!runText) return;

        // HTML Escape
        runText = runText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const style = run.getTextStyle();
        let taggedText = runText;

        if (style.isBold()) taggedText = `<b>${taggedText}</b>`;
        if (style.isItalic()) taggedText = `<i>${taggedText}</i>`;
        if (style.isStrikethrough()) taggedText = `<s>${taggedText}</s>`;
        if (style.isUnderline()) taggedText = `<u>${taggedText}</u>`;

        const color = style.getForegroundColor();
        if (color && color !== '#000000') {
            taggedText = `<span style="color:${color}">${taggedText}</span>`;
        }

        html += taggedText;
    });

    return html.replace(/\r\n|\r|\n/g, "<br>");
}

/**
 * HTML -> RichTextValue (for saving)
 * @param {string} html HTML content
 * @return {GoogleAppsScript.Spreadsheet.RichTextValue}
 */
function htmlToRichText(html) {
    if (!html) return SpreadsheetApp.newRichTextValue().setText("").build();

    const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

    /**
     * Convert HTML to plain text for Sheets
     * Convert newlines tags to \n
     */
    const toPlainText = (h) => {
        if (!h) return "";
        let s = h.replace(/<br\s*\/?>/gi, "\n")
            .replace(/<(?:div|p|li)[^>]*>/gi, "\n")
            .replace(/<[^>]+>/g, "");
        return decode(s).replace(/^\n/, "");
    };

    const fullPlainText = toPlainText(html);
    const builder = SpreadsheetApp.newRichTextValue().setText(fullPlainText);
    const charStyles = Array.from({ length: fullPlainText.length }, () => ({}));

    // Parse HTML tags and accumulate styles
    const stack = [];
    const tagRegex = /<(\/?[a-z0-9]+)(?:\s+([^>]*?))?>/gi;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
        const tagName = match[1].toLowerCase();
        const attrs = match[2] || "";
        const plainIndex = toPlainText(html.substring(0, match.index)).length;

        if (tagName.startsWith('/')) {
            const name = tagName.substring(1);
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].name === name) {
                    const openTag = stack.splice(i, 1)[0];
                    for (let j = openTag.start; j < plainIndex; j++) {
                        if (j < charStyles.length) {
                            Object.assign(charStyles[j], openTag.style);
                        }
                    }
                    break;
                }
            }
        } else {
            if (tagName === 'br') continue;

            const style = {};
            const styleMatch = attrs.match(/style\s*=\s*["']([\s\S]*?)["']/i);
            if (styleMatch) {
                const s = styleMatch[1];
                const colorMatch = s.match(/color:\s*(rgb\s*\([^)]+\)|#[a-f0-9]+|[a-z]+)/i);
                if (colorMatch) style.color = parseToHex(colorMatch[1]);
                if (/font-weight:\s*(bold|700|800|900)/i.test(s)) style.bold = true;
                if (/font-style:\s*italic/i.test(s)) style.italic = true;
                if (/text-decoration:\s*[^"';]*line-through/i.test(s)) style.strikethrough = true;
                if (/text-decoration:\s*[^"';]*underline/i.test(s)) style.underline = true;
            }
            const cMatch = attrs.match(/color\s*=\s*["']([^"']+)["']/i);
            if (cMatch && !style.color) style.color = parseToHex(cMatch[1]);

            if (tagName === 'b' || tagName === 'strong') style.bold = true;
            if (tagName === 'i' || tagName === 'em') style.italic = true;
            if (tagName === 'u') style.underline = true;
            if (tagName === 's' || tagName === 'strike' || tagName === 'del') style.strikethrough = true;

            // Font tag color support (legacy but common in editors)
            if (tagName === 'font') {
                const colorAttr = attrs.match(/color\s*=\s*["']?([^"'\s>]+)["']?/i);
                if (colorAttr) style.color = parseToHex(colorAttr[1]);
            }

            stack.push({ name: tagName, start: plainIndex, style: style });
        }
    }

    // Apply accumulated styles to runs
    if (fullPlainText.length > 0) {
        let runStart = 0;
        let lastStyleStr = JSON.stringify(charStyles[0]);

        for (let i = 1; i <= fullPlainText.length; i++) {
            const currentStyle = i < fullPlainText.length ? charStyles[i] : null;
            const currentStyleStr = JSON.stringify(currentStyle);

            if (currentStyleStr !== lastStyleStr) {
                const styleObj = JSON.parse(lastStyleStr);
                const textStyle = SpreadsheetApp.newTextStyle();
                let hasStyle = false;

                if (styleObj.color) { textStyle.setForegroundColor(styleObj.color); hasStyle = true; }
                if (styleObj.bold) { textStyle.setBold(true); hasStyle = true; }
                if (styleObj.italic) { textStyle.setItalic(true); hasStyle = true; }
                if (styleObj.strikethrough) { textStyle.setStrikethrough(true); hasStyle = true; }
                if (styleObj.underline) { textStyle.setUnderline(true); hasStyle = true; }

                if (hasStyle) builder.setTextStyle(runStart, i, textStyle.build());

                runStart = i;
                lastStyleStr = currentStyleStr;
            }
        }
    }

    return builder.build();
}

/**
 * Helper to normalize color strings
 * @param {string} color 
 * @return {string|null} Hex color string
 */
function parseToHex(color) {
    if (!color) return null;
    let c = color.trim().toLowerCase().replace(/[;].*$/, "");
    if (c.startsWith('#')) {
        if (c.length === 4) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
        return (c.length === 7 || c.length === 9) ? c.substring(0, 7) : null;
    }
    const rgbMatch = c.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    const basicColors = {
        'red': '#ff0000', 'blue': '#0000ff', 'green': '#188038', 'black': '#000000',
        'white': '#ffffff', 'gray': '#5f6368', 'purple': '#800080', 'orange': '#c26401', 'pink': '#d01884'
    };
    return basicColors[c] || null;
}

/* --- END RichTextLib.js --- */

/* --- START TaskService.js --- */
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

/* --- END TaskService.js --- */

/* --- START Code.js --- */
/**
 * MyTask - Backend logic
 */

/**
 * Initialization & HTML Delivery
 */
function doGet() {
  if (!checkAccess()) {
    return HtmlService.createHtmlOutput('Access Denied. You are not authorized to access this application.');
  }
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('MyTask')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}



/* --- END Code.js --- */
