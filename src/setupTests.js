// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom 은 window.scrollTo 가 미구현이라 호출 때마다 console.error 를 찍는다.
// ScrollToTop 이 라우트 전환마다 부르므로 라우터 테스트가 조용하도록 막아 둔다.
window.scrollTo = jest.fn();
