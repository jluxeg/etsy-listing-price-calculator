const MANIFEST_PATH = './site.webmanifest';
let CURRENT_CACHE = null;

const FILES_TO_CACHE = [
	'./',
	'./index.html',
	'./src/styles.css',
	'./src/scripts.js',
	MANIFEST_PATH,
	'./icons/web-app-manifest-192x192.png',
	'./icons/web-app-manifest-512x512.png',
	'./img/folder.svg',
	'./img/save-file.svg'
];

//fetch version from manifest
async function getCacheName() {
	const res = await fetch(MANIFEST_PATH, {cache: 'no-store'});
	const manifest = await res.json();
	return `elpc-${manifest.version}`;
}

//install: cache app shell
self.addEventListener('install', event => {
	event.waitUntil(
		(async () => {
			const CACHE_NAME = await getCacheName();
			CURRENT_CACHE = CACHE_NAME;
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll(FILES_TO_CACHE);
		})()
	);
	//self.skipWaiting(); //activate immediately, using a modal to notify and button instead
});

//activate: remove old caches
self.addEventListener('activate', event => {
	event.waitUntil(
		(async () => {
			const CACHE_NAME = await getCacheName();
			CURRENT_CACHE = CACHE_NAME;
			const keys = await caches.keys();
			await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
		})()
	);
	self.clients.claim(); //take control of open pages
});

//fetch: serve from cache, fall back to network
self.addEventListener('fetch', event => {
	event.respondWith(
		caches.match(event.request).then(response => response || fetch(event.request))
	);
});

//message: handle skipWaiting for instant update
self.addEventListener('message', event => {
	if (event.data && event.data.action === 'skipWaiting') {
		self.skipWaiting();
	}
});