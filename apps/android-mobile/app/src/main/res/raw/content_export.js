(function (nonce) {
  var host = window.TMShell;
  if (
    window.top !== window ||
    !host ||
    !host.beginContentExport ||
    !host.writeContentExport ||
    !host.completeContentExport ||
    !host.cancelContentExport
  )
    return;
  var active = null;
  function settle(task, value, error) {
    if (active !== task) return;
    active = null;
    if (task.reader) {
      try {
        task.reader.abort();
      } catch (ignored) {}
    }
    if (error) task.reject(error);
    else task.resolve(value);
  }
  function fail(task) {
    if (active !== task) return;
    settle(task, null, new Error('Content export failed'));
    try {
      host.cancelContentExport(nonce, task.id);
    } catch (ignored) {}
  }
  function next(task) {
    if (active !== task) return;
    if (task.offset === task.blob.size) {
      try {
        if (host.completeContentExport(nonce, task.id) !== true) {
          fail(task);
          return;
        }
        settle(task, 'queued');
      } catch (error) {
        fail(task);
      }
      return;
    }
    var end = Math.min(task.offset + 65536, task.blob.size);
    var reader = new FileReader();
    task.reader = reader;
    reader.onerror = function () {
      fail(task);
    };
    reader.onabort = function () {
      if (active === task) fail(task);
    };
    reader.onload = function () {
      if (active !== task) return;
      var result = reader.result;
      if (typeof result !== 'string' || result.indexOf(',') < 0) {
        fail(task);
        return;
      }
      try {
        var ack = host.writeContentExport(
          nonce,
          task.id,
          task.sequence,
          result.slice(result.indexOf(',') + 1)
        );
        if (ack !== end) {
          fail(task);
          return;
        }
        task.offset = end;
        task.sequence++;
        setTimeout(function () {
          next(task);
        }, 0);
      } catch (error) {
        fail(task);
      }
    };
    try {
      reader.readAsDataURL(task.blob.slice(task.offset, end));
    } catch (error) {
      fail(task);
    }
  }
  window.__tmContentExport = {
    version: 1,
    saveBlob: function (blob, name) {
      return new Promise(function (resolve, reject) {
        if (active) {
          reject(new Error('Content export busy'));
          return;
        }
        if (
          !blob ||
          typeof blob.size !== 'number' ||
          !isFinite(blob.size) ||
          Math.floor(blob.size) !== blob.size ||
          blob.size < 0 ||
          blob.size > 1073741824 ||
          typeof blob.slice !== 'function'
        ) {
          reject(new Error('Content export size unsupported'));
          return;
        }
        var task = {
          id:
            Date.now().toString(36) +
            '_' +
            Math.random().toString(36).slice(2, 14),
          blob: blob,
          offset: 0,
          sequence: 0,
          phase: 'waiting',
          resolve: resolve,
          reject: reject,
        };
        active = task;
        try {
          host.beginContentExport(
            nonce,
            JSON.stringify({
              v: 1,
              nonce: nonce,
              id: task.id,
              name: String(name || 'download').slice(0, 512),
              mime: String(blob.type || 'application/octet-stream').slice(
                0,
                256
              ),
              bytes: blob.size,
            })
          );
        } catch (error) {
          fail(task);
        }
      });
    },
    reply: function (id, status) {
      var task = active;
      if (!task || task.id !== id) return;
      if (status === 'cancelled') {
        settle(task, 'cancelled');
        return;
      }
      if (status === 'failed') {
        fail(task);
        return;
      }
      if (status === 'ready' && task.phase === 'waiting') {
        task.phase = 'reading';
        next(task);
      }
    },
  };
  if (typeof document !== 'undefined' && window.dispatchEvent) {
    var event = document.createEvent('Event');
    event.initEvent('tm-content-export-ready', false, false);
    window.dispatchEvent(event);
  }
});
