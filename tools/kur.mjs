// Uygulamayı bilgisayara kurar:
//   1) Electron çalışma zamanını ve uygulama dosyalarını %LOCALAPPDATA%\Programs\ArkaPlanKaldir içine kopyalar
//   2) Yapay zekâ modelini indirir (bir kere)
//   3) Sağ tık menüsüne "Arka Planı Kaldır ve Düzenle" ekler
//   4) Başlat menüsüne kısayol koyar
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { modelIndir, modelHazirMi } = require('../lib/model-indir.js');

const KAYNAK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEDEF =
  process.env.AP_KURULUM || path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'ArkaPlanKaldir');

const ELEKTRON = path.join(HEDEF, 'electron');
const UYGULAMA = path.join(HEDEF, 'app');
const MODEL = path.join(UYGULAMA, 'models');
const SIMGE = path.join(UYGULAMA, 'assets', 'icon.ico');
const CALISTIRICI = path.join(ELEKTRON, 'electron.exe');
const KISAYOL = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Arka Plan Kaldır.lnk'
);

const MASAUSTU = (() => {
  try {
    const sonuc = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"],
      { encoding: 'utf8', windowsHide: true }
    );
    const deger = (sonuc.stdout || '').trim();
    if (deger && fs.existsSync(deger)) return deger;
  } catch {
    /* yoksay */
  }
  return path.join(os.homedir(), 'Desktop');
})();

const MASAUSTU_KISAYOL = path.join(MASAUSTU, 'Arka Plan Kaldır.lnk');

const AD = 'Arka Planı Kaldır ve Düzenle';
const ANAHTAR = 'HKCU\\Software\\Classes\\SystemFileAssociations\\image\\shell\\ArkaPlanKaldir';

const adim = (metin) => console.log('\n\x1b[36m▸ ' + metin + '\x1b[0m');
const tamam = (metin) => console.log('  \x1b[32m✓\x1b[0m ' + metin);
const uyari = (metin) => console.log('  \x1b[33m!\x1b[0m ' + metin);

function reg(...args) {
  const sonuc = spawnSync('reg.exe', args, { encoding: 'utf8', windowsHide: true });
  if (sonuc.status !== 0) {
    throw new Error(`reg.exe başarısız: ${args.join(' ')}\n${sonuc.stderr || sonuc.stdout}`);
  }
}

// ------------------------------------------------------------------ 1. dosyalar
adim('Uygulama dosyaları kopyalanıyor');
if (!fs.existsSync(path.join(KAYNAK, 'node_modules', 'electron', 'dist', 'electron.exe'))) {
  console.error(
    '\nElectron bulunamadı. Önce bu klasörde "npm install" komutunu çalıştırın.'
  );
  process.exit(1);
}

fs.mkdirSync(HEDEF, { recursive: true });

// Electron çalışma zamanı
fs.cpSync(path.join(KAYNAK, 'node_modules', 'electron', 'dist'), ELEKTRON, {
  recursive: true,
  force: true
});
tamam('Electron çalışma zamanı hazır');

// Uygulama dosyaları
fs.mkdirSync(UYGULAMA, { recursive: true });
for (const dosya of ['main.js', 'preload.js', 'package.json']) {
  fs.copyFileSync(path.join(KAYNAK, dosya), path.join(UYGULAMA, dosya));
}
for (const klasor of ['renderer', 'assets', 'lib']) {
  fs.cpSync(path.join(KAYNAK, klasor), path.join(UYGULAMA, klasor), {
    recursive: true,
    force: true
  });
}

// Yerel modüller (ONNX Runtime ve sharp) uygulama klasörüne kopyalanır.
for (const modul of ['onnxruntime-node', 'sharp', '@img']) {
  fs.cpSync(path.join(KAYNAK, 'node_modules', modul), path.join(UYGULAMA, 'node_modules', modul), {
    recursive: true,
    force: true
  });
}
tamam('Arka plan kaldırma modülleri hazır');
tamam('Uygulama dosyaları: ' + UYGULAMA);

