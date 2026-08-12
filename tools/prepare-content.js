const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FOTOS_DIR = path.join(ROOT, 'public', 'content', 'media', 'fotos');
const AUDIO_DIR = path.join(ROOT, 'public', 'content', 'media', 'audio');
const CONTENT_FILE = path.join(ROOT, 'content', 'content.json');

const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const AUD_EXT = /\.(mp3|m4a|aac|ogg|wav|opus)$/i;

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.log('sharp no disponible, sin optimizar.'); }

function list(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => ext.test(f)).sort();
}

async function optimize(fotos) {
  const out = [];
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i];
    const src = path.join(FOTOS_DIR, f);
    const dest = path.join(FOTOS_DIR, `foto-${i + 1}.jpg`);
    if (sharp) {
      await sharp(src)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(dest);
      out.push({ src: 'content/media/fotos/foto-' + (i + 1) + '.jpg', leyenda: 'Recuerdo ' + (i + 1) });
    } else {
      out.push({ src: 'content/media/fotos/' + f, leyenda: 'Recuerdo ' + (i + 1) });
    }
  }
  return out;
}

async function main() {
  let content;
  try {
    content = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    console.error('No pude leer content.json:', e.message);
    process.exit(1);
  }

  // limpiar optimizadas anteriores
  if (fs.existsSync(FOTOS_DIR)) {
    fs.readdirSync(FOTOS_DIR).forEach((f) => {
      if (/^foto-\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(FOTOS_DIR, f));
    });
  }

  const fotos = list(FOTOS_DIR, IMG_EXT);
  const audio = list(AUDIO_DIR, AUD_EXT);

  const fotosFinal = fotos.length ? await optimize(fotos) : [];
  content.capas.recuerdos.fotos = fotosFinal;

  if (audio.length) {
    content.capas.audio.archivo = 'content/media/audio/' + audio[0];
  }

  fs.writeFileSync(CONTENT_FILE, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(JSON.stringify(content, null, 2) + '\n', 'utf8')]));
  console.log('content.json actualizado: ' + fotosFinal.length + ' foto(s) y ' + audio.length + ' audio(s).');
}

main();
