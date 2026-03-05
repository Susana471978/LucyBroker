// src/registerSW.js
// Registro del Service Worker para PWA

export function registerSW() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/service-worker.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registrado:', registration.scope);

                    // Detectar actualizaciones disponibles
                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (!installingWorker) return;

                        installingWorker.onstatechange = () => {
                            if (
                                installingWorker.state === 'installed' &&
                                navigator.serviceWorker.controller
                            ) {
                                console.log('[PWA] Nueva versión disponible — recarga para actualizar.');
                            }
                        };
                    };
                })
                .catch((error) => {
                    console.warn('[PWA] Service Worker no pudo registrarse:', error);
                });
        });
    }
}

export function unregisterSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then((registration) => registration.unregister())
            .catch((error) => console.error(error));
    }
}