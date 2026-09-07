import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import Notice from './notice';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('Notice 문의 안내', () => {
  it('문의하기를 누르면 접수 화면으로 이동하고, 로그인 안내는 버튼 밖에 남는다', () => {
    render(<Notice />);

    // 문의 안내는 기본으로 접혀 있는 "계정" 항목 안에 있다. 지금 Accordion 은 닫힌 패널을
    // grid-rows-[0fr] 로만 감춰 접근성 트리에 남기지만, 거기에 기대면 사용자가 밟지 않는
    // 경로를 검증하게 된다. 실제 순서대로 트리거부터 연다.
    fireEvent.click(screen.getByRole('button', { name: /계정/ }));

    const button = screen.getByRole('button', { name: '문의하기' });
    expect(button.parentElement).toHaveTextContent(
      '* 사용 관련 문의·건의 : 문의하기(로그인 후), 또는 이메일 ces@hufs.ac.kr',
    );

    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/new');
    // 진입점이 여러 개라 한 경로만 적으면 거짓이 된다. 경로 안내는 지운다.
    expect(screen.queryByText(/마이페이지 >/)).toBeNull();
    expect(screen.queryByText(/1:1/)).toBeNull();
  });
});

// 휴대폰으로 들어오는 학생이 매번 주소를 치지 않도록 이용 규칙 안에 바로가기 안내를 넣었다.
describe('Notice 홈 화면 바로가기 안내', () => {
  // 이 Accordion 은 닫힌 패널을 grid-rows-[0fr] 로만 감춰 접근성 트리에 남긴다.
  // 닫힌 채로 단언하면 사용자가 밟지 않는 경로를 검증하게 되므로 트리거부터 연다.
  const openGuide = () => {
    render(<Notice />);
    const trigger = screen.getByRole('button', {
      name: /홈 화면에 바로가기 추가하기/,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  };

  it('브라우저 세 가지 안내가 모두 들어 있다', () => {
    openGuide();

    // 본문 팁에도 "Safari" 가 나오므로 각 안내 카드의 제목으로 좁힌다.
    expect(
      screen.getByRole('heading', { name: /Safari.*아이폰/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Chrome.*안드로이드/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /삼성 인터넷.*갤럭시/ }),
    ).toBeInTheDocument();
  });

  // 그림이 이 안내의 핵심이라, 그림을 못 보는 사용자에게도 같은 내용이 전달돼야 한다.
  it('일러스트마다 읽을 수 있는 이름이 붙어 있다', () => {
    openGuide();

    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(
      screen.getByRole('img', { name: /공유 목록에서 홈 화면에 추가/ }),
    ).toBeInTheDocument();
  });

  // 앱 내부 이동이 아니라 브라우저에서 열어야 하는 외부 주소다.
  it('열어야 할 주소를 링크로 알려준다', () => {
    openGuide();

    expect(
      screen.getByRole('link', { name: /studyroom.computer.hufs.ac.kr/ }),
    ).toHaveAttribute('href', 'https://studyroom.computer.hufs.ac.kr');
  });
});
