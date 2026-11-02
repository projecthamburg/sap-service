let loading;
export async function googleMaps(key) {
  if (window.google?.maps?.Map) return window.google.maps;
  if (!key) throw Error("Google Maps is not configured.");
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script"),
        callback = "sapMapsReady";
      const timer = setTimeout(
        () =>
          reject(
            Error("Google Maps timed out. Choose the fallback map or retry.")
          ),
        20000
      );
      window[callback] = () => {
        clearTimeout(timer);
        delete window[callback];
        resolve(window.google.maps);
      };
      window.gm_authFailure = () => {
        window.dispatchEvent(new Event("sap-map-auth-failure"));
        clearTimeout(timer);
        reject(
          Error("Google Maps authorization failed. Use the fallback map.")
        );
      };
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callback}&loading=async&v=quarterly`;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        reject(Error("Google Maps could not load."));
      };
      document.head.append(script);
    }).catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}
