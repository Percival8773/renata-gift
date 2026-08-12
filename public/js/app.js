/* =========================================================
   renata-gift — app
   ========================================================= */

(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const DEVICE_KEY = 'rg_device';
  const SESSION_OPEN = 'rg_opened_session';

  const FALLBACK = {
    novia: { nombre: 'Ren', edad: 15 },
    remitente: 'Jorge',
    unlockAt: '2020-01-01T00:00:00-03:00',
    capas: {
      bienvenida: { titulo: 'Para ti', texto: 'Una cajita hecha con amor, solo para ti.' },
      velas: { titulo: 'Tus 15 velas', instruccion: 'Toca cada vela.', razones: Array(15).fill('Te quiero.') },
      audio: { archivo: '', titulo: 'Mi voz', texto: 'Un mensaje tuyo para ella va aquí.' },
      recuerdos: { titulo: 'Recuerdos', texto: '', fotos: [] },
      carta: { titulo: 'Mi carta para ti', parrafos: ['Hola.'], despedida: 'Con amor', firma: 'Jorge' },
      globos: { titulo: 'Globos de deseos', texto: '', deseos: [] },
      sobres: { titulo: 'Sobres para cuando…', texto: '', sobres: [] },
      playlist: { titulo: 'Playlist', texto: '', canciones: [] },
      constelacion: { titulo: 'Constelación', texto: '', nombre: 'Ren', frase: '' },
      secreto: { titulo: 'Secreto', texto: '', modalTitulo: 'La contraseña', pista: '', video: '' }
    }
  };

  const state = {
    status: null,
    content: null,
    layer: 0,          // 0 = caja
    device: '',
    candlesLeft: 15,
    musicPausedByVideo: false,
    musicPausedByVoice: false
  };

  const tpl = (str) => String(str || '')
    .replace(/\{nombre\}/g, state.content && state.content.novia ? state.content.novia.nombre : '')
    .replace(/\{edad\}/g, state.content && state.content.novia ? state.content.novia.edad : '')
    .replace(/\{remitente\}/g, state.content ? state.content.remitente : '');

  /* ---------------- utilidades ---------------- */

  const deviceId = () => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  };

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
  }

  function unlockedClient(content) {
    try { return Date.now() >= new Date(content.unlockAt).getTime(); } catch (e) { return false; }
  }

  function goToLayer(idx) {
    state.layer = idx;
    showScreen('layer');
    setTheme(idx);
    const content = state.content;
    const capas = content.capas;
    const holder = $('#layer-content');
    const nextBtn = $('#btn-next');
    nextBtn.hidden = true;
    nextBtn.onclick = null;
    nextBtn.textContent = 'Continuar →';

    try {
      switch (idx) {
        case 1: buildBienvenida(holder, nextBtn, capas); break;
        case 2: buildPlaylist(holder, nextBtn, capas); break;
        case 3: buildVelas(holder, nextBtn, capas); break;
        case 4: buildAudio(holder, nextBtn, capas); break;
        case 5: buildRecuerdos(holder, nextBtn, capas); break;
        case 6: buildCarta(holder, nextBtn, capas); break;
        case 7: buildGlobos(holder, nextBtn, capas); break;
        case 8: buildSobres(holder, nextBtn, capas); break;
        case 9: buildConstelacion(holder, nextBtn, capas); break;
        case 10: buildFinal(holder, nextBtn, capas); break;
        case 11: buildSecreto(holder, nextBtn, capas); break;
        default: showScreen('box');
      }
    } catch (err) {
      holder.innerHTML = '<p class="layer-body">Algo se quedó sin cargar aquí. Sigue adelante →</p>';
      nextBtn.hidden = false;
      nextBtn.textContent = 'Continuar →';
    }
    saveProgress(idx);
  }

  function saveProgress(layer) {
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: state.device, layer })
    }).catch(() => {});
  }

  const ui = (key, fb) => (state.content && state.content.ui && state.content.ui[key]) || fb;

  /* ---------------- overlay compartido (a pantalla completa) ---------------- */

  let wishOverlay = null;
  let wishOverlayTimer = null;
  let wishHideTimer = null;

  function ensureWishOverlay() {
    if (wishOverlay) return wishOverlay;
    wishOverlay = document.createElement('div');
    wishOverlay.className = 'wish-overlay';
    wishOverlay.setAttribute('role', 'dialog');
    wishOverlay.setAttribute('aria-modal', 'true');
    wishOverlay.innerHTML = '<div class="wish-card"></div>';
    wishOverlay.addEventListener('click', closeWishOverlay);
    document.body.appendChild(wishOverlay);
    return wishOverlay;
  }

  function showWish(texto, opts = {}) {
    const overlay = ensureWishOverlay();
    const card = overlay.querySelector('.wish-card');
    clearTimeout(wishOverlayTimer);
    clearTimeout(wishHideTimer);
    const titulo = opts.titulo || '';
    const noTimer = !!opts.noTimer;
    card.classList.toggle('wish-card-vela', opts.variant === 'vela');
    card.classList.toggle('wish-card-globo', opts.variant === 'globo');
    card.innerHTML = `${titulo ? `<h3 class="wish-titulo">${escapeHtml(titulo)}</h3>` : ''}<p class="wish-text">${escapeHtml(texto)}</p><span class="wish-hint">${tpl(ui('wishHint', 'toca en cualquier lado para cerrar'))}</span>`;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('show'));
    if (!noTimer) wishOverlayTimer = setTimeout(closeWishOverlay, 4000);
  }

  function closeWishOverlay() {
    if (!wishOverlay) return;
    clearTimeout(wishOverlayTimer);
    clearTimeout(wishHideTimer);
    wishOverlay.classList.remove('show');
    wishHideTimer = setTimeout(() => {
      const card = wishOverlay.querySelector('.wish-card');
      if (card) card.innerHTML = '';
      wishOverlay.style.display = 'none';
    }, 420);
  }

  /* ---------------- capa 1: bienvenida ---------------- */

  function buildBienvenida(holder, nextBtn, capas) {
    const b = capas.bienvenida;
    holder.innerHTML = `
      <h2 class="chap">${b.titulo}</h2>
      <p class="layer-body">${escapeHtml(b.texto)}</p>
    `;
    nextBtn.hidden = false;
    nextBtn.onclick = () => goToLayer(2);
  }

  /* ---------------- capa 2: velas ---------------- */

  function buildVelas(holder, nextBtn, capas) {
    const v = capas.velas;
    const list = Array.isArray(v.razones) ? v.razones : [];
    state.candlesLeft = list.length;
    const candles = list.map((razon, i) => `
      <button class="candle" data-i="${i}" aria-label="Vela ${i + 1}" style="animation-delay:${i * 0.05}s">
        <span class="number">${i + 1}</span>
        <span class="flame"></span>
        <span class="wick"></span>
        <span class="stripe"></span>
        <span class="stick"></span>
        <span class="smoke">💨</span>
      </button>
    `).join('');

    holder.innerHTML = `
      <h2 class="chap chap-script">${v.titulo}</h2>
      <p class="layer-body">${v.instruccion}</p>
      <div class="candles">${candles}</div>
      <p class="velas-done" id="velas-done">${tpl(ui('velasDone', 'Todas apagadas ✨'))}</p>
    `;

    if (!list.length) {
      holder.querySelector('.candles').innerHTML =
        '<div class="memory-empty">Las 15 razones aún no están escritas…</div>';
      nextBtn.hidden = false;
      nextBtn.onclick = () => goToLayer(4);
      return;
    }

    const toast = document.createElement('div');
    toast.className = 'razon-toast';
    document.body.appendChild(toast);

    const gustAir = (cx, cy) => {
      const layer = document.createElement('div');
      layer.className = 'wind-layer';
      document.body.appendChild(layer);
      const windCount = lowPowerMode() ? 16 : 42;
      for (let i = 0; i < windCount; i++) {
        const p = document.createElement('span');
        const streak = i % 3 !== 0;
        p.className = streak ? 'wind-streak' : 'wind-mote';
        p.style.left = cx + 'px';
        p.style.top = (cy - 26 + Math.random() * 52) + 'px';
        if (streak) {
          p.style.width = (36 + Math.random() * 90) + 'px';
          p.style.height = (2 + Math.random() * 3) + 'px';
          p.style.background = `linear-gradient(90deg, rgba(255,250,235,0), rgba(255,246,224,${(0.22 + Math.random() * 0.45).toFixed(2)}))`;
        } else {
          const s = 6 + Math.random() * 14;
          p.style.width = p.style.height = s + 'px';
          p.style.background = 'radial-gradient(circle at 40% 40%, #fffbe9, rgba(214,196,150,0.45))';
          p.style.filter = 'blur(2px)';
        }
        p.style.setProperty('--dx', (110 + Math.random() * 150).toFixed(0) + 'px');
        p.style.setProperty('--dy', ((Math.random() * 2 - 1) * 30).toFixed(0) + 'px');
        p.style.setProperty('--dur', (0.55 + Math.random() * 0.85).toFixed(2) + 's');
        p.style.setProperty('--delay', (Math.random() * 0.18).toFixed(2) + 's');
        layer.appendChild(p);
      }
      setTimeout(() => layer.remove(), 2100);
    };

    holder.querySelectorAll('.candle').forEach((c) => {
      c.addEventListener('click', () => {
        if (c.classList.contains('out')) return;
        c.classList.add('out');
        state.candlesLeft--;

        const r = c.getBoundingClientRect();
        gustAir(r.left + r.width / 2, r.top + r.height / 2);
        showWish(v.razones[+c.dataset.i], {
          titulo: 'Razón ' + (+c.dataset.i + 1) + ' —',
          variant: 'vela',
          noTimer: true
        });
        if (state.candlesLeft <= 0) {
          const done = $('#velas-done');
          if (done) done.classList.add('show');
          nextBtn.hidden = false;
          nextBtn.onclick = () => { toast.remove(); goToLayer(4); };
        }
      });
    });
  }

  /* ---------------- capa 3: audio ---------------- */

  function buildAudio(holder, nextBtn, capas) {
    const a = capas.audio;
    holder.innerHTML = `
      <h2 class="chap chap-script">${a.titulo}</h2>
      <p class="layer-body">${a.texto}</p>
      <div class="audio-card">
        <div class="audio-avatar" id="audio-avatar">♪</div>
        <div class="audio-cuerpo">
          <p class="audio-nombre">Mi voz</p>
          <div class="audio-wave" id="audio-wave"></div>
          <p class="audio-time" id="audio-time">0:00</p>
        </div>
        <button class="audio-play" id="btn-play" aria-label="Reproducir">▶</button>
      </div>
      <p class="audio-note" id="audio-note"></p>
      <audio id="voice-player" preload="none"></audio>
    `;
    const player = $('#voice-player');
    const btn = $('#btn-play');
    const note = $('#audio-note');
    const wave = $('#audio-wave');
    const musicPlayer = $('#player');
    const time = $('#audio-time');
    const avatar = $('#audio-avatar');

    if (!a.archivo) {
      note.textContent = tpl(ui('audioEmpty', '(aquí irá mi voz grabada)'));
      btn.style.filter = 'grayscale(1)';
      return;
    }

    player.src = a.archivo;

    const BARRAS = 28;
    for (let i = 0; i < BARRAS; i++) {
      const b = document.createElement('span');
      b.style.height = `${8 + Math.round(Math.abs(Math.sin(i * 1.7) * 12) + (i * 7) % 5)}%`;
      b.style.animationDelay = `${(i % 9) * 0.09}s`;
      wave.appendChild(b);
    }

    const fmt = (s) => {
      if (!isFinite(s)) return '0:00';
      const m = Math.floor(s / 60);
      const ss = Math.floor(s % 60);
      return `${m}:${String(ss).padStart(2, '0')}`;
    };

    btn.addEventListener('click', () => {
      if (player.paused) {
        player.play();
        btn.classList.add('playing');
        btn.textContent = '❚❚';
        avatar.classList.add('hablando');
        wave.classList.add('playing');
      } else {
        player.pause();
        btn.classList.remove('playing');
        btn.textContent = '▶';
        avatar.classList.remove('hablando');
        wave.classList.remove('playing');
      }
    });
    player.addEventListener('play', () => {
      state.musicPausedByVoice = !!musicPlayer && !musicPlayer.paused && !musicPlayer.ended;
      if (musicPlayer && !musicPlayer.paused) musicPlayer.pause();
      btn.classList.add('playing');
      btn.textContent = '❚❚';
      avatar.classList.add('hablando');
      wave.classList.add('playing');
    });
    player.addEventListener('pause', () => {
      btn.classList.remove('playing');
      btn.textContent = '▶';
      avatar.classList.remove('hablando');
      wave.classList.remove('playing');
      if (state.musicPausedByVoice && musicPlayer) musicPlayer.play().catch(() => {});
      state.musicPausedByVoice = false;
    });
    player.addEventListener('timeupdate', () => { time.textContent = fmt(player.currentTime); });
    player.addEventListener('loadedmetadata', () => { time.textContent = fmt(player.duration); });
    player.addEventListener('ended', () => {
      btn.classList.remove('playing');
      btn.textContent = '▶';
      avatar.classList.remove('hablando');
      wave.classList.remove('playing');
      time.textContent = fmt(player.duration);
      if (state.musicPausedByVoice && musicPlayer) musicPlayer.play().catch(() => {});
      state.musicPausedByVoice = false;
    });
    player.addEventListener('error', () => {
      note.textContent = '(no pude cargar el audio, intenta de nuevo)';
    });

    nextBtn.hidden = false;
    nextBtn.onclick = () => { player.pause(); goToLayer(5); };
  }

  /* ---------------- capa 4: recuerdos ---------------- */

  function buildRecuerdos(holder, nextBtn, capas) {
    const r = capas.recuerdos;
    const barajar = (items) => {
      const copia = items.slice();
      for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    };
    const lista = Array.isArray(r.fotos) ? barajar(r.fotos) : [];
    const fotos = lista.length
      ? lista.map((f, i) => {
          const numero = `Recuerdo ${i + 1}`;
          return `
          <figure class="memory-card" style="--rot:${(i % 2 ? 1 : -1) * (1.4 + (i % 3) * 0.7)}deg; animation-delay:${i * 0.12}s">
            <span class="memory-tape" aria-hidden="true"></span>
            <div class="memory-photo"><img src="${escapeHtml(f.src)}" alt="${numero}" loading="lazy"></div>
            <figcaption class="mem-cap">${numero}</figcaption>
          </figure>`;
        }).join('')
      : `<div class="memory-empty">${tpl(ui('memoriesEmpty', 'Aquí irán nuestras fotos…'))}</div>`;

    holder.innerHTML = `
      <h2 class="chap chap-script">${r.titulo}</h2>
      <p class="layer-body">${r.texto}</p>
      <div class="memories">${fotos}</div>
    `;

    nextBtn.hidden = false;
    nextBtn.onclick = () => goToLayer(6);

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.2 });
    holder.querySelectorAll('.memory-card').forEach((el) => obs.observe(el));
  }

  /* ---------------- capa 5: carta ---------------- */

  function buildCarta(holder, nextBtn, capas) {
    const c = capas.carta;
    const parrafos = c.parrafos.map((p) => `<p class="reveal">${escapeHtml(p)}</p>`).join('');
    holder.innerHTML = `
      <h2 class="chap">${c.titulo}</h2>
      <div class="letter">
        ${parrafos}
        <p class="despedida reveal">${escapeHtml(c.despedida)}</p>
        <p class="firma reveal">${escapeHtml(c.firma)}</p>
      </div>
    `;
    nextBtn.hidden = false;
    nextBtn.onclick = () => goToLayer(7);

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.25 });
    holder.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
  }

  /* ---------------- capa 6: globos ---------------- */

  function buildGlobos(holder, nextBtn, capas) {
    const g = capas.globos;
    const deseos = Array.isArray(g.deseos) ? g.deseos : [];
    state.candlesLeft = deseos.length;

    const colors = ['#e6c56a', '#f6a6c3', '#ffe9c4', '#e86a9a', '#b98aff', '#7ec8ff'];
    const globos = deseos.map((_, i) => {
      const c = colors[i % colors.length];
      return `
        <button class="globo" data-i="${i}" style="--gcolor:${c}; animation-delay:${i * 0.12}s" aria-label="Globo ${i + 1}">
          <span class="globo-visual">
            <span class="globo-hilo"></span>
            <span class="globo-cuerpo"></span>
            <span class="globo-brillo"></span>
            <span class="globo-reflejo"></span>
            <span class="globo-nudo"></span>
          </span>
        </button>
      `;
    }).join('');

    holder.innerHTML = `
      <h2 class="chap chap-script">${g.titulo}</h2>
      <p class="layer-body">${g.texto}</p>
      <div class="globos">${globos}</div>
      <p class="velas-done" id="globos-done">${tpl(ui('globosDone', 'Todos los deseos volaron alto ✨'))}</p>
    `;

    if (!deseos.length) {
      holder.querySelector('.globos').innerHTML =
        '<div class="memory-empty">Los deseos aún se están llenando de ti…</div>';
      nextBtn.hidden = false;
      nextBtn.onclick = () => goToLayer(8);
      return;
    }

    const burstWish = (cx, cy) => {
      const layer = document.createElement('div');
      layer.className = 'wish-burst';
      document.body.appendChild(layer);
      const palette = ['#e6c56a', '#f4dd9a', '#fff6e9', '#f6c9c9', '#f4a6c0'];
      for (let i = 0; i < 64; i++) {
        const p = document.createElement('span');
        p.className = i % 3 ? 'wish-particle' : 'wish-particle dot';
        const s = 5 + Math.random() * 10;
        p.style.left = (cx - s / 2) + 'px';
        p.style.top = (cy - s / 2) + 'px';
        p.style.width = p.style.height = s + 'px';
        p.style.background = palette[i % palette.length];
        p.style.setProperty('--tx', ((Math.random() * 2 - 1) * 78).toFixed(1) + 'vw');
        p.style.setProperty('--ty', ((Math.random() * 2 - 1) * 88).toFixed(1) + 'vh');
        p.style.setProperty('--rot', ((Math.random() * 2 - 1) * 520).toFixed(0) + 'deg');
        p.style.setProperty('--dur', (0.9 + Math.random() * 1.1).toFixed(2) + 's');
        p.style.setProperty('--delay', (Math.random() * 0.14).toFixed(2) + 's');
        layer.appendChild(p);
      }
      const ring = document.createElement('span');
      ring.className = 'wish-ring';
      ring.style.left = (cx - 44) + 'px';
      ring.style.top = (cy - 44) + 'px';
      layer.appendChild(ring);
      setTimeout(() => layer.remove(), 2300);
    };

    holder.querySelectorAll('.globo').forEach((gb) => {
      gb.addEventListener('click', () => {
        if (gb.classList.contains('pop')) return;
        gb.classList.add('pop');
        state.candlesLeft--;

        const r = gb.getBoundingClientRect();
        burstWish(r.left + r.width / 2, r.top + r.height / 2);

        showWish(deseos[+gb.dataset.i], { variant: 'globo' });

        if (state.candlesLeft <= 0) {
          const done = $('#globos-done');
          if (done) done.classList.add('show');
          nextBtn.hidden = false;
          nextBtn.onclick = () => { closeWishOverlay(); goToLayer(8); };
        }
      });
    });
  }

  /* ---------------- capa 7: sobres ---------------- */

  function buildSobres(holder, nextBtn, capas) {
    const s = capas.sobres;
    const lista = Array.isArray(s.sobres) ? s.sobres : [];
    const remitente = state.content && state.content.remitente ? state.content.remitente : '';
    let abiertos = 0;

    const limpiarMensaje = (m) => String(m || '').trim().replace(/^\((.*)\)$/s, '$1').trim();

    const cards = lista.map((sobre, i) => `
      <button class="sobre" data-i="${i}" aria-label="${escapeHtml(sobre.cuando || `Sobre ${i + 1}`)}">
        <span class="sobre-cuerpo"></span>
        <span class="sobre-solapa"></span>
        <span class="sobre-seal">${i + 1}</span>
        <span class="sobre-tag">${escapeHtml(sobre.cuando || `Para cuando… ${i + 1}`)}</span>
      </button>
    `).join('');

    holder.innerHTML = `
      <h2 class="chap chap-script">${s.titulo}</h2>
      <p class="layer-body">${s.texto}</p>
      <div class="sobres">${cards}</div>
      <p class="velas-done" id="sobres-done">${tpl(ui('sobresDone', 'Los abriste todos 🫶'))}</p>
    `;

    if (!lista.length) {
      holder.querySelector('.sobres').innerHTML =
        '<div class="memory-empty">Estos sobres se están escribiendo…</div>';
      nextBtn.hidden = false;
      nextBtn.onclick = () => goToLayer(9);
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'sobre-modal';
    document.body.appendChild(overlay);

    function showCarta(sobre) {
      const cuerpo = limpiarMensaje(sobre.mensaje)
        .split('\n')
        .filter((l) => l.trim())
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('');
      overlay.innerHTML = `
        <div class="sobre-carta">
          <button class="sobre-cerrar" aria-label="Cerrar">✕</button>
          <h3>Para ${escapeHtml(sobre.cuando || 'cuando llegue el momento')}</h3>
          <p class="sobre-encabezado">Una carta para ti, ${escapeHtml(state.content.novia.nombre)}</p>
          <div class="sobre-carta-texto">${cuerpo}</div>
          <p class="sobre-carta-firma">— ${escapeHtml(remitente)}</p>
        </div>
      `;
      overlay.classList.add('show');
      const cerrar = overlay.querySelector('.sobre-cerrar');
      cerrar.addEventListener('click', () => overlay.classList.remove('show'));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    }

    holder.querySelectorAll('.sobre').forEach((sb) => {
      sb.addEventListener('click', () => {
        if (sb.classList.contains('open')) return;
        sb.classList.add('open');
        abiertos++;
        showCarta(lista[+sb.dataset.i]);
        if (abiertos >= lista.length) {
          const done = $('#sobres-done');
          if (done) done.classList.add('show');
          nextBtn.hidden = false;
          nextBtn.onclick = () => goToLayer(9);
        }
      });
    });
  }

  /* ---------------- capa 8: playlist ---------------- */

  function buildPlaylist(holder, nextBtn, capas) {
    const p = capas.playlist;
    const canciones = Array.isArray(p.canciones) ? p.canciones : [];
    const player = $('#player');
    const dock = $('#music-dock');
    let currentIndex = -1;
    let transitionToken = 0;
    let songQueue = [];

    const items = canciones.map((c, i) => `
      <button class="song" data-i="${i}">
        <img class="song-cover" src="${escapeHtml(c.portada || '')}" alt="" onerror="this.style.visibility='hidden'">
        <span class="song-meta">
          <b>${escapeHtml(c.titulo || `Canción ${i + 1}`)}</b>
          <i>${escapeHtml(c.artista || '')}</i>
        </span>
        <span class="song-play">▶</span>
      </button>
    `).join('');

    holder.innerHTML = `
      <h2 class="chap chap-script">${p.titulo}</h2>
      <p class="layer-body">${p.texto}</p>
      <div class="player-card">
        <img class="player-cover" id="player-cover" src="content/media/musica/player-placeholder.jpg" alt="">
        <div class="player-now" id="player-now">${tpl(ui('playlistEmpty', 'Elige una canción…'))}</div>
        <div class="vinilo" id="player-vinilo" aria-hidden="true"><span class="vinilo-etiqueta"></span></div>
        <button class="player-toggle" id="player-toggle" type="button" hidden>❚❚</button>
      </div>
      <div class="songs">${items}</div>
    `;
    const cover = $('#player-cover');
    const now = $('#player-now');
    const toggle = $('#player-toggle');
    const vinilo = $('#player-vinilo');
    const dockHandle = $('#music-dock-handle');
    const dockCover = $('#music-dock-cover');
    const dockTitle = $('#music-dock-title');
    const dockArtist = $('#music-dock-artist');
    const dockPrev = $('#music-dock-prev');
    const dockToggle = $('#music-dock-toggle');
    const dockNext = $('#music-dock-next');

    if (!canciones.length) {
      if (dock) dock.classList.remove('has-song');
      holder.querySelector('.songs').innerHTML = '<div class="memory-empty">La playlist se está armando con canciones nuestras…</div>';
      nextBtn.hidden = false;
      nextBtn.onclick = () => goToLayer(3);
      return;
    }

    player.loop = false;
    const syncPlaying = () => {
      const playing = !player.paused && !player.ended;
      if (toggle) { toggle.hidden = false; toggle.textContent = playing ? '❚❚' : '▶'; }
      if (dockToggle) { dockToggle.textContent = playing ? '❚❚' : '▶'; dockToggle.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir'); }
      if (vinilo) vinilo.classList.toggle('girando', playing);
    };
    const updateSongUI = (i) => {
      const c = canciones[i];
      currentIndex = i;
      if (cover) cover.src = c.portada || 'content/media/musica/player-placeholder.jpg';
      if (now) now.innerHTML = `<b>${escapeHtml(c.titulo || `Canción ${i + 1}`)}</b> — ${escapeHtml(c.artista || '')}`;
      if (dockCover) dockCover.src = c.portada || 'content/media/musica/player-placeholder.jpg';
      if (dockTitle) dockTitle.textContent = c.titulo || `Canción ${i + 1}`;
      if (dockArtist) dockArtist.textContent = c.artista || '';
      if (dock) dock.classList.add('has-song');
      holder.querySelectorAll('.song').forEach((s, si) => s.classList.toggle('playing', si === i));
    };
    const fade = (from, to, duration) => new Promise((resolve) => {
      const start = performance.now();
      const step = (nowTime) => {
        const p = Math.min(1, (nowTime - start) / duration);
        player.volume = from + (to - from) * p;
        if (p < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
    const refillQueue = () => {
      songQueue = canciones.map((_, i) => i).filter((i) => i !== currentIndex);
      for (let i = songQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songQueue[i], songQueue[j]] = [songQueue[j], songQueue[i]];
      }
    };
    const randomNext = () => {
      if (songQueue.length === 0) refillQueue();
      return songQueue.shift() ?? currentIndex;
    };
    const playSong = async (i, smooth = false, forceFade = false) => {
      if (!canciones[i]) return;
      const token = ++transitionToken;
      const wasPlaying = !player.paused && !player.ended;
      const shouldFade = smooth && (wasPlaying || forceFade);
      if (shouldFade) await fade(player.volume, 0, 650);
      if (token !== transitionToken) return;
      player.pause();
      player.src = canciones[i].archivo;
      player.preload = 'auto';
      player.volume = shouldFade ? 0 : 1;
      updateSongUI(i);
      player.load();
      try { await player.play(); } catch (e) {
        player.load();
        try { await player.play(); } catch (ignored) {}
      }
      if (shouldFade) await fade(0, 1, 850);
      else player.volume = 1;
      syncPlaying();
    };
    player.onplay = syncPlaying;
    player.onpause = syncPlaying;
    player.onended = () => playSong(randomNext(), true, true);
    if (toggle) toggle.onclick = () => player.paused ? player.play().catch(() => {}) : player.pause();
    if (dockToggle) dockToggle.onclick = () => player.paused ? player.play().catch(() => {}) : player.pause();
    if (dockPrev) dockPrev.onclick = () => playSong((currentIndex - 1 + canciones.length) % canciones.length, false);
    if (dockNext) dockNext.onclick = () => playSong(randomNext(), false);
    if (dockHandle) dockHandle.onclick = () => {
      const expanded = dock.classList.toggle('expanded');
      dockHandle.setAttribute('aria-expanded', String(expanded));
    };
    holder.querySelectorAll('.song').forEach((s) => s.addEventListener('click', () => playSong(+s.dataset.i, false)));
    nextBtn.hidden = false;
    nextBtn.onclick = () => goToLayer(3);
  }

  /* ---------------- capa 9: constelación ---------------- */

  function buildConstelacion(holder, nextBtn, capas) {
    const c = capas.constelacion;

    const puntos = [
      [6.2, 1.392], [6.6, 0.66], [7.3, 0.05], [8.9, -0.438], [10.7, 0.05],
      [11.6, 1.27], [11.0, 2.734], [9.4, 4.076], [7.6, 5.174], [6.62, 6.28],
      [6.2, 6.82], [5.4, 5.662], [3.8, 4.564], [2.0, 3.344], [0.8, 2.002],
      [1.1, 0.538], [2.7, -0.316], [4.5, -0.316], [5.8, 0.538]
    ];

    function estrellaPath(x, y) {
      const R = 0.3;
      const r = R * 0.55;
      let d = '';
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + i * (Math.PI / 5);
        const rad = i % 2 === 0 ? R : r;
        const px = x + Math.cos(ang) * rad;
        const py = y + Math.sin(ang) * rad;
        d += (i === 0 ? 'M ' : 'L ') + px.toFixed(3) + ' ' + py.toFixed(3) + ' ';
      }
      return d + 'Z';
    }

    let fondo = '';
    let seed = 13;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed % 10000) / 10000; };
    for (let i = 0; i < 60; i++) {
      const x = (0.2 + rnd() * 12.0).toFixed(3);
      const y = (-1.2 + rnd() * 8.0).toFixed(3);
      const r = (0.02 + rnd() * 0.05).toFixed(3);
      const op = (0.18 + rnd() * 0.45).toFixed(2);
      fondo += `<circle class="constel-fondo" cx="${x}" cy="${y}" r="${r}" opacity="${op}"></circle>`;
    }

    let svg = '<svg class="constel" viewBox="0.2 -1.2 12.0 8.0" preserveAspectRatio="xMidYMid meet">';
    svg += '<defs>';
    svg += '<radialGradient id="constelGrad" cx="50%" cy="50%" r="50%">';
    svg += '<stop offset="0%" stop-color="#fffbe9" stop-opacity="1"/>';
    svg += '<stop offset="45%" stop-color="#f4dd9a" stop-opacity="0.85"/>';
    svg += '<stop offset="100%" stop-color="#e6c56a" stop-opacity="0"/>';
    svg += '</radialGradient>';
    svg += '<radialGradient id="constelCorazonGrad" cx="50%" cy="50%" r="50%">';
    svg += '<stop offset="0%" stop-color="#ffb3c1" stop-opacity="0.65"/>';
    svg += '<stop offset="55%" stop-color="#f4809a" stop-opacity="0.4"/>';
    svg += '<stop offset="100%" stop-color="#f4dd9a" stop-opacity="0.05"/>';
    svg += '</radialGradient>';
    svg += '</defs>';
    svg += `<g class="constel-fondo-g">${fondo}</g>`;
    svg += '<path class="constel-corazon" d="M 6.200 1.392C 6.333 1.412, 6.417 0.884, 6.600 0.660C 6.783 0.436, 6.917 0.233, 7.300 0.050C 7.683 -0.133, 8.333 -0.438, 8.900 -0.438C 9.467 -0.438, 10.250 -0.235, 10.700 0.050C 11.150 0.335, 11.550 0.823, 11.600 1.270C 11.650 1.717, 11.367 2.266, 11.000 2.734C 10.633 3.202, 9.967 3.669, 9.400 4.076C 8.833 4.483, 8.083 4.828, 7.600 5.174C 7.117 5.520, 6.733 5.906, 6.500 6.150C 6.267 6.394, 6.383 6.719, 6.200 6.638C 6.017 6.557, 5.800 6.008, 5.400 5.662C 5.000 5.316, 4.367 4.950, 3.800 4.564C 3.233 4.178, 2.500 3.771, 2.000 3.344C 1.500 2.917, 0.950 2.470, 0.800 2.002C 0.650 1.534, 0.783 0.924, 1.100 0.538C 1.417 0.152, 2.133 -0.174, 2.700 -0.316C 3.267 -0.458, 3.983 -0.458, 4.500 -0.316C 5.017 -0.174, 5.517 0.253, 5.800 0.538C 6.083 0.823, 6.067 1.372, 6.200 1.392Z"></path>';
    svg += '<g class="constel-guia"></g>';
    svg += '<g class="constel-trazo"></g>';
    puntos.forEach(([x, y], i) => {
      svg += `<g class="constel-estrella" data-i="${i}">`;
      svg += `<circle class="constel-hit" cx="${x}" cy="${y}" r="0.12"></circle>`;
      svg += `<circle class="constel-glow" cx="${x}" cy="${y}" r="0.36"></circle>`;
      svg += `<path class="constel-nodo" d="${estrellaPath(x, y)}"></path>`;
      svg += '</g>';
    });
    svg += '</svg>';

    holder.innerHTML = `
      <h2 class="chap chap-script">${c.titulo}</h2>
      <p class="layer-body">${c.texto}</p>
      <p class="constel-instr">${tpl(ui('constelInstr', 'Sigue el brillo en orden para encender el cielo. ✨'))}</p>
      <div class="constel-wrap">
        <p class="constel-leyenda hidden" id="constel-leyenda"><span class="constel-leyenda-nombre">${escapeHtml(c.nombre || 'Ren')}</span></p>
        ${svg}
      </div>
      <p class="constel-frase hidden" id="constel-frase">${c.frase || ''}</p>
      <p class="velas-done" id="constel-done">${tpl(ui('constelDone', 'Brillaste en el cielo ✨'))}</p>
    `;

    const wrap = holder.querySelector('.constel-wrap');
    const guia = holder.querySelector('.constel-guia');
    const trazo = holder.querySelector('.constel-trazo');
    const estrellas = [...holder.querySelectorAll('.constel-estrella')];
    const leyenda = $('#constel-leyenda');
    const frase = $('#constel-frase');
    const done = $('#constel-done');
    const actual = { i: 0 };
    let completado = false;

    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1];
      const b = puntos[i];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a[0]); line.setAttribute('y1', a[1]);
      line.setAttribute('x2', b[0]); line.setAttribute('y2', b[1]);
      line.classList.add('constel-guia-linea');
      guia.appendChild(line);
    }

    function marcarSiguiente() {
      estrellas.forEach((est) => est.classList.remove('next'));
      if (actual.i < estrellas.length) {
        estrellas[actual.i].classList.add('next');
      }
    }
    marcarSiguiente();

    function trazarLinea(a, b) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a[0]); line.setAttribute('y1', a[1]);
      line.setAttribute('x2', b[0]); line.setAttribute('y2', b[1]);
      line.classList.add('constel-linea');
      trazo.appendChild(line);
      requestAnimationFrame(() => line.classList.add('draw'));
    }

    function agitar(nodo) {
      nodo.classList.remove('shake');
      void nodo.getBoundingClientRect();
      nodo.classList.add('shake');
      setTimeout(() => nodo.classList.remove('shake'), 500);
    }

    function animarConstelacion() {
      wrap.classList.add('constel-encendido');
      estrellas.forEach((est, i) => {
        const glow = est.querySelector('.constel-glow');
        const nodo = est.querySelector('.constel-nodo');
        nodo.classList.add('brilla');
        glow.style.animationDelay = (i * 0.08).toFixed(2) + 's';
      });
      trazo.querySelectorAll('.constel-linea').forEach((line) => line.classList.add('constel-encendida'));

      leyenda.classList.remove('hidden');
      setTimeout(() => leyenda.classList.add('show'), 500);
    }

    function completar() {
      completado = true;
      done.classList.add('show');
      frase.classList.remove('hidden');
      nextBtn.hidden = false;
      nextBtn.onclick = () => goToLayer(10);
      animarConstelacion();
      starDust();
    }

    estrellas.forEach((est) => {
      est.addEventListener('click', () => {
        if (completado) return;
        const i = +est.dataset.i;
        if (i === actual.i) {
          est.classList.add('lit');
          est.classList.remove('next');
          if (actual.i > 0) trazarLinea(puntos[actual.i - 1], puntos[actual.i]);
          actual.i++;
          if (actual.i >= puntos.length) completar();
          else marcarSiguiente();
        } else if (i > actual.i) {
          agitar(est);
        }
      });
    });

    if (!estrellas.length) {
      holder.innerHTML = `<h2 class="chap chap-script">${c.titulo}</h2>
        <div class="memory-empty">El cielo se está dibujando…</div>`;
      nextBtn.hidden = false;
      nextBtn.onclick = () => goToLayer(10);
    }
  }

  function starDust() {
    const layer = document.createElement('div');
    layer.className = 'dust-layer';
    document.body.appendChild(layer);
    const n = 90;
    for (let i = 0; i < n; i++) {
      const d = document.createElement('span');
      d.className = 'dust-mote';
      const size = 3 + Math.random() * 8;
      d.style.left = (Math.random() * 100) + '%';
      d.style.top = (Math.random() * 100) + '%';
      d.style.width = d.style.height = size + 'px';
      d.style.setProperty('--dx', (Math.random() - 0.5) * 30 + 'vw');
      d.style.setProperty('--dy', '-' + (20 + Math.random() * 80) + 'vh');
      d.style.setProperty('--dr', (Math.random() * 360) + 'deg');
      d.style.setProperty('--dur', (1.6 + Math.random() * 2.2) + 's');
      d.style.setProperty('--td', (Math.random() * 0.8) + 's');
      layer.appendChild(d);
    }
    setTimeout(() => layer.remove(), 6000);
  }

  /* ---------------- capa 10: final ---------------- */

  function buildFinal(holder, nextBtn, capas) {
    const n = state.content.novia;
    holder.innerHTML = `
      <h1 class="final-title">¡Feliz cumpleaños, ${escapeHtml(n.nombre)}!</h1>
      <p class="final-sub">${tpl(ui('finalSub', 'Hoy cumples {edad}. No pude estar ahí para darte un abrazo.'))}</p>
      <div class="final-card">
        <p>${escapeHtml(tpl(ui('finalQuote', '«La distancia no nos quita nada de lo que importa.»')))}</p>
        <p class="firma">— ${escapeHtml(state.content.remitente)}</p>
      </div>
    `;
    nextBtn.hidden = false;
    nextBtn.textContent = 'Hay una última cosa…';
    nextBtn.onclick = () => { showScreen('layer'); goToLayer(11); };
    confetti();
  }

  /* ---------------- capa 11: secreto ---------------- */

  function buildSecreto(holder, nextBtn, capas) {
    const s = capas.secreto;
    holder.innerHTML = `
      <h2 class="chap chap-script">${s.titulo}</h2>
      <p class="layer-body">${s.texto}</p>
      <button class="secreto-btn" id="secreto-open">Abrir el secreto</button>
      <div class="secreto-video hidden" id="secreto-video">
        <video controls playsinline preload="metadata"
               src="${s.video || ''}"></video>
      </div>
      <div class="secreto-modal hidden" id="secreto-modal" role="dialog" aria-modal="true">
        <div class="secreto-card">
          <h3>${s.modalTitulo || 'Contraseña'}</h3>
          <p class="secreto-pista">${s.pista}</p>
          <input id="secreto-input" type="password" inputmode="numeric" autocomplete="off"
                 placeholder="••••" maxlength="8" pattern="[0-9]*">
          <p class="secreto-nums">Solo acepta números</p>
          <p class="secreto-err hidden" id="secreto-err">No es eso. Inténtalo otra vez. 💭</p>
          <div class="secreto-acciones">
            <button class="secreto-cerrar" id="secreto-cancel">Cancelar</button>
            <button class="secreto-entrar" id="secreto-submit">Entrar</button>
          </div>
        </div>
      </div>
    `;

    const open = $('#secreto-open');
    const modal = $('#secreto-modal');
    const input = $('#secreto-input');
    const err = $('#secreto-err');
    const video = $('#secreto-video');
    const videoEl = video.querySelector('video');
    const musicPlayer = $('#player');

    videoEl.addEventListener('play', () => {
      state.musicPausedByVideo = !!musicPlayer && !musicPlayer.paused && !musicPlayer.ended;
      if (musicPlayer && !musicPlayer.paused) musicPlayer.pause();
    });
    videoEl.addEventListener('ended', () => {
      if (state.musicPausedByVideo && musicPlayer) musicPlayer.play().catch(() => {});
      state.musicPausedByVideo = false;
    });

    const openModal = () => {
      modal.classList.remove('hidden');
      input.value = '';
      err.classList.add('hidden');
      setTimeout(() => input.focus(), 120);
    };
    const closeModal = () => {
      modal.classList.add('hidden');
      input.blur();
    };
    const submit = async () => {
      const clave = input.value.trim();
      if (!clave) return;
      err.classList.add('hidden');
      let ok = false;
      try {
        const r = await fetch('/api/secreto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clave })
        });
        const d = await r.json();
        ok = !!d.ok;
      } catch (e) { ok = false; }
      if (ok) {
        closeModal();
        open.classList.add('hidden');
        video.classList.remove('hidden');
        if (videoEl.src && !s.video) videoEl.load();
        try { await videoEl.play(); } catch (e) {}
      } else {
        err.classList.remove('hidden');
        input.value = '';
        input.focus();
      }
    };

    open.addEventListener('click', openModal);
    $('#secreto-cancel').addEventListener('click', closeModal);
    $('#secreto-submit').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
    });

    if (!s.video) {
      video.classList.remove('hidden');
      video.innerHTML = '<p class="memory-empty">Aquí irá un video muy especial. Pronto. 🤍</p>';
    }

    nextBtn.hidden = false;
    nextBtn.textContent = tpl(ui('finalButton', 'Volver a abrir la caja 🎀'));
    nextBtn.onclick = () => { showScreen('box'); resetGift(); setTheme('box'); };
  }

  /* ---------------- caja ---------------- */

  function initBox() {
    showScreen('box');
    const nameEl = $('#box-name');
    if (nameEl && state.content) nameEl.textContent = state.content.novia.nombre;
    const labelEl = $('#box-label');
    if (labelEl) labelEl.textContent = tpl(ui('boxLabel', 'Para {nombre}'));
    const hintEl = $('#box-hint');
    if (hintEl) hintEl.textContent = tpl(ui('boxHint', 'Toca la caja para abrirla'));

    const gift = $('#gift');

    gift.addEventListener('click', openGift);
    gift.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openGift(); });

    if (!sessionStorage.getItem(SESSION_OPEN)) {
      fetch('/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ via: 'caja' })
      }).catch(() => {});
      sessionStorage.setItem(SESSION_OPEN, '1');
    }
  }

  function openGift() {
    const gift = $('#gift');
    if (gift.classList.contains('opening')) return;
    gift.classList.add('opening');
    gift.classList.remove('bump');
    const r = gift.getBoundingClientRect();
    burstFrom(r.left + r.width / 2, r.top + r.height / 2);
    setTimeout(() => { gift.classList.add('bump'); }, 300);
    setTimeout(() => goToLayer(1), 1500);
  }

  function resetGift() {
    const gift = $('#gift');
    gift.classList.remove('opening', 'bump');
    const videoEl = document.querySelector('#secreto-video video');
    if (videoEl) {
      videoEl.pause();
      videoEl.currentTime = 0;
    }
    const musicPlayer = document.querySelector('#player');
    if (state.musicPausedByVideo && musicPlayer) musicPlayer.play().catch(() => {});
    state.musicPausedByVideo = false;
    const voicePlayer = document.querySelector('#voice-player');
    if (voicePlayer) {
      voicePlayer.pause();
      voicePlayer.currentTime = 0;
    }
  }

  /* ---------------- candado / countdown ---------------- */

  function initLock() {
    showScreen('lock');
    $('#lock-small').textContent = tpl(ui('lockSmall', 'Algo viaja hacia ti…'));
    $('#lock-title').textContent = tpl(ui('lockTitle', 'Todavía no 🎀'));
    $('#lock-text').textContent = tpl(ui('lockText', 'Esta cajita se está terminando de llenar. Vuelve pronto.'));
    tick();
    setInterval(tick, 1000);
  }

  function tick() {
    const target = new Date(state.status.unlockAt).getTime();
    const diff = target - Date.now();
    if (diff <= 0) { location.reload(); return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor(diff / 3600000) % 24;
    const m = Math.floor(diff / 60000) % 60;
    const s = Math.floor(diff / 1000) % 60;
    $('#countdown').innerHTML = [
      ['Días', d], ['Horas', h], ['Min', m], ['Seg', s]
    ].map(([l, v]) => `<div class="cd"><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
  }

  /* ---------------- fondo de destellos ---------------- */

  function lowPowerMode() {
    return window.matchMedia('(max-width: 700px)').matches
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || navigator.connection?.saveData === true
      || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  }

  function sparkles() {
    const layer = $('#sparkle-layer');
    const count = lowPowerMode() ? 28 : 90;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      const size = 1.5 + Math.random() * 4.5;
      s.style.width = s.style.height = size + 'px';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      if (size > 4) s.classList.add('star-lg');
      s.style.setProperty('--tw', (2 + Math.random() * 3) + 's');
      s.style.setProperty('--td', (Math.random() * 5) + 's');
      layer.appendChild(s);
    }
  }

  function shootingStars() {
    if (lowPowerMode()) return;
    const layer = $('#sparkle-layer');
    const spawn = () => {
      const st = document.createElement('span');
      st.className = 'shooting';
      st.style.left = (45 + Math.random() * 50) + '%';
      st.style.top = (4 + Math.random() * 30) + '%';
      layer.appendChild(st);
      setTimeout(() => st.remove(), 1200);
    };
    spawn();
    setInterval(spawn, 9000 + Math.random() * 4000);
  }

  /* ---------------- escenas: temas por capa ---------------- */

  const CHAR_POOL = [
    'luka.png', 'amy-a.png', 'amy-b.png',
    'pv-2.png', 'pv-3.png', 'pv-4.png', 'pv.png',
    'sm-2.png', 'sm-3.png', 'sm-4.png', 'sua.png',
    'Aether.png', 'Amber.png', 'Amber_portrait.png',
    'Blade.png', 'Cosmo.png', 'Emu_Otori.png', 'Furina-removebg-preview.png',
    'Kokomi.png', 'Lumine.png', 'March_7th.png', 'March_7th_alt.png',
    'Milky_Way_Cookie.png', 'Momo_Yaoyorozu.png', 'Tsukasa_Tenma.png',
    'White_Lily_Cookie.png', 'descargar-removebg-preview.png'
  ];
  const RANDOM_CHAR_COUNTS = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 1, 11: 1 };
  let unusedChars = [];
  let openingShown = false;

  const resetChars = () => {
    unusedChars = CHAR_POOL.slice();
  };
  resetChars();

  const takeChars = (count) => {
    const selected = [];
    for (let i = 0; i < count && unusedChars.length; i++) {
      const index = Math.floor(Math.random() * unusedChars.length);
      selected.push(unusedChars.splice(index, 1)[0]);
    }
    return selected.map((src, i) => ({ src, side: i % 2 === 0 ? 'left' : 'right' }));
  };

  const openingChars = takeChars(2);

  const THEMES = {
    box:  { wash: 'wash-vanilla', spotlight: false, chars: [{ src: 'pv.png', side: 'left' }, { src: 'sm-2.png', side: 'right' }], particles: 'vanilla' },
    lock: { wash: 'wash-vanilla', spotlight: false, chars: [{ src: 'pv.png', side: 'left' }, { src: 'sm-2.png', side: 'right' }], particles: 'vanilla' },
    1: { wash: 'wash-amy', spotlight: false, chars: [{ src: 'amy-a.png', side: 'right' }], particles: 'amy' },
    2: { wash: 'wash-vanilla', spotlight: false, chars: [{ src: 'pv-2.png', side: 'left' }, { src: 'sm-3.png', side: 'right' }], particles: 'vanilla' },
    3: { wash: 'wash-alien', spotlight: true, chars: [{ src: 'Amber_portrait.png', side: 'left' }, { src: 'White_Lily_Cookie.png', side: 'right' }], particles: 'alien' },
    4: { wash: 'wash-amy', spotlight: false, chars: [{ src: 'Blade.png', side: 'left' }, { src: 'Cosmo.png', side: 'right' }], particles: 'amy' },
    5: { wash: 'wash-vanilla', spotlight: false, chars: [{ src: 'Emu_Otori.png', side: 'left' }, { src: 'Furina-removebg-preview.png', side: 'right' }], particles: 'vanilla' },
    6: { wash: 'wash-vanilla', spotlight: false, chars: [{ src: 'Kokomi.png', side: 'left' }, { src: 'Lumine.png', side: 'right' }], particles: 'vanilla' },
    7: { wash: 'wash-amy', spotlight: false, chars: [{ src: 'March_7th_alt.png', side: 'left' }, { src: 'March_7th.png', side: 'right' }], particles: 'amy' },
    8: { wash: 'wash-alien', spotlight: true, chars: [{ src: 'Milky_Way_Cookie.png', side: 'left' }, { src: 'Momo_Yaoyorozu.png', side: 'right' }], particles: 'alien' },
    9: { wash: 'wash-vanilla', spotlight: false, chars: [{ src: 'Tsukasa_Tenma.png', side: 'left' }, { src: 'White_Lily_Cookie.png', side: 'right' }], particles: 'vanilla' },
    10: { wash: 'wash-final', spotlight: false, chars: [{ src: 'Momo_Yaoyorozu.png', side: 'left' }], particles: 'final' },
    11: { wash: 'wash-alien', spotlight: true, chars: [{ src: 'descargar-removebg-preview.png', side: 'right' }], particles: 'amy' }
  };

  function setTheme(key) {
    const t = THEMES[key] || THEMES.box;
    const wash = $('#wash');
    const bg = document.createElement('div');
    bg.className = 'wash-bg ' + t.wash;
    wash.appendChild(bg);
    requestAnimationFrame(() => {
      anime.animate(bg, {
        opacity: [0, 1],
        duration: 1100,
        ease: 'outCubic',
        onComplete: () => {
          const current = wash.querySelector('.wash-bg:last-child');
          wash.querySelectorAll('.wash-bg').forEach((el) => {
            if (el !== current) el.remove();
          });
        }
      });
    });
    $('#spotlight').classList.toggle('on', !!t.spotlight);
    const randomCount = RANDOM_CHAR_COUNTS[key];
    let chars;
    if (key === 'box' || key === 'lock') {
      chars = openingShown ? takeChars(2) : openingChars;
      openingShown = true;
    } else {
      chars = randomCount ? takeChars(randomCount) : t.chars;
    }
    buildChars(chars);
    ambient(t.particles);
  }

  function buildChars(list) {
    const layer = $('#char-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const seen = new Set();
    const uniqueList = list.filter((c) => {
      if (!c || seen.has(c.src)) return false;
      seen.add(c.src);
      return true;
    });
    const flip = Math.random() < 0.5;
    uniqueList.forEach((c, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'char char-' + c.side + (uniqueList.length > 1 && i % 2 !== (flip ? 0 : 1) ? ' char-top' : '');
      const inner = document.createElement('div');
      inner.className = 'char-img';
      const img = document.createElement('img');
      img.src = 'content/media/personajes/' + c.src;
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      inner.appendChild(img);
      wrap.appendChild(inner);
      layer.appendChild(wrap);
      anime.animate(wrap, {
        opacity: [0, 1],
        translateY: [40, 0],
        duration: 850,
        delay: 100,
        ease: 'outCubic'
      });
      anime.animate(inner, {
        keyframes: [
          { rotate: 0, translateY: 0 },
          { rotate: 1.6, translateY: -5 },
          { rotate: 0, translateY: 0 },
          { rotate: -1.6, translateY: -5 },
          { rotate: 0, translateY: 0 }
        ],
        duration: 7000 + Math.random() * 3000,
        loop: true,
        ease: 'inOutSine'
      });
    });
  }

  /* ---------------- vida: animejs ---------------- */

  function ambient(kind) {
    const layer = $('#float-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const mk = (cls, min, max) => {
      const el = document.createElement('span');
      el.className = cls;
      const s = min + Math.random() * (max - min);
      el.style.width = el.style.height = s + 'px';
      el.style.left = Math.random() * 96 + '%';
      el.style.top = Math.random() * 96 + '%';
      layer.appendChild(el);
      return el;
    };
    const spawn = (els, kf, dur) => {
      anime.animate(els, {
        keyframes: kf,
        duration: () => dur(),
        delay: () => Math.random() * 6000,
        loop: true,
        ease: 'inOutSine'
      });
    };
    const heartKf = [
      { opacity: 0, scale: 0.5, translateY: 0, rotate: 45 },
      { opacity: 0.85, scale: 1, translateY: -70, rotate: 32 },
      { opacity: 0, scale: 1.1, translateY: -150, rotate: 58 }
    ];
    const goldKf = [
      { opacity: 0, scale: 0.4, translateY: 0 },
      { opacity: 0.9, scale: 1, translateY: -60 },
      { opacity: 0, scale: 0.6, translateY: -130 }
    ];
    if (kind === 'amy' || kind === 'final') {
      spawn(Array.from({ length: lowPowerMode() ? 5 : (kind === 'final' ? 8 : 12) }, () => mk('float-heart', 14, 26)), heartKf, () => 7000 + Math.random() * 4000);
    }
    if (kind === 'vanilla' || kind === 'final') {
      spawn(Array.from({ length: lowPowerMode() ? 6 : (kind === 'final' ? 8 : 16) }, () => mk('float-mote', 4, 8)), goldKf, () => 9000 + Math.random() * 5000);
    }
    if (kind === 'alien') {
      spawn(Array.from({ length: lowPowerMode() ? 7 : 18 }, () => mk('float-mote violet', 4, 8)), goldKf, () => 8000 + Math.random() * 4000);
    }
  }

  function burstFrom(cx, cy) {
    const layer = $('#burst-layer');
    if (!layer) return;
    const hearts = [];
    const burstScale = lowPowerMode() ? 0.45 : 1;
    for (let i = 0; i < Math.round(22 * burstScale); i++) {
      const el = document.createElement('span');
      el.className = 'burst-heart';
      el.style.opacity = '0';
      el.style.left = (cx - 8) + 'px';
      el.style.top = (cy - 8) + 'px';
      layer.appendChild(el);
      hearts.push(el);
    }
    const sparks = [];
    for (let i = 0; i < Math.round(30 * burstScale); i++) {
      const el = document.createElement('span');
      el.className = 'burst-spark';
      const s = 4 + Math.random() * 7;
      el.style.opacity = '0';
      el.style.width = el.style.height = s + 'px';
      el.style.left = (cx - s / 2) + 'px';
      el.style.top = (cy - s / 2) + 'px';
      layer.appendChild(el);
      sparks.push(el);
    }
    const ring = document.createElement('span');
    ring.className = 'burst-ring';
    ring.style.opacity = '0';
    ring.style.left = (cx - 15) + 'px';
    ring.style.top = (cy - 15) + 'px';
    layer.appendChild(ring);

    const targets = hearts.concat(sparks);
    const rotateFor = (el) => (el.classList.contains('burst-heart')
      ? 45 + (Math.random() - 0.5) * 140
      : (Math.random() - 0.5) * 360);
    anime.animate(targets, {
      keyframes: [
        { opacity: 1, scale: 0.4, translateY: 0, translateX: 0, rotate: 45 },
        {
          opacity: 0,
          scale: 1.05,
          translateY: () => -(40 + Math.random() * 260),
          translateX: () => (Math.random() - 0.5) * 420,
          rotate: (el) => rotateFor(el)
        }
      ],
      delay: anime.stagger(14),
      duration: 1200,
      ease: 'outCubic',
      onComplete: () => targets.forEach((el) => el.remove())
    });
    anime.animate(ring, {
      keyframes: [
        { opacity: 0.9, scale: 0.2 },
        { opacity: 0, scale: 9 }
      ],
      duration: 1100,
      ease: 'outCubic',
      onComplete: () => ring.remove()
    });
  }

  /* ---------------- confetti ---------------- */

  function confetti() {
    const canvas = $('#confetti');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#e6c56a', '#f4dd9a', '#f6c9c9', '#fff6e9', '#d98aa0'];
    const pieces = [];
    const pieceCount = lowPowerMode() ? 70 : 220;
    for (let i = 0; i < pieceCount; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 12,
        c: colors[Math.floor(Math.random() * colors.length)],
        vy: 2 + Math.random() * 3.5,
        vx: (Math.random() - 0.5) * 2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2
      });
    }
    let frames = 0;
    const anim = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y > canvas.height + 30) p.y = -20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frames++;
      if (frames < (lowPowerMode() ? 220 : 320)) requestAnimationFrame(anim);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    };
    anim();
  }

  /* ---------------- misc ---------------- */

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  /* ---------------- init ---------------- */

  async function init() {
    state.device = deviceId();
    sparkles();
    shootingStars();

    const [statusRes, contentRes] = await Promise.allSettled([
      fetch('/api/status'),
      fetch('/api/content')
    ]);

    state.content = contentRes.status === 'fulfilled'
      ? await contentRes.value.json()
      : FALLBACK;

    state.status = statusRes.status === 'fulfilled'
      ? await statusRes.value.json()
      : { unlocked: unlockedClient(state.content), unlockAt: state.content.unlockAt, novia: state.content.novia };

    if (state.status.unlocked) {
      initBox();
      setTheme('box');
      if (location.hash === '#musica') goToLayer(2);
      else if (location.hash === '#sobres') goToLayer(8);
      else if (location.hash === '#audio') goToLayer(4);
      else if (location.hash === '#recuerdos') goToLayer(5);
    } else {
      initLock();
      setTheme('lock');
    }
  }

  init();
})();
