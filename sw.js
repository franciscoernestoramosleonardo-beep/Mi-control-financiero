const CACHE_NAME = 'control-financiero-v1';
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
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .catch(err => console.warn('⚠️ SW: No se pudo cachear todo', err))
    );
    self.skipWaiting();
});

// Activar: limpia cachés viejas
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: usa caché primero, si falla va a la red
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
            .catch(() => caches.match('./index.html'))
    );
});