import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { DoneAlertBanner } from '../types'

const banner = atom({ plugin: 'done-alert', key: 'banner' } as const, null)
// 띠를 통째로 다시 그리는 신호. $.ui.blit 은 '받음' 으로 답하지만 기본 화면(전체화면 아님)에서는
// 실제로 칠해지지 않았다: 10-14 녹화에서 화면이 다시 그려질 때만 바뀌었다
const tickCount = atom({ plugin: 'done-alert', key: 'tick' } as const, 0)

// 맑은 고딕 굵게 22px 를 도트로 뜬 것. 셀 하나가 위아래 두 점(▀ ▄)이라 20점 = 10줄.
const GLYPH = [
  '................##............................',
  '.....######.....##............................',
  '....########....##...........##############...',
  '...###....###...##...........##############...',
  '...##......###..##......................###...',
  '...##......###..##......................###...',
  '...###....###...##...........##############...',
  '....#########...#####........##############...',
  '.....######.....#####........###..............',
  '.......##.......##...........###..............',
  '.......##.......##...........##############...',
  '.##############.##...........##############...',
  '.##############.##..............##....###.....',
  '................##..............##....###.....',
  '.....###........##..............##....###.....',
  '.....###........................##....###.....',
  '.....###..................####################',
  '.....###..................####################',
  '.....##############...........................',
  '.....##############...........................',
]

const TICK_MS = 60
const LINGER_MS = 0 // 키를 누르면 곧바로 흩어지기 시작한다
const DISSOLVE_MS = 300 // 픽셀이 하나씩 꺼지는 시간
const ROWS = 10
const SIDE = 16 // 큰 글자 양옆에 색종이가 날리는 폭
const DEFAULT = 0x01000000
const EMOJI = '\u{1F389}' // 🎉 파티 폭죽
const GLYPH_WIDTH = GLYPH[0]?.length ?? 0

// 색종이 조각: 터미널에서 한 칸 너비로 그려지는 글자만
const CONFETTI = [0x2a, 0x7e, 0x27, 0x2c, 0x60, 0x2580, 0x2584, 0x2e]

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  color: number
  seed: number
  phase: number
  glyph: number
}

type Dollar = EngineInterface

let timer: Timer | undefined
let startedAt = 0
let lastStepAt = 0
let leaveAt: number | null = null
let dissolve = 0 // 0 이면 온전, 1 이면 다 꺼짐
let particles: Particle[] = []
let serial = 0
let shown: DoneAlertBanner | null = null
let columns = 0
// 엔진 시계로 잰 마지막 시각. Date.now 대신 $.clock 을 써야 테스트의 가짜 시계가 먹는다
let lastNow = 0

function stop() {
  timer?.cancel()
  timer = undefined
}

async function hide($: Dollar) {
  stop()
  shown = null
  leaveAt = null
  dissolve = 0
  particles = []
  await update($, banner, () => null)
}

async function tick($: Dollar) {
  if (shown === null) {
    return
  }

  const now = await $.clock.now()
  lastNow = now

  if (leaveAt !== null && now >= leaveAt) {
    dissolve = (now - leaveAt) / DISSOLVE_MS

    if (dissolve >= 1) {
      await hide($)
      return
    }
  }

  stepConfetti(now)
  await update($, tickCount, n => n + 1)
}

function ensureTimer($: Dollar) {
  if (timer === undefined) {
    timer = $.clock.every(TICK_MS, () => void tick($))
  }
}

async function show($: Dollar, detail: string) {
  serial += 1
  shown = { kind: 'done', detail, serial }
  startedAt = await $.clock.now()
  lastNow = startedAt
  lastStepAt = startedAt
  leaveAt = null
  dissolve = 0
  particles = []
  await update($, banner, () => shown)
  ensureTimer($)
}

// 사람이 돌아온 신호: 곧바로 픽셀이 흩어지며 사라진다
async function markActive($: Dollar) {
  if (shown !== null && leaveAt === null) {
    leaveAt = (await $.clock.now()) + LINGER_MS
  }
}

function titleLeft() {
  return Math.max(0, Math.floor((columns - GLYPH_WIDTH) / 2))
}

// 시간 기준 물리: 틱이 늦게 와도 움직임이 튀지 않는다.
// 큰 글자 양옆 아래 모서리에서 색종이가 바깥 위로 터져 나와 팔랑이며 떨어진다
function stepConfetti(now: number) {
  const steps = Math.min(5, (now - lastStepAt) / 50)
  lastStepAt = now
  const left = titleLeft()
  const right = left + GLYPH_WIDTH

  if (dissolve === 0 && Math.random() < steps / 7) {
    const isLeft = Math.random() < 0.5
    const side = isLeft ? -1 : 1
    const count = 7 + Math.floor(Math.random() * 6)

    for (let k = 0; k < count; k += 1) {
      particles.push({
        x: isLeft ? left - 1 : right,
        y: ROWS - 1.5,
        vx: side * (0.35 + Math.random() * 0.55),
        vy: -(0.35 + Math.random() * 0.45),
        age: 0,
        life: 32 + Math.random() * 20,
        color: hsv(Math.random() * 360, 0.75, 1),
        seed: Math.random(),
        phase: Math.random() * Math.PI * 2,
        glyph: CONFETTI[Math.floor(Math.random() * CONFETTI.length)] ?? 0x2a,
      })
    }
  }

  particles = particles.filter(p => {
    p.age += steps
    p.vy = Math.min(0.12, p.vy + 0.03 * steps) // 천천히 떨어진다
    p.vx *= Math.pow(0.93, steps)
    p.x += (p.vx + Math.sin(p.age * 0.35 + p.phase) * 0.12) * steps // 팔랑임
    p.y += p.vy * steps

    return p.age < p.life && p.y < ROWS + 1
  })
}

