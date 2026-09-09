import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import Notice from './notice';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// 이용 규칙은 비로그인에서도 열린다(푸터 링크). 로그인 여부에 따라 버튼의 목적지가 갈린다.
const mockLoggedIn = jest.fn(() => true);
jest.mock('../../hooks/useAuth', () => () => ({ loggedIn: mockLoggedIn() }));

const mockOpenErrorSnackbar = jest.fn();
jest.mock('../../components/snackbar/SnackBar', () => ({
  useCustomSnackbars: () => ({
    openSuccessSnackbar: jest.fn(),
    openErrorSnackbar: mockOpenErrorSnackbar,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLoggedIn.mockReturnValue(true);
});

// 세 버튼(/check·/password·/inquiry/new)은 비로그인 라우트에 없어 캐치올이 안내 없이 홈으로
// 바꿔치기했다. 학생은 방금 누른 게 왜 홈이 됐는지 알 수 없었다.
describe('Notice 비로그인 이동', () => {
  beforeEach(() => mockLoggedIn.mockReturnValue(false));

  it('내 신청 현황은 홈으로 튕기는 대신 안내와 함께 로그인 화면으로 보낸다', () => {
    render(<Notice />);

    fireEvent.click(screen.getByRole('button', { name: '내 신청 현황' }));

    expect(mockNavigate).toHaveBeenCalledWith('/login');
    expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
      '로그인 후 이용할 수 있습니다.',
      2500,
    );
  });

  it('비밀번호 변경·문의하기도 로그인 화면으로 보낸다', () => {
    render(<Notice />);
    fireEvent.click(screen.getByRole('button', { name: /계정/ }));

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));

    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/login');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/login');
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  // 기본 펼침 구획에 있어 비로그인 방문자가 가장 먼저 만나는 버튼인데 단서가 없었다.
  it('내 신청 현황 문장에 로그인 후 단서가 있다', () => {
    render(<Notice />);

    expect(
      screen.getByRole('button', { name: '내 신청 현황' }).parentElement,
    ).toHaveTextContent('내 신청 현황(로그인 후)에서 확인할 수 있습니다.');
  });
});

describe('Notice 로그인 이동', () => {
  it('로그인 상태면 내 신청 현황과 비밀번호 변경으로 바로 간다', () => {
    render(<Notice />);

    fireEvent.click(screen.getByRole('button', { name: '내 신청 현황' }));
    fireEvent.click(screen.getByRole('button', { name: /계정/ }));
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/check');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/password');
    expect(mockOpenErrorSnackbar).not.toHaveBeenCalled();
  });
});

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
