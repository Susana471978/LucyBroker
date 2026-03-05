// service-worker.js
// SyntexIA PWA Service Worker

const CACHE_NAME = 'syntexia-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/static/js/main.chunk.js',
    '/static/js/bundle.js',
    '/static/css/main.chunk.css',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// =====================================================
// INSTALL — cachear assets estáticos
// =====================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // Si algún asset falla, continuar igualmente
            });
        })
    );
    self.skipWaiting();
});

// =====================================================
// ACTIVATE — limpiar caches antiguas
// =====================================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// =====================================================
// FETCH — estrategia: Network first, cache fallback
// =====================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Las llamadas a la API siempre van a la red (nunca cacheamos datos)
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Para assets estáticos: network first, cache fallback
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Guardar copia en cache si la respuesta es válida
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Sin red: devolver desde cache
                return caches.match(request).then((cached) => {
                    if (cached) return cached;
                    // Si no hay cache y es navegación, devolver index.html
                    if (request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// =====================================================
// PUSH NOTIFICATIONS (preparado para futuro)
// =====================================================
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
        },
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'SyntexIA Executive', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
    );
});