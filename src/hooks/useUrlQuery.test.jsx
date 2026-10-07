import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import useUrlQuery from './useUrlQuery';

// 예약표는 주소에 date 가 없으면 오늘을 기본값으로 넘기고, 자정이 지나면 그 기본값을 바꾼다.
// 기본값이 바뀌면 값도 따라 바뀌어야 오늘 표로 넘어간다.
const Probe = ({ defaultValue }) => {
  const [value, update, isSet] = useUrlQuery('date', defaultValue);
  const location = useLocation();
  return (
    <div>
      <output data-testid="value">{value}</output>
      <output data-testid="isSet">{String(isSet)}</output>
      <output data-testid="search">{location.search}</output>
      <button type="button" onClick={() => update('2026-10-25')}>
        고정
      </button>
      <button type="button" onClick={() => update('')}>
        지우기
      </button>
    </div>
  );
};

const renderAt = (path, defaultValue) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Probe defaultValue={defaultValue} />
    </MemoryRouter>,
  );

const rerenderWith = (rerender, path, defaultValue) =>
  rerender(
    <MemoryRouter initialEntries={[path]}>
      <Probe defaultValue={defaultValue} />
    </MemoryRouter>,
  );

const text = id => screen.getByTestId(id).textContent;

describe('useUrlQuery', () => {
  it('주소에 값이 없으면 기본값을 쓰고, 기본값이 바뀌면 따라간다', () => {
    const { rerender } = renderAt('/', '2026-10-20');
    expect(text('value')).toBe('2026-10-20');
    expect(text('isSet')).toBe('false');

    rerenderWith(rerender, '/', '2026-10-21');

    expect(text('value')).toBe('2026-10-21');
  });

  it('주소에 값이 있으면 기본값이 바뀌어도 주소 값을 쓴다', () => {
    const { rerender } = renderAt('/?date=2026-10-20', '2026-10-20');
    expect(text('isSet')).toBe('true');

    rerenderWith(rerender, '/?date=2026-10-20', '2026-10-21');

    expect(text('value')).toBe('2026-10-20');
  });

  it('값을 적으면 바로 주소 값을 쓰고, 지우면 기본값으로 돌아간다', () => {
    renderAt('/?tab=1', '2026-10-20');

    fireEvent.click(screen.getByRole('button', { name: '고정' }));
    expect(text('value')).toBe('2026-10-25');
    expect(text('isSet')).toBe('true');
    expect(text('search')).toBe('?tab=1&date=2026-10-25');

    fireEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(text('value')).toBe('2026-10-20');
    expect(text('isSet')).toBe('false');
    expect(text('search')).toBe('?tab=1');
  });
});
