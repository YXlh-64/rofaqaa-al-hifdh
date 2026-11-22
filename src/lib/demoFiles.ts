// Demo uploads are kept in IndexedDB, never sent to the real project.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rofaqa-demo-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("تعذّر فتح مساحة الملفات المحلية."));
  });
}
export async function putDemoFile(key: string, file: Blob): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("تعذّر حفظ الملف على هذا الجهاز."));
    };
  });
}
export async function getDemoFile(key: string): Promise<Blob> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(key);
    request.onsuccess = () => {
      db.close();
      request.result
        ? resolve(request.result)
        : reject(new Error("الملف المحلي غير متاح على هذا الجهاز."));
    };
    request.onerror = () => {
      db.close();
      reject(new Error("تعذّر قراءة الملف المحلي."));
    };
  });
}
export async function clearDemoFiles(): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("تعذّر مسح الملفات المحلية."));
    };
  });
}
