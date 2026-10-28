/** Service worker: the toolbar button opens the export page in a tab. All work happens there. */
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("export.html") });
});
