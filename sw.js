const CACHE_NAME = 'pwa-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css?family=Segoe+UI:300,400,500,700&display=swap'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  // فتح الكاش وتخزين الملفات المهمة
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activated');
  
  // حذف الكاش القديم إذا وجد
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', event => {
  console.log('Service Worker: Fetching', event.request.url);
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وجد الملف في الكاش، نعيده
        if (response) {
          return response;
        }
        
        // إذا لم نجده، نحمله من الشبكة
        return fetch(event.request)
          .then(response => {
            // نتحقق من أن الرد صالح للتخزين
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // ننسخ الرد لأننا يمكن أن نستخدمه مرة واحدة فقط
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          });
      })
  );
});
