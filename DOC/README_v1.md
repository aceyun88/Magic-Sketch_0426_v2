# Magic Sketch_0418_v2 🎨

아이들의 상상력을 현실로 만들어주는 AI 기반 색칠공부 생성기, **Magic Sketch**입니다.

## 🚀 프로젝트 개요
Magic Sketch는 고성능 AI 모델인 Google Gemini를 활용하여, 아이가 원하는 주제와 이름을 넣으면 즉석에서 고화질 색칠공부 도안 4장과 맞춤형 표지가 포함된 5페이지 분량의 PDF를 생성해주는 웹 애플리케이션입니다.

## ✨ 주요 기능
- **AI 도안 생성**: 주제(Theme)를 입력하면 Gemini API가 4가지의 유니크한 선화(Line Art) 도안을 그려줍니다.
- **개인화 서비스**: 아이의 이름을 입력하면 PDF 표지에 자동으로 포함되어 '나만의 색칠공부 책'이 완성됩니다.
- **마이 갤러리**: 생성한 도안을 클라우드(Firebase)에 저장하고 언제든 다시 확인하거나 다운로드할 수 있습니다.
- **고화질 PDF**: 인쇄에 최적화된 A4 사이즈 PDF 파일을 한글 깨짐 없이 생성합니다.
- **반응형 다크 모드**: 세련된 '미드나잇 매직' 테마로 낮과 밤 언제든 편안하게 사용할 수 있습니다.

## 🛠 기술 스택
- **Frontend**: React 18+, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion (애니메이션)
- **Backend/DB**: Firebase (Authentication, Firestore)
- **AI**: @google/genai (Gemini 3-Flash, Gemini 2.5-Flash-Image)
- **Document**: jsPDF (PDF 생성)

## 📁 프로젝트 구조
```text
/src
  /components  - 재사용 가능한 UI 컴포넌트
  /lib         - Firebase 및 유틸리티 설정
  App.tsx      - 메인 로직 및 라우팅
/DOC
  PRD_v1.md          - 제품 요구사항 정의서
  guide_manual_v2.md - 왕초보용 개발 매뉴얼 및 바이브 코딩 가이드
  roadmap.md         - 수익화 및 향후 발전 계획
  version_history.md - 버전 관리 이력
```

## 📋 시작하기
1. **API 키 설정**: `.env.example` 파일을 참고하여 `GEMINI_API_KEY`를 설정하세요.
2. **Firebase 프로젝트**: Firebase 콘솔에서 프로젝트를 만들고 설정 정보를 `firebase-applet-config.json`에 입력하세요.
3. **실행**: `npm install` 후 `npm run dev`를 통해 로컬에서 실행할 수 있습니다.

## 📄 라이선스
이 프로젝트는 Apache-2.0 라이선스를 따릅니다.

---
*최종 업데이트: 2026-04-26 (README_v1)*
