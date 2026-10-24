import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite'; // 引入 Vite 專用的 Tailwind 外掛

export default defineConfig({
  site: 'https://giraffechiu.github.io',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()], // 直接掛載到 Vite 插件中
  },
});