const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "RK Global Fabric ERP",
    icon: path.join(__dirname, '..', 'public', 'rk-global-logo.svg'), // fallback or default icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the production URL
  mainWindow.loadURL('https://polymer-fabric-erp.vercel.app');

  // Hide the default application menu bar for a cleaner, native app experience
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
