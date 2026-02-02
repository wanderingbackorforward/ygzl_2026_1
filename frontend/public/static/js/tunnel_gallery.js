// -*- coding: utf-8 -*-
(function() {
  'use strict';

  function createModal() {
    var modal = document.createElement('div');
    modal.className = 'tunnel-gallery-modal';
    modal.innerHTML = [
      '<div class="tunnel-gallery-modal-backdrop"></div>',
      '<div class="tunnel-gallery-modal-content">',
      '  <button class="tunnel-gallery-modal-close" type="button">Close</button>',
      '  <img class="tunnel-gallery-modal-image" alt="tunnel" />',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var backdrop = modal.querySelector('.tunnel-gallery-modal-backdrop');
    var closeBtn = modal.querySelector('.tunnel-gallery-modal-close');

    function close() {
      modal.classList.remove('is-open');
    }

    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);

    return {
      open: function(src) {
        var img = modal.querySelector('.tunnel-gallery-modal-image');
        img.src = src;
        modal.classList.add('is-open');
      }
    };
  }

  function initGallery(containerId) {
    var panel = document.getElementById(containerId);
    if (!panel) return;

    var list = panel.querySelector('.tunnel-gallery-list');
    if (!list) return;

    var modal = createModal();
    var status = panel.querySelector('.tunnel-gallery-status');

    fetch('./assets/tunnel/manifest.json')
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        var items = data && data.items ? data.items : [];
        if (!items.length) {
          if (status) status.textContent = 'No images found';
          return;
        }

        if (status) status.textContent = items.length + ' images';

        items.forEach(function(item) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'tunnel-gallery-thumb';
          btn.title = item.id || 'tunnel';

          var img = document.createElement('img');
          img.loading = 'lazy';
          img.alt = item.id || 'tunnel';
          img.src = './' + item.thumb;
          btn.appendChild(img);

          btn.addEventListener('click', function() {
            modal.open('./' + item.image);
          });

          list.appendChild(btn);
        });
      })
      .catch(function(err) {
        if (status) status.textContent = 'Load failed';
        console.warn('[tunnel_gallery] load failed', err);
      });
  }

  window.addEventListener('load', function() {
    initGallery('tunnel-gallery');
  });
})();
