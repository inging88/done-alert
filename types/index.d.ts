export type DoneAlertBanner = {
  kind: 'done'
  detail: string
  /** 새 배너마다 바뀌는 번호: 픽셀이 꺼지는 순서를 새로 섞는다 */
  serial: number
}

declare module 'claude-code' {
  interface PluginState {
    'done-alert': { banner: DoneAlertBanner | null; tick: number }
  }
}
