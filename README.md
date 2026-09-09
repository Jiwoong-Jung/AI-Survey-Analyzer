# AI 강의평가 인사이트

설문 문항 TXT와 응답 XLSX 파일을 불러와 강의평가 결과를 브라우저에서 분석하는 웹 도구입니다.

## 주요 기능

- 5점 리커트 응답 자동 인식
- 전체 평균 및 정량 문항 수 집계
- 문항별 평균, 긍정률, 개선필요율 분석
- 서술형 의견 및 핵심 키워드 확인
- 응답자별 피드백 확인
- 교수자 실명 자동 익명화
- 분석 결과 TXT 보고서 저장
- 선택한 설문 파일은 브라우저 내부에서 처리

## 사용 방법

1. 웹페이지에서 `설문 문항 TXT 선택`을 눌러 문항 파일을 선택합니다.
2. `응답 XLSX 선택`을 눌러 설문 응답 파일을 선택합니다.
3. `분석 실행`을 누릅니다.
4. 요약 대시보드, 문항별 분석, 키워드·의견, 응답자별 피드백 탭에서 결과를 확인합니다.
5. 필요할 경우 `분석 보고서 저장`을 눌러 TXT 보고서를 저장합니다.

`sample_questions.txt`와 `sample_responses.xlsx`는 테스트용 샘플 파일입니다.

## GitHub Pages로 공개하기

1. GitHub에서 새 저장소(Repository)를 만듭니다.
2. 이 폴더 안의 파일들을 저장소의 최상위 경로에 업로드합니다. `index.html`이 반드시 저장소 최상단에 있어야 합니다.
3. 저장소의 `Settings` → `Pages`로 이동합니다.
4. `Build and deployment`에서 `Deploy from a branch`를 선택합니다.
5. Branch를 `main`, 폴더를 `/(root)`로 선택하고 저장합니다.
6. 배포가 완료되면 GitHub Pages 주소로 접속할 수 있습니다.

일반적인 주소 형태는 다음과 같습니다.

`https://GitHub아이디.github.io/저장소이름/`

## 개인정보 및 보안 주의사항

실제 훈련생 또는 설문 참여자의 개인정보가 포함된 응답 XLSX 파일은 GitHub 저장소에 업로드하지 마세요. 사용자가 웹페이지에서 직접 선택한 TXT/XLSX 파일은 브라우저 메모리에서 분석하도록 구성되어 있습니다.

단, XLSX 파일 처리를 위해 SheetJS 라이브러리를 CDN에서 불러오므로 현재 버전은 실행 시 인터넷 연결이 필요합니다. 설문 파일 자체를 SheetJS CDN으로 전송하는 구조는 아닙니다.

## 권장 저장소 구성

```text
AI-Survey-Analyzer/
├─ index.html
├─ app.js
├─ style.css
├─ sample_questions.txt
├─ sample_responses.xlsx
├─ README.md
└─ .gitignore
```

## 실제 운영 시 권장 사항

- GitHub에는 샘플 데이터만 게시하고 실제 응답 데이터는 게시하지 않습니다.
- 개인정보나 내부 대외비가 포함된 파일은 로컬에서만 선택해 분석합니다.
- 프로그램 수정 후에는 `index.html`, `app.js`, `style.css`를 교체하여 업데이트할 수 있습니다.