function paint(now: number) {
  const words = new Uint32Array(columns * ROWS * 3)
  const put = (x: number, y: number, ch: number, fg: number, bg: number) => {
    if (x < 0 || y < 0 || x >= columns || y >= ROWS) return
    const i = (y * columns + x) * 3
    words[i] = ch
    words[i + 1] = fg
    words[i + 2] = bg
  }

  for (let i = 0; i < words.length; i += 3) {
    words[i] = 0x20
    words[i + 1] = DEFAULT
    words[i + 2] = DEFAULT
  }

  const left = titleLeft()
  // 한 프레임에 큰 글자 전체가 한 색: 터미널로 보내는 색 코드가 줄어 덜 끊긴다
  const color = hsv(((now - startedAt) / 1000) * 50, 0.8, 1)
  const isOn = (x: number, y: number) => GLYPH[y]?.[x] === '#' && noise(x, y, serial) >= dissolve

  for (let cy = 0; cy < ROWS; cy += 1) {
    for (let x = 0; x < GLYPH_WIDTH; x += 1) {
      const top = isOn(x, cy * 2)
      const bottom = isOn(x, cy * 2 + 1)

      if (top && bottom) {
        put(left + x, cy, 0x2588, color, DEFAULT) // █
      } else if (top) {
        put(left + x, cy, 0x2580, color, DEFAULT) // ▀
      } else if (bottom) {
        put(left + x, cy, 0x2584, color, DEFAULT) // ▄
      }
    }
  }

  for (const p of particles) {
    if (p.seed < dissolve) continue
    const x = Math.round(p.x)
    if (x >= left && x < left + GLYPH_WIDTH) continue // 큰 글자 위에는 그리지 않는다
    put(x, Math.round(p.y), p.glyph, p.color, DEFAULT)
  }

  return words
}

// 아래 문구도 글자가 무작위로 하나씩 빠진다. 넓은 글자(한글 · 이모지)는 넓은 공백으로 자리를 지킨다
function scatter(text: string): string {
  if (dissolve === 0) return text

  return Array.from(text)
    .map((ch, i) => {
      if (noise(i, 977, serial) >= dissolve) return ch
      const code = ch.codePointAt(0) ?? 0
      return code >= 0x1100 ? '　' : ' '
    })
    .join('')
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined && e.reason === 'answer') {
      const u = e.usage
      const output = u?.output_tokens ?? 0
      // 입력 = 새 입력 + 캐시 쓰기 + 캐시 읽기 (모델이 읽은 전체)
      const input = (u?.input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0)
      await show(
        $,
        `작업이 완료되었습니다 (소요시간 ${duration(e.durationMs)} - 출력 ${short(output)} · 입력 ${short(input)})`,
      )
    }

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    if (shown !== null) {
      await hide($)
    }

    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    await markActive($)
    return next(e)
  })

  on('ui.scroll', async ($, e, next) => {
    await markActive($)
    return next(e)
  })

  on('ui.focus', async ($, e, next) => {
    await markActive($)
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    await markActive($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, banner)

    if (current === null || e.props.hasSurvey) {
      return next(e)
    }

    await read($, tickCount)

    if (shown === null || shown.serial !== current.serial) {
      // 다시 불러온 직후: 저장된 배너로 이어 간다
      shown = current
      serial = Math.max(serial, current.serial)
      startedAt = lastNow
      lastStepAt = startedAt
    }

    columns = Math.max(24, Math.min(e.props.bodyColumns, GLYPH_WIDTH + SIDE * 2))
    ensureTimer($)

    const message = scatter(`${EMOJI} ${current.detail} ${EMOJI}`)

    if (e.surface !== 'terminal') {
      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          <Text bold color="success">
            {scatter('완료')}
          </Text>
          <Text>{message}</Text>
        </Box>
      )
    }

    const { Box, Text, Raster } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Raster key="show" columns={columns} rows={ROWS} cells={encode(paint(lastNow))} />
        <Box width={columns} justifyContent="center">
          <Text bold color="success">
            {message}
          </Text>
        </Box>
      </Box>
    )
  })
}

// 좌표마다 고정된 0~1 난수: 같은 픽셀은 늘 같은 순서로 꺼진다
function noise(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35) ^ Math.imul(seed + 1, 0x27d4eb2f)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15

  return (h >>> 0) / 4294967296
}

function hsv(hue: number, saturation: number, value: number): number {
  const h = (((hue % 360) + 360) % 360) / 60
  const c = value * saturation
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = value - c
  const [r, g, b] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  const to = (n: number) => Math.max(0, Math.min(255, Math.round((n + m) * 255)))

  return (to(r) << 16) | (to(g) << 8) | to(b)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function encode(words: Uint32Array): string {
  const bytes = new Uint8Array(words.buffer, words.byteOffset, words.byteLength)
  let out = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += b === undefined ? '=' : B64[(n >> 6) & 63]!
    out += c === undefined ? '=' : B64[n & 63]!
  }

  return out
}

function duration(ms: number): string {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60

  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`
}

// 4567 → 4.6k, 1234567 → 1.2m
function short(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
