(function (nonce) {
  if (window.top !== window || !window.__tmContentExport || !window.TMShell)
    return;
  var busy = false;
  var maxBytes = 64 * 1024 * 1024;
  function failed() {
    busy = false;
    try {
      window.TMShell.legacyDownloadError(nonce);
    } catch (ignored) {}
  }
  document.addEventListener(
    'click',
    function (event) {
      if (
        event.defaultPrevented ||
        event.isTrusted !== true ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      var anchor = event.target;
      while (anchor && anchor.tagName !== 'A') anchor = anchor.parentNode;
      if (!anchor || !anchor.hasAttribute('download')) return;
      var url = document.createElement('a');
      url.href = anchor.href;
      if (
        (url.protocol !== 'http:' && url.protocol !== 'https:') ||
        url.protocol !== window.location.protocol ||
        url.host !== window.location.host
      )
        return;
      event.preventDefault();
      if (busy) {
        try {
          window.TMShell.legacyDownloadError(nonce);
        } catch (ignored) {}
        return;
      }
      busy = true;
      var request = new XMLHttpRequest();
      var ended = false;
      function error() {
        if (ended) return;
        ended = true;
        failed();
      }
      request.onerror = request.ontimeout = error;
      request.onprogress = function (progress) {
        if (
          progress.loaded > maxBytes ||
          (progress.lengthComputable && progress.total > maxBytes)
        ) {
          request.abort();
          error();
        }
      };
      request.onload = function () {
        if (ended) return;
        if (!request.responseURL) {
          error();
          return;
        }
        var finalUrl = document.createElement('a');
        finalUrl.href = request.responseURL;
        if (
          finalUrl.protocol !== window.location.protocol ||
          finalUrl.host !== window.location.host
        ) {
          error();
          return;
        }
        if (
          request.status < 200 ||
          request.status >= 300 ||
          !request.response ||
          request.response.size > maxBytes
        ) {
          error();
          return;
        }
        ended = true;
        var name = anchor.getAttribute('download') || 'download';
        window.__tmContentExport
          .saveBlob(request.response, name)
          .then(function () {
            busy = false;
          }, failed);
      };
      try {
        request.open('GET', url.href, true);
        request.responseType = 'blob';
        request.timeout = 120000;
        request.send();
      } catch (ignored) {
        error();
      }
    },
    true
  );
});
