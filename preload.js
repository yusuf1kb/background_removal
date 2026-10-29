const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('kopru', {
  // pencere
  pencere: (islem) => ipcRenderer.invoke('ap:pencere', islem),
  pencereDurum: () => ipcRenderer.invoke('ap:pencere-durum'),
  temaZemin: (renk) => ipcRenderer.send('ap:tema-zemin', renk),

  // dosyalar
  dosyaAc: () => ipcRenderer.invoke('ap:ac'),
  ilkDosya: () => ipcRenderer.invoke('ap:ilk-dosya'),
  yenidenOku: (yol) => ipcRenderer.invoke('ap:yeniden-oku', yol),
  kaydet: (veri) => ipcRenderer.invoke('ap:kaydet', veri),
  klasorGoster: (yol) => ipcRenderer.invoke('ap:klasor-goster', yol),
  yolAl: (dosya) => {
    try {
      return webUtils.getPathForFile(dosya) || null;
    } catch {
      return null;
    }
  },

  // model
  modelDurum: () => ipcRenderer.invoke('ap:model-durum'),
  modelIndir: () => ipcRenderer.invoke('ap:model-indir'),
  arkaPlanKaldir: (veri) => ipcRenderer.invoke('ap:arka-plan', veri),
  asama: (geri) => {
    const dinleyici = (_olay, asama) => geri(asama);
    ipcRenderer.on('ap:asama', dinleyici);
    return () => ipcRenderer.removeListener('ap:asama', dinleyici);
  },

  // olaylar
  dosyaGeldi: (geri) => {
    const dinleyici = (_olay, veri) => geri(veri);
    ipcRenderer.on('ap:dosya', dinleyici);
    return () => ipcRenderer.removeListener('ap:dosya', dinleyici);
  },
  indirmeGeldi: (geri) => {
    const dinleyici = (_olay, veri) => geri(veri);
    ipcRenderer.on('ap:indirme', dinleyici);
    return () => ipcRenderer.removeListener('ap:indirme', dinleyici);
  },
  hazir: () => ipcRenderer.send('ap:hazir')
});
