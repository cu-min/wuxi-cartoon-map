// Load POIs only when entering a city. Successful data stays cached for this visit.
(() => {
  const pending = new Map();
  window.CITY_DATA = window.CITY_DATA || {};
  window.loadCityData = function loadCityData(key) {
    if (!/^[a-z0-9-]+$/.test(key) || !Object.prototype.hasOwnProperty.call(window.CITY_CATALOG || {}, key)) {
      return Promise.reject(new Error('Unknown city: ' + key));
    }
    if (Object.prototype.hasOwnProperty.call(window.CITY_DATA, key)) return Promise.resolve(window.CITY_DATA[key]);
    if (pending.has(key)) return pending.get(key);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let timer;
      function finish(error) {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        script.remove();
        if (error) reject(error);
        else resolve(window.CITY_DATA[key]);
      }
      script.src = 'data/' + key + '.js';
      script.async = true;
      script.onload = () => finish(Object.prototype.hasOwnProperty.call(window.CITY_DATA, key)
        ? null : new Error('City script did not register data: ' + key));
      script.onerror = () => finish(new Error('City data could not be loaded: ' + key));
      timer = setTimeout(() => finish(new Error('City data load timed out: ' + key)), 15000);
      document.head.appendChild(script);
    });
    pending.set(key, promise);
    // Remove failed/in-flight entries so a later visit can retry. The city itself
    // remains in CITY_DATA after success; stale route handling belongs to router.
    promise.then(() => pending.delete(key), () => pending.delete(key));
    return promise;
  };
})();
