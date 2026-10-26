import brand from './brand.json';

/** Public identity only. Existing storage keys and client protocols stay compatible. */
export const BRAND_NAME = brand.name;
export const BRAND_SLUG = brand.slug;
export const BRAND_DESCRIPTION = brand.description;
export const PROJECT_VERSION = brand.version;
export const PROJECT_REPOSITORY_URL = brand.repositoryUrl;
export const PROJECT_STAR_MESSAGE = `喜欢 ${BRAND_NAME}？欢迎在 GitHub 点个 Star 支持。`;
export const AI_WELCOME_MESSAGE = `你好！我是 ${BRAND_NAME} 的影视助手。想看什么电影或剧集？需要推荐吗？`;

/** 浏览器工具栏初始颜色：<meta name="theme-color"> 只能写字面量，须与 tokens.css 深色 --tm-bg 保持一致。 */
export const INITIAL_THEME_COLOR = '#0b0b0d';
