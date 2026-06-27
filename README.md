# OPIc Script Studio

로컬에서 OPIc 스크립트를 JSON 하나로 관리하고, 웹 화면에서 편집/추가/학습할 수 있는 앱입니다.

## 실행

```bash
npm start
```

브라우저에서 `http://localhost:5174`를 엽니다.

## 배포

GitHub Pages 배포는 `.github/workflows/pages.yml`에서 처리합니다. `main` 브랜치에 변경사항이 올라가면 `public/` 파일과 `data/` JSON을 정적 사이트로 묶어 배포합니다.

배포된 정적 사이트에서는 서버 API가 없기 때문에 `저장` 버튼이 `data/scripts.json`을 직접 수정하지 않고, 현재 브라우저의 `localStorage`에 개인 편집본을 저장합니다. 다른 기기나 브라우저로 옮길 때는 `JSON 내보내기`와 `JSON 가져오기`를 사용하세요.

## 데이터 파일

스크립트 데이터는 `data/scripts.json` 하나에 저장됩니다.

각 스크립트는 `title`, `topic`, `type`, `tags`, `sentences`를 가집니다. 문장은 `korean`, `english`, 선택 필드인 `note`로 구성됩니다.

웹 화면에서 전체 JSON을 내보내거나 가져올 수 있습니다. 가져온 JSON은 화면에 먼저 반영되고, `저장`을 눌러야 `data/scripts.json`에 기록됩니다.

편집 화면의 `스크립트 JSON` 영역에서는 선택된 스크립트 하나를 JSON으로 직접 수정한 뒤 `JSON 적용`으로 반영할 수 있습니다.

## 필러

필러 표현은 `data/fillers.json`에 별도로 저장됩니다. 웹 화면의 `필러` 탭에서 상황별로 필터링하고, 브라우저 TTS로 영어 표현을 바로 들을 수 있습니다.
