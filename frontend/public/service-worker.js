// service-worker.js
// Lucy PWA Service Worker
// CACHE_NAME se actualiza automáticamente en cada deploy via sed o build script

const CACHE_NAME = 'lucy-BUILD_HASH';

// =====================================================
// INSTALL — precache solo el shell mínimo
// =====================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Solo cachear lo que sabemos que existe siempre
            // Los JS/CSS con hash se cachean en el fetch handler
            return cache.addAll([
                '/',
                '/index.html',
                '/manifest.json',
            ]).catch(() => {
                // Si algún asset falla (ej: offline), continuar igualmente
            });
        })
    );
    self.skipWaiting();
});

// =====================================================
// ACTIVATE — limpiar TODAS las caches antiguas
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
// FETCH — Network first, cache fallback
// =====================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API calls: always network, never cache
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Hashed static assets (e.g. /static/js/main.a1b2c3.js):
    // Cache first — the hash guarantees uniqueness
    if (url.pathname.startsWith('/static/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Everything else: network first, cache fallback
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(request).then((cached) => {
                    if (cached) return cached;
                    // SPA fallback: return index.html for navigation requests
                    if (request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// =====================================================
// PUSH NOTIFICATIONS
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
        self.registration.showNotification(data.title || 'Lucy', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
    );
});