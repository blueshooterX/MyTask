const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');
const SERVER_FILES = ['AppConfig.js.sample', 'RichTextLib.js', 'TaskService.js', 'Code.js'];
const CLIENT_MAIN = 'index.html';

/**
 * Consolidate server-side JS files into one Code.gs
 */
function bundleServer() {
    console.log('Bundling server-side files...');
    let combined = '// Combined Google Apps Script Logic\n\n';

    SERVER_FILES.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`  Adding ${file}`);
            combined += `\n/* --- START ${file} --- */\n`;
            let content = fs.readFileSync(filePath, 'utf8');

            // Remove include function from Code.js (not needed in bundled version)
            if (file === 'Code.js') {
                content = content.replace(/function include\([^)]*\)\s*\{[^}]*\}/g, '');
            }

            combined += content;
            combined += `\n/* --- END ${file} --- */\n`;
        }
    });

    fs.writeFileSync(path.join(DIST_DIR, 'Code.gs'), combined);
}

/**
 * Consolidate client-side HTML files into one index.html
 */
function bundleClient() {
    console.log('Bundling client-side files...');
    let mainHtml = fs.readFileSync(path.join(__dirname, CLIENT_MAIN), 'utf8');

    // Regex to find <?!= include('filename'); ?> or <?!= include('filename') ?>
    const includeRegex = /<\?!(=?)\s*include\(['"]([^'"]+)['"]\);?\s*\?>/g;

    let bundledHtml = mainHtml.replace(includeRegex, (match, equals, filename) => {
        const filePath = path.join(__dirname, `${filename}.html`);
        if (fs.existsSync(filePath)) {
            console.log(`  Inlining ${filename}.html`);
            return `\n<!-- --- START ${filename}.html --- -->\n` +
                fs.readFileSync(filePath, 'utf8') +
                `\n<!-- --- END ${filename}.html --- -->\n`;
        }
        console.warn(`  Warning: ${filename}.html not found.`);
        return match;
    });

    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), bundledHtml);
}

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR);
}

try {
    bundleServer();
    bundleClient();
    console.log('\nSuccess! Files generated in "dist" directory:');
    console.log('1. Code.gs  -> Copy to GAS Editor (Code.gs)');
    console.log('2. index.html -> Copy to GAS Editor (index.html)');
    console.log('\nYou only need to create these TWO files in the GAS editor.');
} catch (err) {
    console.error('Error during bundling:', err);
}
