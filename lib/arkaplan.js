// Arka plan kaldırma: BiRefNet_lite (ONNX) ile yüksek kaliteli maske çıkarır.
// Model ve çıkarım ana süreçte çalışır; böylece tarayıcı wasm bellek sınırlarına takılmayız.

const fs = require('node:fs');
const path = require('node:path');
const ort = require('onnxruntime-node');
const sharp = require('sharp');

const BOY = 1024;
const MODEL_DOSYA = path.join('birefnet', 'model.onnx');
const EN_AZ_MODEL = 200 * 1024 * 1024;

const ORTALAMA = [0.485, 0.456, 0.406];
const SAPMA = [0.229, 0.224, 0.225];

let oturum = null;
let oturumSozu = null;
let kuyruk = Promise.resolve();

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

function oturumAl(klasor, haber) {
  if (oturum) return Promise.resolve(oturum);
  if (!oturumSozu) {
    if (haber) haber('model');
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

async function isle({ veri, klasor, haber = () => {} }) {
  const tampon = Buffer.isBuffer(veri) ? veri : Buffer.from(veri);
  const kesif = await oturumAl(klasor, haber);

  haber('islem');

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

function arkaPlaniKaldir(secenek) {
  const is = kuyruk.then(() => isle(secenek));
  kuyruk = is.catch(() => {});
  return is;
}

async function isindir(klasor) {
  if (!modelHazirMi(klasor)) return false;
  await oturumAl(klasor);
  return true;
}

module.exports = { arkaPlaniKaldir, isindir, modelHazirMi, modelYolu, BOY };
