import React from 'react';
import { fireEvent, render } from '@testing-library/react';

import SelectionBar from './SelectionBar';

const props = (over = {}) => ({
  roomLabel: '306-1',
  from: new Date('2026-09-04T17:30:00'),
  to: new Date('2026-09-04T18:30:00'),
  disabled: false,
  onReserve: jest.fn(),
  ...over,
});

describe('SelectionBar', () => {
  it('선택이 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<SelectionBar {...props({ from: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('호실이 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(
      <SelectionBar {...props({ roomLabel: null })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('종료 시간이 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<SelectionBar {...props({ to: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('호실과 시간을 보여준다', () => {
    const { getByText } = render(<SelectionBar {...props()} />);
    expect(getByText('306-1 · 17:30~18:30')).toBeInTheDocument();
  });

  it('예약하기를 누르면 onReserve 가 불린다', () => {
    const onReserve = jest.fn();
    const { getByRole } = render(<SelectionBar {...props({ onReserve })} />);
    fireEvent.click(getByRole('button', { name: '예약하기' }));
    expect(onReserve).toHaveBeenCalledTimes(1);
  });

  it('disabled 면 버튼이 잠긴다', () => {
    const { getByRole } = render(
      <SelectionBar {...props({ disabled: true })} />,
    );
    expect(getByRole('button', { name: '예약하기' })).toBeDisabled();
  });
});

describe('SelectionBar 본문 여백', () => {
  // jsdom 은 offsetHeight 를 항상 0 으로 보고하므로, 실제 바 높이가 있는 것처럼
  // 스텁을 세워야 ResizeObserver 콜백이 의미 있는 값을 읽는다.
  //
  // 추가로: jsdom 이 번들한 cssstyle(2.3.0)의 padding-bottom 세터는 빈 문자열을
  // "유효하지 않은 padding 값"으로 보고 대입 자체를 조용히 무시한다
  // (node_modules/cssstyle/lib/parsers.js 의 subImplicitSetter, padding.js 의
  // isValid 로 직접 확인함). 실제 브라우저는 `el.style.paddingBottom = ''` 로
  // 정상적으로 속성을 지운다. 이 버그 때문에 컴포넌트가 올바르게
  // `document.body.style.paddingBottom = ''` 를 실행해도 jsdom 에서는 값이
  // 그대로 남아, "지워졌는지" 검증이 불가능해진다. 그래서 이 describe 안에서만
  // paddingBottom 을 인스턴스 프로퍼티로 덮어써 표준 CSSOM 동작(빈 문자열 대입
  // = 제거)을 흉내 낸다. 이렇게 해야 컴포넌트의 정리 로직이 실제로 의도한 값을
  // 대입하는지를 검증할 수 있다.
  let originalOffsetHeightDescriptor;
  let paddingValue = '';

  beforeEach(() => {
    originalOffsetHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight',
    );
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return 65;
      },
    });

    paddingValue = '';
    Object.defineProperty(document.body.style, 'paddingBottom', {
      configurable: true,
      get: () => paddingValue,
      set: v => {
        paddingValue = v;
      },
    });
  });

  afterEach(() => {
    if (originalOffsetHeightDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'offsetHeight',
        originalOffsetHeightDescriptor,
      );
    }
    delete document.body.style.paddingBottom;
  });

  it('선택이 완전하면 바 높이만큼 본문 아래 여백을 둔다', () => {
    render(<SelectionBar {...props()} />);
    expect(document.body.style.paddingBottom).not.toBe('');
  });

  it('언마운트되면 여백을 지운다', () => {
    const { unmount } = render(<SelectionBar {...props()} />);
    expect(document.body.style.paddingBottom).not.toBe('');

    unmount();

    expect(document.body.style.paddingBottom).toBe('');
  });
});
