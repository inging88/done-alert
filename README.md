# done-alert

Claude Code 작업이 끝나면 프롬프트 위에 색이 천천히 도는 큰 **완료** 글자와, 그 양옆에서 터져 날리는 색종이를 띄우는 mod 입니다.

```
🎉 작업이 완료되었습니다 (소요시간 1분 23초 - 출력 4.6k · 입력 1.2m) 🎉
```

- **출력**: 모델이 새로 생성한 토큰
- **입력**: 모델이 읽은 전체 토큰(새 입력 + 캐시 쓰기 + 캐시 읽기)
- **사라지는 시점**: 돌아온 신호가 오고 5초 뒤, 픽셀이 무작위로 하나씩 꺼지며 사라집니다. 돌아온 신호는 프롬프트에 입력하기, 스크롤, 배너 클릭입니다.
- 새 프롬프트를 보내면 바로 사라집니다.
- 터미널에서만 큰 글자로 그립니다. 데스크톱 앱에서는 글자 한 줄로 표시합니다.

## 설치

터미널 세션의 프롬프트에서:

```
/plugin install done-alert --marketplace inging88/done-alert
```

`Add marketplace?` 에 `y` 를 누른 뒤 범위(user 권장)를 고르면 됩니다.

셸에서 설치할 때:

```
claude plugin install done-alert --marketplace inging88/done-alert
```

Claude Code 데스크톱 앱에서는 `/plugin` 이 동작하지 않습니다. 프롬프트 옆 **+** → Plugins → Add marketplace 에 `inging88/done-alert` 를 넣은 뒤 Add plugin 을 누르세요.

## 요구 사항

- mod(함수 훅 플러그인)를 지원하는 Claude Code. 2.1.299 에서 확인했습니다.
- truecolor 를 지원하는 터미널
