import brand from './brand.json';

/** Public identity only. Existing storage keys and client protocols stay compatible. */
export const BRAND_NAME = brand.name;
export const BRAND_SLUG = brand.slug;
export const BRAND_DESCRIPTION = brand.description;
export const PROJECT_VERSION = brand.version;
export const UPSTREAM_NAME = brand.upstreamName;
export const UPSTREAM_BASE_VERSION = brand.upstreamVersion;
export const UPSTREAM_URL = brand.upstreamUrl;
export const AI_WELCOME_MESSAGE = `你好！我是 ${BRAND_NAME} 的影视助手。想看什么电影或剧集？需要推荐吗？`;
