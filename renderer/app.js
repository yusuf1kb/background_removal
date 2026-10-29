// Arka Plan Kaldır ve Düzenle — arayüz mantığı
(() => {
  'use strict';

  const kopru = window.kopru;

  // ------------------------------------------------------------------ palet
  const PALET = [
    '#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8', '#475569', '#1f2937',
    '#fecdd3', '#fde68a', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#ddd6fe',
    '#f43f5e', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6',
    '#be123c', '#b45309', '#15803d', '#0e7490', '#1d4ed8', '#6d28d9',
    '#111827', '#0ea5e9', '#ec4899', '#fda4af', '#fcd34d', '#86efac'
  ];

  // ------------------------------------------------------------------ öğeler
  const el = (kimlik) => document.getElementById(kimlik);
  const tuval = el('tuval');
  const tuvalAlan = el('tuvalAlan');
  const tuvalKap = el('tuvalKap');
  const damali = el('damali');
  const bosDurum = el('bosDurum');
  const kaplama = el('kaplama');
  const halka = el('halka');
  const halkaYuzde = el('halkaYuzde');
  const kaplamaMetin = el('kaplamaMetin');
  const kaplamaAlt = el('kaplamaAlt');
  const ilerleme = el('ilerleme');
  const ilerlemeCubuk = el('ilerlemeCubuk');
  const kaplamaHata = el('kaplamaHata');
  const btnTekrar = el('btnTekrar');
  const palet = el('palet');
  const seffafSecim = el('seffafSecim');
  const renkSecici = el('renkSecici');
  const renkOrnek = el('renkOrnek');
  const renkKod = el('renkKod');
  const renkUygula = el('renkUygula');
  const sonRenkler = el('sonRenkler');
  const sonRenkListe = el('sonRenkListe');
  const gorunumSegment = el('gorunumSegment');
  const formatSegment = el('formatSegment');
  const kaydetIpucu = el('kaydetIpucu');
  const btnKaydet = el('btnKaydet');
  const btnYeni = el('btnYeni');
  const btnSec = el('btnSec');
  const durumSol = el('durumSol');
  const dosyaBilgi = el('dosyaBilgi');
  const dosyaAd = el('dosyaAd');
  const dosyaMeta = el('dosyaMeta');
  const zoomKutu = el('zoom');
  const bildirim = el('bildirim');
  const bildirimBaslik = el('bildirimBaslik');
  const bildirimAlt = el('bildirimAlt');
  const bildirimEylem = el('bildirimEylem');
  const panel = el('panel');

  const ctx = tuval.getContext('2d');

  const durum = {
    dosya: null,
    blob: null,
    orijinal: null,
    kesik: null,
    arkaRenk: null,
    gorunum: 'sonuc',
    format: 'png',
    mesgul: false,
    otoSigdir: true,
    olcek: 1,
    sonRenkler: JSON.parse(localStorage.getItem('sonRenkler') || '[]'),
    model: 'birefnet'
  };

  // ------------------------------------------------------------------ yardımcı
  const hexGecerli = (deger) => /^#[0-9a-f]{6}$/i.test(deger || '');

  function acikRenkMi(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72;
  }

  function boyutYaz(bayt) {
    if (!bayt) return '';
    if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`;
    return `${(bayt / 1024 / 1024).toFixed(1)} MB`;
  }

  function durumYaz(metin) {
    durumSol.textContent = metin;
  }

  // ------------------------------------------------------------------ palet kur
  function paletKur() {
    const parca = document.createDocumentFragment();
    for (const renk of PALET) {
      const dugme = document.createElement('button');
      dugme.type = 'button';
      dugme.style.background = renk;
      dugme.title = renk.toUpperCase();
      dugme.dataset.renk = renk;
      dugme.setAttribute('aria-pressed', 'false');
      if (acikRenkMi(renk)) dugme.classList.add('acik-renk');
      dugme.addEventListener('click', () => {
        renkKod.value = renk.toUpperCase();
        renkSecici.value = renk;
        renkOrnek.style.background = renk;
        arkaRenkSec(renk);
      });
      parca.appendChild(dugme);
    }
    palet.appendChild(parca);
  }

  function paletIsaretle(renk) {
    for (const dugme of palet.querySelectorAll('button')) {
      dugme.setAttribute('aria-pressed', dugme.dataset.renk === renk ? 'true' : 'false');
    }
    seffafSecim.setAttribute('aria-pressed', renk ? 'false' : 'true');
  }

  function sonRenkCiz() {
    if (durum.sonRenkler.length === 0) {
      sonRenkler.hidden = true;
      return;
    }
    sonRenkler.hidden = false;
    sonRenkListe.innerHTML = '';
    for (const renk of durum.sonRenkler) {
      const dugme = document.createElement('button');
      dugme.type = 'button';
      dugme.style.background = renk;
      dugme.title = renk.toUpperCase();
      dugme.addEventListener('click', () => {
        renkKod.value = renk.toUpperCase();
        renkSecici.value = renk;
        renkOrnek.style.background = renk;
        arkaRenkSec(renk);
      });
      sonRenkListe.appendChild(dugme);
    }
  }

  function sonRenge(resim) {
    const renk = resim.toUpperCase();
    durum.sonRenkler = [renk, ...durum.sonRenkler.filter((r) => r !== renk)].slice(0, 6);
    localStorage.setItem('sonRenkler', JSON.stringify(durum.sonRenkler));
    sonRenkCiz();
  }

  // ------------------------------------------------------------------ renk
  function arkaRenkSec(renk) {
    durum.arkaRenk = renk;
    paletIsaretle(renk);
    renkOrnek.style.background = renk;
    if (renk) {
      renkSecici.value = renk;
      renkKod.value = renk.toUpperCase();
      sonRenge(renk);
    }
    ciz();
    durumYaz(renk ? `Arka plan rengi ${renk.toUpperCase()}` : 'Arka plan şeffaf');
  }

  // ------------------------------------------------------------------ çizim
  function ciz() {
    const kaynak = durum.gorunum === 'orijinal' ? durum.orijinal : durum.kesik;
    if (!kaynak) return;

    if (tuval.width !== kaynak.width || tuval.height !== kaynak.height) {
      tuval.width = kaynak.width;
      tuval.height = kaynak.height;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tuval.width, tuval.height);

    const doluZemin = durum.gorunum === 'sonuc' && !!durum.arkaRenk;
    if (doluZemin) {
      ctx.fillStyle = durum.arkaRenk;
      ctx.fillRect(0, 0, tuval.width, tuval.height);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(kaynak, 0, 0);

    damali.style.display = doluZemin || durum.gorunum === 'orijinal' ? 'none' : 'block';

    yerles();
  }

  function sigdirmaOlcegi() {
    const alan = tuvalAlan.getBoundingClientRect();
    const payW = Math.max(80, Math.min(160, alan.width * 0.12));
    const payH = Math.max(80, Math.min(140, alan.height * 0.18));
    const w = tuval.width || 1;
    const h = tuval.height || 1;
    return Math.max(0.02, Math.min((alan.width - payW) / w, (alan.height - payH) / h));
  }

  function yerles() {
    if (!tuval.width) return;
    const olcek = durum.otoSigdir ? sigdirmaOlcegi() : durum.olcek;
    durum.olcek = olcek;
    tuvalKap.style.width = Math.max(1, Math.round(tuval.width * olcek)) + 'px';
    tuvalKap.style.height = Math.max(1, Math.round(tuval.height * olcek)) + 'px';
  }

  function zoomAyarla(yeni) {
    durum.otoSigdir = false;
    durum.olcek = Math.max(0.05, Math.min(5, yeni));
    yerles();
  }

  // ------------------------------------------------------------------ görsel
  function gorselArayuzu() {
    const varMi = !!durum.dosya;
    bosDurum.hidden = varMi;
    tuvalAlan.hidden = !varMi;
    dosyaBilgi.hidden = !varMi;
    zoomKutu.hidden = !varMi;
    panel.classList.toggle('pasif', !varMi);
    if (varMi) {
      dosyaAd.textContent = durum.dosya.ad;
      const bilgi = [];
      if (durum.orijinal) bilgi.push(`${durum.orijinal.width} × ${durum.orijinal.height}`);
      if (durum.dosya.boyut) bilgi.push(boyutYaz(durum.dosya.boyut));
      dosyaMeta.textContent = bilgi.join('  ·  ');
      document.title = `${durum.dosya.ad} — Arka Plan Kaldır`;
    } else {
      document.title = 'Arka Plan Kaldır ve Düzenle';
    }
  }

  function dugmeleriGuncelle() {
    btnKaydet.disabled = !durum.kesik || durum.mesgul;
  }

  async function gorselYukle(veri) {
    if (!veri || !veri.veri) return;
    const no = ++istekNo;
    if (durum.orijinal) durum.orijinal.close();
    if (durum.kesik) durum.kesik.close();
    durum.dosya = { yol: veri.yol, ad: veri.ad, boyut: veri.boyut, tur: veri.tur };
    durum.blob = new Blob([veri.veri], { type: veri.tur || 'image/*' });
    durum.kesik = null;
    durum.orijinal = null;
    durum.gorunum = 'sonuc';
    durum.otoSigdir = true;
    gorunumSegmentGuncelle();
    dugmeleriGuncelle();

    try {
      const bitmap = await createImageBitmap(durum.blob);
      if (no !== istekNo) {
        bitmap.close();
        return;
      }
      durum.orijinal = bitmap;
    } catch (hata) {
      bildir('Fotoğraf açılamadı', 'Bu dosya biçimi desteklenmiyor olabilir.', true);
      return;
    }

    gorselArayuzu();
    ciz();
    durumYaz('Arka plan kaldırılıyor…');
    await arkaPlaniKaldir(no);
  }

  function gorunumSegmentGuncelle() {
    for (const dugme of gorunumSegment.querySelectorAll('button')) {
      dugme.setAttribute('aria-pressed', dugme.dataset.gorunum === durum.gorunum ? 'true' : 'false');
    }
  }

  // ------------------------------------------------------------------ kaplama
  function kaplamaGoster({ metin, alt = '', oran = null }) {
    kaplama.hidden = false;
    kaplama.classList.remove('hata');
    kaplamaHata.hidden = true;
    halka.classList.toggle('belirsiz', oran === null);
    kaplamaMetin.textContent = metin;
    kaplamaAlt.textContent = alt;
    if (oran === null) {
      halka.style.setProperty('--p', 0);
      halkaYuzde.textContent = '';
      ilerleme.hidden = true;
    } else {
      halka.style.setProperty('--p', Math.max(0.004, oran));
      halkaYuzde.textContent = `%${Math.round(oran * 100)}`;
      ilerleme.hidden = false;
      ilerlemeCubuk.style.width = `${Math.round(oran * 100)}%`;
    }
  }

  function kaplamaHataGoster(baslik, ayrinti) {
    kaplama.hidden = false;
    kaplama.classList.add('hata');
    halka.classList.remove('belirsiz');
    halka.style.setProperty('--p', 0);
    halkaYuzde.textContent = '!';
    kaplamaMetin.textContent = baslik;
    kaplamaAlt.textContent = ayrinti || '';
    ilerleme.hidden = true;
    kaplamaHata.hidden = false;
  }

  function kaplamaGizle() {
    kaplama.hidden = true;
    kaplama.classList.remove('hata');
  }

  // ------------------------------------------------------------------ model
  async function modelHazirla() {
    const bilgi = await kopru.modelDurum();
    durum.model = bilgi.model || durum.model;
    if (bilgi.hazir) return true;

    kaplamaGoster({
      metin: 'Yapay zekâ modeli hazırlanıyor',
      alt: 'Model kurulumla birlikte gelir; ilk açılışta hazırlanır.',
      oran: 0
    });

    const sonuc = await kopru.modelIndir();
    if (!sonuc || !sonuc.tamam) {
      throw new Error(sonuc && sonuc.hata ? sonuc.hata : 'Model indirilemedi.');
    }
    durum.model = sonuc.model || durum.model;
    return true;
  }

  let istekNo = 0;

  if (kopru.asama) {
    kopru.asama((asama) => {
      if (!durum.mesgul) return;
      if (asama === 'model') {
        kaplamaGoster({
          metin: 'Yüksek kalite model yükleniyor',
          alt: 'İlk fotoğrafta birkaç saniye sürebilir.',
          oran: null
        });
      } else if (asama === 'islem') {
        kaplamaGoster({
          metin: 'Arka plan kaldırılıyor',
          alt: 'Yüksek kalite model çalışıyor…',
          oran: null
        });
      }
    });
  }

  async function arkaPlaniKaldir(no = istekNo) {
    if (!durum.blob) return;
    durum.mesgul = true;
    dugmeleriGuncelle();
    durumYaz('Arka plan kaldırılıyor…');

    try {
      await modelHazirla();

      if (!kopru.arkaPlanKaldir) {
        throw new Error('Arka plan kaldırma motoru yüklenemedi.');
      }

      kaplamaGoster({ metin: 'Arka plan kaldırılıyor', alt: 'Yüksek kalite model özne ile zemini ayırıyor.', oran: null });

      const ham = new Uint8Array(await durum.blob.arrayBuffer());
      const sonuc = await kopru.arkaPlanKaldir(ham);
      if (no !== istekNo) return;
      if (!sonuc || !sonuc.tamam) {
        throw new Error(sonuc && sonuc.hata ? sonuc.hata : 'Arka plan kaldırılamadı.');
      }

      const kesikBlob = new Blob([sonuc.png], { type: 'image/png' });
      durum.kesik = await createImageBitmap(kesikBlob);
      if (no !== istekNo) {
        durum.kesik.close();
        durum.kesik = null;
        return;
      }
      durum.gorunum = 'sonuc';
      gorunumSegmentGuncelle();
      kaplamaGizle();
      ciz();
      dugmeleriGuncelle();
      durumYaz('Arka plan kaldırıldı — renk seçebilir veya kaydedebilirsin.');
      kopru.hazir();
    } catch (hata) {
      console.error(hata);
      if (no === istekNo) {
        kaplamaHataGoster('Arka plan kaldırılamadı', String(hata && hata.message ? hata.message : hata));
        durumYaz('Bir sorun oluştu.');
      }
    } finally {
      if (no === istekNo) {
        durum.mesgul = false;
        dugmeleriGuncelle();
      }
    }
  }

  // ------------------------------------------------------------------ kaydet
  function oneriYolu(uzanti) {
    const ad = durum.dosya ? durum.dosya.ad : 'fotograf';
    const taban = ad.replace(/\.[^./\\]+$/, '');
    const yeniAd = `${taban}-arka-plan-kaldirildi.${uzanti}`;
    const yol = (durum.dosya && durum.dosya.yol) || '';
    const ayrac = yol.includes('\\') ? '\\' : '/';
    const kesme = Math.max(yol.lastIndexOf('\\'), yol.lastIndexOf('/'));
    if (kesme > 0) return yol.slice(0, kesme + 1) + yeniAd;
    return yeniAd;
  }

  function kayitTuvali() {
    const tuval2 = document.createElement('canvas');
    tuval2.width = durum.kesik.width;
    tuval2.height = durum.kesik.height;
    const b = tuval2.getContext('2d');
    const zemin = durum.arkaRenk || (durum.format === 'jpeg' ? '#ffffff' : null);
    if (zemin) {
      b.fillStyle = zemin;
      b.fillRect(0, 0, tuval2.width, tuval2.height);
    }
    b.imageSmoothingEnabled = true;
    b.imageSmoothingQuality = 'high';
    b.drawImage(durum.kesik, 0, 0);
    return tuval2;
  }

  async function kaydet() {
    if (!durum.kesik || durum.mesgul) return;
    const jpeg = durum.format === 'jpeg';
    const tuval2 = kayitTuvali();
    const blob = await new Promise((cozum) =>
      tuval2.toBlob(cozum, jpeg ? 'image/jpeg' : 'image/png', 0.95)
    );
    if (!blob) {
      bildir('Kaydedilemedi', 'Görsel oluşturulamadı.', true);
      return;
    }
    const veri = new Uint8Array(await blob.arrayBuffer());
    const sonuc = await kopru.kaydet({
      veri,
      oneri: oneriYolu(jpeg ? 'jpg' : 'png'),
      format: jpeg ? 'jpeg' : 'png'
    });

    if (sonuc && sonuc.yol) {
      bildir('Fotoğraf kaydedildi', sonuc.ad, false, 'Klasörde göster', () =>
        kopru.klasorGoster(sonuc.yol)
      );
      durumYaz(`Kaydedildi: ${sonuc.ad}`);
    }
  }

  // ------------------------------------------------------------------ bildirim
  let bildirimZaman = null;
  function bildir(baslik, alt, hata = false, eylemMetni = null, eylem = null) {
    clearTimeout(bildirimZaman);
    bildirimBaslik.textContent = baslik;
    bildirimAlt.textContent = alt || '';
    bildirim.classList.toggle('hata', !!hata);
    if (eylemMetni) {
      bildirimEylem.hidden = false;
      bildirimEylem.textContent = eylemMetni;
      bildirimEylem.onclick = () => {
        eylem && eylem();
        bildirim.hidden = true;
      };
    } else {
      bildirimEylem.hidden = true;
      bildirimEylem.onclick = null;
    }
    bildirim.hidden = false;
    bildirimZaman = setTimeout(() => (bildirim.hidden = true), hata ? 7000 : 5000);
  }

  // ------------------------------------------------------------------ olaylar
  seffafSecim.addEventListener('click', () => arkaRenkSec(null));

  renkSecici.addEventListener('input', () => {
    renkOrnek.style.background = renkSecici.value;
    renkKod.value = renkSecici.value.toUpperCase();
    arkaRenkSec(renkSecici.value);
  });

  renkKod.addEventListener('keydown', (olay) => {
    if (olay.key !== 'Enter') return;
    let deger = renkKod.value.trim();
    if (!deger.startsWith('#')) deger = '#' + deger;
    if (!hexGecerli(deger)) {
      renkKod.value = (durum.arkaRenk || '#7C5CFF').toUpperCase();
      return;
    }
    renkSecici.value = deger;
    renkOrnek.style.background = deger;
    arkaRenkSec(deger.toLowerCase());
  });

  renkUygula.addEventListener('click', () => {
    let deger = renkKod.value.trim();
    if (!deger.startsWith('#')) deger = '#' + deger;
    if (!hexGecerli(deger)) {
      bildir('Geçersiz renk kodu', '#7C5CFF gibi 6 haneli bir kod gir.', true);
      return;
    }
    renkSecici.value = deger;
    renkOrnek.style.background = deger;
    arkaRenkSec(deger.toLowerCase());
  });

  gorunumSegment.addEventListener('click', (olay) => {
    const dugme = olay.target.closest('button');
    if (!dugme) return;
    if (!durum.kesik && dugme.dataset.gorunum === 'sonuc') return;
    durum.gorunum = dugme.dataset.gorunum;
    gorunumSegmentGuncelle();
    ciz();
  });

  formatSegment.addEventListener('click', (olay) => {
    const dugme = olay.target.closest('button');
    if (!dugme) return;
    durum.format = dugme.dataset.format;
    for (const d of formatSegment.querySelectorAll('button')) {
      d.setAttribute('aria-pressed', d.dataset.format === durum.format ? 'true' : 'false');
    }
    kaydetIpucu.textContent =
      durum.format === 'jpeg'
        ? durum.arkaRenk
          ? 'Seçtiğin renk zemine uygulanır, dosya küçük olur.'
          : 'JPEG şeffaflığı desteklemez; şeffaf alan beyaz olur.'
        : 'Şeffaflık korunur, dosya kayıpsız olur.';
  });

  btnKaydet.addEventListener('click', kaydet);
  btnYeni.addEventListener('click', async () => {
    const veri = await kopru.dosyaAc();
    if (veri) gorselYukle(veri);
  });
  btnSec.addEventListener('click', async () => {
    const veri = await kopru.dosyaAc();
    if (veri) gorselYukle(veri);
  });
  btnTekrar.addEventListener('click', () => {
    if (durum.kesik) kaplamaGizle();
    else arkaPlaniKaldir();
  });

  el('btnKucult').addEventListener('click', () => kopru.pencere('kucult'));
  el('btnBuyut').addEventListener('click', () => kopru.pencere('buyut'));
  el('btnKapat').addEventListener('click', () => kopru.pencere('kapat'));

  document.querySelector('.baslik').addEventListener('dblclick', (olay) => {
    if (olay.target.closest('.pencere-dugmeleri')) return;
    kopru.pencere('buyut');
  });

  el('zoomEksi').addEventListener('click', () => zoomAyarla(durum.olcek / 1.25));
  el('zoomArtı').addEventListener('click', () => zoomAyarla(durum.olcek * 1.25));
  el('zoomSigdir').addEventListener('click', () => {
    durum.otoSigdir = true;
    yerles();
  });

  tuvalAlan.addEventListener(
    'wheel',
    (olay) => {
      if (!olay.ctrlKey || !durum.orijinal) return;
      olay.preventDefault();
      zoomAyarla(durum.olcek * (olay.deltaY < 0 ? 1.12 : 0.89));
    },
    { passive: false }
  );

  window.addEventListener('keydown', (olay) => {
    if (!(olay.ctrlKey || olay.metaKey)) return;
    const tus = olay.key.toLowerCase();
    if (tus === 's') {
      olay.preventDefault();
      kaydet();
    } else if (tus === 'o') {
      olay.preventDefault();
      kopru.dosyaAc().then((veri) => veri && gorselYukle(veri));
    }
  });

  window.addEventListener('resize', () => {
    if (durum.otoSigdir) yerles();
  });

  panel.addEventListener('auxclick', (olay) => olay.preventDefault());

  // sürükle bırak
  let suruklemeSayaci = 0;
  document.addEventListener('dragenter', (olay) => {
    olay.preventDefault();
    suruklemeSayaci += 1;
    document.body.classList.add('surukle');
  });
  document.addEventListener('dragover', (olay) => olay.preventDefault());
  document.addEventListener('dragleave', (olay) => {
    olay.preventDefault();
    suruklemeSayaci = Math.max(0, suruklemeSayaci - 1);
    if (suruklemeSayaci === 0) document.body.classList.remove('surukle');
  });
  document.addEventListener('drop', async (olay) => {
    olay.preventDefault();
    suruklemeSayaci = 0;
    document.body.classList.remove('surukle');
    const dosya = olay.dataTransfer.files && olay.dataTransfer.files[0];
    if (!dosya) return;
    if (!/^image\//.test(dosya.type) && !/\.(jpe?g|png|webp|bmp|gif|tiff?|avif)$/i.test(dosya.name)) {
      bildir('Bu dosya bir fotoğraf değil', dosya.name, true);
      return;
    }
    const yol = kopru.yolAl ? kopru.yolAl(dosya) : null;
    if (yol) {
      const veri = await kopru.yenidenOku(yol);
      if (veri) {
        gorselYukle(veri);
        return;
      }
    }
    gorselYukle({
      yol: '',
      ad: dosya.name,
      boyut: dosya.size,
      tur: dosya.type || 'image/png',
      veri: new Uint8Array(await dosya.arrayBuffer())
    });
  });

  kopru.dosyaGeldi((veri) => gorselYukle(veri));
  kopru.indirmeGeldi(({ oran, metin }) => {
    if (kaplama.hidden) return;
    kaplamaGoster({
      metin: metin || 'Model indiriliyor',
      alt: 'Yüksek kalite model hazırlanıyor.',
      oran: typeof oran === 'number' ? oran : 0
    });
  });

  // ------------------------------------------------------------------ tema
  const TEMALAR = ['koyu', 'acik', 'gece', 'sicak'];
  const TEMA_ZEMIN = {
    koyu: '#0a0c11',
    acik: '#eef1f8',
    gece: '#0a1220',
    sicak: '#f6f1e6'
  };
  const btnTema = el('btnTema');
  const temaMenu = el('temaMenu');

  function temaUygula(tema, kaydet) {
    const secili = TEMALAR.includes(tema) ? tema : 'koyu';
    document.documentElement.dataset.tema = secili;
    for (const dugme of temaMenu.querySelectorAll('.tema-sec')) {
      dugme.setAttribute('aria-checked', dugme.dataset.tema === secili ? 'true' : 'false');
    }
    if (kaydet) {
      try {
        localStorage.setItem('tema', secili);
      } catch {
        /* yoksay */
      }
    }
    if (kopru.temaZemin) kopru.temaZemin(TEMA_ZEMIN[secili]);
  }

  function temaMenuKapat() {
    temaMenu.hidden = true;
    btnTema.setAttribute('aria-expanded', 'false');
  }

  btnTema.addEventListener('click', (olay) => {
    olay.stopPropagation();
    const acilacak = temaMenu.hidden;
    temaMenu.hidden = !acilacak;
    btnTema.setAttribute('aria-expanded', acilacak ? 'true' : 'false');
  });

  temaMenu.addEventListener('click', (olay) => {
    const dugme = olay.target.closest('.tema-sec');
    if (!dugme) return;
    temaUygula(dugme.dataset.tema, true);
    temaMenuKapat();
    btnTema.focus();
  });

  document.addEventListener('click', (olay) => {
    if (!temaMenu.hidden && !olay.target.closest('.tema-kap')) temaMenuKapat();
  });

  document.addEventListener('keydown', (olay) => {
    if (olay.key === 'Escape' && !temaMenu.hidden) {
      temaMenuKapat();
      btnTema.focus();
    }
  });

  // ------------------------------------------------------------------ başlat
  temaUygula(document.documentElement.dataset.tema || 'koyu', false);
  paletKur();
  sonRenkCiz();
  arkaRenkSec(null);
  gorselArayuzu();
  dugmeleriGuncelle();
  durumYaz('Fotoğraf seç veya sürükle');

  kopru.ilkDosya().then((veri) => {
    if (veri) gorselYukle(veri);
  });
})();
