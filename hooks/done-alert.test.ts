import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 30,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 29, contentRows: 0 },
    view: {},
  } as unknown as RenderPropsOf['AbovePrompt'],
} as const

// 엔진 대역: 턴 종료와 프롬프트 제출을 그대로 받아 준다
const engine = (on: On) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, {}, '엔진의 기본 그림') as never
  })
  return clock
}

test('턴이 끝나면 완료 글자와 소요시간 · 토큰을 띄운다', async ($, on) => {
  engine(on)
  await $.turn.complete({
    answer: '끝',
    durationMs: 83_000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      input_tokens: 10,
      output_tokens: 4567,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      model: 'm',
    },
  } as never)

  const ui = await $.ui.mount({ plugin: 'done-alert', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'show' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /작업이 완료되었습니다/ }))?.text).toBe(
    '🎉 작업이 완료되었습니다 (소요시간 1분 23초 - 출력 4.6k · 입력 10) 🎉',
  )
  await ui.unmount()
})

test('새 프롬프트를 보내면 배너를 바로 내린다', async ($, on) => {
  engine(on)
  await $.turn.complete({
    answer: '',
    durationMs: 5_000,
    isAborted: false,
    turnId: 't2',
    reason: 'answer',
  } as never)
  await $.prompt.submit({ text: '다음 일' } as never)

  const ui = await $.ui.mount({ plugin: 'done-alert', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'show' })).toBeUndefined()
  await ui.unmount()
})

test('프롬프트에 키를 누르면 곧바로 픽셀이 흩어지며 사라진다', async ($, on) => {
  const clock = engine(on)
  on('prompt.edit', ($, e) => ({ text: e.text + e.inputText, cursor: e.cursor + 1 }))
  await $.turn.complete({ answer: '', durationMs: 5_000, isAborted: false, turnId: 't3', reason: 'answer' } as never)

  const ui = await $.ui.mount({ plugin: 'done-alert', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'show' })).toBeDefined()

  // prompt.edit 은 엔진만 올리는 사건이라 타입에 없다. 테스트의 $ 는 그대로 올린다
  await ($.prompt as unknown as { edit: (e: unknown) => Promise<unknown> }).edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'a' } as never)
  await clock.advance(120)
  expect(await ui.find({ key: 'show' })).toBeDefined() // 흩어지는 중
  await clock.advance(300)
  expect(await ui.find({ key: 'show' })).toBeUndefined()
  await ui.unmount()
})
