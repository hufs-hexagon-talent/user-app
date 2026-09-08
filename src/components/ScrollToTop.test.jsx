import React from 'react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ScrollToTop from './ScrollToTop';

const Page = ({ name }) => {
  const navigate = useNavigate();
  return (
    <div>
      <h1>{name}</h1>
      <button type="button" onClick={() => navigate('/b')}>
        b로
      </button>
      <button type="button" onClick={() => navigate('/b?tab=2')}>
        b 쿼리만
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        뒤로
      </button>
    </div>
  );
};

const renderAt = path =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ScrollToTop />
      <Routes>
        <Route path="/a" element={<Page name="A" />} />
        <Route path="/b" element={<Page name="B" />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ScrollToTop', () => {
  let scrollTo;
  beforeEach(() => {
    scrollTo = jest.fn();
    window.scrollTo = scrollTo;
  });

  test('첫 진입에서는 스크롤을 건드리지 않는다', () => {
    renderAt('/a');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('다른 화면으로 이동하면 맨 위로 올린다', () => {
    renderAt('/a');
    fireEvent.click(screen.getByRole('button', { name: 'b로' }));
    expect(screen.getByRole('heading', { name: 'B' })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test('같은 화면에서 쿼리만 바뀌면 올리지 않는다', () => {
    renderAt('/b');
    fireEvent.click(screen.getByRole('button', { name: 'b 쿼리만' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('뒤로 가기(POP)에서는 브라우저 복원에 맡기고 올리지 않는다', () => {
    renderAt('/a');
    fireEvent.click(screen.getByRole('button', { name: 'b로' }));
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(screen.getByRole('heading', { name: 'A' })).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
