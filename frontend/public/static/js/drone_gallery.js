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
      '  <img class="tunnel-gallery-modal-image" alt="drone" />',
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

  function initGallery() {
    var panel = document.getElementById('drone-gallery');
    if (!panel) return;

    var list = panel.querySelector('.tunnel-gallery-list');
    var status = panel.querySelector('.tunnel-gallery-status');
    var filters = panel.querySelector('.drone-gallery-filters');
    if (!list || !filters) return;

    var modal = createModal();
    var allItems = [];
    var activeGroup = 'ALL';

    function render() {
      list.innerHTML = '';
      var items = activeGroup === 'ALL'
        ? allItems
        : allItems.filter(function(item) { return item.group === activeGroup; });

      if (status) status.textContent = items.length + ' images';

      items.forEach(function(item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tunnel-gallery-thumb';
        btn.title = item.id || 'drone';

        var img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = item.id || 'drone';
        img.src = './' + item.thumb;
        btn.appendChild(img);

        btn.addEventListener('click', function() {
          modal.open('./' + item.image);
        });

        list.appendChild(btn);
      });
    }

    function setActiveGroup(group) {
      activeGroup = group;
      Array.prototype.forEach.call(filters.querySelectorAll('button'), function(btn) {
        btn.classList.toggle('is-active', btn.dataset.group === group);
      });
      render();
    }

    fetch('./assets/drone/manifest.json')
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        allItems = data && data.items ? data.items : [];
        if (!allItems.length) {
          if (status) status.textContent = 'No images found';
          return;
        }

        var groups = Array.from(new Set(allItems.map(function(item) { return item.group; })))
          .filter(Boolean)
          .sort();

        var allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.textContent = 'ALL';
        allBtn.dataset.group = 'ALL';
        allBtn.className = 'drone-filter-btn is-active';
        allBtn.addEventListener('click', function() { setActiveGroup('ALL'); });
        filters.appendChild(allBtn);

        groups.forEach(function(group) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = group;
          btn.dataset.group = group;
          btn.className = 'drone-filter-btn';
          btn.addEventListener('click', function() { setActiveGroup(group); });
          filters.appendChild(btn);
        });

        render();
      })
      .catch(function(err) {
        if (status) status.textContent = 'Load failed';
        console.warn('[drone_gallery] load failed', err);
      });
  }

  window.addEventListener('load', initGallery);
})();
