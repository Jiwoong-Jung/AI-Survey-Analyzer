# v2.1.0 검증 기록

## 범위
- 분석 엔진 회귀 테스트: **18개 통과** (`node tests/analysis.test.cjs`)
- 로컬 Chromium UI/코드 점검: **18개 통과**
- 가상 응답 XLSX: 18명, 유효점수 141개, 평균 3.43/5, 분석 의견 16건
- 사용자가 제공한 원본 XLSX: TXT 없이 분석 성공. 같은 설정에서 TXT를 추가해도 평균, 문항별 분석, 키워드, 의견 분류, 개선안, 개인별 피드백이 동일함을 확인
- 가상 자료 PDF: 실제 다운로드 파일 생성, A4 6쪽, 페이지 구조 확인
- 실제 응답 원본, 이름 대응표 및 실제 자료 PDF는 배포 파일에 포함하지 않음

## UI 점검 내역
1. Initial load / latest version / no JavaScript error
2. Missing workbook produces a usable message, not a TXT requirement
3. Built-in demonstration runs with no TXT
4. XLSX-only file upload produces the expected 18-response result
5. Optional matching TXT leaves all analytical results unchanged
6. Removing TXT preserves sheet/header and supports re-analysis
7. Unreadable optional TXT is explained and Excel-only remains usable
8. Mismatched optional TXT warns without changing score/feedback
9. Invalid XLSX clears stale results and disables report download
10. Changing scale invalidates prior results and re-analyzes as 7-point
11. Edited individual feedback and skipped TXT status are reflected in PDF preview
12. Manual classification refreshes linked output, preserves edited feedback, resets confirmation
13. PDF downloaded successfully with valid A4 pages
14. User-provided workbook: XLSX-only and optional TXT results match
15. Static code check: no automatic localStorage or sessionStorage writes
16. No external network request during analysis or PDF creation
17. No runtime JavaScript errors in the tested UI paths
18. Narrow-screen initial form has no horizontal overflow

## 환경과 한계
이 환경은 Chromium의 URL 이동이 정책상 제한되어, 실제 소스의 HTML/CSS/JavaScript를 로컬 브라우저 메모리에 적재하는 테스트 방식으로 검증했습니다. 파일 선택, 분석, 수정, PDF 다운로드의 기능을 검증한 것이며 GitHub 배포 URL, 기관 Windows/Edge, 실제 네트워크 또는 CSP 정책의 집행까지 확인한 것은 아닙니다. 테스트 화면은 가상 자료만 사용했습니다.

분류 정확도, 완전한 익명화, 업무시간 절감률을 수치로 검증했다는 뜻이 아닙니다. 공개 사이트의 현재 파일 교체/배포는 사용자가 수행해야 합니다.

## 게시 후 필수 확인
1. 상단 버전이 2.1.0인지 확인
2. sample_responses.xlsx만 선택하고 분석 실행
3. TXT 미선택 상태로 PDF 미리보기에서 ‘엑셀 문항 사용 / TXT 대조 생략’ 확인
4. 피드백 문구 수정 → 최종 검토 확인 → PDF 다운로드
5. TXT를 선택 후 해제하고 재분석되는지 확인
6. 실제 자료는 저장소가 아닌 웹의 파일 선택 버튼으로 불러오기
