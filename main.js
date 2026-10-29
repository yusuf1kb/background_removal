// Arka Plan Kaldır ve Düzenle — Electron ana süreci
const { app, BrowserWindow, ipcMain, dialog, protocol, shell, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { modelIndir, modelHazirMi } = require('./lib/model-indir');
const { arkaPlaniKaldir, isindir } = require('./lib/arkaplan');

const APP_DIR = __dirname;
const MODEL_DIR = (() => {
  const adaylar = [];
  if (app.isPackaged) adaylar.push(path.join(process.resourcesPath, 'models'));
  adaylar.push(path.join(APP_DIR, 'models'));
  adaylar.push(path.join(process.env.LOCALAPPDATA || '', 'ArkaPlanKaldir', 'models'));
  for (const aday of adaylar) {
    if (fs.existsSync(path.join(aday, 'birefnet', 'model.onnx'))) return aday;
  }
  return adaylar[0];
})();
const GORSEL_UZANTI = /\.(jpe?g|png|webp|bmp|gif|tiff?|avif)$/i;

let pencere = null;
let bekleyenDosya = null;

app.setName('Arka Plan Kaldır');
app.setAppUserModelId('ArkaPlanKaldir.Uygulama');

// ---------------------------------------------------------------------------
// ap://local/... adresleri: uygulama dosyaları ve model dosyaları
// ---------------------------------------------------------------------------
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ap',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function dosyaYaniti(yol) {
  try {
    if (!fs.existsSync(yol) || !fs.statSync(yol).isFile()) {
      return new Response('Bulunamadı', { status: 404 });
    }
    const veri = fs.readFileSync(yol);
    return new Response(veri, {
      status: 200,
      headers: {
        'content-type': MIME[path.extname(yol).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
        'cross-origin-resource-policy': 'cross-origin'
      }
    });
  } catch (hata) {
    return new Response('Hata: ' + hata.message, { status: 500 });
  }
}

function guvenliYol(kok, istenen) {
  const tam = path.resolve(kok, '.' + istenen);
  if (!tam.startsWith(path.resolve(kok))) return null;
  return tam;
}

app.whenReady().then(() => {
  protocol.handle('ap', (istek) => {
    let adres;
    try {
      adres = new URL(istek.url);
    } catch {
      return new Response('Geçersiz adres', { status: 400 });
    }
    const yol = decodeURIComponent(adres.pathname);
    if (adres.host === 'local') {
      if (yol.startsWith('/models/')) {
        const hedef = guvenliYol(MODEL_DIR, yol.slice('/models'.length));
        if (hedef) return dosyaYaniti(hedef);
      }
      if (yol.startsWith('/app/')) {
        const hedef = guvenliYol(APP_DIR, yol.slice('/app'.length));
        if (hedef) return dosyaYaniti(hedef);
      }
    }
    return new Response('Bulunamadı', { status: 404 });
  });

  Menu.setApplicationMenu(null);
  pencereOlustur();
  if (modelHazirMi(MODEL_DIR)) {
    setTimeout(() => {
      isindir(MODEL_DIR).catch(() => {
        /* ilk fotoğrafta yeniden denenir */
      });
    }, 1200);
  }
});

function argvGorsel(argv) {
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue;
    if (!GORSEL_UZANTI.test(arg)) continue;
    try {
      if (fs.existsSync(arg) && fs.statSync(arg).isFile()) return path.resolve(arg);
    } catch {
      /* yoksay */
    }
  }
  return null;
}

function gorselOku(yol) {
  const veri = fs.readFileSync(yol);
  const istatistik = fs.statSync(yol);
  return {
    yol,
    ad: path.basename(yol),
    boyut: istatistik.size,
    tur: MIME[path.extname(yol).toLowerCase()] || 'image/*',
    veri: new Uint8Array(veri)
  };
}

function guvenliGorselOku(yol) {
  try {
    if (!yol || !fs.existsSync(yol)) return null;
    return gorselOku(yol);
  } catch {
    return null;
  }
}

