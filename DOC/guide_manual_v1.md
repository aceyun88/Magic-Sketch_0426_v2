# Magic Sketch 초보자용 개발 가이드 및 매뉴얼 (v1.0)

본 문서는 'Magic Sketch' 앱의 기술적 구조를 이해하고, 직접 수정 및 확장하려는 입문자를 위한 상세 가이드입니다.

---

## 1. 프로젝트 개요
'Magic Sketch'는 아이들의 상상력을 현실로 만들어주는 **AI 기반 색칠공부 생성기**입니다.
*   **프론트엔드**: React + TypeScript + Tailwind CSS
*   **백엔드**: Firebase (Auth, Firestore)
*   **AI 엔진**: Google Gemini API

---

## 2. 필수 준비물 (Prerequisites)
이 프로젝트를 직접 수정하려면 다음 계정들이 필요합니다.
1.  **Google 계정**: AI Studio 및 Firebase 설정에 사용됩니다.
2.  **API Key**: Gemini 모델을 호출하기 위한 열쇠입니다. (AI Studio 설정에서 자동 관리됨)

---

## 3. 단계별 개발 가이드

### 1단계: 코드 구조 이해하기 (어디에 무엇이 있나요?)
*   `src/App.tsx`: 대부분의 화면 디자인과 로직(AI 호출, 데이터 저장)이 들어있는 **심장**입니다.
*   `src/lib/firebase.ts`: Firebase 데이터베이스와 연결하는 **통로**입니다.
*   `firebase-blueprint.json`: 데이터베이스가 어떤 모양으로 생겼는지 정의한 **설계도**입니다.
*   `DOC/`: 현재 읽고 계신 매뉴얼과 로드맵이 들어있는 **문서 보관실**입니다.

### 2단계: 화면 수정하기 (디자인 바꾸기)
가장 쉬운 수정은 글자나 색상을 바꾸는 것입니다.
*   **텍스트 변경**: `src/App.tsx` 파일에서 `Ctrl+F`를 눌러 "Magic Sketch"를 찾은 뒤 원하는 이름으로 고쳐보세요.
*   **색상 변경**: Tailwind CSS 클래스를 사용합니다. 예를 들어 `bg-[#6C5DD3]`는 보라색 배경입니다. 이를 `bg-[#FF0000]`로 바꾸면 빨간색이 됩니다.

### 3단계: AI 프롬프트 튜닝하기
`handleGenerate` 함수 안에는 AI에게 내리는 명령(Prompt)이 있습니다.
*   `"pure white background, no shading"` 같은 문구를 추가하거나 수정하여 생성되는 그림의 스타일을 바꿀 수 있습니다.

---

## 4. 데이터베이스 관리 (Firestore)
우리는 **Subcollection**이라는 구조를 사용합니다.
*   `books`: 도안의 제목, 날짜, 썸네일 정보만 저장 (가볍게!)
*   `books/{bookID}/images`: 실제 고용량 이미지 4개를 각각 따로 저장 (용량 초과 방지!)

---

## 5. 버전 관리 규칙
수정을 마칠 때마다 다음을 수행하세요:
1.  `metadata.json`의 `name` 뒤에 버전을 업데이트합니다 (예: v1 -> v2).
2.  `DOC/version_history.md`에 변경된 내용을 한 줄 기록합니다.
3.  매뉴얼(`DOC/guide_manual_v1.md`)을 복사하여 새로운 버전(`_v2`)으로 만듭니다.

---

## 6. 트러블슈팅 (자주 발생하는 문제)
*   **PDF가 안 열려요**: 한글 폰트 지원 문제로 인해 텍스트를 이미지로 변환해 넣고 있습니다. `drawTextToImage` 함수를 확인하세요.
*   **저장할 때 에러가 나요**: 로그인이 되어 있는지 확인하세요. 로그인을 해야만 Firestore에 저장할 수 있습니다.

---
*최종 업데이트: 2026-04-18 (v1.0)*
