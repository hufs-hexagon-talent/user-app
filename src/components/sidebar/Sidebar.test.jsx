import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import CustomSidebar from './Sidebar';

// 배지는 UptimeRobot 을 부르므로 링크 검사에서는 뺀다.
jest.mock('./ServiceStatusBadge', () => () => null);

/*
 * /admin 은 admin-app 몫이고 이 앱의 관리자 화면은 /manage 아래에 있다.
 * 링크 하나라도 /admin 으로 돌아가면 nginx-proxy 가 그 요청을 admin-app 으로 보내
 * 없는 화면에 떨어진다 — 사이드바는 멀쩡히 뜨고 눌러야 알 수 있는 고장이라 여기서 묶어 고정한다.
 */
describe('관리자 사이드바 링크', () => {
  // 메뉴는 전부 접힌 채로 시작한다. 펼치기 버튼을 눌러야 Link 가 DOM 에 들어온다.
  const expandAll = () => {
    const opened = new Set();
    for (let round = 0; round < 5; round += 1) {
      const fresh = screen
        .queryAllByRole('button')
        .filter(button => !opened.has(button.textContent));
      if (fresh.length === 0) return;
      fresh.forEach(button => {
        opened.add(button.textContent);
        fireEvent.click(button);
      });
    }
  };

  const hrefsAfterExpanding = () => {
    render(
      <MemoryRouter initialEntries={['/manage/user-statics']}>
        <CustomSidebar />
      </MemoryRouter>,
    );
    expandAll();
    return screen.getAllByRole('link').map(link => link.getAttribute('href'));
  };

  it('모든 링크가 /manage 아래를 가리킨다', () => {
    const hrefs = hrefsAfterExpanding();

    // 링크를 하나도 못 찾으면 단언이 공회전하므로 개수부터 잡아 둔다.
    expect(hrefs.length).toBeGreaterThanOrEqual(10);
    hrefs.forEach(href => expect(href).toMatch(/^\/manage\//));
  });

  it('구 경로 /admin 을 가리키는 링크가 하나도 없다', () => {
    expect(hrefsAfterExpanding().filter(href => href.startsWith('/admin'))).toEqual([]);
  });
});
