import { defineConfig } from 'vite'
import react from '@vitejs/react-devtools' // 또는 @vitejs/plugin-react

export default defineConfig({
  plugins: [react()],
  base: '/Magic-Sketch_0426_v2/', // ← 이 부분을 리포지토리 이름과 똑같이 넣으세요!
})
