# OPIc Script Studio

로컬에서 OPIc 스크립트를 JSON 하나로 관리하고, 웹 화면에서 편집/추가/학습할 수 있는 앱입니다.

## 실행

```bash
npm start
```

브라우저에서 `http://localhost:5174`를 엽니다.

웹 화면의 스크립트 목록은 기본적으로 공개된 Google Spreadsheet의 CSV export를 읽어옵니다.
현재 연결된 시트:

`https://docs.google.com/spreadsheets/d/1P2jZmJJv4t_AMjFEPbHFPqc5iKeHz_oPdnn8ktUpIiQ/edit?usp=sharing`

C열의 단일 스크립트 JSON만 실제 앱 데이터로 사용하며, 빈 C열은 무시합니다. A열/B열은 시트 관리용 보조 컬럼입니다.

## 배포

GitHub Pages 배포는 `.github/workflows/pages.yml`에서 처리합니다. `main` 브랜치에 변경사항이 올라가면 `public/` 파일과 `data/` JSON을 정적 사이트로 묶어 배포합니다.

앱 데이터는 기본적으로 공개된 Google Spreadsheet CSV를 읽고, 시트 접근이 안 될 때만 `data/scripts.json` 백업본으로 폴백합니다.

## 데이터 파일

스크립트 데이터는 Google Spreadsheet의 C열 JSON에서 읽습니다. `data/scripts.json`은 시트 로딩 실패 시만 쓰는 백업본입니다.

각 스크립트는 `title`, `topic`, `type`, `tags`, `sentences`를 가집니다. 문장은 `korean`, `english`, 선택 필드인 `note`로 구성됩니다.

편집 화면의 `스크립트 JSON` 영역은 현재 스크립트의 JSON 미리보기입니다. 수정한 뒤 `복사`해서 스프레드시트 C열에 붙여넣는 용도로 사용합니다.

## 필러

필러 표현은 `data/fillers.json`에 별도로 저장됩니다. 웹 화면의 `필러` 탭에서 상황별로 필터링해 빠르게 찾아볼 수 있습니다.
