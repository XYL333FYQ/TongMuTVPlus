// 页面实际的滚动容器是 document.body，这里同时兼容 documentElement

export const getPageScrollTop = () =>
  document.body.scrollTop || document.documentElement.scrollTop || 0;

export const scrollPageTo = (top: number) => {
  document.body.scrollTop = top;
  document.documentElement.scrollTop = top;
};
