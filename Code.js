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

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
