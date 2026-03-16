// Central application state
const AppState = {
  tabs: [],          // Array of { id, filePath, fileName, content, isDirty }
  activeTabId: null,
  recentFiles: [],   // Array of file path strings (max 20)
  nextUntitledNum: 1,
  autoSaveTimers: {} // tabId -> timer
};

export default AppState;
