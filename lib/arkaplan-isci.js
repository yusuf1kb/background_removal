// Arka plan kaldırma işçisi: model ve çıkarım ayrı bir iş parçacığında çalışır.
// Böylece ana süreç (pencere düğmeleri, küçültme/kapatma) yanıt vermeye devam eder.

const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const ort = require('onnxruntime-node');
const sharp = require('sharp');

const BOY = 1024;
const MODEL_DOSYA = path.join('birefnet', 'model.onnx');
const ORTALAMA = [0.485, 0.456, 0.406];
const SAPMA = [0.229, 0.224, 0.225];

let oturum = null;
let oturumSozu = null;

function modelYolu(klasor) {
  return path.join(klasor, MODEL_DOSYA);
}

function oturumAl(klasor) {
  if (oturum) return Promise.resolve(oturum);
  if (!oturumSozu) {
    oturumSozu = ort
      .InferenceSession.create(modelYolu(klasor), {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
      })
      .then((sonuc) => {
        oturum = sonuc;
        return sonuc;
      })
      .catch((hata) => {
        oturumSozu = null;
        throw hata;
      });
  }
  return oturumSozu;
}

function sigmoid(deger) {
  return 1 / (1 + Math.exp(-deger));
}

async function isle({ veri, klasor, id }) {
  const tampon = Buffer.isBuffer(veri) ? veri : Buffer.from(veri);

  parentPort.postMessage({ tip: 'asama', id, asama: 'model' });
  const kesif = await oturumAl(klasor);

  parentPort.postMessage({ tip: 'asama', id, asama: 'islem' });

  const kucuk = await sharp(tampon)
    .rotate()
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .resize(BOY, BOY, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgb = kucuk.data;
  const girdi = new Float32Array(3 * BOY * BOY);
  for (let i = 0; i < BOY * BOY; i++) {
    girdi[i] = (rgb[i * 3] / 255 - ORTALAMA[0]) / SAPMA[0];
    girdi[BOY * BOY + i] = (rgb[i * 3 + 1] / 255 - ORTALAMA[1]) / SAPMA[1];
    girdi[2 * BOY * BOY + i] = (rgb[i * 3 + 2] / 255 - ORTALAMA[2]) / SAPMA[2];
  }

  const sonuc = await kesif.run({
    input_image: new ort.Tensor('float32', girdi, [1, 3, BOY, BOY])
  });
  const cikis = sonuc[kesif.outputNames[0]];

  const maske = Buffer.alloc(BOY * BOY);
  for (let i = 0; i < BOY * BOY; i++) {
    maske[i] = Math.round(sigmoid(cikis.data[i]) * 255);
  }

  const { data: rgba, info } = await sharp(tampon)
    .rotate()
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tamMaske = await sharp(maske, { raw: { width: BOY, height: BOY, channels: 1 } })
    .resize(info.width, info.height, { fit: 'fill', kernel: 'lanczos3' })
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i + 3] = tamMaske[i >> 2];
  }

  const png = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 6 })
    .toBuffer();

  return { png, genislik: info.width, yukseklik: info.height };
}

parentPort.on('message', async (mesaj) => {
  if (!mesaj || typeof mesaj !== 'object') return;

  if (mesaj.tip === 'isin') {
    try {
      if (!fs.existsSync(modelYolu(mesaj.klasor))) throw new Error('Model dosyası bulunamadı.');
      await oturumAl(mesaj.klasor);
      parentPort.postMessage({ tip: 'hazir' });
    } catch (hata) {
      parentPort.postMessage({ tip: 'isin-hata', hata: String((hata && hata.message) || hata) });
    }
    return;
  }

  if (mesaj.tip === 'kaldir') {
    try {
      const sonuc = await isle(mesaj);
      parentPort.postMessage({
        tip: 'sonuc',
        id: mesaj.id,
        png: sonuc.png,
        genislik: sonuc.genislik,
        yukseklik: sonuc.yukseklik
      });
    } catch (hata) {
      parentPort.postMessage({
        tip: 'hata',
        id: mesaj.id,
        hata: String((hata && hata.message) || hata)
      });
    }
  }
});
