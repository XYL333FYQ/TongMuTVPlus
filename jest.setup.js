import '@testing-library/jest-dom/extend-expect';

// Allow router mocks.
// eslint-disable-next-line no-undef
jest.mock('next/router', () => require('next-router-mock'));

// jsdom 的 <dialog> 没有 showModal / close；全站模态层（ModalLayer）要用，给最小实现。
if (
  typeof window !== 'undefined' &&
  window.HTMLDialogElement &&
  !window.HTMLDialogElement.prototype.showModal
) {
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}

// jsdom 没有 ResizeObserver；组件只用它重新测量，测试里给一个空实现。
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
