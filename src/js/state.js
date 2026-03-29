// Central application state
const AppState = {
  tabs: [],          // Array of { id, filePath, fileName, content, isDirty }
  activeTabId: null,
  recentFiles: [],   // Array of file path strings (max 20)
  autoSaveTimers: {}, // tabId -> timer
  viewMode: 'split'  // 'editor', 'split', or 'preview'
};

export default AppState;
