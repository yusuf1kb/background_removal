// Arka plan kaldırma: BiRefNet_lite (ONNX) ile yüksek kaliteli maske çıkarır.
// Model ve çıkarım ayrı bir iş parçacığında (worker) çalışır; ana süreç pencere
// düğmelerine (küçültme, kapatma) yanıt vermeye devam eder.

const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const BOY = 1024;
const MODEL_DOSYA = path.join('birefnet', 'model.onnx');
const EN_AZ_MODEL = 200 * 1024 * 1024;

let isci = null;
let sayac = 0;
let kuyruk = Promise.resolve();
let isinSozu = null;
let isciHazir = null;
const bekleyen = new Map();

function modelYolu(klasor) {
  return path.join(klasor, MODEL_DOSYA);
}

function modelHazirMi(klasor) {
  try {
    return fs.statSync(modelYolu(klasor)).size >= EN_AZ_MODEL;
  } catch {
    return false;
  }
}

function isciYolu() {
  const yol = path.join(__dirname, 'arkaplan-isci.js');
  return yol.includes('app.asar') ? yol.replace('app.asar', 'app.asar.unpacked') : yol;
}

function bekleyenleriReddet(hata) {
  for (const [, istek] of bekleyen) {
    istek.reddet(hata);
  }
  bekleyen.clear();
  if (isciHazir) {
    isciHazir.reddet(hata);
    isciHazir = null;
    isinSozu = null;
  }
}

function isciAl() {
  if (isci) return isci;

  const calisan = new Worker(isciYolu());
  isci = calisan;

  calisan.on('message', (mesaj) => {
    if (!mesaj || typeof mesaj !== 'object') return;

    if (mesaj.tip === 'asama') {
      const istek = bekleyen.get(mesaj.id);
      if (istek && istek.haber) istek.haber(mesaj.asama);
      return;
    }

    if (mesaj.tip === 'sonuc') {
      const istek = bekleyen.get(mesaj.id);
      if (!istek) return;
      bekleyen.delete(mesaj.id);
      istek.coz({
        png: Buffer.from(mesaj.png),
        genislik: mesaj.genislik,
        yukseklik: mesaj.yukseklik
      });
      return;
    }

    if (mesaj.tip === 'hata') {
      const istek = bekleyen.get(mesaj.id);
      if (!istek) return;
      bekleyen.delete(mesaj.id);
      istek.reddet(new Error(mesaj.hata || 'Arka plan kaldırılamadı.'));
      return;
    }

    if (mesaj.tip === 'hazir' || mesaj.tip === 'isin-hata') {
      if (!isciHazir) return;
      const istek = isciHazir;
      isciHazir = null;
      if (mesaj.tip === 'hazir') istek.coz(true);
      else istek.reddet(new Error(mesaj.hata || 'Model yüklenemedi.'));
    }
  });

  calisan.on('error', (hata) => {
    if (isci === calisan) isci = null;
    bekleyenleriReddet(hata instanceof Error ? hata : new Error(String(hata)));
  });

  calisan.on('exit', (kod) => {
    if (isci === calisan) isci = null;
    if (kod !== 0) {
      bekleyenleriReddet(new Error('Arka plan işçisi beklenmedik şekilde kapandı.'));
    }
  });

  return calisan;
}

function arkaPlaniKaldir(secenek) {
  const is = kuyruk.then(
    () =>
      new Promise((coz, reddet) => {
        const id = ++sayac;
        bekleyen.set(id, { coz, reddet, haber: secenek.haber });
        try {
          isciAl().postMessage({
            tip: 'kaldir',
            id,
            veri: Buffer.isBuffer(secenek.veri) ? secenek.veri : Buffer.from(secenek.veri),
            klasor: secenek.klasor
          });
        } catch (hata) {
          bekleyen.delete(id);
          reddet(hata);
        }
      })
  );
  kuyruk = is.catch(() => {});
  return is;
}

function isindir(klasor) {
  if (!modelHazirMi(klasor)) return Promise.resolve(false);
  if (isinSozu) return isinSozu;

  isinSozu = new Promise((coz, reddet) => {
    isciHazir = { coz, reddet };
    try {
      isciAl().postMessage({ tip: 'isin', klasor });
    } catch (hata) {
      isciHazir = null;
      isinSozu = null;
      reddet(hata);
    }
  }).finally(() => {
    isciHazir = null;
    isinSozu = null;
  });

  return isinSozu;
}

function kapat() {
  const calisan = isci;
  isci = null;
  bekleyenleriReddet(new Error('Uygulama kapatılıyor.'));
  if (calisan) calisan.terminate();
}

module.exports = { arkaPlaniKaldir, isindir, kapat, modelHazirMi, modelYolu, BOY };
