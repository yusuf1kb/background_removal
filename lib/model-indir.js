// BiRefNet_lite modelini indirir. Kurulum paketinde model hazır gelir; bu dosya
// yalnızca geliştirme sırasında (models/ yoksa) ve ilk açılış akışında kullanılır.

const fs = require('node:fs');
const path = require('node:path');

const MODEL_URL =
  'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx';
const MODEL_DOSYA = path.join('birefnet', 'model.onnx');
const EN_AZ_MODEL = 200 * 1024 * 1024;

function boyut(yol) {
  try {
    return fs.statSync(yol).size;
  } catch {
    return 0;
  }
}

function modelHazirMi(hedef) {
  return boyut(path.join(hedef, MODEL_DOSYA)) >= EN_AZ_MODEL;
}

async function modelIndir({ hedef, ilerleme = () => {} } = {}) {
  const dosya = path.join(hedef, MODEL_DOSYA);
  if (modelHazirMi(hedef)) {
    ilerleme(1, 'Model hazır');
    return 'birefnet';
  }

  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  const gecici = dosya + '.indiriliyor';
  ilerleme(0, 'Model indiriliyor… %0');

  const yanit = await fetch(MODEL_URL);
  if (!yanit.ok) {
    throw new Error('Model sunucusuna ulaşılamadı (HTTP ' + yanit.status + ').');
  }

  const toplam = Number(yanit.headers.get('content-length')) || 0;
  const fd = fs.openSync(gecici, 'w');
  let inen = 0;
  let sonYuzde = -1;

  try {
    if (yanit.body) {
      const okuyucu = yanit.body.getReader();
      while (true) {
        const { done, value } = await okuyucu.read();
        if (done) break;
        const parca = Buffer.from(value);
        fs.writeSync(fd, parca);
        inen += parca.length;
        if (toplam > 0) {
          const yuzde = Math.min(100, Math.round((inen / toplam) * 100));
          if (yuzde !== sonYuzde) {
            sonYuzde = yuzde;
            ilerleme(inen / toplam, `Model indiriliyor… %${yuzde}`);
          }
        }
      }
    } else {
      const tampon = Buffer.from(await yanit.arrayBuffer());
      fs.writeSync(fd, tampon);
      inen = tampon.length;
    }
  } finally {
    fs.closeSync(fd);
  }

  if (boyut(gecici) < EN_AZ_MODEL) {
    try {
      fs.unlinkSync(gecici);
    } catch {
      /* yoksay */
    }
    throw new Error('Model indirme tamamlanmadı.');
  }

  fs.renameSync(gecici, dosya);
  ilerleme(1, 'Model hazır');
  return 'birefnet';
}

module.exports = { modelIndir, modelHazirMi, MODEL_DOSYA };