// ------------------------------------------------------------------ 2. model
adim('Yapay zekâ modeli kontrol ediliyor');
if (modelHazirMi(MODEL)) {
  tamam('Model zaten kurulu (214 MB)');
} else {
  uyari('Model indiriliyor, bu işlem bağlantı hızına göre birkaç dakika sürebilir…');
  let son = 0;
  await modelIndir({
    hedef: MODEL,
    ilerleme: (oran) => {
      const yuzde = Math.round(oran * 100);
      if (yuzde !== son) {
        son = yuzde;
        process.stdout.write(`\r    %${String(yuzde).padStart(3)}  `);
      }
    }
  });
  process.stdout.write('\r');
  tamam('Model hazır');
}

// ------------------------------------------------------------------ 3. sağ tık
adim('Sağ tık menüsü ekleniyor');
const komut = `"${CALISTIRICI}" "${UYGULAMA}" "%1"`;

reg('add', ANAHTAR, '/ve', '/t', 'REG_SZ', '/d', AD, '/f');
reg('add', ANAHTAR, '/v', 'Icon', '/t', 'REG_SZ', '/d', SIMGE, '/f');
reg('add', ANAHTAR, '/v', 'MultiSelectModel', '/t', 'REG_SZ', '/d', 'Single', '/f');
reg('add', `${ANAHTAR}\\command`, '/ve', '/t', 'REG_SZ', '/d', komut, '/f');
tamam(`Menü öğesi eklendi: "${AD}"`);

// ------------------------------------------------------------------ 4. kısayollar
adim('Kısayollar oluşturuluyor');
try {
  fs.mkdirSync(path.dirname(KISAYOL), { recursive: true });
  const betik = [
    '$ws = New-Object -ComObject WScript.Shell',
    `foreach ($h in @(${psDize(KISAYOL)}, ${psDize(MASAUSTU_KISAYOL)})) {`,
    '  $s = $ws.CreateShortcut($h)',
    `  $s.TargetPath = ${psDize(CALISTIRICI)}`,
    `  $s.Arguments = '"' + ${psDize(UYGULAMA)} + '"'`,
    `  $s.WorkingDirectory = ${psDize(HEDEF)}`,
    `  $s.IconLocation = ${psDize(SIMGE)}`,
    `  $s.Description = ${psDize(AD)}`,
    '  $s.Save()',
    '}'
  ].join('; ');
  const sonuc = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', betik],
    { encoding: 'utf8', windowsHide: true }
  );
  if (sonuc.status !== 0) throw new Error(sonuc.stderr || 'PowerShell hatası');
  tamam('Başlat menüsüne ve masaüstüne "Arka Plan Kaldır" kısayolu eklendi');
} catch (hata) {
  uyari('Kısayol oluşturulamadı: ' + hata.message);
}

// ------------------------------------------------------------------ kaldırma betiği
fs.writeFileSync(
  path.join(HEDEF, 'Kaldir.bat'),
  [
    '@echo off',
    'chcp 65001 >nul',
    'title Arka Plan Kaldir - Kaldirma',
    'echo.',
    'echo Arka Plan Kaldir uygulamasi kaldiriliyor...',
    'reg delete "' + ANAHTAR + '" /f >nul 2>&1',
    'del "' + path.join(path.dirname(KISAYOL), 'Arka Plan Kald*.lnk') + '" >nul 2>&1',
    'del "' + path.join(MASAUSTU, 'Arka Plan Kald*.lnk') + '" >nul 2>&1',
    'echo Sag tik menusu ve kisayollar kaldirildi.',
    'cd /d "%TEMP%"',
    'timeout /t 1 >nul',
    'rmdir /s /q "' + HEDEF + '"',
    'echo Bitti.',
    'pause'
  ].join('\r\n'),
  'utf8'
);

console.log('\n\x1b[32m✓ Kurulum tamamlandı.\x1b[0m');
console.log('\nArtık bir fotoğrafa sağ tıklayıp \x1b[1m"' + AD + '"\x1b[0m seçebilirsin.');
console.log('Uygulama: ' + CALISTIRICI);
console.log('Kaldırmak için: ' + path.join(HEDEF, 'Kaldir.bat') + '\n');

function psDize(deger) {
  return "'" + deger.replace(/'/g, "''") + "'";
}