function pencereOlustur() {
  pencere = new BrowserWindow({    width: 1280,
    height: 840,
    minWidth: 1020,
    minHeight: 660,
    show: false,
    frame: false,
    backgroundColor: '#0a0c11',
    icon: path.join(APP_DIR, 'assets', 'icon.ico'),
    title: 'Arka Plan Kaldır',
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  pencere.loadURL('ap://local/app/renderer/index.html');

  pencere.once('ready-to-show', () => {
    pencere.show();
    if (process.env.AP_DEVTOOLS) pencere.webContents.openDevTools({ mode: 'detach' });
    if (process.env.AP_TEST_BOS && process.env.AP_TEST_SHOT) {
      setTimeout(async () => {
        const gorsel = await pencere.webContents.capturePage();
        fs.writeFileSync(process.env.AP_TEST_SHOT, gorsel.toPNG());
        app.quit();
      }, 1800);
    }
  });

  pencere.on('closed', () => {
    pencere = null;
  });

  if (process.env.AP_LOG) {
    const logYolu = process.env.AP_LOG;
    const yaz = (satir) => {
      try {
        fs.appendFileSync(logYolu, satir + '\n');
      } catch {
        /* yoksay */
      }
    };
    pencere.webContents.on('console-message', (...args) => {
      const olay = args[0];
      if (olay && typeof olay === 'object' && typeof olay.message === 'string') {
        yaz(`[renderer:${olay.level}] ${olay.message} (${olay.sourceId}:${olay.lineNumber})`);
      } else {
        yaz(`[renderer] ${args[2]} (${args[4]}:${args[3]})`);
      }
    });
    pencere.webContents.on('did-fail-load', (_o, kod, aciklama, adres) => {
      yaz(`[did-fail-load] ${kod} ${aciklama} ${adres}`);
    });
    pencere.webContents.on('render-process-gone', (_o, ayrinti) => {
      yaz(`[render-gone] ${JSON.stringify(ayrinti)}`);
    });
  }

  pencere.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---------------------------------------------------------------------------
// Tek örnek: uygulama açıkken gelen yeni dosya aynı pencerede açılır
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_olay, argv) => {
    const dosya = argvGorsel(argv);
    if (pencere) {
      if (pencere.isMinimized()) pencere.restore();
      pencere.show();
      pencere.focus();
      if (dosya) {
        const gorsel = guvenliGorselOku(dosya);
        if (gorsel) pencere.webContents.send('ap:dosya', gorsel);
      }
    } else {
      bekleyenDosya = dosya;
      if (app.isReady()) pencereOlustur();
    }
  });

  app.on('window-all-closed', () => app.quit());
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('ap:pencere', (_olay, islem) => {
  if (!pencere) return;
  if (islem === 'kucult') pencere.minimize();
  else if (islem === 'buyut') {
    if (pencere.isMaximized()) pencere.unmaximize();
    else pencere.maximize();
  } else if (islem === 'kapat') pencere.close();
});

ipcMain.handle('ap:pencere-durum', () => ({
  buyuk: pencere ? pencere.isMaximized() : false
}));

ipcMain.on('ap:tema-zemin', (_olay, renk) => {
  if (!pencere || typeof renk !== 'string' || !/^#[0-9a-f]{6}$/i.test(renk)) return;
  try {
    pencere.setBackgroundColor(renk);
  } catch {
    /* yoksay */
  }
});

ipcMain.handle('ap:ac', async () => {
  if (!pencere) return null;
  const sonuc = await dialog.showOpenDialog(pencere, {
    title: 'Fotoğraf seç',
    properties: ['openFile'],
    filters: [
      { name: 'Fotoğraflar', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff', 'avif'] }
    ]
  });
  if (sonuc.canceled || sonuc.filePaths.length === 0) return null;
  return guvenliGorselOku(sonuc.filePaths[0]);
});

ipcMain.handle('ap:yeniden-oku', (_olay, yol) => guvenliGorselOku(yol));

ipcMain.handle('ap:kaydet', async (_olay, { veri, oneri, format }) => {
  if (!pencere) return null;
  const uzanti = format === 'jpeg' ? 'jpg' : 'png';

  if (process.env.AP_TEST_KAYIT) {
    fs.writeFileSync(process.env.AP_TEST_KAYIT, Buffer.from(veri));
    return { yol: process.env.AP_TEST_KAYIT, ad: path.basename(process.env.AP_TEST_KAYIT) };
  }

  const sonuc = await dialog.showSaveDialog(pencere, {
    title: 'Yeni fotoğraf olarak kaydet',
    defaultPath: oneri,
    filters:
      format === 'jpeg'
        ? [{ name: 'JPEG fotoğraf', extensions: ['jpg', 'jpeg'] }]
        : [{ name: 'PNG fotoğraf', extensions: ['png'] }]
  });
  if (sonuc.canceled || !sonuc.filePath) return { iptal: true };

  let hedef = sonuc.filePath;
  if (!new RegExp('\\.' + uzanti + '$', 'i').test(hedef)) hedef += '.' + uzanti;
  fs.writeFileSync(hedef, Buffer.from(veri));
  return { yol: hedef, ad: path.basename(hedef) };
});

ipcMain.handle('ap:klasor-goster', (_olay, yol) => {
  shell.showItemInFolder(yol);
});

ipcMain.handle('ap:ilk-dosya', () => {
  const dosya = bekleyenDosya || argvGorsel(process.argv);
  bekleyenDosya = null;
  return guvenliGorselOku(dosya);
});

ipcMain.handle('ap:model-durum', () => ({
  hazir: modelHazirMi(MODEL_DIR),
  klasor: MODEL_DIR,
  model: 'birefnet'
}));

ipcMain.handle('ap:model-indir', async () => {
  try {
    const model = await modelIndir({
      hedef: MODEL_DIR,
      ilerleme: (oran, metin) => {
        if (pencere && !pencere.isDestroyed()) {
          pencere.webContents.send('ap:indirme', { oran, metin });
        }
      }
    });
    return { tamam: true, model };
  } catch (hata) {
    return { tamam: false, hata: hata.message };
  }
});

ipcMain.handle('ap:arka-plan', async (_olay, veri) => {
  try {
    const sonuc = await arkaPlaniKaldir({
      veri,
      klasor: MODEL_DIR,
      haber: (asama) => {
        if (pencere && !pencere.isDestroyed()) {
          pencere.webContents.send('ap:asama', asama);
        }
      }
    });
    return { tamam: true, png: sonuc.png, genislik: sonuc.genislik, yukseklik: sonuc.yukseklik };
  } catch (hata) {
    return { tamam: false, hata: String((hata && hata.message) || hata) };
  }
});

ipcMain.on('ap:hazir', () => {
  if (process.env.AP_LOG) {
    fs.appendFileSync(process.env.AP_LOG, `[main] hazir alindi ${new Date().toISOString()}\n`);
  }
  if (!process.env.AP_TEST_SHOT || !pencere) return;

  const bekle = (ms) => new Promise((coz) => setTimeout(coz, ms));

  (async () => {
    try {
      if (process.env.AP_LOG) {
        const izole = await pencere.webContents.executeJavaScript('self.crossOriginIsolated');
        fs.appendFileSync(process.env.AP_LOG, `[test] crossOriginIsolated=${izole}\n`);
      }
      if (process.env.AP_TEST_RENK) {
        await pencere.webContents.executeJavaScript(
          `document.querySelector('.palet button[data-renk="${process.env.AP_TEST_RENK}"]')?.click()`
        );
        await bekle(250);
      }
      if (process.env.AP_TEST_TEMA) {
        await pencere.webContents.executeJavaScript(
          `document.querySelector('.tema-sec[data-tema="${process.env.AP_TEST_TEMA}"]')?.click()`
        );
        await bekle(250);
      }
      if (process.env.AP_TEST_MENU) {
        await pencere.webContents.executeJavaScript(
          `document.getElementById('btnTema').click()`
        );
        await bekle(250);
      }
      if (process.env.AP_TEST_KAYDET === '1') {
        await pencere.webContents.executeJavaScript(
          `document.getElementById('btnKaydet').click()`
        );
        await bekle(700);
      }
      const gorsel = await pencere.webContents.capturePage();
      fs.writeFileSync(process.env.AP_TEST_SHOT, gorsel.toPNG());
    } catch (hata) {
      console.error('Test görüntüsü alınamadı:', hata);
    }
    if (process.env.AP_TEST_CIK !== '0') app.quit();
  })();
});
