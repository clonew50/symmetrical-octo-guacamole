// pianotiles.js
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
// Features: Dynamic Tiles, Audio Synthesizer, Score Counter, Dark Theme
// ESM Plugin for YATO BOT MD

const html = `
<style>
:root {
  --bg: #111b21;
  --card: #202c33;
  --tile-black: #0b141a;
  --tile-white: #2a3942;
  --line: #3b4a54;
  --text: #e9edef;
  --muted: #8696a0;
  --accent: #00a884;
  --danger: #ef5350;
  --shadow: 0 18px 50px rgba(0,0,0,.45);
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  min-height: 100vh;
  background: transparent;
  color: var(--text);
  font-family: var(--font);
  user-select: none;
  overflow: hidden;
}

.stage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
}

.card {
  width: 100%;
  max-width: 360px;
  background: rgba(17, 27, 33, 0.96);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--shadow);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 12px;
}

.title {
  font-size: 18px;
  font-weight: 700;
}

.score-box {
  font-size: 16px;
  font-weight: 800;
  color: var(--accent);
}

.board {
  position: relative;
  width: 100%;
  height: 320px;
  background: #0b141a;
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.column {
  position: relative;
  border-right: 1px solid var(--line);
  height: 100%;
}

.column:last-child {
  border-right: 0;
}

.tile {
  position: absolute;
  width: 100%;
  height: 80px;
  background: var(--accent);
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.tile.hit {
  background: #202c33;
  opacity: 0.3;
}

.btn {
  width: 100%;
  margin-top: 14px;
  border: 0;
  background: var(--accent);
  color: #071b16;
  font-size: 16px;
  font-weight: 700;
  border-radius: 12px;
  padding: 12px 0;
  cursor: pointer;
}

.footer {
  text-align: center;
  margin-top: 12px;
  font-size: 11px;
  color: var(--muted);
}
</style>

<main class="stage">
  <div class="card">
    <div class="header">
      <div class="title">🎹 YATO Piano Tiles</div>
      <div class="score-box">النقاط: <span id="score">0</span></div>
    </div>

    <div class="board" id="board">
      <div class="column" id="col0"></div>
      <div class="column" id="col1"></div>
      <div class="column" id="col2"></div>
      <div class="column" id="col3"></div>
    </div>

    <button class="btn" id="startBtn">▶️ ابدأ اللعبة</button>
    <div class="footer">YATO BOT MD — Rich Music Game</div>
  </div>
</main>

<script>
(() => {
  const scoreEl = document.getElementById('score');
  const startBtn = document.getElementById('startBtn');
  const columns = [
    document.getElementById('col0'),
    document.getElementById('col1'),
    document.getElementById('col2'),
    document.getElementById('col3')
  ];

  let score = 0;
  let isPlaying = false;
  let gameInterval = null;
  let speed = 4;
  let tiles = [];

  const freqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];

  function playNote(freq) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  function spawnTile() {
    const colIdx = Math.floor(Math.random() * 4);
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.top = '-80px';
    columns[colIdx].appendChild(tile);

    const tileObj = { el: tile, y: -80, col: colIdx, clicked: false };
    tiles.push(tileObj);

    tile.onclick = () => {
      if (!isPlaying || tileObj.clicked) return;
      tileObj.clicked = true;
      tile.classList.add('hit');
      score += 10;
      scoreEl.textContent = score;
      playNote(freqs[score % freqs.length]);
      if (score % 50 === 0) speed += 0.5;
    };
  }

  function update() {
    for (let i = tiles.length - 1; i >= 0; i--) {
      const t = tiles[i];
      t.y += speed;
      t.el.style.top = t.y + 'px';

      if (t.y > 320) {
        if (!t.clicked) {
          endGame();
          return;
        }
        t.el.remove();
        tiles.splice(i, 1);
      }
    }
  }

  function startGame() {
    score = 0;
    speed = 4;
    isPlaying = true;
    scoreEl.textContent = '0';
    startBtn.style.display = 'none';

    tiles.forEach(t => t.el.remove());
    tiles = [];

    let spawnCounter = 0;
    gameInterval = setInterval(() => {
      update();
      spawnCounter++;
      if (spawnCounter % 30 === 0) {
        spawnTile();
      }
    }, 1000 / 60);
  }

  function endGame() {
    isPlaying = false;
    clearInterval(gameInterval);
    alert('💥 انتهت اللعبة! مجموع نقاطك: ' + score);
    startBtn.style.display = 'block';
    startBtn.textContent = '🔄 إعـادة اللعـب';
  }

  startBtn.onclick = startGame;
})();
</script>
`;
// ᴍᴏᴅᴇ‌ʙʏ‌: https://t.me/YatoCoding
const handler = async (m, { conn }) => {
  try {
    await conn.relayMessage(
      m.chat,
      {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          botMetadata: {}
        },
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages: [
                {
                  messageType: 2,
                  messageText: 'YATO Piano Tiles 🎹'
                }
              ],
              unifiedResponse: {
                data: Buffer.from(
                  JSON.stringify({
                    response_id: 'yato-pianotiles-rich-html',
                    sections: [
                      {
                        view_model: {
                          primitive: {
                            __typename: 'GenAIaeacdsnwHtmlPrimitive',
                            payload: html,
                            trusted_sources: []
                          },
                          __typename: 'GenAISingleLayoutViewModel'
                        }
                      }
                    ]
                  })
                ).toString('base64')
              },
              contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: {
                  botJid: '867051314767696@bot'
                },
                forwardOrigin: 4
              }
            }
          }
        }
      },
      {}
    );
  } catch (e) {
    console.error('[PIANO TILES ERROR]', e);
    await m.reply('❌ فشل إرسال واجهة لعبة البيانو.');
  }
};

handler.help = ['بيانو', 'piano'];
handler.tags = ['game'];
handler.command = ['بيانو', 'بيانو', 'piano', 'pianotiles'];

export default handler;