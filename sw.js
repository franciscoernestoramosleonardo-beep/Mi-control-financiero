// 🔄 VERSIÓN DEL CACHE - CAMBIA ESTE NÚMERO CADA VEZ QUE MODIFIQUES CÓDIGO
const CACHE_VERSION = 'v2.0.2';
const CACHE_NAME = 'control-financiero-' + CACHE_VERSION;

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icono.png',
    'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js',
    'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js'
];

// Instalar: guarda todo en caché
self.addEventListener('install', event => {
    console.log('🔧 SW: Instalando versión', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .catch(err => console.warn('⚠️ SW: No se pudo cachear todo', err))
    );
    self.skipWaiting();
});

// Activar: BORRA TODAS LAS CACHÉS VIEJAS
self.addEventListener('activate', event => {
    console.log('🚀 SW: Activando versión', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(k => k.startsWith('control-financiero-') && k !== CACHE_NAME)
                    .map(k => {
                        console.log('🗑️ SW: Eliminando caché vieja:', k);
                        return caches.delete(k);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network First para archivos principales
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Para archivos locales (HTML, CSS, JS): intentar red primero
    if (url.origin === location.origin && 
        (url.pathname.endsWith('.html') || 
         url.pathname.endsWith('.css') || 
         url.pathname.endsWith('.js'))) {
        
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }
    
    // Para otros archivos: caché primero
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
            .catch(() => caches.match('./index.html'))
    );
});

// 📡 Mensaje para forzar actualización desde la app
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data === 'CLEAR_CACHE') {
        caches.keys().then(keys => {
            keys.forEach(key => caches.delete(key));
        });
    }
});